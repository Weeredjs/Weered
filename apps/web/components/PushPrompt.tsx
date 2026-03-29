"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export default function PushPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only prompt after 2+ visits, logged in, not already subscribed/denied
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "denied" || Notification.permission === "granted") return;

    const token = localStorage.getItem("weered_token");
    if (!token) return;

    const dismissed = localStorage.getItem("weered_push_later");
    if (dismissed) {
      const ts = Number(dismissed);
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return; // 7-day cooldown
    }

    const visits = Number(localStorage.getItem("weered_visit_count") || "0") + 1;
    localStorage.setItem("weered_visit_count", String(visits));
    if (visits < 3) return;

    // Delay showing prompt by 5 seconds so it doesn't feel aggressive
    const timer = setTimeout(() => setShow(true), 5000);
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
    localStorage.setItem("weered_push_later", String(Date.now()));
  }, []);

  if (!show) return null;

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
