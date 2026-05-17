#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Installs Firmly queue worker and scheduler as Windows Services using NSSM.

.DESCRIPTION
    Run once on the production server (as Administrator) to register:
      - Firmly-Queue   : php artisan queue:work  (persistent service, auto-restarts)
      - Firmly-Scheduler: runs php artisan schedule:run every minute via Task Scheduler

.USAGE
    powershell -ExecutionPolicy Bypass -File scripts\install-services.ps1

    Optional overrides:
      -PhpPath    "C:\laragon\bin\php\php8.3\php.exe"
      -AppPath    "C:\laragon\www\Firmly\backend"
      -NssmPath   "C:\nssm\nssm.exe"
#>

param(
    [string]$PhpPath   = "C:\laragon\bin\php\php8.3\php.exe",
    [string]$AppPath   = "C:\laragon\www\Firmly\backend",
    [string]$NssmPath  = "C:\nssm\nssm.exe"
)

$ErrorActionPreference = "Stop"

# ── Validation ───────────────────────────────────────────────────────────────

if (-not (Test-Path $PhpPath)) {
    # Try to auto-detect the latest PHP in Laragon
    $found = Get-ChildItem "C:\laragon\bin\php" -Filter "php.exe" -Recurse -ErrorAction SilentlyContinue |
             Sort-Object FullName -Descending | Select-Object -First 1
    if ($found) {
        $PhpPath = $found.FullName
        Write-Host "Auto-detected PHP: $PhpPath" -ForegroundColor Cyan
    } else {
        Write-Error "PHP not found at $PhpPath. Pass -PhpPath to override."
    }
}

if (-not (Test-Path "$AppPath\artisan")) {
    Write-Error "artisan not found in $AppPath. Pass -AppPath to override."
}

if (-not (Test-Path $NssmPath)) {
    Write-Host ""
    Write-Host "NSSM not found at $NssmPath." -ForegroundColor Yellow
    Write-Host "Download from https://nssm.cc/download and extract nssm.exe, then re-run." -ForegroundColor Yellow
    Write-Host "Or install via Scoop:  scoop install nssm" -ForegroundColor Cyan
    Write-Host "Or install via Choco:  choco install nssm" -ForegroundColor Cyan
    exit 1
}

$ArtisanPath = "$AppPath\artisan"
$LogDir      = "$AppPath\storage\logs"

# ── Helper ───────────────────────────────────────────────────────────────────

function Install-NssmService {
    param([string]$Name, [string]$Description, [string]$Arguments)

    $exists = & sc.exe query $Name 2>&1
    if ($exists -match "SERVICE_NAME") {
        Write-Host "Removing existing service: $Name" -ForegroundColor Yellow
        & $NssmPath stop $Name | Out-Null
        & $NssmPath remove $Name confirm | Out-Null
    }

    Write-Host "Installing service: $Name" -ForegroundColor Green
    & $NssmPath install $Name $PhpPath $Arguments
    & $NssmPath set $Name AppDirectory $AppPath
    & $NssmPath set $Name Description $Description
    & $NssmPath set $Name Start SERVICE_AUTO_START
    & $NssmPath set $Name AppStdout "$LogDir\$Name-stdout.log"
    & $NssmPath set $Name AppStderr "$LogDir\$Name-stderr.log"
    & $NssmPath set $Name AppStdoutCreationDisposition 4   # append
    & $NssmPath set $Name AppStderrCreationDisposition 4
    & $NssmPath set $Name AppRotateFiles 1
    & $NssmPath set $Name AppRotateBytes 10485760           # rotate at 10 MB
    & $NssmPath set $Name AppRestartDelay 5000              # 5 s before restart
}

# ── 1. Queue Worker Service ───────────────────────────────────────────────────

Install-NssmService `
    -Name        "Firmly-Queue" `
    -Description "Firmly Laravel queue worker (email sync, background jobs)" `
    -Arguments   "$ArtisanPath queue:work --tries=3 --timeout=120 --sleep=3 --max-time=3600"

# Restart the service every hour (--max-time=3600) to clear memory leaks.
# NSSM will relaunch it automatically.

Write-Host "Starting Firmly-Queue..." -ForegroundColor Cyan
& $NssmPath start Firmly-Queue

# ── 2. Scheduler via Task Scheduler (runs every minute) ──────────────────────

$TaskName = "Firmly-Scheduler"

# Remove if already registered
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction `
    -Execute          $PhpPath `
    -Argument         "$ArtisanPath schedule:run --no-interaction" `
    -WorkingDirectory $AppPath

# Repeat every 1 minute, indefinitely
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval  (New-TimeSpan -Minutes 1) `
    -RepetitionDuration  ([TimeSpan]::MaxValue)

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit  (New-TimeSpan -Minutes 1) `
    -MultipleInstances   IgnoreNew `
    -RunOnlyIfNetworkAvailable $false

Register-ScheduledTask `
    -TaskName    $TaskName `
    -Description "Firmly Laravel scheduler — fires every minute" `
    -Action      $action `
    -Trigger     $trigger `
    -Settings    $settings `
    -RunLevel    Highest `
    -Force | Out-Null

Write-Host "Scheduled task '$TaskName' registered (every 1 minute)." -ForegroundColor Green

# ── Summary ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Firmly production services installed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Queue worker   : Windows Service 'Firmly-Queue'  (auto-start, auto-restart)"
Write-Host "  Scheduler      : Task Scheduler  'Firmly-Scheduler' (every 1 min)"
Write-Host ""
Write-Host "  Logs           : $LogDir\Firmly-Queue-stdout.log"
Write-Host "  Manage queue   : sc start/stop/query Firmly-Queue"
Write-Host "  Failed jobs    : php artisan queue:failed"
Write-Host "  Retry failed   : php artisan queue:retry all"
Write-Host ""
Write-Host "To uninstall run: scripts\uninstall-services.ps1" -ForegroundColor Yellow
