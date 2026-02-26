$ErrorActionPreference="Stop"

$Repo="C:\Weered"
$p = Join-Path $Repo "apps\web\components\LobbyChatPanel.tsx"
if (!(Test-Path -LiteralPath $p)) { throw "Missing: $p" }

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$bak = "$p.bak_ui_patch2b_$ts"
Copy-Item -LiteralPath $p -Destination $bak -Force
Write-Host "OK Backup:" $bak

$t = Get-Content -Raw -LiteralPath $p

# 1) Fix mojibake placeholder if present
$t = $t.Replace("MessageÃ¢â‚¬Â¦", "Message...").Replace("Messageâ€¦", "Message...")

# 2) Replace the tiny dot indicator block with an avatar-ish block
# We match the whole <div style={{ width: 10, height: 10 ... }} /> snippet and replace it.
$pattern = '<div\s+style=\{\{\s*width:\s*10,\s*height:\s*10,\s*borderRadius:\s*999,\s*marginTop:\s*5,\s*background:\s*isMe\s*\?\s*"[^"]*"\s*:\s*"[^"]*"\s*\}\}\s*/>'
$repl = '<div style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(255,255,255,.07)", border: "1px solid rgba(148,163,184,.16)", boxShadow: isMe ? "0 0 0 2px var(--weered-accent-ring, rgba(14,165,233,.34))" : "none", fontWeight: 1000, flex: "0 0 auto" }}><span style={{ fontSize: 12 }}>{uname.slice(0,1).toUpperCase()}</span></div>'

$regex = New-Object System.Text.RegularExpressions.Regex($pattern)
if ($regex.IsMatch($t)) {
  $t = $regex.Replace($t, $repl, 1)
  Write-Host "OK Patched: dot -> avatar block"
} else {
  Write-Host "WARN: Could not find dot indicator block to replace (maybe already changed)."
}

Set-Content -LiteralPath $p -Value $t -Force
Write-Host "OK Wrote:" $p