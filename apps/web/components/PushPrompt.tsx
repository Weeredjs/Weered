"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

// Detect iOS Safari not running as installed PWA
function isIosSafariNotPwa(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  // Already installed as PWA (standalone mode)?
  if ((window.navigator as any).standalone === true) return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return false;
  return true;
}

export default function PushPrompt() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"push" | "ios">("push");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("weered_token");
    if (!token) return;

    const visits = Number(localStorage.getItem("weered_visit_count") || "0") + 1;
    localStorage.setItem("weered_visit_count", String(visits));
    if (visits < 3) return;

    // Check iOS Safari first
    if (isIosSafariNotPwa()) {
      const dismissed = localStorage.getItem("weered_ios_pwa_later");
      if (dismissed) {
        const ts = Number(dismissed);
        if (Date.now() - ts < 14 * 24 * 60 * 60 * 1000) return; // 14-day cooldown
      }
      const timer = setTimeout(() => { setMode("ios"); setShow(true); }, 5000);
      return () => clearTimeout(timer);
    }

    // Standard push prompt for non-iOS
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "denied" || Notification.permission === "granted") return;

    const dismissed = localStorage.getItem("weered_push_later");
    if (dismissed) {
      const ts = Number(dismissed);
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return; // 7-day cooldown
    }

    // Delay showing prompt by 5 seconds so it doesn't feel aggressive
    const timer = setTimeout(() => { setMode("push"); setShow(true); }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = useCallback(async () => {
    setShow(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const reg = await navigator.serviceWorker.ready;

      // Fetch VAPID key from API
      const vapidRes = await fetch(`${API}/push/vapid-key`);
      const vapidData = await vapidRes.json();
      if (!vapidData.ok || !vapidData.key) return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidData.key,
      } as any);

      const token = localStorage.getItem("weered_token") || "";
      await fetch(`${API}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: arrayBufferToBase64(sub.getKey("p256dh")), auth: arrayBufferToBase64(sub.getKey("auth")) },
        }),
      });
    } catch (e) {
      console.error("[push subscribe]", e);
    }
  }, []);

  const handleLater = useCallback(() => {
    setShow(false);
    if (mode === "ios") {
      localStorage.setItem("weered_ios_pwa_later", String(Date.now()));
    } else {
      localStorage.setItem("weered_push_later", String(Date.now()));
    }
  }, [mode]);

  if (!show) return null;

  // iOS "Add to Home Screen" guidance
  if (mode === "ios") {
    return (
      <div style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        zIndex: 800, background: "rgba(14,14,22,.97)", border: "1px solid rgba(88,0,229,.35)",
        borderRadius: 16, padding: "16px 20px", width: "calc(100vw - 32px)", maxWidth: 380,
        boxShadow: "0 12px 48px rgba(0,0,0,.6)",
        backdropFilter: "blur(12px)",
        animation: "weeredSlideUp 0.3s ease-out",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <img src="/brand/logo/weered-logo-128.png" alt="" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "rgba(243,244,246,.95)", marginBottom: 4 }}>
              Install Weered
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", lineHeight: 1.5, marginBottom: 12 }}>
              Add to your Home Screen to get push notifications for DMs, mentions, and crew activity.
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: "rgba(88,0,229,.15)", border: "1px solid rgba(88,0,229,.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900, color: "rgba(88,0,229,.8)",
                }}>1</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>
                  Tap the <span style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(88,0,229,.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", margin: "0 2px" }}>
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </span> <strong style={{ color: "rgba(255,255,255,.9)" }}>Share</strong> button in Safari
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: "rgba(88,0,229,.15)", border: "1px solid rgba(88,0,229,.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900, color: "rgba(88,0,229,.8)",
                }}>2</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>
                  Scroll down, tap <strong style={{ color: "rgba(255,255,255,.9)" }}>Add to Home Screen</strong>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: "rgba(88,0,229,.15)", border: "1px solid rgba(88,0,229,.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900, color: "rgba(88,0,229,.8)",
                }}>3</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>
                  Open from Home Screen — notifications enabled
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleLater} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,.08)",
                background: "transparent", color: "rgba(148,163,184,.5)",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
              }}>
                Maybe later
              </button>
            </div>
          </div>
        </div>

        <style>{`@keyframes weeredSlideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      </div>
    );
  }

  // Standard push prompt (Android/desktop)
  return (
    <div style={{
      position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)",
      zIndex: 800, background: "#1a1a2e", border: "1px solid rgba(124,58,237,.3)",
      borderRadius: 14, padding: "12px 18px", display: "flex", alignItems: "center", gap: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,.5)", maxWidth: 400,
      animation: "weeredFadeIn 0.3s ease-out",
    }}>
      <div style={{ fontSize: 13, color: "rgba(230,235,240,.85)", flex: 1 }}>
        Get notified about DMs and mentions?
      </div>
      <button onClick={handleEnable} style={{
        padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
        background: "rgba(124,58,237,.25)", color: "rgba(167,139,250,.95)",
        fontSize: 12, fontWeight: 700, fontFamily: "inherit",
      }}>
        Enable
      </button>
      <button onClick={handleLater} style={{
        padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer",
        background: "transparent", color: "rgba(148,163,184,.5)",
        fontSize: 12, fontWeight: 600, fontFamily: "inherit",
      }}>
        Later
      </button>
    </div>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
