#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Removes the Firmly-Queue Windows Service and Firmly-Scheduler Task Scheduler entry.

.USAGE
    powershell -ExecutionPolicy Bypass -File scripts\uninstall-services.ps1
#>

param(
    [string]$NssmPath = "C:\nssm\nssm.exe"
)

$ErrorActionPreference = "Continue"

# Stop & remove queue service
Write-Host "Stopping and removing Firmly-Queue service..." -ForegroundColor Yellow
if (Test-Path $NssmPath) {
    & $NssmPath stop   Firmly-Queue 2>&1 | Out-Null
    & $NssmPath remove Firmly-Queue confirm 2>&1 | Out-Null
} else {
    & sc.exe stop   Firmly-Queue 2>&1 | Out-Null
    & sc.exe delete Firmly-Queue 2>&1 | Out-Null
}
Write-Host "Firmly-Queue removed." -ForegroundColor Green

# Remove scheduled task
Write-Host "Removing Firmly-Scheduler task..." -ForegroundColor Yellow
Unregister-ScheduledTask -TaskName "Firmly-Scheduler" -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Firmly-Scheduler removed." -ForegroundColor Green

Write-Host ""
Write-Host "All Firmly production services uninstalled." -ForegroundColor Cyan
