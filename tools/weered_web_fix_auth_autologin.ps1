param([switch]$Apply)

function Backup-File([string]$path) {
  $stamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
  $bak = $path + ".bak_" + $stamp
  [System.IO.File]::Copy($path, $bak, $true)
  return $bak
}

function Find-WebDir([string]$repoRoot) {
  $a = Join-Path $repoRoot "apps\web"
  if ([System.IO.Directory]::Exists($a)) { return $a }
  $b = Join-Path $repoRoot "apps/web"
  if ([System.IO.Directory]::Exists($b)) { return $b }
  return $null
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$webDir = Find-WebDir $repoRoot
if (-not $webDir) { throw "Web folder not found at apps\web or apps/web." }

$exts = @(".ts",".tsx",".js",".jsx")
$files = Get-ChildItem -LiteralPath $webDir -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $exts -contains $_.Extension.ToLowerInvariant() }

# Detect token key used by app (weered:*token*)
$tokenKey = $null
foreach ($f in $files) {
  $t = $null
  try { $t = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8) } catch { continue }
  $m = [regex]::Match($t, "localStorage\.setItem\(\s*['""](weered:[^'""]*token[^'""]*)['""]")
  if ($m.Success) { $tokenKey = $m.Groups[1].Value; break }
}
if (-not $tokenKey) { $tokenKey = "weered:token" }

Write-Host ("Detected token key: " + $tokenKey)

# Find auth/provider candidate (tokenKey + useState + context/provider-ish)
$cands = @()
foreach ($f in $files) {
  $t = $null
  try { $t = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8) } catch { continue }
  if ($t -notlike ("*" + $tokenKey + "*")) { continue }

  $score = 0
  if ($t -match "useState") { $score += 2 }
  if ($t -match "createContext|AuthProvider|useAuth") { $score += 3 }
  if ($t -match "/auth/dev-login|dev-login") { $score += 2 }
  if ($t -match "localStorage\.setItem") { $score += 2 }
  $cands += [pscustomobject]@{ File=$f.FullName; Score=$score }
}

if ($cands.Count -eq 0) { throw "No auth candidates found referencing $tokenKey." }

$target = ($cands | Sort-Object Score -Descending | Select-Object -First 1).File
Write-Host ("Target file: " + $target)

$lines = [System.IO.File]::ReadAllLines($target, [System.Text.Encoding]::UTF8)

# Find: const [token, setToken] = useState(...)
$idx = -1
$tokenVar = $null
$setTokenVar = $null
for ($i=0; $i -lt $lines.Length; $i++) {
  $m = [regex]::Match($lines[$i], "const\s*\[\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\]\s*=\s*useState")
  if ($m.Success) {
    $tokenVar = $m.Groups[1].Value
    $setTokenVar = $m.Groups[2].Value
    $idx = $i
    break
  }
}
if ($idx -lt 0) { throw "Could not find token useState line (const [token, setToken] = useState...)." }

# Ensure React import includes useEffect
for ($i=0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match "from\s+['""]react['""]") {
    if ($lines[$i] -match "{") {
      if ($lines[$i] -notmatch "\buseEffect\b") {
        $lines[$i] = $lines[$i] -replace "{", "{ useEffect, "
        $lines[$i] = $lines[$i] -replace "{\s*useEffect,\s*useEffect,\s*", "{ useEffect, "
        Write-Host "Patched react import to include useEffect."
      }
    } else {
      # uncommon style: import React from 'react' — we won't rewrite it here
      Write-Host "NOTE: react import does not use named imports; if compile fails, update it manually to include useEffect."
    }
    break
  }
}

# Avoid double insert if already present
$alreadyHydrate = $false
$alreadyAuto = $false
for ($k=[Math]::Max(0,$idx); $k -lt [Math]::Min($lines.Length, $idx+80); $k++) {
  if ($lines[$k] -match ("localStorage\.getItem\(\s*['""]" + [regex]::Escape($tokenKey) + "['""]\s*\)")) { $alreadyHydrate = $true }
  if ($lines[$k] -match "/auth/dev-login") { $alreadyAuto = $true }
}

