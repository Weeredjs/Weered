"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";

type LatestRelease = {
  version: string;
  pub_date: string;
  notes: string;
  downloads: Record<string, string>; // tauri target -> url
};

const FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: "▣", title: "System tray",        body: "Stays online in your tray. One click and you're back in the lobby." },
  { icon: "⌘", title: "Global hotkeys",     body: "Ctrl+Shift+W toggles the window from anywhere. Push-to-talk soon." },
  { icon: "✸", title: "Native notifications", body: "OS-level pings — no browser permission popups, no missed DMs." },
  { icon: "⌬", title: "Deep links",          body: "Click weered:// links in Discord/email/wherever and they open in the app." },
  { icon: "↑",  title: "Auto-launch",        body: "Optional — start Weered with your machine. Runs hidden in the tray." },
  { icon: "⟲", title: "Auto-update",         body: "Background updates, no nagware. Restart and you're on the latest." },
];

type Platform = {
  id: "windows" | "macos-intel" | "macos-arm" | "linux";
  label: string;
  sub: string;
  target: string;       // tauri target string used in /desktop/updates/:target
  detect: (ua: string, plat: string) => boolean;
};

const PLATFORMS: Platform[] = [
  { id: "windows",     label: "Windows",        sub: "Win 10 / 11 · NSIS installer",       target: "windows-x86_64",  detect: (_ua, p) => p.includes("Win") },
  { id: "macos-arm",   label: "macOS (Apple)",  sub: "Apple Silicon · DMG",                target: "darwin-aarch64",  detect: (ua, p) => p.includes("Mac") && /arm|aarch/i.test(ua) },
  { id: "macos-intel", label: "macOS (Intel)",  sub: "10.15+ · DMG",                       target: "darwin-x86_64",   detect: (ua, p) => p.includes("Mac") && !/arm|aarch/i.test(ua) },
  { id: "linux",       label: "Linux",          sub: "AppImage",                            target: "linux-x86_64",    detect: (_ua, p) => /Linux|X11/i.test(p) },
];

