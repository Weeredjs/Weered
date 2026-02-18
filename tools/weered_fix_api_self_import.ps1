param([switch]$Apply)

$indexPath = "C:\Weered\apps\api\src\index.ts"
if (-not [System.IO.File]::Exists($indexPath)) {
  throw "Missing: $indexPath"
}

function Backup-File([string]$path) {
  $stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
  $bak = $path + ".bak_" + $stamp
  [System.IO.File]::Copy($path, $bak, $true)
  return $bak
}

$lines = [System.IO.File]::ReadAllLines($indexPath, [System.Text.Encoding]::UTF8)

# Find any imports from './index' or "./index" (self import)
$importIdx = @()
$importIds = New-Object System.Collections.Generic.HashSet[string]

for ($i=0; $i -lt $lines.Length; $i++) {
  $ln = $lines[$i]

  if ($ln -match "^\s*import\s+.+\s+from\s+['""]\./index(\.ts)?['""]\s*;?\s*$") {
    $importIdx += $i

    # capture default import: import X from './index'
    $m = [regex]::Match($ln, "^\s*import\s+([A-Za-z0-9_\$]+)\s+from\s+['""]\./index")
    if ($m.Success) { [void]$importIds.Add($m.Groups[1].Value) }

    # capture named import: import { A, B as C } from './index'
    $m2 = [regex]::Match($ln, "^\s*import\s*{\s*([^}]+)\s*}\s*from\s+['""]\./index")
    if ($m2.Success) {
      $parts = $m2.Groups[1].Value.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
      foreach ($p in $parts) {
        if ($p -match "\bas\b") {
          $asParts = $p -split "\bas\b" | ForEach-Object { $_.Trim() }
          if ($asParts.Count -ge 2) { [void]$importIds.Add($asParts[1]) }
        } else {
          [void]$importIds.Add($p)
        }
      }
    }
  }
}

if ($importIdx.Count -eq 0) {
  Write-Host "No self-imports (from './index') found. Nothing to do."
  exit 0
}

Write-Host ""
Write-Host "Found self-import(s) in index.ts:"
foreach ($i in $importIdx) {
  Write-Host ("  L" + ($i+1) + ": " + $lines[$i])
}

Write-Host ""
Write-Host "Identifiers imported from './index':"
foreach ($id in $importIds) { Write-Host ("  - " + $id) }

# Build a set of line indexes to remove:
# - the import line(s)
# - any app.register(<id>) or <id>(app) lines for those ids
$remove = New-Object System.Collections.Generic.HashSet[int]
foreach ($i in $importIdx) { [void]$remove.Add($i) }

for ($i=0; $i -lt $lines.Length; $i++) {
  $ln = $lines[$i]
  foreach ($id in $importIds) {
    if ($ln -match ("app\.register\s*\(\s*" + [regex]::Escape($id) + "\s*\)\s*;?")) {
      [void]$remove.Add($i)
    }
    if ($ln -match ("^\s*" + [regex]::Escape($id) + "\s*\(\s*app\s*\)\s*;?\s*$")) {
      [void]$remove.Add($i)
    }
  }
}

Write-Host ""
Write-Host "Planned removals:"
($remove | Sort-Object) | ForEach-Object {
  Write-Host ("  L" + ($_+1) + ": " + $lines[$_])
}

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry run only. Apply with:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\tools\weered_fix_api_self_import.ps1 -Apply"
  exit 0
}

$bak = Backup-File $indexPath
Write-Host ""
Write-Host ("Backup created: " + $bak)

$out = New-Object System.Collections.Generic.List[string]
for ($i=0; $i -lt $lines.Length; $i++) {
  if ($remove.Contains($i)) { continue }
  $out.Add($lines[$i]) | Out-Null
}

# Light cleanup: collapse triple blank lines
$clean = New-Object System.Collections.Generic.List[string]
$blankRun = 0
foreach ($ln in $out) {
  if ([string]::IsNullOrWhiteSpace($ln)) {
    $blankRun++
    if ($blankRun -gt 2) { continue }
  } else {
    $blankRun = 0
  }
  $clean.Add($ln) | Out-Null
}

[System.IO.File]::WriteAllLines($indexPath, $clean.ToArray(), [System.Text.Encoding]::UTF8)
Write-Host ("Wrote: " + $indexPath)
Write-Host "Done."
