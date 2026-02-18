param([switch]$Apply)

$srcDir   = "C:\Weered\apps\api\src"
$indexTs  = Join-Path $srcDir "index.ts"
if (-not [System.IO.File]::Exists($indexTs)) { throw "Missing: $indexTs" }

function Backup-File([string]$path) {
  $stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
  $bak = $path + ".bak_" + $stamp
  [System.IO.File]::Copy($path, $bak, $true)
  return $bak
}

function ReadUtf8([string]$path) { [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8) }

function Find-RouteFiles([string]$needle) {
  $files = Get-ChildItem -LiteralPath $srcDir -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -eq ".ts" -or $_.Extension -eq ".tsx" }
  $hits = @()
  foreach ($f in $files) {
    if ($f.FullName -eq $indexTs) { continue } # IMPORTANT: avoid self-match
    $t = $null
    try { $t = ReadUtf8 $f.FullName } catch { continue }
    if ($t -like ("*" + $needle + "*")) { $hits += $f.FullName }
  }
  return $hits | Sort-Object -Unique
}

function SrcImportPath([string]$filePath) {
  $rel = $filePath.Substring($srcDir.Length).TrimStart('\','/')
  $rel = $rel -replace '\.(ts|tsx)$',''
  $rel = $rel -replace '\\','/'
  return "./" + $rel
}

function Get-ExportInfo([string]$routeFile, [string]$fallbackBase) {
  $txt = ReadUtf8 $routeFile

  if ($txt -match "export\s+default") {
    return [pscustomobject]@{ id = ($fallbackBase + "Routes"); isDefault = $true; callStyle = "register" }
  }

  $m1 = [regex]::Match($txt, "export\s+const\s+([A-Za-z0-9_]+)")
  if ($m1.Success) { return [pscustomobject]@{ id = $m1.Groups[1].Value; isDefault = $false; callStyle = "register" } }

  $m2 = [regex]::Match($txt, "export\s+function\s+([A-Za-z0-9_]+)")
  if ($m2.Success) {
    $name = $m2.Groups[1].Value
    # If it's a plain function that uses app.get/app.put, call it; otherwise register it.
    if ($txt -match "\bapp\.(get|put|post|delete)\s*\(") {
      return [pscustomobject]@{ id = $name; isDefault = $false; callStyle = "call" }
    }
    return [pscustomobject]@{ id = $name; isDefault = $false; callStyle = "register" }
  }

  return [pscustomobject]@{ id = ($fallbackBase + "Routes"); isDefault = $true; callStyle = "register" }
}

Write-Host ""
Write-Host ("="*80)
Write-Host "Weered API Fix: clean dangling register + wire rooms routes"
Write-Host ("="*80)

$lines = [System.IO.File]::ReadAllLines($indexTs, [System.Text.Encoding]::UTF8)

# 1) Remove any self-import from './index' (if exists)
$removeIdx = New-Object System.Collections.Generic.HashSet[int]
for ($i=0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match "^\s*import\s+.+\s+from\s+['""]\./index(\.ts)?['""]\s*;?\s*$") {
    [void]$removeIdx.Add($i)
  }
}

# 2) Build sets of defined + imported identifiers
$imported = New-Object System.Collections.Generic.HashSet[string]
$defined  = New-Object System.Collections.Generic.HashSet[string]

for ($i=0; $i -lt $lines.Length; $i++) {
  $ln = $lines[$i]

  # default import: import X from './x'
  $m = [regex]::Match($ln, "^\s*import\s+([A-Za-z0-9_\$]+)\s+from\s+['""][^'""]+['""]")
  if ($m.Success) { [void]$imported.Add($m.Groups[1].Value) }

  # named import: import { A, B as C } from './x'
  $m2 = [regex]::Match($ln, "^\s*import\s*{\s*([^}]+)\s*}\s*from\s+['""][^'""]+['""]")
  if ($m2.Success) {
    $parts = $m2.Groups[1].Value.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    foreach ($p in $parts) {
      if ($p -match "\bas\b") {
        $asParts = $p -split "\bas\b" | ForEach-Object { $_.Trim() }
        if ($asParts.Count -ge 2) { [void]$imported.Add($asParts[1]) }
      } else {
        [void]$imported.Add($p)
      }
    }
  }

  # defined symbols (very rough but good enough): const NAME / function NAME
  $d1 = [regex]::Match($ln, "^\s*(export\s+)?const\s+([A-Za-z0-9_]+)\b")
  if ($d1.Success) { [void]$defined.Add($d1.Groups[2].Value) }

  $d2 = [regex]::Match($ln, "^\s*(export\s+)?function\s+([A-Za-z0-9_]+)\b")
  if ($d2.Success) { [void]$defined.Add($d2.Groups[2].Value) }
}

# 3) Remove any dangling app.register(X) or X(app) where X is not imported/defined
for ($i=0; $i -lt $lines.Length; $i++) {
  $ln = $lines[$i]

  $r1 = [regex]::Match($ln, "app\.register\s*\(\s*([A-Za-z0-9_]+)\s*\)\s*;?")
  if ($r1.Success) {
    $id = $r1.Groups[1].Value
    if (-not $imported.Contains($id) -and -not $defined.Contains($id)) {
      [void]$removeIdx.Add($i)
    }
  }

  $r2 = [regex]::Match($ln, "^\s*([A-Za-z0-9_]+)\s*\(\s*app\s*\)\s*;?\s*$")
  if ($r2.Success) {
    $id = $r2.Groups[1].Value
    if (-not $imported.Contains($id) -and -not $defined.Contains($id)) {
      [void]$removeIdx.Add($i)
    }
  }
}