export default function DesktopContent() {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [primaryPlatform, setPrimaryPlatform] = useState<Platform["id"] | null>(null);

  useEffect(() => {
    // Detect the visitor's OS so we can highlight the right download.
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent || "";
      const plat = window.navigator.platform || "";
      const match = PLATFORMS.find((p) => p.detect(ua, plat));
      if (match) setPrimaryPlatform(match.id);
    }
    // Fetch latest release info from API. Safe fallback: if it fails or
    // returns null, we just show "Coming soon" tiles (current behavior).
    fetch(`${API_BASE}/desktop/latest`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.release) setRelease(data.release as LatestRelease);
      })
      .catch(() => { /* silent — page degrades to "Coming soon" */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&family=Syne:wght@700;800;900&display=swap');
        .dt-root {
          min-height: 100vh;
          background: #0c0b0a;
          color: rgba(243,244,246,0.96);
          font-family: 'DM Mono', monospace;
          padding: 80px 24px 60px;
          position: relative;
          overflow-x: hidden;
        }
        .dt-root::before {
          content: '';
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 60% 40% at 18% 8%, rgba(88,0,229,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 50% 35% at 82% 90%, rgba(245,183,0,0.08) 0%, transparent 55%);
        }
        .dt-inner { max-width: 880px; margin: 0 auto; position: relative; z-index: 1; }
        .dt-eyebrow { font-size: 11px; letter-spacing: 2.5px; font-weight: 800; color: #f5b700; text-transform: uppercase; margin-bottom: 14px; }
        .dt-h1 { font-family: 'Syne', sans-serif; font-size: 56px; line-height: 1.05; font-weight: 900; letter-spacing: -1.5px; margin: 0 0 18px; }
        .dt-h1 em { color: #5800E5; font-style: normal; }
        .dt-lede { font-size: 16px; line-height: 1.6; color: rgba(203,213,225,0.85); max-width: 620px; margin: 0 0 36px; }
        .dt-pitch { display: flex; gap: 28px; flex-wrap: wrap; padding: 18px 22px; border: 1px solid rgba(245,183,0,0.4); border-radius: 6px; background: rgba(245,183,0,0.05); margin-bottom: 48px; }
        .dt-pitch-stat { flex: 1; min-width: 160px; }
        .dt-pitch-num { font-family: 'Syne', sans-serif; font-weight: 900; font-size: 28px; color: #f5b700; letter-spacing: -1px; }
        .dt-pitch-lab { font-size: 11px; letter-spacing: 1.5px; font-weight: 700; color: rgba(203,213,225,0.6); text-transform: uppercase; margin-top: 4px; }
        .dt-section-h { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.5px; margin: 48px 0 18px; }
        .dt-section-h::before { content: '·'; color: #5800E5; margin-right: 10px; font-weight: 900; }
        .dt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
        .dt-card { padding: 18px 18px 16px; background: #15131a; border: 1px solid rgba(255,255,255,0.06); border-radius: 5px; }
        .dt-card-icon { font-size: 18px; color: #f5b700; margin-bottom: 10px; line-height: 1; }
        .dt-card-title { font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: rgba(243,244,246,0.96); margin-bottom: 6px; }
        .dt-card-body { font-size: 12px; line-height: 1.55; color: rgba(203,213,225,0.7); }
        .dt-platforms { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
        .dt-plat { padding: 22px; background: linear-gradient(180deg, #160a24 0%, #15131a 100%); border: 1.5px solid rgba(88,0,229,0.5); border-radius: 5px; box-shadow: 0 4px 12px rgba(88,0,229,0.2); position: relative; }
        .dt-plat-name { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 20px; letter-spacing: -0.5px; color: #fff; margin-bottom: 4px; }
        .dt-plat-sub { font-size: 11px; letter-spacing: 1px; color: rgba(203,213,225,0.6); text-transform: uppercase; margin-bottom: 16px; }
        .dt-plat-cta { display: inline-block; padding: 10px 18px; background: rgba(88,0,229,0.15); border: 1px solid rgba(88,0,229,0.4); border-radius: 4px; color: rgba(160,160,170,0.7); font-weight: 800; font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; cursor: not-allowed; }
        .dt-plat-cta.live { background: #5800E5; border-color: #5800E5; color: #fff; cursor: pointer; box-shadow: 0 4px 12px rgba(88,0,229,0.5); }
        .dt-plat-cta.live:hover { filter: brightness(1.1); }
        .dt-soon { position: absolute; top: 12px; right: 12px; font-size: 9px; letter-spacing: 1.5px; font-weight: 800; color: #f5b700; text-transform: uppercase; padding: 3px 7px; border: 1px solid rgba(245,183,0,0.5); border-radius: 3px; background: rgba(245,183,0,0.1); }
        .dt-pwa { margin-top: 36px; padding: 18px 22px; border: 1px dashed rgba(255,255,255,0.15); border-radius: 5px; background: rgba(255,255,255,0.02); }
        .dt-pwa-h { font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; color: rgba(243,244,246,0.96); }
        .dt-pwa-body { font-size: 12px; line-height: 1.6; color: rgba(203,213,225,0.7); }
        .dt-back { display: inline-block; margin-bottom: 24px; font-size: 11px; letter-spacing: 1.5px; font-weight: 700; color: rgba(203,213,225,0.6); text-decoration: none; text-transform: uppercase; }
        .dt-back:hover { color: #f5b700; }
        @media (max-width: 600px) {
          .dt-h1 { font-size: 38px; }
          .dt-root { padding: 60px 18px 40px; }
        }
      `}</style>
      <div className="dt-root">
        <div className="dt-inner">
          <Link href="/" className="dt-back">← back to weered</Link>

          <div className="dt-eyebrow">Weered Desktop</div>
          <h1 className="dt-h1">Native. Tiny. <em>Always on.</em></h1>
          <p className="dt-lede">
            The full Weered experience as a real desktop app. System tray, native notifications, global hotkeys, deep links — built on Rust + Tauri.
            30× smaller than Discord. Eats less RAM. Doesn't pretend to be a browser.
          </p>

          <div className="dt-pitch">
            <div className="dt-pitch-stat">
              <div className="dt-pitch-num">~6 MB</div>
              <div className="dt-pitch-lab">Installer</div>
            </div>
            <div className="dt-pitch-stat">
              <div className="dt-pitch-num">~80 MB</div>
              <div className="dt-pitch-lab">RAM at rest</div>
            </div>
            <div className="dt-pitch-stat">
              <div className="dt-pitch-num">Rust</div>
              <div className="dt-pitch-lab">Tauri 2 shell</div>
            </div>
          </div>

          <h2 className="dt-section-h">Download{release ? ` · v${release.version}` : ""}</h2>
          <div className="dt-platforms">
            {PLATFORMS.map((p) => {
              const url = release?.downloads?.[p.target] || null;
              const isPrimary = primaryPlatform === p.id;
              return (
                <div key={p.id} className="dt-plat" style={isPrimary ? { borderColor: "#f5b700", boxShadow: "0 4px 16px rgba(245,183,0,0.3)" } : undefined}>
                  {!url && !loading && <div className="dt-soon">Coming soon</div>}
                  {isPrimary && url && <div className="dt-soon" style={{ color: "#f5b700", borderColor: "rgba(245,183,0,0.7)", background: "rgba(245,183,0,0.15)" }}>Recommended</div>}
                  <div className="dt-plat-name">{p.label}</div>
                  <div className="dt-plat-sub">{p.sub}</div>
                  {url ? (
                    <a className="dt-plat-cta live" href={url} download style={{ textDecoration: "none", display: "inline-block" }}>
                      Download
                    </a>
                  ) : (
                    <span className="dt-plat-cta">{loading ? "Checking…" : "In testing"}</span>
                  )}
                </div>
              );
            })}
          </div>
          {release && (
            <div style={{ marginTop: 14, fontSize: 11, color: "rgba(203,213,225,0.5)", letterSpacing: 0.5 }}>
              Released {new Date(release.pub_date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              {" · "}
              <a href="https://github.com/Weeredjs/Weered/releases" target="_blank" rel="noreferrer" style={{ color: "#a78bfa", textDecoration: "none" }}>
                All releases →
              </a>
            </div>
          )}
          {!release && !loading && (
            <div style={{ marginTop: 14, fontSize: 11, color: "rgba(203,213,225,0.5)", letterSpacing: 0.5 }}>
              First public release is in testing. The PWA install (below) works today.
            </div>
          )}

          <div className="dt-pwa">
            <div className="dt-pwa-h">Want it now? Install as a PWA.</div>
            <div className="dt-pwa-body">
              Open <Link href="/" style={{ color: "#5800E5", textDecoration: "underline" }}>weered.ca</Link> in Chrome or Edge,
              click the install icon in the address bar, and Weered runs as a standalone window. No browser tabs, no chrome.
              Works today, while we finish the native shell.
            </div>
          </div>

          <h2 className="dt-section-h">What it adds</h2>
          <div className="dt-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="dt-card">
                <div className="dt-card-icon">{f.icon}</div>
                <div className="dt-card-title">{f.title}</div>
                <div className="dt-card-body">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
