# ===========================================================================
#  BDBBC POS (offline .exe) - CLEAN DATABASE on this PC
#
#  Wipes the LOCAL database of the installed desktop app so the next launch
#  starts empty (roles + default organization + one super admin only).
#
#  Why the older scripts failed:
#    - they looked for the process "Unique*", but the app is now "BDBBC POS"
#    - they never stopped the BUNDLED mongod, which keeps db\ locked, so the
#      folder could not be moved and nothing was actually cleaned
#
#  This script stops the app AND its bundled mongod, waits for the lock to
#  clear, then backs up the old database and restores your license.key.
#  It never touches the cloud / web project.
#
#  Best: right-click CLEAN-EXE-DB.bat -> "Run as administrator".
# ===========================================================================

$ErrorActionPreference = 'SilentlyContinue'

$appData = Join-Path $env:APPDATA 'BDBBC POS'
$stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'

Write-Host '=================================================='
Write-Host ' BDBBC POS - CLEAN LOCAL DATABASE'
Write-Host '=================================================='
Write-Host ' This ERASES the shop data on THIS PC:'
Write-Host '   products, barcodes, customers, sales, users, stock.'
Write-Host ' A backup of the old database is kept first.'
Write-Host ' Your license.key is kept.'
Write-Host ''
Write-Host " App data folder: $appData"
Write-Host ''

if (-not (Test-Path $appData)) {
  Write-Host 'Nothing to clean - the app has never run on this PC.'
  return
}

$ans = Read-Host 'Type YES to continue'
if ($ans -ne 'YES') {
  Write-Host 'Cancelled - nothing changed.'
  return
}

# ---------------------------------------------------------------------------
# 1) Stop the app and ONLY its bundled mongod
# ---------------------------------------------------------------------------
function Get-AppProcesses {
  param([string]$DataDir)
  Get-CimInstance Win32_Process | Where-Object {
    if ($_.Name -eq 'BDBBC POS.exe' -or $_.Name -eq 'BDBBC POS Desktop.exe') { return $true }
    if ($_.Name -eq 'mongod.exe') {
      # The bundled mongod lives inside the app folder and points its dbpath at
      # %APPDATA%\BDBBC POS. A shop's own MongoDB service must NOT be touched.
      if ($_.ExecutablePath -and $_.ExecutablePath -like '*BDBBC POS*') { return $true }
      if ($_.CommandLine  -and $_.CommandLine  -like "*$DataDir*")     { return $true }
    }
    # The spawned backend / frontend node servers live under <install>\resources.
    if ($_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine -like '*BDBBC POS\resources*') {
      return $true
    }
    return $false
  }
}

Write-Host ''
Write-Host '[1/4] Stopping BDBBC POS and its database...'
for ($i = 1; $i -le 3; $i++) {
  $procs = @(Get-AppProcesses -DataDir $appData)
  if ($procs.Count -eq 0) { break }
  foreach ($p in $procs) {
    Write-Host ("      stopping {0} (pid {1})" -f $p.Name, $p.ProcessId)
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
}

# Wait until the lock is actually released (up to ~15s).
$left = @(Get-AppProcesses -DataDir $appData)
for ($i = 0; $i -lt 15 -and $left.Count -gt 0; $i++) {
  Start-Sleep -Seconds 1
  $left = @(Get-AppProcesses -DataDir $appData)
}
if ($left.Count -gt 0) {
  Write-Host ''
  Write-Host '  Could not stop these processes - close BDBBC POS manually and run again:'
  foreach ($p in $left) { Write-Host ("    {0} (pid {1})" -f $p.Name, $p.ProcessId) }
  return
}
Start-Sleep -Seconds 1

# ---------------------------------------------------------------------------
# 2) Back up + remove the local database
# ---------------------------------------------------------------------------
Write-Host '[2/4] Removing the local database...'
$db  = Join-Path $appData 'db'
$bak = Join-Path $appData ("db-backup-$stamp")

if (Test-Path $db) {
  $moved = $false
  for ($i = 1; $i -le 3; $i++) {
    try {
      Move-Item -LiteralPath $db -Destination $bak -Force -ErrorAction Stop
      $moved = $true
      break
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  if ($moved) {
    Write-Host "      old database backed up to: $bak"
  } else {
    Write-Host ''
    Write-Host '  The database folder is still locked.'
    Write-Host '  Close BDBBC POS completely (check the taskbar / Task Manager), then run this again.'
    Write-Host "  Folder: $db"
    return
  }
} else {
  Write-Host '      no local database folder found (already clean).'
}

# ---------------------------------------------------------------------------
# 3) Make sure no cloud URI can pull old data back in
# ---------------------------------------------------------------------------
Write-Host '[3/4] Checking config.json...'
$cfg = Join-Path $appData 'config.json'
if (Test-Path $cfg) {
  Copy-Item -LiteralPath $cfg -Destination "$cfg.bak-$stamp" -Force
  try {
    $j = Get-Content $cfg -Raw | ConvertFrom-Json
    $j.cloudMongoUri = ''
    $j.mongoMode     = 'bundled'
    if ($j.PSObject.Properties.Name -contains 'edition') { $j.edition = 'offline' }
    # Write WITHOUT a BOM - the app parses this with JSON.parse.
    [System.IO.File]::WriteAllText($cfg, ($j | ConvertTo-Json -Depth 12))
    Write-Host '      cloud URI cleared, mode set to bundled (config.json backed up).'
  } catch {
    Write-Host "      could not edit config.json: $($_.Exception.Message)"
  }
} else {
  Write-Host '      no config.json yet (the app will create a fresh one).'
}

# ---------------------------------------------------------------------------
# 4) Confirm
# ---------------------------------------------------------------------------
Write-Host '[4/4] Verifying...'
if (Test-Path $db) {
  Write-Host '      WARNING: db\ still exists - something still holds it.'
  Write-Host '      Reboot the PC and run this script once more.'
} else {
  Write-Host '      OK - the local database is gone.'
}

$key = Join-Path $appData 'license.key'
if (Test-Path $key) {
  Write-Host '      license.key is still in place.'
} else {
  Write-Host '      no license.key found - the app will ask for your key on launch.'
}

Write-Host ''
Write-Host '=================================================='
Write-Host ' DONE - BDBBC POS will start with a clean database.'
Write-Host ''
Write-Host ' Next:'
Write-Host '   1) Open BDBBC POS'
Write-Host '   2) Sign in with  admin / Admin@123   (PIN 0000)'
Write-Host '   3) Change that password immediately'
Write-Host '   4) Create a CASHIER user for the counter, then add'
Write-Host '      your products and customers'
Write-Host ''
Write-Host " Old data backup: $bak"
Write-Host ' Delete that folder later if you no longer need it.'
Write-Host '=================================================='
