param(
  [switch]$Apply
)

function Find-WebDir([string]$repoRoot) {
  $a = Join-Path $repoRoot 'apps\web'
  if ([System.IO.Directory]::Exists($a)) { return $a }
  $b = Join-Path $repoRoot 'apps/web'
  if ([System.IO.Directory]::Exists($b)) { return $b }
  return $null
}

function Backup-File([string]$path) {
  $stamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
  $bak = $path + ".bak_" + $stamp
  [System.IO.File]::Copy($path, $bak, $true)
  return $bak
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$webDir = Find-WebDir $repoRoot
if (-not $webDir) {
  Write-Host 'Could not find web folder at apps\web or apps/web.'
  exit 1
}

$exts = @('.ts','.tsx','.js','.jsx')
$files = Get-ChildItem -LiteralPath $webDir -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $exts -contains $_.Extension.ToLowerInvariant() }

$hits = @()
foreach ($f in $files) {
  $txt = $null
  try { $txt = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8) } catch { continue }
  if ($txt -like "*weered:lastRoomId*") {
    # Prefer the home redirect logic: also references localStorage + router/redirect
    $score = 0
    if ($txt -like "*localStorage.getItem*") { $score += 2 }
    if ($txt -like "*router.push*" -or $txt -like "*redirect(*") { $score += 2 }
    if ($txt -like "*weered:token*" -or $txt -like "*token*") { $score += 1 }
    $hits += [pscustomobject]@{ File = $f.FullName; Score = $score }
  }
}

if ($hits.Count -eq 0) {
  Write-Host 'No files referenced weered:lastRoomId. Nothing to patch.'
  exit 0
}

$target = ($hits | Sort-Object Score -Descending | Select-Object -First 1).File
Write-Host ("Target file: " + $target)

$txt2 = [System.IO.File]::ReadAllText($target, [System.Text.Encoding]::UTF8)
if ($txt2 -like "*get('stay')*" -or $txt2 -like "*stay=1*") {
  Write-Host 'stay guard already present. Nothing to do.'
  exit 0
}

$lines = [System.IO.File]::ReadAllLines($target, [System.Text.Encoding]::UTF8)

# Find the line that reads localStorage.getItem('weered:lastRoomId')
$idx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match "localStorage\.getItem\(\s*['""]weered:lastRoomId['""]\s*\)") {
    $idx = $i
    break
  }
}

if ($idx -lt 0) {
  Write-Host 'Could not locate localStorage.getItem("weered:lastRoomId") line. Nothing to patch.'
  exit 1
}

$indent = ([regex]::Match($lines[$idx], '^\s*')).Value
$insert = @(
  ($indent + "const stay = new URLSearchParams(window.location.search).get('stay') === '1';"),
  ($indent + "if (stay) return;"),
  ""
)

Write-Host ''
Write-Host ('Inserting stay guard above line ' + ($idx + 1) + ':')
$insert | ForEach-Object { Write-Host ('  ' + $_) }

if (-not $Apply) {
  Write-Host ''
  Write-Host 'Dry run only. Re-run with -Apply to write changes:'
  Write-Host '  powershell -ExecutionPolicy Bypass -File .\tools\weered_add_stay_escape.ps1 -Apply'
  exit 0
}

$bak = Backup-File $target
Write-Host ("Backup: " + $bak)

$newLines = New-Object System.Collections.Generic.List[string]
for ($j = 0; $j -lt $lines.Length; $j++) {
  if ($j -eq $idx) {
    foreach ($ln in $insert) { $newLines.Add($ln) | Out-Null }
  }
  $newLines.Add($lines[$j]) | Out-Null
}

[System.IO.File]::WriteAllLines($target, $newLines.ToArray(), [System.Text.Encoding]::UTF8)
Write-Host ("Wrote: " + $target)
