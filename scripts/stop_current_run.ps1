$TaskName = "SSL Monitor - Check Scheduled"
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
