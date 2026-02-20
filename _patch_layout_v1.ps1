param(
  [string]$Repo = "C:\Weered"
)

$ErrorActionPreference = "Stop"

function Find-FirstFile([string[]]$Candidates, [string]$FallbackSearchName) {
  foreach ($p in $Candidates) {
    if (Test-Path -LiteralPath $p) { return $p }
  }

  $root = Join-Path $Repo "apps\web"
  if (-not (Test-Path -LiteralPath $root)) { return $null }

  $found = Get-ChildItem -LiteralPath $root -Recurse -File -Filter $FallbackSearchName -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\\.next\\' } |
    Select-Object -First 1

  if ($found) { return $found.FullName }
  return $null
}

function Backup-Files([string]$SnapDir, [string[]]$Files) {
  New-Item -ItemType Directory -Force -Path $SnapDir | Out-Null
  $copied = @()

  foreach ($f in $Files) {
    if (Test-Path -LiteralPath $f) {
      $dest = Join-Path $SnapDir (Split-Path -Leaf $f)
      Copy-Item -LiteralPath $f -Destination $dest -Force
      $copied += @{ src=$f; leaf=(Split-Path -Leaf $dest) }
    }
  }

  $restorePath = Join-Path $SnapDir "RESTORE_LAYOUT_V1.ps1"
  $out = @()
  $out += '$ErrorActionPreference="Stop"'
  $out += '$here = Split-Path -Parent $MyInvocation.MyCommand.Path'
  $out += 'Write-Host "Restoring snapshot from $here ..."'

  foreach ($c in $copied) {
    $dst = $c.src.Replace('"','\"')
    $leaf = $c.leaf.Replace('"','\"')
    $out += 'Copy-Item -LiteralPath (Join-Path $here "' + $leaf + '") -Destination "' + $dst + '" -Force'
  }

  $out += 'Write-Host "OK. Restart web: cd C:\Weered\apps\web; pnpm dev"'
  Set-Content -LiteralPath $restorePath -Value ($out -join "`r`n") -Encoding UTF8

  return $restorePath
}

