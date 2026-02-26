$ErrorActionPreference = "Stop"

$Repo = "C:\Weered"
$pProv = Join-Path $Repo "apps\web\components\WeeredProvider.tsx"
$pDock = Join-Path $Repo "apps\web\components\DockShell.tsx"
$pLobby = Join-Path $Repo "apps\web\components\LobbyChatPanel.tsx"

function Save-Utf8NoBom([string]$Path, [string]$Text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Backup([string]$p, [string]$tag) {
  if (!(Test-Path -LiteralPath $p)) { throw "Missing: $p" }
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$p.bak_${tag}_$ts"
  Copy-Item -LiteralPath $p -Destination $bak -Force
  Write-Host "✅ Backup:" $bak
}

Backup $pProv "ui_blanket_v1"
Backup $pDock "ui_blanket_v1"
Backup $pLobby "ui_blanket_v1"

# ============================================================
# 1) WeeredProvider.tsx
#   - Fix "refresh after login" by syncing token/user on navigation
#   - Expose getMsgs/getUsers so Dock can show Lobby chat independently
# ============================================================
$t = Get-Content -Raw -LiteralPath $pProv

# (a) import usePathname
if ($t -match 'import\s*\{\s*useRouter\s*\}\s*from\s*"next/navigation";') {
  $t = [regex]::Replace($t, 'import\s*\{\s*useRouter\s*\}\s*from\s*"next/navigation";', 'import { useRouter, usePathname } from "next/navigation";', 1)
  Write-Host "✅ Provider: usePathname imported."
} elseif ($t -match 'usePathname') {
  Write-Host "ℹ Provider: usePathname already present."
} else {
  throw "Provider: could not find next/navigation import line."
}

# (b) add const pathname after router
if ($t -notmatch 'const\s+pathname\s*=\s*usePathname\(\)\s*;') {
  $t = [regex]::Replace(
    $t,
    '(?m)^\s*const\s+router\s*=\s*useRouter\(\)\s*;\s*$',
    { param($m) $m.Value + "`r`n  const pathname = usePathname();" },
    1
  )
  Write-Host "✅ Provider: pathname added."
}

# (c) add sync effect (route-change)
if ($t -notmatch 'Sync auth from localStorage on navigation') {
  $sync = @'
  // Sync auth from localStorage on navigation (fix: no refresh after login redirect)
  useEffect(() => {
    try {
      const tok = localStorage.getItem("weered_token") || "";
      const uRaw = localStorage.getItem("weered_user") || "";
      if (tok && tok !== token) {
        setToken(tok);
        try { setMe(uRaw ? JSON.parse(uRaw) : null); } catch { setMe(null); }
      }
      if (!tok && token) {
        setToken("");
        setMe(null);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
'@

  # Insert right after the existing boot auth useEffect (anchor comment exists in your file)
  $anchor = '// Load persisted auth on boot so WS can come up without clicking Login every refresh'
  if ($t -match [regex]::Escape($anchor)) {
    $t = [regex]::Replace(
      $t,
      [regex]::Escape($anchor) + '(?s)(.*?\}\s*,\s*\[\s*\]\s*\)\s*;)',
      { param($m) $anchor + $m.Groups[1].Value + "`r`n`r`n" + $sync },
      1
    )
    Write-Host "✅ Provider: auth sync effect inserted."
  } else {
    # fallback: after first useEffect
    $t = [regex]::Replace(
      $t,
      '(?s)(useEffect\s*\(\s*\(\)\s*=>\s*\{.*?\}\s*,\s*\[.*?\]\s*\)\s*;)',
      { param($m) $m.Groups[1].Value + "`r`n`r`n" + $sync },
      1
    )
    Write-Host "✅ Provider: auth sync effect inserted (fallback)."
  }
}

# (d) Add getMsgs/getUsers into the context type and value
# Add to type Ctx block: getMsgs/getUsers
if ($t -notmatch 'getMsgs:\s*\(roomId: string\)') {
  $t = [regex]::Replace(
    $t,
    '(?s)(type\s+Ctx\s*=\s*\{.*?msgs:\s*ChatMsg\[\];)',
    { param($m) $m.Groups[1].Value + "`r`n  getMsgs: (roomId: string) => ChatMsg[];" },
    1
  )
  $t = [regex]::Replace(
    $t,
    '(?s)(type\s+Ctx\s*=\s*\{.*?users:\s*RoomUser\[\];)',
    { param($m) $m.Groups[1].Value + "`r`n  getUsers: (roomId: string) => RoomUser[];" },
    1
  )
  Write-Host "✅ Provider: getMsgs/getUsers added to Ctx type."
}

# Find where ctx object is returned (near bottom: const value: Ctx = { ... })
# Insert getMsgs/getUsers fields if missing
if ($t -notmatch 'getMsgs\s*:\s*\(roomId') {
  $t = [regex]::Replace(
    $t,
    '(?s)(const\s+value\s*:\s*Ctx\s*=\s*\{)',
    { param($m) $m.Groups[1].Value + "`r`n    getMsgs: (roomId: string) => (msgsByRoom[String(roomId || \"\")] || [])," + "`r`n    getUsers: (roomId: string) => (usersByRoom[String(roomId || \"\")] || [])," },
    1
  )
  Write-Host "✅ Provider: getMsgs/getUsers added to context value."
}

Save-Utf8NoBom $pProv $t
Write-Host "✅ Wrote:" $pProv

# ============================================================
# 2) DockShell.tsx
#   - Add theme vars + dropdown (default slate/sky, NOT purple)
#   - Add Avatar chip + role badge styling
#   - Add Lobby Chat panel (always: lobby:r/all) + Room Chat
#   - Make Dock a true right-rail in wide screens
# ============================================================
$t = Get-Content -Raw -LiteralPath $pDock

# (a) ensure LobbyChatPanel import
if ($t -notmatch 'from\s+"\.\/LobbyChatPanel"') {
  $t = [regex]::Replace(
    $t,
    '(?m)^(import\s+React.*)$',
    { param($m) $m.Value + "`r`nimport LobbyChatPanel from \"./LobbyChatPanel\";" },
    1
  )
  Write-Host "✅ Dock: imported LobbyChatPanel."
}

# (b) Inject theme helpers after DM_KEY
if ($t -notmatch 'WEERED_THEME_KEY') {
  $anchor = 'const DM_KEY = "weered_dm_threads_v0";'
  $ins = @'
const WEERED_THEME_KEY = "weered_theme_v2";

type WeeredThemeName = "slate" | "zinc" | "stone" | "gray";
const WEERED_THEMES: Record<WeeredThemeName, any> = {
  slate: {
    bg: "rgb(2,6,23)",
    panel: "rgba(15,23,42,.92)",
    panel2: "rgba(17,24,39,.94)",
    bd: "rgba(148,163,184,.14)",
    bd2: "rgba(148,163,184,.26)",
    text: "rgba(229,231,235,.96)",
    muted: "rgba(148,163,184,.76)",
    accentBg: "rgba(14,165,233,.16)",     // sky
    accentRing: "rgba(14,165,233,.34)",
    accentText: "rgba(56,189,248,.95)",
  },
  zinc: {
    bg: "rgb(9,9,11)",
    panel: "rgba(24,24,27,.92)",
    panel2: "rgba(24,24,27,.94)",
    bd: "rgba(161,161,170,.18)",
    bd2: "rgba(161,161,170,.28)",
    text: "rgba(244,244,245,.96)",
    muted: "rgba(161,161,170,.78)",
    accentBg: "rgba(34,197,94,.14)",      // green
    accentRing: "rgba(34,197,94,.32)",
    accentText: "rgba(74,222,128,.95)",
  },
  stone: {
    bg: "rgb(12,10,9)",
    panel: "rgba(28,25,23,.92)",
    panel2: "rgba(28,25,23,.94)",
    bd: "rgba(168,162,158,.18)",
    bd2: "rgba(168,162,158,.28)",
    text: "rgba(245,245,244,.96)",
    muted: "rgba(168,162,158,.78)",
    accentBg: "rgba(245,158,11,.14)",     // amber
    accentRing: "rgba(245,158,11,.32)",
    accentText: "rgba(251,191,36,.95)",
  },
  gray: {
    bg: "rgb(3,7,18)",
    panel: "rgba(17,24,39,.92)",
    panel2: "rgba(17,24,39,.94)",
    bd: "rgba(156,163,175,.18)",
    bd2: "rgba(156,163,175,.28)",
    text: "rgba(243,244,246,.96)",
    muted: "rgba(156,163,175,.78)",
    accentBg: "rgba(20,184,166,.14)",     // teal
    accentRing: "rgba(20,184,166,.32)",
    accentText: "rgba(45,212,191,.95)",
  },
};

function applyWeeredTheme(name: WeeredThemeName) {
  if (typeof document === "undefined") return;
  const t = WEERED_THEMES[name] || WEERED_THEMES.slate;
  const root = document.documentElement;

  root.style.setProperty("--weered-bg", t.bg);
  root.style.setProperty("--weered-panel", t.panel);
  root.style.setProperty("--weered-panel2", t.panel2);
  root.style.setProperty("--weered-bd", t.bd);
  root.style.setProperty("--weered-bd2", t.bd2);
  root.style.setProperty("--weered-text", t.text);
  root.style.setProperty("--weered-muted", t.muted);

  root.style.setProperty("--weered-accent-bg", t.accentBg);
  root.style.setProperty("--weered-accent-ring", t.accentRing);
  root.style.setProperty("--weered-accent-text", t.accentText);

  root.setAttribute("data-weered-theme", name);
}
'@
  if ($t -notmatch [regex]::Escape($anchor)) { throw "Dock: DM_KEY anchor not found." }
  $t = $t.Replace($anchor, $anchor + "`r`n`r`n" + $ins)
  Write-Host "✅ Dock: theme helpers inserted."
}

# (c) Replace Pill violet colors to use CSS vars (no purple)
$t = $t.Replace('tone === "violet" ? "rgba(124,58,237,.18)"', 'tone === "violet" ? "var(--weered-accent-bg, rgba(14,165,233,.16))"')
$t = $t.Replace('tone === "violet" ? "rgba(217,70,239,.35)"', 'tone === "violet" ? "var(--weered-accent-ring, rgba(14,165,233,.34))"')

# (d) Add avatar helper above export default
if ($t -notmatch 'function\s+Avatar\(') {
  $t = [regex]::Replace(
    $t,
    '(?s)(function\s+Pill\(.*?\)\s*\{.*?\}\s*)\r?\n\r?\nexport\s+default\s+function',
    { param($m) $m.Groups[1].Value + "`r`n`r`nfunction Avatar(props: { name: string; size?: number; ring?: boolean }) {`r`n  const s = props.size || 28;`r`n  const n = String(props.name || \"?\");`r`n  const parts = n.trim().split(/\s+/).filter(Boolean);`r`n  const initials = (parts[0]?.[0] || \"?\") + (parts.length > 1 ? (parts[parts.length-1]?.[0] || \"\") : (parts[0]?.[1] || \"\"));`r`n  const bg = \"rgba(255,255,255,.08)\";`r`n  const ring = props.ring ? \"0 0 0 2px var(--weered-accent-ring, rgba(14,165,233,.34))\" : \"0 0 0 1px var(--weered-bd, rgba(148,163,184,.14))\";`r`n  return (`r`n    <div style={{ width: s, height: s, borderRadius: 999, display: \"grid\", placeItems: \"center\", background: bg, color: \"rgba(229,231,235,.95)\", fontWeight: 950, letterSpacing: \".5px\", boxShadow: ring, flex: \"0 0 auto\" }}>`r`n      <span style={{ fontSize: Math.max(10, Math.round(s * 0.38)) }}>{initials.toUpperCase()}</span>`r`n    </div>`r`n  );`r`n}`r`n`r`nexport default function" },
    1
  )
  Write-Host "✅ Dock: Avatar helper added."
}

# (e) Add theme state after dockMode state line
if ($t -notmatch 'const\s+\[theme,\s*setTheme\]') {
  $anchor2 = 'const [dockMode, setDockMode] = useState<"rail" | "floating">(props.forceMode || "floating");'
  if ($t -notmatch [regex]::Escape($anchor2)) { throw "Dock: dockMode anchor not found." }

  $block = @'
  const [theme, setTheme] = useState<WeeredThemeName>(() => {
    try {
      const v = String(localStorage.getItem(WEERED_THEME_KEY) || "").trim();
      if (v === "slate" || v === "zinc" || v === "stone" || v === "gray") return v;
    } catch {}
    return "slate";
  });

  useEffect(() => {
    try { localStorage.setItem(WEERED_THEME_KEY, theme); } catch {}
    applyWeeredTheme(theme);
  }, [theme]);
'@
  $t = $t.Replace($anchor2, $anchor2 + "`r`n`r`n" + $block)
  Write-Host "✅ Dock: theme state added."
}

# (f) Upgrade surface colors to CSS vars
$t = $t.Replace('background: "rgba(17,24,39,.94)"', 'background: "var(--weered-panel2, rgba(17,24,39,.94))"')
$t = $t.Replace('border: "1px solid rgba(148,163,184,.26)"', 'border: "1px solid var(--weered-bd2, rgba(148,163,184,.26))"')

# (g) Make btnActive use accent vars
$t = $t.Replace('border: "1px solid rgba(217,70,239,.35)"', 'border: "1px solid var(--weered-accent-ring, rgba(14,165,233,.34))"')
$t = $t.Replace('background: "rgba(124,58,237,.18)"', 'background: "var(--weered-accent-bg, rgba(14,165,233,.16))"')

# (h) Insert Theme dropdown into header controls (after DMs button is stable)
if ($t -notmatch 'Theme:' ) {
  $t = [regex]::Replace(
    $t,
    '(?s)(<button style=\{tab === "dms"\s*\?\s*btnActive\s*:\s*btn\}\s*onClick=\{\(\)\s*=>\s*setTab\("dms"\)\}\>DMs<\/button>)',
    { param($m) $m.Groups[1].Value + "`r`n          <span style={{ display: \"inline-flex\", alignItems: \"center\", gap: 6, marginLeft: 6 }}>`r`n            <span style={{ fontSize: 11, opacity: 0.75 }}>Theme:</span>`r`n            <select value={theme} onChange={(e) => setTheme(e.target.value as any)} style={{ background: \"rgba(255,255,255,.06)\", color: \"rgba(229,231,235,.95)\", border: \"1px solid rgba(148,163,184,.18)\", borderRadius: 10, padding: \"4px 8px\", fontSize: 12, outline: \"none\" }}>`r`n              <option value=\"slate\">Slate</option>`r`n              <option value=\"zinc\">Zinc</option>`r`n              <option value=\"stone\">Stone</option>`r`n              <option value=\"gray\">Gray</option>`r`n            </select>`r`n          </span>" },
    1
  )
  Write-Host "✅ Dock: Theme dropdown inserted."
}

# (i) Add dedicated Lobby chat section (lobby:r/all) above room chat mirror
# Anchor: "Room chat (dock mirror)" header
if ($t -notmatch 'Lobby chat \(always\)') {
  $t = [regex]::Replace(
    $t,
    '(?s)(<div style=\{\{ padding: "8px 10px".*?\}\}>\s*Room chat \(dock mirror\)\s*<\/div>)',
    { param($m) @'
<div style={{ border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
  <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(148,163,184,.12)", fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
    Lobby chat (always) — lobby:r/all
  </div>
  <div style={{ padding: 10 }}>
    <LobbyChatPanel title="Lobby Chat" roomId="lobby:r/all" height={210} />
  </div>
</div>

'@ + $m.Groups[1].Value },
    1
  )
  Write-Host "✅ Dock: Lobby chat panel added."
}

# (j) Upgrade presence list to use Avatar instead of dots
# Replace the name line block with Avatar + badges (simple safe transform)
$t = [regex]::Replace(
  $t,
  '(?s)<span style=\{\{ fontWeight: 900 \}\}>\{uname\}\{isMe \? " \(you\)" : ""\}<\/span>',
  '<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Avatar name={uname} size={26} ring={isMe} /><span style={{ fontWeight: 950 }}>{uname}{isMe ? " (you)" : ""}</span></span>',
  1
)

Save-Utf8NoBom $pDock $t
Write-Host "✅ Wrote:" $pDock

# ============================================================
# 3) LobbyChatPanel.tsx
#   - Add roomId prop, use getMsgs(roomId) if available
#   - Replace dot with Avatar
#   - Theme vars (no purple)
# ============================================================
$t = Get-Content -Raw -LiteralPath $pLobby

# Add Avatar helper locally (small, avoids cross-file deps)
if ($t -notmatch 'function\s+Avatar\(') {
  $t = [regex]::Replace(
    $t,
    '(?m)^function pickFirstString.*\r?\n\}',
    { param($m) $m.Value + "`r`n`r`nfunction Avatar(props: { name: string; size?: number; ring?: boolean }) {`r`n  const s = props.size || 26;`r`n  const n = String(props.name || \"?\");`r`n  const parts = n.trim().split(/\\s+/).filter(Boolean);`r`n  const initials = (parts[0]?.[0] || \"?\") + (parts.length > 1 ? (parts[parts.length-1]?.[0] || \"\") : (parts[0]?.[1] || \"\"));`r`n  const bg = \"rgba(255,255,255,.08)\";`r`n  const ring = props.ring ? \"0 0 0 2px var(--weered-accent-ring, rgba(14,165,233,.34))\" : \"0 0 0 1px rgba(148,163,184,.14)\";`r`n  return (<div style={{ width: s, height: s, borderRadius: 999, display: \"grid\", placeItems: \"center\", background: bg, color: \"rgba(229,231,235,.95)\", fontWeight: 950, boxShadow: ring, flex: \"0 0 auto\" }}><span style={{ fontSize: Math.max(10, Math.round(s * 0.38)) }}>{initials.toUpperCase()}</span></div>);`r`n}`r`n" },
    1
  )
  Write-Host "✅ LobbyChatPanel: Avatar helper added."
}

# Extend props signature to accept roomId + height
$t = [regex]::Replace(
  $t,
  'export default function LobbyChatPanel\(props: \{ title\?: string; style\?: React\.CSSProperties \} = \{\}\)',
  'export default function LobbyChatPanel(props: { title?: string; style?: React.CSSProperties; roomId?: string; height?: number } = {})',
  1
)

# Use ctx.getMsgs(roomId) when available
if ($t -notmatch 'const roomId =') {
  $t = [regex]::Replace(
    $t,
    '(?s)const\s+\{\s*me,.*?sendChat,\s*\}\s*:\s*any\s*=\s*useWeered\(\);\s*',
    {
      param($m)
      $m.Value + "`r`n  const roomId = String(props.roomId || activeRoomId || \"\");`r`n  const msgsEff = useMemo(() => {`r`n    try { if (typeof (useWeered() as any)?.getMsgs === \"function\") return ((useWeered() as any).getMsgs(roomId) || []); } catch {}`r`n    try { if (typeof (useWeered() as any)?.getMsgs === \"function\") return []; } catch {}`r`n    return Array.isArray(msgs) ? msgs : [];`r`n  }, [roomId, msgs]);`r`n"
    },
    1
  )
  Write-Host "✅ LobbyChatPanel: msgsEff added."
}

# Fix canChat/hint to use roomId instead of activeRoomId when provided
$t = [regex]::Replace($t, 'const view = String\(activeRoomId \|\| ""\);', 'const view = String(roomId || "");', 99)

# panel theme vars + height prop
$t = $t.Replace('background: "rgba(15,23,42,.92)"', 'background: "var(--weered-panel, rgba(15,23,42,.92))"')
$t = $t.Replace('border: "1px solid rgba(148,163,184,.18)"', 'border: "1px solid var(--weered-bd2, rgba(148,163,184,.18))"')
$t = [regex]::Replace($t, 'height:\s*260,', { param($m) 'height: (props.height || 260),' }, 1)

# Replace message render dot with Avatar
$t = $t.Replace(
  '<div style={{ width: 10, height: 10, borderRadius: 999, marginTop: 5, background: isMe ? "rgba(217,70,239,.95)" : "rgba(148,163,184,.55)" }} />',
  '<Avatar name={uname} size={26} ring={isMe} />'
)
$t = $t.Replace('rgba(217,70,239,.95)', 'var(--weered-accent-text, rgba(56,189,248,.95))')

# Use msgsEff instead of msgs in list + auto-scroll dependency
$t = [regex]::Replace($t, '\[msgs\?\.length\]', '[msgsEff.length]', 1)
$t = [regex]::Replace($t, 'Array\.isArray\(msgs\)\s*&&\s*msgs\.length', 'Array.isArray(msgsEff) && msgsEff.length', 1)
$t = [regex]::Replace($t, '\{msgs\.map\(\(m:\s*any\)\s*=>', '{msgsEff.map((m: any) =>', 1)

Save-Utf8NoBom $pLobby $t
Write-Host "✅ Wrote:" $pLobby

Write-Host ""
Write-Host "NEXT:" -ForegroundColor Cyan
Write-Host "  1) Restart API + Web:"
Write-Host "     cd C:\Weered\apps\api ; pnpm dev"
Write-Host "     cd C:\Weered\apps\web ; pnpm dev"
Write-Host "  2) Login (no manual refresh)"
Write-Host "  3) Dock should show Lobby Chat + Room Chat, avatars in presence, and theme dropdown."