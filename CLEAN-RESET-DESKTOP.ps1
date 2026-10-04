# ===========================================================================
#  BDBBC POS - clean reset (fresh database, super admin only)
#  Run on the PC whose data you want to wipe. Best: right-click the .bat ->
#  "Run as administrator".
# ===========================================================================

$ErrorActionPreference = 'SilentlyContinue'
$app   = Join-Path $env:APPDATA 'BDBBC POS'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

Write-Host '=================================================='
Write-Host ' BDBBC POS - CLEAN RESET'
Write-Host ' This ERASES all shop data on this PC:'
Write-Host '   products, barcodes, customers, sales, users.'
Write-Host ' A backup of the local database is kept first.'
Write-Host '=================================================='
Write-Host ''

if (-not (Test-Path $app)) {
  Write-Host "Nothing to reset - $app does not exist."
  return
}

$ans = Read-Host 'Type YES to continue'
if ($ans -ne 'YES') { Write-Host 'Cancelled - nothing changed.'; return }

# 1) Stop the app so its files are not locked.
Write-Host ''
Write-Host 'Stopping BDBBC POS...'
Get-Process | Where-Object { $_.ProcessName -like 'Unique*' } | Stop-Process -Force
Start-Sleep -Seconds 2

# 2) Back up and remove the local (bundled) database.
$db = Join-Path $app 'db'
if (Test-Path $db) {
  $bak = Join-Path $app "db-backup-$stamp"
  Move-Item $db $bak -Force
  Write-Host "Local database backed up to: $bak"
} else {
  Write-Host 'No local database folder (the bundled DB was not used).'
}

# 3) Clear the cloud sync URI so old cloud data cannot come back.
$cfg = Join-Path $app 'config.json'
if (Test-Path $cfg) {
  Copy-Item $cfg "$cfg.bak-$stamp" -Force
  try {
    $j = Get-Content $cfg -Raw | ConvertFrom-Json
    $j.cloudMongoUri = ''
    $json = $j | ConvertTo-Json -Depth 12
    # Write WITHOUT a BOM - the app uses JSON.parse and a BOM would break it.
    [System.IO.File]::WriteAllText($cfg, $json)
    Write-Host 'Cloud sync URI cleared (config.json backed up).'
  } catch {
    Write-Host "Could not edit config.json: $($_.Exception.Message)"
  }
}

# 4) If the external MongoDB edition is used, drop its pos_db database.
$shell = Get-ChildItem 'C:\Program Files\MongoDB\Server' -Recurse -Filter mongosh.exe | Select-Object -First 1
if (-not $shell) { $shell = Get-ChildItem 'C:\Program Files\MongoDB\Server' -Recurse -Filter mongo.exe | Select-Object -First 1 }
$up = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($shell -and $up) {
  & $shell.FullName --quiet --eval "db.getSiblingDB('pos_db').dropDatabase()"
  Write-Host 'External MongoDB: pos_db dropped.'
} elseif ($up) {
  Write-Host 'External MongoDB is running but no mongosh/mongo shell was found.'
  Write-Host 'Drop it manually:  mongosh pos_db --eval "db.dropDatabase()"'
} else {
  Write-Host 'External MongoDB is not running - nothing to drop there.'
  Write-Host 'If you use the external edition, start the MongoDB service and run:'
  Write-Host '   mongosh pos_db --eval "db.dropDatabase()"'
}

Write-Host ''
Write-Host 'Done. Open BDBBC POS now - it builds a clean database:'
Write-Host '   - roles, default organization, settings, chart of accounts'
Write-Host '   - one super admin:  admin / Admin@123'
Write-Host '   - no products, no barcodes, no customers, no sales'
Write-Host 'Change the admin password right after you sign in.'
Write-Host ''
