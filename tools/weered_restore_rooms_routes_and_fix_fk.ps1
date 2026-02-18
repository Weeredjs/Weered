param([switch]$Apply)

function Backup-File([string]$path) {
  $stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
  $bak = $path + ".bak_" + $stamp
  [System.IO.File]::Copy($path, $bak, $true)
  return $bak
}

function ReadUtf8([string]$path) {
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function WriteUtf8Lines([string]$path, [string[]]$lines) {
  [System.IO.File]::WriteAllLines($path, $lines, [System.Text.Encoding]::UTF8)
}

function FindInSrc([string]$srcDir, [string]$needle) {
  $exts = @(".ts",".tsx",".js",".jsx",".mjs",".cjs")
  $files = Get-ChildItem -LiteralPath $srcDir -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $exts -contains $_.Extension.ToLowerInvariant() }

  $hits = @()
  foreach ($f in $files) {
    $t = $null
    try { $t = ReadUtf8 $f.FullName } catch { continue }
    if ($t -like ("*" + $needle + "*")) { $hits += $f.FullName }
  }
  return $hits
}

function SrcImportPath([string]$srcDir, [string]$filePath) {
  $rel = $filePath.Substring($srcDir.Length).TrimStart('\','/')
  $rel = $rel -replace '\.(ts|tsx|js|jsx|mjs|cjs)$',''
  $rel = $rel -replace '\\','/'
  return "./" + $rel
}

function GetExportInfo([string]$routeFile, [string]$fallbackBase) {
  $txt = ReadUtf8 $routeFile

  # default export?
  if ($txt -match "export\s+default") {
    return [pscustomobject]@{ importId = ($fallbackBase + "Routes"); isDefault = $true; callStyle = "register" }
  }

  # named const/function export?
  $m1 = [regex]::Match($txt, "export\s+const\s+([A-Za-z0-9_]+)")
  if ($m1.Success) {
    $name = $m1.Groups[1].Value
    # if it looks like fastify-plugin / FastifyPlugin* -> app.register
    if ($txt -match "FastifyPlugin" -or $txt -match "fastify-plugin") {
      return [pscustomobject]@{ importId = $name; isDefault = $false; callStyle = "register" }
    }
    # otherwise assume it's still a plugin-style export and register it
    return [pscustomobject]@{ importId = $name; isDefault = $false; callStyle = "register" }
  }

  $m2 = [regex]::Match($txt, "export\s+function\s+([A-Za-z0-9_]+)")
  if ($m2.Success) {
    $name = $m2.Groups[1].Value
    # if the file contains app.get/app.put inside a function, we should CALL it, not register
    if ($txt -match "\bapp\.(get|put|post|delete)\s*\(") {
      return [pscustomobject]@{ importId = $name; isDefault = $false; callStyle = "call" }
    }
    return [pscustomobject]@{ importId = $name; isDefault = $false; callStyle = "call" }
  }

  # fallback
  return [pscustomobject]@{ importId = ($fallbackBase + "Routes"); isDefault = $true; callStyle = "register" }
}

function EnsureImport([string[]]$lines, [string]$importPath, [string]$importId, [bool]$isDefault) {
  foreach ($ln in $lines) {
    if ($ln -like ("*from '" + $importPath + "'*") -or $ln -like ("*from """ + $importPath + """*")) {
      return ,@($lines, $false)
    }
  }

  $lastImportIdx = -1
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "^\s*import\b") { $lastImportIdx = $i }
  }
  if ($lastImportIdx -lt 0) { throw "No import block found in index.ts" }

  $out = New-Object System.Collections.Generic.List[string]
  for ($i=0; $i -lt $lines.Length; $i++) {
    $out.Add($lines[$i]) | Out-Null
    if ($i -eq $lastImportIdx) {
      if ($isDefault) {
        $out.Add("import " + $importId + " from '" + $importPath + "';") | Out-Null
      } else {
        $out.Add("import { " + $importId + " } from '" + $importPath + "';") | Out-Null
      }
    }
  }
  return ,@($out.ToArray(), $true)
}

function EnsureBeforeListen([string[]]$lines, [string]$stmt) {
  foreach ($ln in $lines) {
    if ($ln -match [regex]::Escape($stmt)) { return ,@($lines, $false) }
  }

  $listenIdx = -1
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "await\s+app\.listen\s*\(" -or $lines[$i] -match "\.listen\s*\(") { $listenIdx = $i; break }
  }
  if ($listenIdx -lt 0) { throw "Could not find app.listen(...) in index.ts" }

  $indent = ([regex]::Match($lines[$listenIdx], "^\s*")).Value

  $out = New-Object System.Collections.Generic.List[string]
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($i -eq $listenIdx) {
      $out.Add($indent + $stmt) | Out-Null
      $out.Add("") | Out-Null
    }
    $out.Add($lines[$i]) | Out-Null
  }
  return ,@($out.ToArray(), $true)
}

function InsertRoomUpsertBeforeMessageCreate([string[]]$lines) {
  # Find the exact failing pattern shown in your log
  $idxCreate = -1
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "const\s+saved\s*=\s*await\s+prisma\.message\.create\s*\(") { $idxCreate = $i; break }
  }
  if ($idxCreate -lt 0) { return ,@($lines, $false, "Could not find const saved = await prisma.message.create(") }

  # Avoid double insert
  for ($k=[Math]::Max(0,$idxCreate-8); $k -lt $idxCreate; $k++) {
    if ($lines[$k] -match "prisma\.room\.upsert") { return ,@($lines, $false, "Room upsert already present") }
  }

  $indent = ([regex]::Match($lines[$idxCreate], "^\s*")).Value
  $insert = @(
    ($indent + "// Ensure Room exists before inserting messages (prevents FK crash)"),
    ($indent + "await prisma.room.upsert({ where: { id: roomId }, update: {}, create: { id: roomId } });"),
    ""
  )

  $out = New-Object System.Collections.Generic.List[string]
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($i -eq $idxCreate) { foreach ($ln in $insert) { $out.Add($ln) | Out-Null } }
    $out.Add($lines[$i]) | Out-Null
  }
  return ,@($out.ToArray(), $true, "Inserted room upsert before prisma.message.create")
}

Write-Host ""
Write-Host ("="*80)
Write-Host "Weered: restore /rooms routes registration + fix WS chat FK crash"
Write-Host ("="*80)

$srcDir = "C:\Weered\apps\api\src"
$indexPath = Join-Path $srcDir "index.ts"
if (-not [System.IO.File]::Exists($indexPath)) { throw "Missing: $indexPath" }

$hitsState = FindInSrc $srcDir "rooms/:roomId/state"
$hitsMsgs  = FindInSrc $srcDir "rooms/:roomId/messages"

$routeFiles = @($hitsState + $hitsMsgs) | Sort-Object -Unique
if ($routeFiles.Count -eq 0) {
  throw "Could not locate any route file containing rooms/:roomId/state or rooms/:roomId/messages."
}

Write-Host ""
Write-Host "Route files found:"
$routeFiles | ForEach-Object { Write-Host (" - " + $_) }

$lines = [System.IO.File]::ReadAllLines($indexPath, [System.Text.Encoding]::UTF8)
$changed = $false

foreach ($rf in $routeFiles) {
  $importPath = SrcImportPath $srcDir $rf
  $base = [System.IO.Path]::GetFileNameWithoutExtension($rf)
  $fallback = "rooms_" + $base

  $exp = GetExportInfo $rf $fallback

  Write-Host ""
  Write-Host ("Ensuring import + wiring for: " + $rf)
  Write-Host ("  import: " + $importPath)
  Write-Host ("  id:     " + $exp.importId + ($(if($exp.isDefault){" (default)"}else{" (named)"})))
  Write-Host ("  style:  " + $exp.callStyle)

  $r1 = EnsureImport $lines $importPath $exp.importId $exp.isDefault
  $lines = $r1[0]; if ($r1[1]) { $changed = $true }

  if ($exp.callStyle -eq "call") {
    $stmt = ($exp.importId + "(app);")
  } else {
    $stmt = ("app.register(" + $exp.importId + ");")
  }

  $r2 = EnsureBeforeListen $lines $stmt
  $lines = $r2[0]; if ($r2[1]) { $changed = $true }
}

# Fix Prisma FK crash in WS chat handler
$r3 = InsertRoomUpsertBeforeMessageCreate $lines
$lines = $r3[0]
if ($r3[1]) { $changed = $true }
Write-Host ""
Write-Host ("FK patch: " + $r3[2])

if (-not $changed) {
  Write-Host ""
  Write-Host "No changes needed."
  exit 0
}

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry run complete. Apply with:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\tools\weered_restore_rooms_routes_and_fix_fk.ps1 -Apply"
  exit 0
}

$bak = Backup-File $indexPath
Write-Host ""
Write-Host ("Backup: " + $bak)

WriteUtf8Lines $indexPath $lines
Write-Host ("Wrote: " + $indexPath)
Write-Host ""
Write-Host "Done. Restart the API + refresh the room page."
