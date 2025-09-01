# C:\Users\SALAH\ssl-monitor\scripts\run_check_scheduled.ps1
param(
  [int]$IntervalSeconds = 3600  # 3600s = 1h
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Paths ---
$REPO_ROOT = "C:\Users\SALAH\ssl-monitor"
$DJANGO_DIR = Join-Path $REPO_ROOT "django-core"
$MANAGE     = Join-Path $DJANGO_DIR "manage.py"
$VENV_PY    = Join-Path $REPO_ROOT "venv\Scripts\python.exe"
$PY         = if (Test-Path $VENV_PY) { $VENV_PY } else { "python" }

$LOG_DIR  = Join-Path $REPO_ROOT "logs"
$LOG_FILE = Join-Path $LOG_DIR  "check_scheduled.log"
New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null

# --- UTF-8 everywhere (evite UnicodeEncodeError) ---
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONUTF8 = "1"

# --- Single instance guard (évite deux scripts en même temps) ---
$mutexName = "Global\sslmon_check_scheduled_runner"
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($false, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
  Write-Host "Une autre instance est déjà en cours. Arrêt."
  exit 1
}

function Timestamp { Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffffffK" }

Write-Host  "Boucle lancée. Intervalle = $IntervalSeconds s. Log = $LOG_FILE"
Add-Content -Path $LOG_FILE -Value "[$(Timestamp)] service start (interval=$IntervalSeconds)"

try {
  while ($true) {
    $ts = Timestamp
    Add-Content -Path $LOG_FILE -Value "[$ts] start"

    try {
      Push-Location $DJANGO_DIR

      # -X utf8 : force UTF-8 ; -u : stdout/stderr non bufferisés
      # Tee-Object : écrit à la fois dans la console et dans le fichier log
      & $PY -X utf8 -u $MANAGE check_scheduled 2>&1 |
        Tee-Object -FilePath $LOG_FILE -Append
    }
    catch {
      $msg = ($_ | Out-String)
      Add-Content -Path $LOG_FILE -Value "[$(Timestamp)] ERROR: $msg"
      Write-Host "ERROR: $msg"
    }
    finally {
      Pop-Location | Out-Null
      Add-Content -Path $LOG_FILE -Value "[$(Timestamp)] done"
      Add-Content -Path $LOG_FILE -Value "----"
    }

    Start-Sleep -Seconds $IntervalSeconds
  }
}
finally {
  Add-Content -Path $LOG_FILE -Value "[$(Timestamp)] service stop"
  if ($mutex) { $mutex.ReleaseMutex(); $mutex.Dispose() }
}
