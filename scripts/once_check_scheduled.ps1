# Exécute 1 fois la commande Django "check_scheduled" et loggue la sortie

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONUTF8 = "1"

$REPO_ROOT = Split-Path -Parent $PSScriptRoot
$DJANGO_DIR = Join-Path $REPO_ROOT "django-core"
$MANAGE     = Join-Path $DJANGO_DIR "manage.py"
$PY         = Join-Path $REPO_ROOT "venv\Scripts\python.exe"

$LOG_DIR  = Join-Path $REPO_ROOT "logs"
$LOG_FILE = Join-Path $LOG_DIR  "check_scheduled.log"
New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null

function TS { Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffffffK" }
Add-Content -Path $LOG_FILE -Value "[$(TS)] task run start"

Push-Location $DJANGO_DIR
try {
  & $PY -X utf8 -u $MANAGE check_scheduled 2>&1 |
    Tee-Object -FilePath $LOG_FILE -Append
}
finally {
  Pop-Location | Out-Null
  Add-Content -Path $LOG_FILE -Value "[$(TS)] task run end"
  Add-Content -Path $LOG_FILE -Value "----"
}
