param([switch]$Apply)

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
if (-not $webDir) { Write-Host 'Web folder not found.'; exit 1 }

# Discover token key by scanning localStorage.setItem('weered:...')
$exts = @('.ts','.tsx','.js','.jsx')
$files = Get-ChildItem -LiteralPath $webDir -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $exts -contains $_.Extension.ToLowerInvariant() }

$weeredKeys = New-Object System.Collections.Generic.HashSet[string]
foreach ($f in $files) {
  $t = $null
  try { $t = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8) } catch { continue }
  $ms = [regex]::Matches($t, "localStorage\.setItem\(\s*['""](weered:[^'""]+)['""]")
  foreach ($m in $ms) { [void]$weeredKeys.Add($m.Groups[1].Value) }
}

$tokenKey = $weeredKeys | Where-Object { $_ -match 'token' } | Select-Object -First 1
if (-not $tokenKey) { $tokenKey = 'weered:token' }

Write-Host ("Detected token key: " + $tokenKey)

# Find the Home redirect file (mentions lastRoomId + router.push/redirect)
$hits = @()
foreach ($f in $files) {
  $txt = $null
  try { $txt = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8) } catch { continue }
  if ($txt -like "*weered:lastRoomId*") {
    $score = 0
    if ($txt -like "*localStorage.getItem*") { $score += 2 }
    if ($txt -like "*router.push*" -or $txt -like "*redirect(*" -or $txt -like "*router.replace*") { $score += 2 }
    if ($txt -like "*stay*" -and $txt -like "*URLSearchParams*") { $score += 1 }
    $hits += [pscustomobject]@{ File = $f.FullName; Score = $score }
  }
}

if ($hits.Count -eq 0) { Write-Host 'No lastRoomId references found.'; exit 1 }

$target = ($hits | Sort-Object Score -Descending | Select-Object -First 1).File
Write-Host ("Target file: " + $target)

$lines = [System.IO.File]::ReadAllLines($target, [System.Text.Encoding]::UTF8)

# Find the line that reads lastRoomId
$idx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match "localStorage\.getItem\(\s*['""]weered:lastRoomId['""]\s*\)") { $idx = $i; break }
}
if ($idx -lt 0) { Write-Host 'Could not find localStorage.getItem("weered:lastRoomId")'; exit 1 }

# Prevent double insert
for ($k = [Math]::Max(0, $idx - 8); $k -lt $idx; $k++) {
  if ($lines[$k] -match [regex]::Escape($tokenKey) -and $lines[$k] -match "localStorage\.getItem") {
    Write-Host 'Token guard already present near redirect. Nothing to do.'
    exit 0
  }
}

$indent = ([regex]::Match($lines[$idx], '^\s*')).Value
$insert = @(
  ($indent + "const token = localStorage.getItem('" + $tokenKey + "');"),
  ($indent + "if (!token) return;"),
  ""
)

Write-Host ""
Write-Host ("Inserting token guard above line " + ($idx + 1) + ":")
$insert | ForEach-Object { Write-Host ("  " + $_) }

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry run only. Apply with:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\tools\weered_fix_autojump_requires_token.ps1 -Apply"
  exit 0
}

$bak = Backup-File $target
Write-Host ("Backup: " + $bak)

$newLines = New-Object System.Collections.Generic.List[string]
for ($j = 0; $j -lt $lines.Length; $j++) {
  if ($j -eq $idx) { foreach ($ln in $insert) { [void]$newLines.Add($ln) } }
  [void]$newLines.Add($lines[$j])
}

[System.IO.File]::WriteAllLines($target, $newLines.ToArray(), [System.Text.Encoding]::UTF8)
Write-Host ("Wrote: " + $target)
