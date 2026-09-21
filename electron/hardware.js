'use strict';

/**
 * Real ESC/POS hardware access for the desktop app.
 *
 * Thermal printers do not understand a browser print dialog — they need raw
 * ESC/POS bytes written straight to the spooler. On Windows that means
 * winspool.drv's WritePrinter, which is reached through PowerShell's in-box
 * .NET compiler. This avoids a native npm module, so nothing has to be rebuilt
 * per Node/Electron version.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const CASH_DRAWER_KICK = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);

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

const WRITE_FAILURES = {
  1: 'printer could not be opened — check the printer name and that it is installed',
  2: 'the print job could not be started',
  3: 'the print page could not be started',
  4: 'the printer rejected the raw data (driver may not accept RAW mode)',
  5: 'only part of the receipt was accepted by the printer',
};

/** PowerShell single-quoted literal — the only escape needed is doubling '. */
const psLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

function runPowerShell(script, timeout = 30000) {
  return new Promise((resolve) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { timeout, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error && typeof error.code === 'number' ? error.code : error ? 1 : 0,
          stdout: String(stdout || '').trim(),
          stderr: String(stderr || '').trim() || (error ? error.message : ''),
        });
      }
    );
  });
}

/** Returns installed printers, marking the Windows default. */
async function listPrinters() {
  if (process.platform !== 'win32') {
    const result = await new Promise((resolve) => {
      execFile('lpstat', ['-p'], { timeout: 5000 }, (error, stdout) =>
        resolve({ ok: !error, stdout: String(stdout || '') })
      );
    });

    if (!result.ok) return { success: false, printers: [], error: 'No printers found.' };

    const printers = result.stdout
      .split('\n')
      .map((line) => /^printer (\S+)/.exec(line.trim()))
      .filter(Boolean)
      .map((match, index) => ({ name: match[1], isDefault: index === 0, portName: '' }));

    return { success: true, printers };
  }

  const script = `
$ErrorActionPreference = 'Stop'
$list = @()
foreach ($p in @(Get-CimInstance Win32_Printer)) {
  $list += [pscustomobject]@{
    name = $p.Name
    isDefault = [bool]$p.Default
    portName = [string]$p.PortName
    status = [string]$p.PrinterStatus
  }
}
ConvertTo-Json -InputObject @($list) -Compress
`;

  const result = await runPowerShell(script);

  if (!result.ok) {
    return { success: false, printers: [], error: result.stderr || 'Could not read the printer list.' };
  }

  try {
    const parsed = JSON.parse(result.stdout || '[]');
    const printers = (Array.isArray(parsed) ? parsed : [parsed])
      .filter((p) => p && p.name)
      .map((p) => ({ name: p.name, isDefault: p.isDefault, portName: p.portName || '' }));

    return { success: true, printers };
  } catch (err) {
    return { success: false, printers: [], error: 'Could not parse the printer list.' };
  }
}

async function resolvePrinterName(printerName) {
  if (printerName) return printerName;

  const { printers } = await listPrinters();
  const fallback = printers.find((p) => p.isDefault) || printers[0];
  return fallback ? fallback.name : null;
}

/**
 * Writes raw ESC/POS bytes to a printer.
 * @param {string|undefined} printerName  Blank uses the system default printer.
 * @param {Uint8Array|number[]} bytes
 * @param {string} docName
 */
async function printRaw(printerName, bytes, docName = 'Unique POS Receipt') {
  const buffer = Buffer.from(bytes);

  if (buffer.length === 0) {
    return { success: false, error: 'Nothing to print — the receipt payload was empty.' };
  }

  const target = await resolvePrinterName(printerName);

  if (!target) {
    return { success: false, error: 'No printer is installed on this computer.' };
  }

  const tempFile = path.join(os.tmpdir(), `unique-pos-${crypto.randomUUID()}.bin`);
  fs.writeFileSync(tempFile, buffer);

  try {
    if (process.platform !== 'win32') {
      const result = await new Promise((resolve) => {
        execFile(
          'lp',
          ['-d', target, '-o', 'raw', tempFile],
          { timeout: 20000 },
          (error, stdout, stderr) =>
            resolve({ ok: !error, error: String(stderr || (error && error.message) || '').trim() })
        );
      });

      return result.ok
        ? { success: true, printerName: target, bytes: buffer.length }
        : { success: false, printerName: target, error: result.error || 'Printing failed.' };
    }

    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
${RAW_PRINTER_HELPER}
'@
$bytes = [System.IO.File]::ReadAllBytes(${psLiteral(tempFile)})
$code = [RawPrinterHelper]::SendBytes(${psLiteral(target)}, $bytes, ${psLiteral(docName)})
if ($code -ne 0) { Write-Error ("RAW_PRINT_FAILED:" + $code); exit 1 }
Write-Output 'PRINT_OK'
`;

    const result = await runPowerShell(script);

    if (result.ok && result.stdout.includes('PRINT_OK')) {
      return { success: true, printerName: target, bytes: buffer.length };
    }

    const match = /RAW_PRINT_FAILED:(\d+)/.exec(result.stderr);
    const reason = match ? WRITE_FAILURES[match[1]] : null;

    return {
      success: false,
      printerName: target,
      error: reason || result.stderr || 'The printer did not accept the receipt.',
    };
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

/**
 * Kicks the cash drawer open. The drawer hangs off the receipt printer's RJ11
 * port, so the pulse is delivered as a raw print job.
 */
async function kickCashDrawer(printerName) {
  return printRaw(printerName, CASH_DRAWER_KICK, 'Unique POS Cash Drawer');
}

module.exports = { listPrinters, printRaw, kickCashDrawer, CASH_DRAWER_KICK };