# 4) Discover route files (excluding index.ts)
$stateFiles = Find-RouteFiles "rooms/:roomId/state"
$msgFiles   = Find-RouteFiles "rooms/:roomId/messages"

Write-Host ""
Write-Host "Route files found:"
Write-Host ("  state:    " + ($(if($stateFiles.Count){$stateFiles[0]}else{"<none>"})))
Write-Host ("  messages: " + ($(if($msgFiles.Count){$msgFiles[0]}else{"<none>"})))

# We'll wire at most 1 file per route type
$wires = @()
if ($stateFiles.Count -gt 0) { $wires += [pscustomobject]@{ kind="state"; file=$stateFiles[0] } }
if ($msgFiles.Count -gt 0 -and ($msgFiles[0] -ne ($stateFiles[0]))) { $wires += [pscustomobject]@{ kind="messages"; file=$msgFiles[0] } }

# Find listen line index
$listenIdx = -1
for ($i=0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match "await\s+app\.listen\s*\(" -or $lines[$i] -match "\.listen\s*\(") { $listenIdx = $i; break }
}
if ($listenIdx -lt 0) { throw "Could not find app.listen(...) in index.ts" }
$listenIndent = ([regex]::Match($lines[$listenIdx], "^\s*")).Value

# Prepare inserts: imports + wiring statements
$importInserts = New-Object System.Collections.Generic.List[string]
$wireInserts   = New-Object System.Collections.Generic.List[string]

foreach ($w in $wires) {
  $importPath = SrcImportPath $w.file
  $base = [System.IO.Path]::GetFileNameWithoutExtension($w.file)
  $fallback = ("rooms_" + $w.kind + "_" + $base)
  $exp = Get-ExportInfo $w.file $fallback

  # ensure we do NOT import from './index'
  if ($importPath -eq "./index") { continue }

  $importLine = $(if($exp.isDefault) { "import " + $exp.id + " from '" + $importPath + "';" } else { "import { " + $exp.id + " } from '" + $importPath + "';" })

  $hasImport = $false
  foreach ($ln in $lines) { if ($ln -like ("*from '" + $importPath + "'*") -or $ln -like ("*from """ + $importPath + """*")) { $hasImport = $true; break } }
  if (-not $hasImport) { $importInserts.Add($importLine) | Out-Null }

  $stmt = $(if($exp.callStyle -eq "call") { $exp.id + "(app);" } else { "app.register(" + $exp.id + ");" })

  $hasStmt = $false
  foreach ($ln in $lines) { if ($ln -match [regex]::Escape($stmt)) { $hasStmt = $true; break } }
  if (-not $hasStmt) { $wireInserts.Add($listenIndent + $stmt) | Out-Null }
}

# Insert imports after last import
if ($importInserts.Count -gt 0) {
  $lastImport = -1
  for ($i=0; $i -lt $lines.Length; $i++) { if ($lines[$i] -match "^\s*import\b") { $lastImport = $i } }
  if ($lastImport -lt 0) { throw "No imports found in index.ts" }

  $out = New-Object System.Collections.Generic.List[string]
  for ($i=0; $i -lt $lines.Length; $i++) {
    $out.Add($lines[$i]) | Out-Null
    if ($i -eq $lastImport) {
      foreach ($il in $importInserts) { $out.Add($il) | Out-Null }
    }
  }
  $lines = $out.ToArray()
}

# Recompute listenIdx after possible import insertion
$listenIdx = -1
for ($i=0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match "await\s+app\.listen\s*\(" -or $lines[$i] -match "\.listen\s*\(") { $listenIdx = $i; break }
}

# Insert wiring statements right before listen
if ($wireInserts.Count -gt 0) {
  $out = New-Object System.Collections.Generic.List[string]
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($i -eq $listenIdx) {
      $out.Add("") | Out-Null
      foreach ($wl in $wireInserts) { $out.Add($wl) | Out-Null }
      $out.Add("") | Out-Null
    }
    $out.Add($lines[$i]) | Out-Null
  }
  $lines = $out.ToArray()
}

# Apply removals
if ($removeIdx.Count -gt 0) {
  Write-Host ""
  Write-Host "Removing broken lines:"
  ($removeIdx | Sort-Object) | ForEach-Object { Write-Host ("  L" + ($_+1) + ": " + $lines[$_]) }
}

$final = New-Object System.Collections.Generic.List[string]
for ($i=0; $i -lt $lines.Length; $i++) {
  if ($removeIdx.Contains($i)) { continue }
  $final.Add($lines[$i]) | Out-Null
}

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry run complete. Apply with:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\tools\weered_api_fix_boot_and_rooms.ps1 -Apply"
  exit 0
}

$bak = Backup-File $indexTs
Write-Host ""
Write-Host ("Backup: " + $bak)

[System.IO.File]::WriteAllLines($indexTs, $final.ToArray(), [System.Text.Encoding]::UTF8)
Write-Host ("Wrote: " + $indexTs)
Write-Host "Done."
