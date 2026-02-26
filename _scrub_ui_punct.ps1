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

function ScrubText {
  param([string]$TextIn)
  $t = $TextIn

  # Replace smart punctuation with ASCII (string overloads)
  $t = $t.Replace([string][char]0x2022, "-")    # bullet
  $t = $t.Replace([string][char]0x00B7, ".")    # middle dot
  $t = $t.Replace([string][char]0x2014, "--")   # em dash
  $t = $t.Replace([string][char]0x2013, "-")    # en dash
  $t = $t.Replace([string][char]0x2026, "...")  # ellipsis

  # Common mojibake sequences (ASCII only)
  $t = $t.Replace("???", "--")
  $t = $t.Replace("????????", "--")
  $t = $t.Replace("???", "-")
  $t = $t.Replace("????????", "-")
  $t = $t.Replace("???", "...")
  $t = $t.Replace("???????", "...")
  $t = $t.Replace("????????????????????", "--")

  return $t
}

$WebRoot = "C:\Weered\apps\web"
$Targets = @(
  (Join-Path $WebRoot "components\RightRail.tsx"),
  (Join-Path $WebRoot "components\LobbyHeaderBar.tsx"),
  (Join-Path $WebRoot "components\weeredUi.ts")
)

foreach ($p in $Targets) {
  if (!(Test-Path -LiteralPath $p)) {
    Write-Host ("Skip (missing): " + $p) -ForegroundColor Yellow
    continue
  }

  BackupFile -PathIn $p -Tag "scrub_punct"
  $txt = Get-Content -Raw -LiteralPath $p
  $fixed = ScrubText -TextIn $txt
  SaveUtf8NoBom -PathOut $p -TextOut $fixed
  Write-Host ("Patched: " + $p) -ForegroundColor Green
}

Write-Host "DONE. Restart web and hard refresh." -ForegroundColor Green
