"use client";
import React, { useState } from "react";
import { LobbyData, S, apiFetch } from "./shared";
import { onActivate } from "@/lib/a11y";

export const ALL_MODULES = [
  { key: "voice", label: "Voice (LiveKit)", desc: "Real-time voice chat in rooms" },
  { key: "youtube", label: "YouTube Sync", desc: "Synced video playback" },
  { key: "video", label: "Video / Camera", desc: "Webcam grids and video calls" },
  { key: "screen", label: "Screen Share", desc: "Presenter-style screen broadcasting" },
  { key: "twitch", label: "Twitch Embed", desc: "Live Twitch stream embed" },
  { key: "browser", label: "Browser", desc: "Co-browse external pages in-room" },
  { key: "article", label: "Article Reader", desc: "Long-form reading with synced presence" },
  { key: "custom", label: "Custom Embed", desc: "Custom iframe integration" },
  { key: "reddit", label: "Reddit Feed", desc: "Subreddit content browser" },
  {
    key: "fakeout",
    label: "FakeOut Trading",
    desc: "Paper trading with live charts and leaderboards",
  },
  { key: "hq", label: "HQ", desc: "Headquarters dashboard module" },
];

export function ModulesTab({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const [enabled, setEnabled] = useState<string[]>(lobby.enabledModules || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  React.useEffect(() => {
    setEnabled(lobby.enabledModules || []);
  }, [lobby.enabledModules]);

  function toggle(key: string) {
    setEnabled((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/modules`, {
      method: "PATCH",
      body: JSON.stringify({ enabledModules: enabled }),
    });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={S.sectionTitle}>Available Modules</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {ALL_MODULES.map((mod) => {
          const on = enabled.includes(mod.key);
          return (
            <div
              key={mod.key}
              onClick={() => toggle(mod.key)}
              onKeyDown={onActivate(() => toggle(mod.key))}
              role="button"
              tabIndex={0}
              style={{
                ...S.card,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: on ? "1px solid rgba(16,185,129,.30)" : "1px solid rgba(255,255,255,.08)",
                background: on ? "rgba(16,185,129,.05)" : "rgba(255,255,255,.03)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: on ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.05)",
                  fontSize: 16,
                  flexShrink: 0,
                  transition: "background .15s",
                }}
              >
                {on ? "✓" : "○"}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: on ? "rgb(167,243,208)" : "rgba(243,244,246,.85)",
                  }}
                >
                  {mod.label}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>{mod.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Modules"}
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}
