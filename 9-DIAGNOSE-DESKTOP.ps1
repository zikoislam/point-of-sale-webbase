# ===========================================================================
#  Unique POS - desktop startup diagnosis
#  Run on a new PC when the app shows:
#    "Check that port 5000 is free and that the database is reachable"
#  Best results: run as Administrator.
# ===========================================================================

$ErrorActionPreference = 'SilentlyContinue'
function Head($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Unique POS - Startup Diagnosis" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Head "[1] MongoDB Windows service"
$svc = Get-Service -Name MongoDB
if ($svc) {
  Write-Host ("    {0}: Status={1}  StartType={2}" -f $svc.Name, $svc.Status, $svc.StartType)
  if ($svc.Status -ne 'Running') {
    Write-Host "    PROBLEM: the MongoDB service is not running." -ForegroundColor Red
    Write-Host "    FIX: in an admin terminal run:  net start MongoDB" -ForegroundColor Red
    Write-Host "         (permanent: services.msc -> MongoDB -> Startup type = Automatic)" -ForegroundColor Red
  } else {
    Write-Host "    OK: MongoDB is running." -ForegroundColor Green
  }
} else {
  Write-Host "    PROBLEM: the MongoDB service is NOT installed." -ForegroundColor Red
  Write-Host "    FIX: install MongoDB Community Server and tick 'Install MongoDB as a Service'." -ForegroundColor Red
}

Head "[2] Ports (27017=DB, 5000=API, 3000=UI)"
foreach ($p in 27017, 5000, 3000) {
  $c = Get-NetTCPConnection -State Listen -LocalPort $p
  if ($c) {
    $pr = (Get-Process -Id $c[0].OwningProcess).ProcessName
    Write-Host ("    {0} : IN USE by {1}" -f $p, $pr) -ForegroundColor Yellow
  } else {
    Write-Host ("    {0} : free" -f $p) -ForegroundColor Green
  }
}

Head "[3] MongoDB reachable on 127.0.0.1:27017"
$reachable = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($reachable) { Write-Host "    reachable" -ForegroundColor Green }
else { Write-Host "    NOT reachable -> start the MongoDB service (see [1])" -ForegroundColor Red }

Head "[4] Replica set (rs0) - required for transactions"
$shell = Get-ChildItem "C:\Program Files\MongoDB\Server" -Recurse -Filter mongosh.exe | Select-Object -First 1
if (-not $shell) { $shell = Get-ChildItem "C:\Program Files\MongoDB\Server" -Recurse -Filter mongo.exe | Select-Object -First 1 }
if ($shell -and $reachable) {
  Write-Host ("    shell: {0}" -f $shell.FullName)
  $eval = 'try { rs.status().ok } catch (e) { 0 }'
  $res = & $shell.FullName --quiet --eval $eval
  Write-Host ("    rs.status().ok = {0}" -f $res)
  if ("$res" -notmatch '1') {
    Write-Host "    PROBLEM: the replica set is not initiated." -ForegroundColor Red
    Write-Host "    FIX: run 8-SETUP-MONGODB-REPLSET.bat as Administrator." -ForegroundColor Red
  } else {
    Write-Host "    OK: replica set is up." -ForegroundColor Green
  }
} else {
  Write-Host "    (mongosh not found, or the database is not reachable - skipped)"
}

Head "[5] App config"
$cfg = Join-Path $env:APPDATA 'Unique POS\config.json'
if (Test-Path $cfg) {
  $j = Get-Content $cfg -Raw | ConvertFrom-Json
  Write-Host ("    file          = {0}" -f $cfg)
  Write-Host ("    mongoMode     = {0}" -f $j.mongoMode)
  Write-Host ("    localMongoUri = {0}" -f $j.localMongoUri)
  Write-Host ("    cloudMongoUri = {0}" -f $j.cloudMongoUri)
  Write-Host ("    backendPort   = {0}" -f $j.backendPort)
} else {
  Write-Host ("    (no config.json yet at {0} - has the app been started?)" -f $cfg)
}

Head "[6] Application log (main.log) - last 45 lines"
$log = Join-Path $env:APPDATA 'Unique POS\logs\main.log'
if (Test-Path $log) {
  Get-Content $log -Tail 45
} else {
  Write-Host ("    (no main.log at {0})" -f $log)
}

Head "[7] MongoDB-related Windows services"
Get-Service | Where-Object { $_.Name -like '*Mongo*' -or $_.DisplayName -like '*Mongo*' } | Format-Table Name, Status, StartType -AutoSize

Write-Host ""
Write-Host "Done. If [1] / [4] / [6] show a problem, that is the cause." -ForegroundColor Cyan
Write-Host "Run this as Administrator for the fullest result." -ForegroundColor Cyan
Write-Host ""
