param(
  [string]$Repo = "C:\Weered"
)

Write-Host "Starting infra..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @('-NoExit','-Command', "cd `"$Repo`"; docker compose up -d")

Write-Host "Starting API..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @('-NoExit','-Command', "cd `"$Repo\apps\api`"; pnpm dev")

Write-Host "Starting Web..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @('-NoExit','-Command', "cd `"$Repo\apps\web`"; pnpm dev")

Write-Host "Done. Web: http://127.0.0.1:3000  API: http://127.0.0.1:4000/health  WS: ws://127.0.0.1:4001" -ForegroundColor Green
