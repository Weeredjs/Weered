param([switch]$Apply)

function Backup-File([string]$path) {
  $stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
  $bak = $path + ".bak_" + $stamp
  [System.IO.File]::Copy($path, $bak, $true)
  return $bak
}

function Read-Utf8([string]$path) {
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function Write-Utf8Lines([string]$path, [string[]]$lines) {
  [System.IO.File]::WriteAllLines($path, $lines, [System.Text.Encoding]::UTF8)
}

function Find-FirstFileContaining([string]$root, [string]$needle) {
  $exts = @(".ts",".tsx",".js",".jsx",".mjs",".cjs")
  $files = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $exts -contains $_.Extension.ToLowerInvariant() }

  foreach ($f in $files) {
    $t = $null
    try { $t = Read-Utf8 $f.FullName } catch { continue }
    if ($t -like ("*" + $needle + "*")) { return $f.FullName }
  }
  return $null
}

function SrcImportPath([string]$srcDir, [string]$filePath) {
  # index.ts is in $srcDir; route file is under $srcDir\...
  $rel = $filePath.Substring($srcDir.Length).TrimStart('\','/')
  $rel = $rel -replace '\.(ts|tsx|js|jsx|mjs|cjs)$',''
  $rel = $rel -replace '\\','/'
  return "./" + $rel
}

function Pick-ExportId([string]$routeFile, [string]$fallbackBase) {
  $txt = Read-Utf8 $routeFile
  if ($txt -match "export\s+default") {
    # default export — we'll import as <FallbackBase>Routes
    return ($fallbackBase + "Routes"), $true
  }

  $m1 = [regex]::Match($txt, "export\s+const\s+([A-Za-z0-9_]+)")
  if ($m1.Success) { return $m1.Groups[1].Value, $false }

  $m2 = [regex]::Match($txt, "export\s+function\s+([A-Za-z0-9_]+)")
  if ($m2.Success) { return $m2.Groups[1].Value, $false }

  # give up: treat as default
  return ($fallbackBase + "Routes"), $true
}

function Ensure-ImportAndRegister([string]$indexPath, [string]$importPath, [string]$importId, [bool]$isDefault) {
  $lines = [System.IO.File]::ReadAllLines($indexPath, [System.Text.Encoding]::UTF8)

  $alreadyImport = $false
  foreach ($ln in $lines) {
    if ($ln -like ("*from '" + $importPath + "'*") -or $ln -like ("*from """ + $importPath + """*")) {
      $alreadyImport = $true; break
    }
  }

  $alreadyRegister = $false
  foreach ($ln in $lines) {
    if ($ln -match ("\.\s*register\s*\(\s*" + [regex]::Escape($importId) + "\b")) {
      $alreadyRegister = $true; break
    }
  }

  $changed = $false
  $out = New-Object System.Collections.Generic.List[string]

  # Insert import after last top import
  if (-not $alreadyImport) {
    $inserted = $false
    $lastImportIdx = -1
    for ($i=0; $i -lt $lines.Length; $i++) {
      if ($lines[$i] -match "^\s*import\b") { $lastImportIdx = $i; continue }
      if ($lastImportIdx -ge 0) { break }
    }

    for ($i=0; $i -lt $lines.Length; $i++) {
      $out.Add($lines[$i]) | Out-Null
      if ($i -eq $lastImportIdx -and -not $inserted) {
        if ($isDefault) {
          $out.Add("import " + $importId + " from '" + $importPath + "';") | Out-Null
        } else {
          $out.Add("import { " + $importId + " } from '" + $importPath + "';") | Out-Null
        }
        $inserted = $true
        $changed = $true
      }
    }

    $lines = $out.ToArray()
    $out = New-Object System.Collections.Generic.List[string]
  }

  # Insert app.register(...) before app.listen(...)
  if (-not $alreadyRegister) {
    $listenIdx = -1
    for ($i=0; $i -lt $lines.Length; $i++) {
      if ($lines[$i] -match "\.listen\s*\(" -or $lines[$i] -match "await\s+app\.listen") { $listenIdx = $i; break }
    }
    if ($listenIdx -lt 0) {
      throw "Could not find app.listen(...) in index.ts to insert register call."
    }

    $indent = ([regex]::Match($lines[$listenIdx], "^\s*")).Value

    for ($i=0; $i -lt $lines.Length; $i++) {
      if ($i -eq $listenIdx) {
        $out.Add($indent + "app.register(" + $importId + ");") | Out-Null
        $out.Add("") | Out-Null
        $changed = $true
      }
      $out.Add($lines[$i]) | Out-Null
    }

    $lines = $out.ToArray()
  }

  return ,@($lines, $changed)
}

function Ensure-RoomUpsert-Before-MessageCreate([string]$indexPath) {
  $lines = [System.IO.File]::ReadAllLines($indexPath, [System.Text.Encoding]::UTF8)
  $idx = -1
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "prisma\.message\.create\s*\(") { $idx = $i; break }
  }
  if ($idx -lt 0) { return ,@($lines, $false, "No prisma.message.create() found") }

  # Avoid double insert
  for ($k=[Math]::Max(0,$idx-6); $k -lt $idx; $k++) {
    if ($lines[$k] -match "prisma\.room\.upsert" -or $lines[$k] -match "ensureRoom") {
      return ,@($lines, $false, "Room upsert already present near message.create")
    }
  }

  $indent = ([regex]::Match($lines[$idx], "^\s*")).Value

  $insert = @(
    ($indent + "// Ensure Room exists before inserting messages (prevents FK crash)"),
    ($indent + "await prisma.room.upsert({ where: { id: roomId }, update: {}, create: { id: roomId } });"),
    ""
  )

  $out = New-Object System.Collections.Generic.List[string]
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($i -eq $idx) { foreach ($ln in $insert) { $out.Add($ln) | Out-Null } }
    $out.Add($lines[$i]) | Out-Null
  }

  return ,@($out.ToArray(), $true, "Inserted room upsert before prisma.message.create")
}

Write-Host ""
Write-Host ("="*80)
Write-Host "Weered API Fix: restore /rooms routes + prevent Prisma FK crash"
Write-Host ("="*80)

$apiSrc = "C:\Weered\apps\api\src"
$indexPath = Join-Path $apiSrc "index.ts"
if (-not [System.IO.File]::Exists($indexPath)) { throw "Missing: $indexPath" }

# Find route definition files
$stateRoute = Find-FirstFileContaining $apiSrc "rooms/:roomId/state"
$messagesRoute = Find-FirstFileContaining $apiSrc "rooms/:roomId/messages"

Write-Host ""
Write-Host ("State route file: " + ($stateRoute ?? "<not found>"))
Write-Host ("Messages route file: " + ($messagesRoute ?? "<not found>"))

if (-not $stateRoute -and -not $messagesRoute) {
  throw "Could not find route definitions for state/messages under apps\api\src. (They may have been deleted.)"
}

$pending = @()

if ($stateRoute) { $pending += [pscustomobject]@{ Kind="state"; File=$stateRoute } }
if ($messagesRoute -and $messagesRoute -ne $stateRoute) { $pending += [pscustomobject]@{ Kind="messages"; File=$messagesRoute } }

$indexLines = [System.IO.File]::ReadAllLines($indexPath, [System.Text.Encoding]::UTF8)
$indexChanged = $false

foreach ($p in $pending) {
  $importPath = SrcImportPath $apiSrc $p.File
  $base = [System.IO.Path]::GetFileNameWithoutExtension($p.File)
  $fallback = "weered_" + $p.Kind + "_" + $base
  $pick = Pick-ExportId $p.File $fallback
  $importId = $pick[0]
  $isDefault = [bool]$pick[1]

  Write-Host ""
  Write-Host ("Will ensure registered: " + $p.Kind)
  Write-Host ("  importPath: " + $importPath)
  Write-Host ("  importId:   " + $importId + ($(if($isDefault){" (default)"}else{" (named)"})))

  $res = Ensure-ImportAndRegister $indexPath $importPath $importId $isDefault
  $indexLines = $res[0]
  if ($res[1]) { $indexChanged = $true }
  # Write back to temp for subsequent inserts
  [System.IO.File]::WriteAllLines($indexPath, $indexLines, [System.Text.Encoding]::UTF8)
}

# Patch Prisma FK crash
$res2 = Ensure-RoomUpsert-Before-MessageCreate $indexPath
$indexLines = $res2[0]
$fkChanged = $res2[1]
$fkMsg = $res2[2]

Write-Host ""
Write-Host ("FK patch: " + $fkMsg)

$finalChanged = ($indexChanged -or $fkChanged)

if (-not $finalChanged) {
  Write-Host ""
  Write-Host "No changes needed."
  exit 0
}

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry run complete. Apply with:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\tools\weered_api_fix_rooms_routes_and_fk.ps1 -Apply"
  exit 0
}

$bak = Backup-File $indexPath
Write-Host ""
Write-Host ("Backup created: " + $bak)

Write-Utf8Lines $indexPath $indexLines
Write-Host ("Wrote: " + $indexPath)
Write-Host ""
Write-Host "Done. Restart the API + Web dev servers."
