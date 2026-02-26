$ErrorActionPreference="Stop"

function Backup([string]$p, [string]$tag) {
  if (!(Test-Path -LiteralPath $p)) { throw "Missing: $p" }
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$p.bak_${tag}_$ts"
  Copy-Item -LiteralPath $p -Destination $bak -Force
  Write-Host "OK Backup:" $bak
}

$Repo="C:\Weered"
$Layout = Join-Path $Repo "apps\web\app\layout.tsx"
$Lobby  = Join-Path $Repo "apps\web\app\lobby\page.tsx"

Backup $Layout "ui_patch5"
Backup $Lobby  "ui_patch5"

# --- Replace layout.tsx with drawer-enabled Dock ---
$layout = @'
import "./globals.css";
import React from "react";
import { WeeredProvider } from "../components/WeeredProvider";
import LeftRail from "../components/LeftRail";
import DockShell from "../components/DockShell";

function DockToggleButton() {
  return (
    <button
      onClick={() => {
        try { window.dispatchEvent(new CustomEvent("weered:dock:toggle")); } catch {}
      }}
      style={{
        position: "fixed",
        right: 18,
        top: 18,
        padding: "10px 12px",
        borderRadius: 999,
        border: "1px solid rgba(148,163,184,.20)",
        background: "rgba(255,255,255,.06)",
        color: "rgba(243,244,246,.95)",
        fontWeight: 950,
        boxShadow: "0 12px 30px rgba(0,0,0,.35)",
        cursor: "pointer",
        zIndex: 80
      }}
    >
      Dock
    </button>
  );
}

function DockDrawer() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onToggle = () => setOpen(v => !v);
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener("weered:dock:toggle", onToggle as any);
    window.addEventListener("weered:dock:open", onOpen as any);
    window.addEventListener("weered:dock:close", onClose as any);
    return () => {
      window.removeEventListener("weered:dock:toggle", onToggle as any);
      window.removeEventListener("weered:dock:open", onOpen as any);
      window.removeEventListener("weered:dock:close", onClose as any);
    };
  }, []);

  return (
    <>
      {/* backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 180ms ease",
          zIndex: 70
        }}
      />

      {/* drawer */}
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          bottom: 12,
          width: 420,
          maxWidth: "min(420px, calc(100vw - 24px))",
          transform: open ? "translateX(0)" : "translateX(110%)",
          transition: "transform 220ms ease",
          zIndex: 75,
          pointerEvents: "auto",
        }}
      >
        <DockShell forceMode="floating" />
      </div>

      <DockToggleButton />
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "var(--weered-bg, #050816)" }}>
        <WeeredProvider>
          <div
            style={{
              minHeight: "100vh",
              display: "grid",
              gridTemplateColumns: "300px 1fr",
              gap: 14,
              padding: 14,
              alignItems: "start",
            }}
          >
            <div style={{ position: "sticky", top: 14, height: "calc(100vh - 28px)" }}>
              <LeftRail />
            </div>

            <div style={{ minWidth: 0 }}>
              {children}
            </div>
          </div>

          <DockDrawer />
        </WeeredProvider>
      </body>
    </html>
  );
}
'@

Set-Content -LiteralPath $Layout -Value $layout -Force
Write-Host "OK Wrote:" $Layout

# --- Remove the lobby "Dock" button we added earlier (keep header clean) ---
$t = Get-Content -Raw -LiteralPath $Lobby
$t2 = $t -replace '(?s)\s*<button\s+onClick=\{\(\)\s*=>\s*window\.scrollTo\(\{ top: 0, behavior: "smooth" \}\)\}\s*style=\{btn\}\>\s*Dock\s*<\/button>\s*', "`r`n"
if ($t2 -ne $t) {
  Set-Content -LiteralPath $Lobby -Value $t2 -Force
  Write-Host "OK Patched: removed lobby Dock button"
} else {
  Write-Host "OK Lobby Dock button not found (already removed)."
}

Write-Host ""
Write-Host "NEXT:"
Write-Host "  cd C:\Weered\apps\web ; pnpm dev"
Write-Host "  Open /lobby, click Dock button (top-right) -> drawer slides in"
Write-Host "  Click backdrop -> drawer closes"