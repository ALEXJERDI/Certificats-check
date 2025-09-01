# Create/Update a Windows Scheduled Task to run run_check_scheduled.ps1 every hour.

# --- paths ---
$TaskName    = "SSL Monitor - Check Scheduled"
$PSScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script      = Join-Path $PSScriptDir "run_check_scheduled.ps1"
$PSExe       = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path $Script)) {
  Write-Host "Script not found: $Script" -ForegroundColor Red
  exit 1
}

# --- delete old task if present (do NOT stop on error here) ---
$oldEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"

schtasks.exe /Query /TN "$TaskName" >$null 2>&1
if ($LASTEXITCODE -eq 0) {
  schtasks.exe /Delete /TN "$TaskName" /F >$null 2>&1
}

$ErrorActionPreference = $oldEAP  # restore

# --- create hourly task ---
# Important: keep quotes around the -File path
$TR = "$PSExe -NoProfile -ExecutionPolicy Bypass -File `"$Script`""

# Runs every hour while user is logged on; limited privileges
$createArgs = @(
  "/Create",
  "/TN", "$TaskName",
  "/SC", "HOURLY",
  "/MO", "1",
  "/TR", "$TR",
  "/IT",
  "/RL", "LIMITED",
  "/F"
)

schtasks.exe @createArgs | Out-Null

# --- start immediately (optional) ---
schtasks.exe /Run /TN "$TaskName" | Out-Null

Write-Host "Task installed and started: $TaskName"
Write-Host "Script launched: $Script"

# --- show next run and remaining time ---
try {
  # give the scheduler a second to compute NextRunTime
  Start-Sleep -Seconds 1

  $svc  = New-Object -ComObject "Schedule.Service"
  $svc.Connect()
  $task = $svc.GetFolder("\").GetTask($TaskName)
  $next = [datetime]$task.NextRunTime

  if (-not $next -or $next -eq [datetime]::MinValue) {
    Write-Host "Next run time not available yet."
  } else {
    $now  = Get-Date
    $left = $next - $now
    $line = "Next run: {0} | Remaining: {1}d {2:00}h {3:00}m {4:00}s" -f ($next.ToString("yyyy-MM-dd HH:mm:ss")), $left.Days, $left.Hours, $left.Minutes, $left.Seconds
    Write-Host $line
  }
}
catch {
  Write-Host "Failed to query next run time: $_" -ForegroundColor Yellow
}
