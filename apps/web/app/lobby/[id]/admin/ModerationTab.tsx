"use client";
import React, { useState } from "react";
import { LobbyData, S, apiFetch } from "./shared";

export function ModerationTab({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const [blockedWords, setBlockedWords] = useState<string>((lobby.blockedWords || []).join(", "));
  const [blockedDomains, setBlockedDomains] = useState<string>(
    (lobby.blockedDomains || []).join(", "),
  );
  const [newAccountHours, setNewAccountHours] = useState<number>(lobby.newAccountChatHours ?? 0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  React.useEffect(() => {
    setBlockedWords((lobby.blockedWords || []).join(", "));
    setBlockedDomains((lobby.blockedDomains || []).join(", "));
    setNewAccountHours(lobby.newAccountChatHours ?? 0);
  }, [lobby.blockedWords, lobby.blockedDomains, lobby.newAccountChatHours]);

  async function save() {
    setSaving(true);
    setMsg("");
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/moderation`, {
      method: "PATCH",
      body: JSON.stringify({
        blockedWords: blockedWords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        blockedDomains: blockedDomains
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        newAccountChatHours: Number(newAccountHours) || 0,
      }),
    });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.message || j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={S.sectionTitle}>AutoMod-light</div>
      <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 18, lineHeight: 1.6 }}>
        Owner-set filters that run before any chat message is broadcast in this lobby's rooms.
        Cached for 60s after edits.
      </div>

      <label style={{ ...S.label, marginTop: 4 }}>Blocked words / phrases</label>
      <textarea
        value={blockedWords}
        onChange={(e) => setBlockedWords(e.target.value)}
        rows={3}
        placeholder="comma-separated · case-insensitive substring match"
        style={{
          ...S.input,
          width: "100%",
          fontFamily: "ui-monospace, monospace",
          resize: "vertical",
          marginBottom: 14,
        }}
      />

      <label style={S.label}>Blocked domains</label>
      <textarea
        value={blockedDomains}
        onChange={(e) => setBlockedDomains(e.target.value)}
        rows={2}
        placeholder="e.g. discord.gg, bit.ly, t.me — substring match against URLs"
        style={{
          ...S.input,
          width: "100%",
          fontFamily: "ui-monospace, monospace",
          resize: "vertical",
          marginBottom: 14,
        }}
      />

      <label style={S.label}>New-account chat cooldown (hours)</label>
      <input
        type="number"
        min={0}
        max={720}
        value={newAccountHours}
        onChange={(e) => setNewAccountHours(Number(e.target.value) || 0)}
        style={{ ...S.input, width: 120, marginBottom: 4 }}
      />
      <div style={{ fontSize: 11, opacity: 0.45, marginBottom: 18 }}>
        Accounts younger than this can't chat in this lobby. 0 = disabled. Max 720 (30 days).
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Moderation Settings"}
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}
