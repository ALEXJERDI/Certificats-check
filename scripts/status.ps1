$TaskName = "SSL Monitor - Check Scheduled"
Get-ScheduledTask -TaskName $TaskName
Get-ScheduledTaskInfo -TaskName $TaskName | Format-List *
Write-Host "`nDernières lignes du log:`n"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Get-Content (Join-Path $RepoRoot "logs\check_scheduled.log") -Tail 50
