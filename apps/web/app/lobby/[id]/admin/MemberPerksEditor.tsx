"use client";
import { useState } from "react";
import { LobbyData, S, apiFetch } from "./shared";

export function MemberPerksEditor({
  lobby,
  onRefresh,
}: {
  lobby: LobbyData;
  onRefresh: () => void;
}) {
  const initial =
    Array.isArray(lobby.memberPerks) && lobby.memberPerks.length > 0 ? lobby.memberPerks : [];
  const [perks, setPerks] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function updatePerk(i: number, v: string) {
    setPerks((p) => {
      const next = [...p];
      next[i] = v;
      return next;
    });
  }
  function removePerk(i: number) {
    setPerks((p) => p.filter((_, idx) => idx !== i));
  }
  function addPerk() {
    if (perks.length >= 5) return;
    setPerks((p) => [...p, ""]);
  }
  async function save() {
    setSaving(true);
    setMsg("");
    const cleaned = perks
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .slice(0, 5);
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/perks`, {
      method: "PATCH",
      body: JSON.stringify({ memberPerks: cleaned }),
    });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  return (
    <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.06)" }}>
      <div style={{ ...S.label, marginBottom: 6 }}>MEMBER PERKS</div>
      <div
        style={{ fontSize: 11, color: "rgba(148,163,184,.55)", marginBottom: 14, lineHeight: 1.5 }}
      >
        Up to 5 perks shown in the Join overlay non-members see. Leave empty to use the platform
        defaults (themed experience, room creation, tournament eligibility, announcements, member
        badge). Keep each entry short — they render as a checklist.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {perks.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, opacity: 0.5, width: 14, textAlign: "right" }}>
              {i + 1}.
            </span>
            <input
              style={{ ...S.input, flex: 1 }}
              value={p}
              maxLength={80}
              placeholder="e.g. Exclusive cube-draft rooms"
              onChange={(e) => updatePerk(i, e.target.value)}
            />
            <button
              onClick={() => removePerk(i)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid rgba(239,68,68,.25)",
                background: "rgba(239,68,68,.08)",
                color: "rgba(252,165,165,.7)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        ))}
        {perks.length < 5 && (
          <button
            onClick={addPerk}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px dashed rgba(255,255,255,.12)",
              background: "transparent",
              color: "rgba(148,163,184,.7)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add perk ({perks.length}/5)
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Perks"}
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}
