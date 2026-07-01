# 日次バッチ「02行動_下書き」Gcal書き込みをタスクスケジューラーに登録する
# 実行: pwsh -ExecutionPolicy Bypass -File tools\setup-daily-gcal-draft.ps1

$taskName = "U3LAB-DailyGcalDraft"
$scriptPath = "$PSScriptRoot\run-daily-gcal-draft.ps1"
$time = "23:00"

# 既存タスクを削除
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest
Write-Host "Registered: $taskName at $time JST"
