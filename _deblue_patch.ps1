$ErrorActionPreference = "Stop"

function Save-Utf8NoBom($Path, $Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllBytes($Path, $enc.GetBytes($Text))
}

$ts = Get-Date -Format "yyyyMMdd_HHmmss"

$SubPath  = "C:\Weered\apps\web\components\SubredditBrowser.tsx"
$ChatPath = "C:\Weered\apps\web\components\LobbyChatPanel.tsx"

foreach ($p in @($SubPath, $ChatPath)) {
  if (!(Test-Path -LiteralPath $p)) { throw "Missing: $p" }
  Copy-Item -LiteralPath $p -Destination ($p + ".bak_deblue_" + $ts) -Force
  Write-Host "✅ Backup:" ($p + ".bak_deblue_" + $ts)
}

# --- SubredditBrowser.tsx ---
$s = Get-Content -Raw -LiteralPath $SubPath
$s = $s -replace "^\uFEFF", ""

$s = $s -replace 'border:\s*"1px solid rgba\(148,163,184,\.18\)"', 'border: "1px solid var(--weered-border)"'
$s = $s -replace 'background:\s*"rgba\(15,23,42,\.92\)"', 'background: "var(--weered-panel)"'

$s = $s -replace 'border:\s*"1px solid rgba\(148,163,184,\.24\)"', 'border: "1px solid var(--weered-border2)"'
$s = $s -replace 'background:\s*s === sort \?\s*"rgba\(124,58,237,\.18\)"\s*:\s*"rgba\(255,255,255,\.06\)"', 'background: s === sort ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)"'

$s = $s -replace 'border:\s*"1px solid rgba\(148,163,184,\.14\)"', 'border: "1px solid var(--weered-border2)"'
$s = $s -replace 'background:\s*"rgba\(255,255,255,\.03\)"', 'background: "var(--weered-panel2)"'

$s = $s -replace 'borderBottom:\s*"1px solid rgba\(148,163,184,\.08\)"', 'borderBottom: "1px solid rgba(255,255,255,.06)"'
$s = $s -replace 'background:\s*active \?\s*"rgba\(124,58,237,\.14\)"\s*:\s*"transparent"', 'background: active ? "rgba(124,58,237,.14)" : "transparent"'

$s = $s -replace 'border:\s*"1px solid rgba\(148,163,184,\.12\)"', 'border: "1px solid rgba(255,255,255,.08)"'
$s = $s -replace 'background:\s*"rgba\(0,0,0,\.10\)"', 'background: "rgba(255,255,255,.03)"'

Save-Utf8NoBom $SubPath $s
Write-Host "✅ Patched:" $SubPath

# --- LobbyChatPanel.tsx ---
$c = Get-Content -Raw -LiteralPath $ChatPath

$c = $c -replace "Joiningâ€¦", "Joining..."
$c = $c -replace "requiredâ€¦", "required..."
$c = $c -replace "â€”", "-"

$c = $c -replace 'border:\s*"1px solid rgba\(148,163,184,\.18\)"', 'border: "1px solid var(--weered-border)"'
$c = $c -replace 'background:\s*"rgba\(15,23,42,\.92\)"', 'background: "var(--weered-panel)"'

$c = $c -replace 'border:\s*"1px solid rgba\(148,163,184,\.14\)"', 'border: "1px solid var(--weered-border2)"'
$c = $c -replace 'background:\s*"rgba\(2,6,23,\.25\)"', 'background: "var(--weered-panel2)"'

$c = $c -replace 'rgba\(14,165,233,\.34\)', 'rgba(124,58,237,.28)'

# Replace input style block -> class
$c = [regex]::Replace(
  $c,
  '(?s)<input\s+([^>]*?)style=\{\{[^}]*flex:\s*1[^}]*borderRadius:\s*12[^}]*\}\}\s*\/>',
  '<input $1 className="weered-input" style={{ flex: 1 }} />',
  1
)

# Replace button style block -> class
$c = [regex]::Replace(
  $c,
  '(?s)<button\s+([^>]*?)style=\{\{[^}]*padding:\s*"10px 12px"[^}]*borderRadius:\s*12[^}]*fontWeight:\s*950[^}]*\}\}\s*>',
  '<button $1 className="weered-btn">',
  1
)

Save-Utf8NoBom $ChatPath $c
Write-Host "✅ Patched:" $ChatPath

Write-Host ""
Write-Host "NEXT:"
Write-Host "  cd C:\Weered\apps\web"
Write-Host "  pnpm dev -p 3001"
Write-Host "  Hard refresh (Ctrl+Shift+R)"