$indent = ([regex]::Match($lines[$idx], "^\s*")).Value
$insert = New-Object System.Collections.Generic.List[string]

if (-not $alreadyHydrate) {
  $insert.Add("") | Out-Null
  $insert.Add($indent + "useEffect(() => {") | Out-Null
  $insert.Add($indent + "  try {") | Out-Null
  $insert.Add($indent + "    const t = localStorage.getItem('" + $tokenKey + "');") | Out-Null
  $insert.Add($indent + "    if (t && !" + $tokenVar + ") " + $setTokenVar + "(t);") | Out-Null
  $insert.Add($indent + "  } catch {}") | Out-Null
  $insert.Add($indent + "}, []);") | Out-Null
  $insert.Add("") | Out-Null
}

if (-not $alreadyAuto) {
  $insert.Add($indent + "useEffect(() => {") | Out-Null
  $insert.Add($indent + "  if (" + $tokenVar + ") return;") | Out-Null
  $insert.Add($indent + "  if (process.env.NODE_ENV !== 'development') return;") | Out-Null
  $insert.Add($indent + "  (async () => {") | Out-Null
  $insert.Add($indent + "    try {") | Out-Null
  $insert.Add($indent + "      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';") | Out-Null
  $insert.Add($indent + "      const displayName = localStorage.getItem('weered:displayName') || 'James';") | Out-Null
  $insert.Add($indent + "      const res = await fetch(API_BASE + '/auth/dev-login', {") | Out-Null
  $insert.Add($indent + "        method: 'POST',") | Out-Null
  $insert.Add($indent + "        headers: { 'content-type': 'application/json' },") | Out-Null
  $insert.Add($indent + "        body: JSON.stringify({ displayName }),") | Out-Null
  $insert.Add($indent + "      });") | Out-Null
  $insert.Add($indent + "      if (!res.ok) return;") | Out-Null
  $insert.Add($indent + "      const data = await res.json();") | Out-Null
  $insert.Add($indent + "      if (data && data.token) {") | Out-Null
  $insert.Add($indent + "        try { localStorage.setItem('weered:displayName', displayName); } catch {}") | Out-Null
  $insert.Add($indent + "        try { localStorage.setItem('" + $tokenKey + "', data.token); } catch {}") | Out-Null
  $insert.Add($indent + "        " + $setTokenVar + "(data.token);") | Out-Null
  $insert.Add($indent + "      }") | Out-Null
  $insert.Add($indent + "    } catch {}") | Out-Null
  $insert.Add($indent + "  })();") | Out-Null
  $insert.Add($indent + "}, [" + $tokenVar + "]);") | Out-Null
  $insert.Add("") | Out-Null
}

if ($insert.Count -eq 0) {
  Write-Host "Hydration/autologin already present. Nothing to do."
  exit 0
}

Write-Host ""
Write-Host ("Will insert after token state line " + ($idx+1) + " (" + $tokenVar + "/" + $setTokenVar + "):")
$insert | ForEach-Object { Write-Host ("  " + $_) }

if (-not $Apply) {
  Write-Host ""
  Write-Host "Dry run only. Apply with:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\tools\weered_web_fix_auth_autologin.ps1 -Apply"
  exit 0
}

$bak = Backup-File $target
Write-Host ("Backup: " + $bak)

$out = New-Object System.Collections.Generic.List[string]
for ($j=0; $j -lt $lines.Length; $j++) {
  $out.Add($lines[$j]) | Out-Null
  if ($j -eq $idx) {
    foreach ($ln in $insert) { $out.Add($ln) | Out-Null }
  }
}

[System.IO.File]::WriteAllLines($target, $out.ToArray(), [System.Text.Encoding]::UTF8)
Write-Host ("Wrote: " + $target)
