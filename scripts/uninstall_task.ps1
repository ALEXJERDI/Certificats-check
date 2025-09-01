$TaskName = "SSL Monitor - Check Scheduled"
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "🧹 Tâche supprimée."
} else {
  Write-Host "ℹ️ Tâche introuvable."
}
