# 毎日 23:00 JST に実行される日次バッチ — タスクスケジューラーから呼び出し
$envLines = Get-Content "$PSScriptRoot\..\..\..\saku\.env"
$secret = ($envLines | Where-Object { $_ -match '^CRON_SECRET=' } | ForEach-Object { ($_ -split '=',2)[1].Trim() })
$bypassSecret = ($envLines | Where-Object { $_ -match '^VERCEL_PROTECTION_BYPASS_SECRET=' } | ForEach-Object { ($_ -split '=',2)[1].Trim() })
$url = "https://u3lab-board.vercel.app/api/daily-gcal-draft"

try {
  $res = Invoke-RestMethod -Uri $url -Method POST `
    -Headers @{ Authorization = "Bearer $secret"; "Content-Type" = "application/json"; "x-vercel-protection-bypass" = $bypassSecret } `
    -Body "{}" `
    -ErrorAction Stop

  $log = "$(Get-Date -Format 'yyyy-MM-dd HH:mm') ok=$($res.ok) fail=$($res.fail) total=$($res.total) date=$($res.date)"
  Write-Host $log
  Add-Content -Path "$PSScriptRoot\daily-gcal-draft.log" -Value $log
} catch {
  $err = "$(Get-Date -Format 'yyyy-MM-dd HH:mm') ERROR: $_"
  Write-Host $err
  Add-Content -Path "$PSScriptRoot\daily-gcal-draft.log" -Value $err
}
