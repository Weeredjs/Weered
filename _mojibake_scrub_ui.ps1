$ErrorActionPreference = "Stop"

function SaveUtf8NoBom {
  param([string]$PathOut, [string]$TextOut)
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllBytes($PathOut, $enc.GetBytes($TextOut))
}

function BackupFile {
  param([string]$PathIn, [string]$Tag)
  if (!(Test-Path -LiteralPath $PathIn)) { throw ("Missing: " + $PathIn) }
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = $PathIn + ".bak_" + $Tag + "_" + $ts
  Copy-Item -LiteralPath $PathIn -Destination $bak -Force
  Write-Host ("Backup: " + $bak)
}

function Scrub {
  param([string]$s)
  $t = $s
  $t = $t.Replace("???????","...")
  $t = $t.Replace("???????????????","...")
  $t = $t.Replace("????????","--")
  $t = $t.Replace("???????????????????","--")
  $t = $t.Replace("????????","-")
  $t = $t.Replace("??????????????????","-")
  $t = $t.Replace("???????","'").Replace("????????","'")
  $t = $t.Replace("???????????????","'").Replace("??????????????????","'")
  $t = $t.Replace("??","")
  return $t
}

$Targets = @(
  "C:\Weered\apps\web\components\LobbyRoomsList.tsx",
  "C:\Weered\apps\web\components\DockShell.tsx",
  "C:\Weered\apps\web\components\DockDrawer.tsx",
  "C:\Weered\apps\web\components\LobbyChatPanel.tsx"
) | Where-Object { Test-Path -LiteralPath $_ }

foreach ($p in $Targets) {
  BackupFile -PathIn $p -Tag "mojibake_scrub"
  $txt = Get-Content -Raw -LiteralPath $p
  $fixed = Scrub -s $txt
  SaveUtf8NoBom -PathOut $p -TextOut $fixed
  Write-Host ("Patched: " + $p)
}

Write-Host "DONE. Restart web and hard refresh." -ForegroundColor Green
