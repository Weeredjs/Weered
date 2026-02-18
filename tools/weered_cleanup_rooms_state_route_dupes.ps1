param(
  [switch]$Apply
)

function Write-Section([string]$t) {
  Write-Host ''
  Write-Host ('=' * 80)
  Write-Host $t
  Write-Host ('=' * 80)
}

function Get-TextFiles([string]$rootDir, [string[]]$exts) {
  Get-ChildItem -LiteralPath $rootDir -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $exts -contains $_.Extension.ToLowerInvariant() }
}

function Read-AllText([string]$path) {
  [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function Backup-File([string]$path) {
  $stamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
  $bak = $path + ".bak_" + $stamp
  [System.IO.File]::Copy($path, $bak, $true)
  return $bak
}

function Remove-RegisterBlocksForId([string[]]$lines, [string]$id, [int[]]$removeStartLinesZeroBased) {
  $toRemove = New-Object System.Collections.Generic.List[object]

  foreach ($start0 in $removeStartLinesZeroBased) {
    $i = $start0
    $balance = 0
    $foundEnd = $false
    $maxLookahead = [Math]::Min($lines.Length - 1, $i + 80)

    for ($j = $i; $j -le $maxLookahead; $j++) {
      $balance += ([regex]::Matches($lines[$j], '\(').Count - [regex]::Matches($lines[$j], '\)').Count)

      if ($lines[$j] -match '\);\s*$' -and $balance -le 0) {
        $toRemove.Add(@($i, $j))
        $foundEnd = $true
        break
      }
    }

    if (-not $foundEnd) {
      # Fallback: remove just the start line (safer than deleting a wrong block)
      $toRemove.Add(@($i, $i))
    }
  }

  # Merge overlapping ranges
  $ranges = $toRemove | Sort-Object { $_[0] }
  $merged = New-Object System.Collections.Generic.List[object]
  foreach ($r in $ranges) {
    if ($merged.Count -eq 0) { $merged.Add($r); continue }
    $last = $merged[$merged.Count - 1]
    if ($r[0] -le ($last[1] + 1)) {
      $last[1] = [Math]::Max($last[1], $r[1])
    } else {
      $merged.Add($r)
    }
  }

  $out = New-Object System.Collections.Generic.List[string]
  for ($k = 0; $k -lt $lines.Length; $k++) {
    $skip = $false
    foreach ($mr in $merged) {
      if ($k -ge $mr[0] -and $k -le $mr[1]) { $skip = $true; break }
    }
    if (-not $skip) { $out.Add($lines[$k]) }
  }

  # Trim excessive blank lines (keep it tidy)
  $final = New-Object System.Collections.Generic.List[string]
  $prevBlank = $false
  foreach ($ln in $out) {
    $isBlank = [string]::IsNullOrWhiteSpace($ln)
    if ($isBlank -and $prevBlank) { continue }
    $final.Add($ln)
    $prevBlank = $isBlank
  }

  return ,$final.ToArray()
}

Write-Section 'Weered Cleanup: dedupe /rooms/:roomId/state route registration'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$apiDir = Join-Path $repoRoot 'apps\api'
if (-not [System.IO.Directory]::Exists($apiDir)) {
  $apiDir = Join-Path $repoRoot 'api'
}
if (-not [System.IO.Directory]::Exists($apiDir)) {
  $apiDir = $repoRoot
  Write-Host "API folder not found at apps\api or api; scanning repo root: $apiDir"
} else {
  Write-Host "Scanning API folder: $apiDir"
}

$exts = @('.ts','.tsx','.js','.jsx','.mjs','.cjs')
$files = Get-TextFiles -rootDir $apiDir -exts $exts

# Find route definition file(s)
$needle = 'rooms/:roomId/state'
$routeDefCandidates = @()

foreach ($f in $files) {
  $txt = $null
  try { $txt = Read-AllText $f.FullName } catch { continue }
  if ($txt -like "*$needle*") {
    $routeDefCandidates += $f
  }
}

if ($routeDefCandidates.Count -eq 0) {
  Write-Host "No files mention '$needle' under: $apiDir"
  Write-Host "Nothing to do."
  exit 0
}

Write-Host ''
Write-Host 'Found route path mentions in:'
$routeDefCandidates | ForEach-Object { Write-Host (" - " + $_.FullName) }

# Pick the best "route plugin" file by heuristic (contains both GET and PUT for state)
function Score-RouteFile([string]$txt) {
  $score = 0
  if ($txt -match '\bget\s*\(' -or $txt -match '\.get\s*\(') { $score += 1 }
  if ($txt -match '\bput\s*\(' -or $txt -match '\.put\s*\(') { $score += 1 }
  if ($txt -match 'rooms/:roomId/state') { $score += 2 }
  if ($txt -match 'auth' -or $txt -match 'Bearer') { $score += 1 }
  return $score
}

$best = $null
$bestScore = -1
foreach ($c in $routeDefCandidates) {
  $t = Read-AllText $c.FullName
  $s = Score-RouteFile $t
  if ($s -gt $bestScore) { $bestScore = $s; $best = $c }
}

Write-Host ''
Write-Host ("Chosen route definition file: " + $best.FullName + " (score " + $bestScore + ")")

# Build an import hint (path after src/, no extension, forward slashes)
$bestPath = $best.FullName
$hint = $bestPath -replace '.*[\\/]src[\\/]', ''
$hint = $hint -replace '\.(ts|tsx|js|jsx|mjs|cjs)$',''
$hint = $hint -replace '\\','/'

Write-Host ("Import hint: " + $hint)

# Find files that import the route plugin (contain the hint in an import/require line)
$importingFiles = @()
foreach ($f in $files) {
  $lines = $null
  try { $lines = [System.IO.File]::ReadAllLines($f.FullName, [System.Text.Encoding]::UTF8) } catch { continue }
  foreach ($ln in $lines) {
    if ($ln -match '^\s*import\b' -or $ln -match 'require\s*\(') {
      if ($ln -like "*$hint*") { $importingFiles += $f; break }
    }
  }
}
$importingFiles = $importingFiles | Sort-Object FullName -Unique

if ($importingFiles.Count -eq 0) {
  Write-Host ''
  Write-Host 'Could not find any importers for the chosen route file.'
  Write-Host 'This usually means the route file is registered via a different path/alias.'
  Write-Host 'Run this script again after ensuring your imports contain the src-relative tail shown above.'
  exit 1
}

Write-Host ''
Write-Host 'Files importing the route plugin:'
$importingFiles | ForEach-Object { Write-Host (" - " + $_.FullName) }

# Extract imported identifiers from those files
$idsByFile = @{}
foreach ($f in $importingFiles) {
  $lines = [System.IO.File]::ReadAllLines($f.FullName, [System.Text.Encoding]::UTF8)
  $ids = New-Object System.Collections.Generic.List[string]

  foreach ($ln in $lines) {
    if ($ln -notmatch '^\s*import\b') { continue }
    if ($ln -notlike "*$hint*") { continue }

    # default import: import X from '...hint...'
    $m = [regex]::Match($ln, "^\s*import\s+([A-Za-z0-9_\$]+)\s+from\s+['""][^'""]*$([regex]::Escape($hint))[ ^'""]*['""]")
    if ($m.Success) {
      $ids.Add($m.Groups[1].Value) | Out-Null
      continue
    }

    # named import: import { A, B as C } from '...hint...'
    $m2 = [regex]::Match($ln, "^\s*import\s*{\s*([^}]+)\s*}\s*from\s+['""][^'""]*$([regex]::Escape($hint))[ ^'""]*['""]")
    if ($m2.Success) {
      $parts = $m2.Groups[1].Value.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
      foreach ($p in $parts) {
        # handle "X as Y"
        if ($p -match '\bas\b') {
          $asParts = $p -split '\bas\b' | ForEach-Object { $_.Trim() }
          if ($asParts.Count -ge 2) { $ids.Add($asParts[1]) | Out-Null }
        } else {
          $ids.Add($p) | Out-Null
        }
      }
    }
  }

  if ($ids.Count -gt 0) {
    $idsByFile[$f.FullName] = ($ids | Select-Object -Unique)
  }
}

if ($idsByFile.Keys.Count -eq 0) {
  Write-Host ''
  Write-Host 'Found importers but could not parse any imported identifiers.'
  Write-Host 'Nothing was changed.'
  exit 1
}

Write-Host ''
Write-Host 'Parsed route plugin identifiers:'
foreach ($k in $idsByFile.Keys) {
  Write-Host (" - " + $k)
  foreach ($id in $idsByFile[$k]) { Write-Host ("     * " + $id) }
}

# Find .register(...) occurrences for those identifiers
$occ = New-Object System.Collections.Generic.List[object]
foreach ($filePath in $idsByFile.Keys) {
  $lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)
  foreach ($id in $idsByFile[$filePath]) {
    for ($i = 0; $i -lt $lines.Length; $i++) {
      if ($lines[$i] -match "\.register\s*\(\s*$([regex]::Escape($id))\b") {
        $occ.Add([pscustomobject]@{
          File = $filePath
          Id = $id
          Line0 = $i
          Line1 = $i + 1
          Text = $lines[$i].Trim()
        }) | Out-Null
      }
    }
  }
}

if ($occ.Count -eq 0) {
  Write-Host ''
  Write-Host 'No app.register(...) calls found for the imported route plugin.'
  Write-Host 'Nothing to dedupe.'
  exit 0
}

Write-Host ''
Write-Host 'Found registrations:'
$occ | Sort-Object Id, File, Line0 | ForEach-Object {
  Write-Host (" - [" + $_.Id + "] " + $_.File + ":" + $_.Line1 + " :: " + $_.Text)
}

# Group by Id and dedupe (keep one canonical registration)
$groups = $occ | Group-Object Id
$changes = @()

foreach ($g in $groups) {
  $items = $g.Group | Sort-Object File, Line0
  if ($items.Count -le 1) { continue }

  # Choose canonical file to KEEP:
  # Prefer "routes" aggregators; otherwise file with most .register calls.
  $fileScores = @{}
  foreach ($it in $items) {
    if (-not $fileScores.ContainsKey($it.File)) {
      $all = [System.IO.File]::ReadAllLines($it.File, [System.Text.Encoding]::UTF8)
      $regCount = ($all | Select-String -Pattern '\.register\s*\(').Count
      $score = $regCount
      if ($it.File -match '[\\/]routes[\\/]' -or $it.File -match 'routes\.') { $score += 50 }
      if ($it.File -match 'index\.(ts|js)$') { $score += 15 }
      $fileScores[$it.File] = $score
    }
  }

  $keepFile = ($fileScores.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key
  $keep = ($items | Where-Object { $_.File -eq $keepFile } | Sort-Object Line0 | Select-Object -First 1)

  Write-Host ''
  Write-Host ("Keeping [" + $g.Name + "] in: " + $keep.File + ":" + $keep.Line1)
  Write-Host ("Removing other registrations for [" + $g.Name + "]")

  foreach ($it in $items) {
    if ($it.File -eq $keep.File -and $it.Line0 -eq $keep.Line0) { continue }
    $changes += [pscustomobject]@{ File = $it.File; Id = $g.Name; StartLine0 = $it.Line0; StartLine1 = $it.Line1 }
  }
}

if ($changes.Count -eq 0) {
  Write-Host ''
  Write-Host 'No duplicate registrations detected (per-Id).'
  exit 0
}

Write-Host ''
Write-Host 'Planned removals:'
$changes | Sort-Object File, StartLine0 | ForEach-Object {
  Write-Host (" - [" + $_.Id + "] " + $_.File + ":" + $_.StartLine1)
}

if (-not $Apply) {
  Write-Host ''
  Write-Host 'Dry run only. Re-run with -Apply to write changes:'
  Write-Host '  powershell -ExecutionPolicy Bypass -File .\tools\weered_cleanup_rooms_state_route_dupes.ps1 -Apply'
  exit 0
}

# Apply changes (by file)
$byFile = $changes | Group-Object File
foreach ($bf in $byFile) {
  $path = $bf.Name
  $lines = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)

  # backup
  $bak = Backup-File $path
  Write-Host ''
  Write-Host ("Backup: " + $bak)

  # group by Id to remove blocks for that Id
  $fileEdits = $bf.Group | Group-Object Id
  foreach ($fe in $fileEdits) {
    $id = $fe.Name
    $starts0 = $fe.Group | ForEach-Object { $_.StartLine0 }
    $lines = Remove-RegisterBlocksForId -lines $lines -id $id -removeStartLinesZeroBased $starts0
  }

  [System.IO.File]::WriteAllLines($path, $lines, [System.Text.Encoding]::UTF8)
  Write-Host ("Wrote: " + $path)
}

Write-Host ''
Write-Host 'Done. Restart API and confirm /rooms/:roomId/state works and is only registered once.'
