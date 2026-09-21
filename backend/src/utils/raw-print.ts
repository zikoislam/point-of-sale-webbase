import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

/**
 * Raw printer access for the case where the API and the printer live on the
 * same computer (the desktop install), so a receipt can be sent without going
 * through the Electron IPC bridge.
 *
 * ESC/POS printers ignore a normal print dialog — bytes have to reach the
 * spooler untouched, hence WritePrinter on Windows and `lp -o raw` elsewhere.
 */

export const CASH_DRAWER_KICK = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);

const RAW_PRINTER_HELPER = `
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFOW
    {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true,
        CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true,
        ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true,
        CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOW di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true,
        ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true,
        ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true,
        ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true,
        ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static int SendBytes(string printerName, byte[] bytes, string docName)
    {
        IntPtr hPrinter = IntPtr.Zero;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return 1;

        try
        {
            DOCINFOW di = new DOCINFOW();
            di.pDocName = docName;
            di.pDataType = "RAW";

            if (!StartDocPrinter(hPrinter, 1, ref di)) return 2;

            try
            {
                if (!StartPagePrinter(hPrinter)) return 3;

                IntPtr pUnmanaged = Marshal.AllocCoTaskMem(bytes.Length);
                try
                {
                    Marshal.Copy(bytes, 0, pUnmanaged, bytes.Length);
                    int written;
                    if (!WritePrinter(hPrinter, pUnmanaged, bytes.Length, out written)) return 4;
                    if (written != bytes.Length) return 5;
                }
                finally
                {
                    Marshal.FreeCoTaskMem(pUnmanaged);
                }

                EndPagePrinter(hPrinter);
            }
            finally
            {
                EndDocPrinter(hPrinter);
            }
        }
        finally
        {
            ClosePrinter(hPrinter);
        }

        return 0;
    }
}
`;

const WRITE_FAILURES: Record<string, string> = {
  '1': 'printer could not be opened — check the printer name and that it is installed',
  '2': 'the print job could not be started',
  '3': 'the print page could not be started',
  '4': 'the printer rejected the raw data (driver may not accept RAW mode)',
  '5': 'only part of the receipt was accepted by the printer',
};

const psLiteral = (value: string) => `'${String(value).replace(/'/g, "''")}'`;

export interface PrintResult {
  success: boolean;
  printerName?: string;
  bytes?: number;
  error?: string;
}

export interface PrinterInfo {
  name: string;
  isDefault: boolean;
  portName?: string;
}

function run(command: string, args: string[], timeout = 30000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || '').trim(),
        stderr: String(stderr || '').trim() || (error ? error.message : ''),
      });
    });
  });
}

function runPowerShell(script: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');

  return run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-EncodedCommand',
    encoded,
  ]);
}

export async function listPrinters(): Promise<PrinterInfo[]> {
  if (process.platform !== 'win32') {
    const result = await run('lpstat', ['-p'], 5000);
    if (!result.ok) return [];

    return result.stdout
      .split('\n')
      .map((line) => /^printer (\S+)/.exec(line.trim()))
      .filter((match): match is RegExpExecArray => Boolean(match))
      .map((match, index) => ({ name: match[1], isDefault: index === 0 }));
  }

  const result = await runPowerShell(`
$list = @()
foreach ($p in @(Get-CimInstance Win32_Printer)) {
  $list += [pscustomobject]@{ name = $p.Name; isDefault = [bool]$p.Default; portName = [string]$p.PortName }
}
ConvertTo-Json -InputObject @($list) -Compress
`);

  if (!result.ok) return [];

  try {
    const parsed = JSON.parse(result.stdout || '[]');
    return (Array.isArray(parsed) ? parsed : [parsed])
      .filter((printer: any) => printer && printer.name)
      .map((printer: any) => ({
        name: printer.name,
        isDefault: Boolean(printer.isDefault),
        portName: printer.portName || '',
      }));
  } catch {
    return [];
  }
}

async function resolvePrinterName(printerName?: string): Promise<string | null> {
  if (printerName) return printerName;

  const printers = await listPrinters();
  const fallback = printers.find((printer) => printer.isDefault) || printers[0];
  return fallback ? fallback.name : null;
}

export async function printRaw(
  printerName: string | undefined,
  bytes: Uint8Array | number[],
  docName = 'Unique POS Receipt'
): Promise<PrintResult> {
  const buffer = Buffer.from(bytes);

  if (buffer.length === 0) {
    return { success: false, error: 'Nothing to print — the payload was empty.' };
  }

  const target = await resolvePrinterName(printerName);

  if (!target) {
    return { success: false, error: 'No printer is installed on this computer.' };
  }

  const tempFile = path.join(os.tmpdir(), `unique-pos-${crypto.randomUUID()}.bin`);
  fs.writeFileSync(tempFile, buffer);

  try {
    if (process.platform !== 'win32') {
      const result = await run('lp', ['-d', target, '-o', 'raw', tempFile], 20000);

      return result.ok
        ? { success: true, printerName: target, bytes: buffer.length }
        : { success: false, printerName: target, error: result.stderr || 'Printing failed.' };
    }

    const result = await runPowerShell(`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
${RAW_PRINTER_HELPER}
'@
$bytes = [System.IO.File]::ReadAllBytes(${psLiteral(tempFile)})
$code = [RawPrinterHelper]::SendBytes(${psLiteral(target)}, $bytes, ${psLiteral(docName)})
if ($code -ne 0) { Write-Error ("RAW_PRINT_FAILED:" + $code); exit 1 }
Write-Output 'PRINT_OK'
`);

    if (result.ok && result.stdout.includes('PRINT_OK')) {
      return { success: true, printerName: target, bytes: buffer.length };
    }

    const match = /RAW_PRINT_FAILED:(\d+)/.exec(result.stderr);

    return {
      success: false,
      printerName: target,
      error: (match && WRITE_FAILURES[match[1]]) || result.stderr || 'The printer did not accept the receipt.',
    };
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

export async function kickCashDrawer(printerName?: string): Promise<PrintResult> {
  return printRaw(printerName, CASH_DRAWER_KICK, 'Unique POS Cash Drawer');
}
