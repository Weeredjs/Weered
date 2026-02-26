$ErrorActionPreference = "Stop"

function SaveUtf8NoBom {
  param([string]$PathOut, [string]$TextOut)
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllBytes($PathOut, $enc.GetBytes($TextOut))
}

function BackupFile {
  param([string]$PathIn, [string]$Tag)
  if (!(Test-Path -LiteralPath $PathIn)) { throw ("Missing: " + $PathIn) }
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = $PathIn + ".bak_" + $Tag + "_" + $ts
  Copy-Item -LiteralPath $PathIn -Destination $bak -Force
  Write-Host ("Backup: " + $bak)
}

$Path = "C:\Weered\apps\web\app\lobby\page.tsx"
BackupFile -PathIn $Path -Tag "repair_page_structure"

$t = Get-Content -Raw -LiteralPath $Path

# --- Replace Avatar function block with a known-good one ---
$after = $t
$m = [regex]::Match($after, "(?s)function Avatar\([^\)]*\)\s*\{.*?\n\}\s*\n")
if (-not $m.Success) { throw "Could not locate Avatar function block to replace." }

$AvatarFixed = @"
function Avatar(props: { name: string; size?: number }) {
  const s = props.size || 28;
  const n = String(props.name || "?");
  const parts = n.trim().split(/\s+/).filter(Boolean);
  const initials =
    (parts[0]?.[0] || "?") +
    (parts.length > 1 ? (parts[parts.length - 1]?.[0] || "") : (parts[0]?.[1] || ""));

  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: Math.max(12, Math.floor(s * 0.42)),
        background: "rgba(124,58,237,0.18)",
        border: "1px solid var(--weered-border)",
        color: "rgba(255,255,255,0.92)",
        userSelect: "none",
      }}
      title={n}
    >
      {initials.toUpperCase()}
    </div>
  );
}
"@

$t2 = $t.Replace($m.Value, $AvatarFixed)

# --- Ensure a default export for the page ---
if ($t2 -notmatch "export\s+default\s+function\s+LobbyPage") {

  $anchor = '<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>'
  $layoutIdx = $t2.IndexOf($anchor)
  if ($layoutIdx -lt 0) { throw "Could not find lobby layout root div anchor (flexDirection column wrapper)." }

  $endIdx = $t2.IndexOf(");", $layoutIdx)
  if ($endIdx -lt 0) { throw "Could not find end ');' for lobby layout block." }

  $layoutBlock = $t2.Substring($layoutIdx, ($endIdx - $layoutIdx))

  $wrapped = @"
export default function LobbyPage() {
  return (
$layoutBlock
  );
}
"@

  # Remove old raw layout block (not including the closing ');' so we keep file structure stable)
  $t2 = $t2.Remove($layoutIdx, ($endIdx - $layoutIdx))
  $t2 = $t2.Insert($layoutIdx, $wrapped)
}

SaveUtf8NoBom -PathOut $Path -TextOut $t2
Write-Host "OK: Repaired lobby/page.tsx (Avatar closed + default export added)." -ForegroundColor Green