function Upsert-Block([string]$Text, [string]$Begin, [string]$End, [string]$BlockBody) {
  $pattern = [regex]::Escape($Begin) + ".*?" + [regex]::Escape($End)
  $rx = New-Object System.Text.RegularExpressions.Regex($pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $newBlock = $Begin + "`r`n" + $BlockBody.TrimEnd() + "`r`n" + $End

  if ($rx.IsMatch($Text)) {
    return $rx.Replace($Text, $newBlock, 1)
  }

  return ($Text.TrimEnd() + "`r`n`r`n" + $newBlock + "`r`n")
}

function Patch-GlobalsCss([string]$Path) {
  $begin = "/* WEERED_LAYOUT_V1_BEGIN */"
  $end   = "/* WEERED_LAYOUT_V1_END */"

  $css = @'
:root{
  --weered-maxw: 1120px;
  --weered-pad-x: 18px;
  --weered-pad-y: 18px;
  --weered-radius: 14px;
}

/* Make pages sane without refactoring JSX yet */
main{
  width: 100%;
  max-width: var(--weered-maxw);
  margin: 0 auto;
  padding: var(--weered-pad-y) var(--weered-pad-x) 140px;
}

/* Lobby room links look like cards */
a[href^="/room/"]{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--weered-radius);
  border: 1px solid var(--weered-border);
  background: rgba(255,255,255,0.03);
  text-decoration: none;
}
a[href^="/room/"]:hover{
  border-color: rgba(217,70,239,0.55);
  background: rgba(124,58,237,0.10);
}
a[href^="/room/"] + a[href^="/room/"]{ margin-top: 10px; }

/* Inputs/buttons: consistent dark style */
input, textarea, select{
  background: rgba(255,255,255,0.04);
  color: var(--weered-text, #E5E7EB);
  border: 1px solid var(--weered-border);
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
}
input::placeholder, textarea::placeholder{ color: rgba(229,231,235,0.45); }
input:focus, textarea:focus, select:focus{
  border-color: rgba(217,70,239,0.65);
  box-shadow: 0 0 0 3px rgba(124,58,237,0.18);
}

button{ border-radius: 12px; }
button:hover{ filter: brightness(1.06); }
'@

  $t = Get-Content -Raw -LiteralPath $Path -ErrorAction Stop
  $t2 = Upsert-Block -Text $t -Begin $begin -End $end -BlockBody $css

  if ($t2 -ne $t) {
    Set-Content -LiteralPath $Path -Value $t2 -Encoding UTF8
    Write-Host "OK: patched globals.css (WEERED_LAYOUT_V1)"
  } else {
    Write-Host "No change: globals.css already has WEERED_LAYOUT_V1"
  }
}

function Patch-DockPanelWidth([string]$DockPath) {
  $lines = Get-Content -LiteralPath $DockPath -ErrorAction Stop
  $idx = -1

  for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\s*const\s+panel\b') { $idx = $i; break }
    if ($lines[$i] -match '^\s*const\s+panel\s*:\s*React\.CSSProperties') { $idx = $i; break }
  }

  if ($idx -lt 0) {
    Write-Host "Skip: DockShell panel const not found"
    return
  }

  $end = $idx
  while ($end -lt $lines.Count -and $lines[$end] -notmatch '^\s*};\s*$') { $end++ }
  if ($end -ge $lines.Count) {
    Write-Host "Skip: DockShell panel block end not found"
    return
  }

  $hasWidth = $false
  $hasMaxH  = $false
  $hasOv    = $false

  for ($i=$idx; $i -le $end; $i++) {
    if ($lines[$i] -match '^\s*width\s*:') {
      $lines[$i] = "    width: 320,"
      $hasWidth = $true
    }
    if ($lines[$i] -match '^\s*maxHeight\s*:') { $hasMaxH = $true }
    if ($lines[$i] -match '^\s*overflow\s*:')   { $hasOv  = $true }
  }

  $toInsert = @()
  if (-not $hasWidth) { $toInsert += "    width: 320," }
  if (-not $hasMaxH)  { $toInsert += "    maxHeight: `"calc(100vh - 24px)`"," }
  if (-not $hasOv)    { $toInsert += "    overflow: `"auto`"," }

  if ($toInsert.Count -gt 0) {
    $before = @()
    if ($end -gt 0) { $before = $lines[0..($end-1)] }
    $after = $lines[$end..($lines.Count-1)]
    $lines = @($before + $toInsert + $after)
  }

  Set-Content -LiteralPath $DockPath -Value ($lines -join "`r`n") -Encoding UTF8
  Write-Host "OK: patched DockShell panel width/maxHeight/overflow"
}

# ------------------- main -------------------

if (-not (Test-Path -LiteralPath $Repo)) { throw "Repo path not found: $Repo" }

$globals = Find-FirstFile @(
  (Join-Path $Repo "apps\web\app\globals.css"),
  (Join-Path $Repo "apps\web\styles\globals.css")
) "globals.css"

$dock = Find-FirstFile @(
  (Join-Path $Repo "apps\web\components\DockShell.tsx")
) "DockShell.tsx"

if (-not $globals) { throw "Could not find globals.css under $Repo\apps\web" }
if (-not $dock)    { throw "Could not find components\DockShell.tsx under $Repo\apps\web" }

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$snapDir = Join-Path $Repo ("_snapshots\layout_pre_" + $stamp)

Write-Host "== Layout v1 patch =="
Write-Host "Repo   : $Repo"
Write-Host "globals: $globals"
Write-Host "dock   : $dock"
Write-Host ""

$restoreScript = Backup-Files -SnapDir $snapDir -Files @($globals, $dock)
Write-Host "OK: snapshot created: $snapDir"
Write-Host "OK: restore script  : $restoreScript"
Write-Host ""

Patch-GlobalsCss -Path $globals
Patch-DockPanelWidth -DockPath $dock

Write-Host ""
Write-Host "DONE."
Write-Host "Restart web: cd `"$Repo\apps\web`"; pnpm dev"
Write-Host "Revert anytime: powershell -ExecutionPolicy Bypass -File `"$restoreScript`""