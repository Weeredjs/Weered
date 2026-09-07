"use client";
// Admin → Modules → start.gg: point this lobby at a tournament, an organizer
// profile, or a league on start.gg. The lobby's feed then shows the next event,
// registration, live stream queue and recent results (StartggCard).
import React, { useState } from "react";
import { LobbyData, S, apiFetch } from "./shared";

export function StartggEditor({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const current = (lobby.moduleConfig as any)?.startgg || null;
  const [val, setVal] = useState<string>(current?.ref ? `https://www.start.gg/${current.ref}` : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    const c = (lobby.moduleConfig as any)?.startgg || null;
    setVal(c?.ref ? `https://www.start.gg/${c.ref}` : "");
  }, [lobby.moduleConfig]);

  async function submit(ref: string) {
    setBusy(true);
    setMsg(null);
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/startgg`, {
      method: "PATCH",
      body: JSON.stringify({ ref }),
    });
    setBusy(false);
    if (j?.ok && j.configured) {
      const n = j.upcoming?.length || 0;
      setMsg({
        ok: true,
        text: `Linked to ${j.source?.name || j.ref}. ${n ? `${n} upcoming event${n === 1 ? "" : "s"}.` : "Nothing upcoming right now."}`,
      });
    } else if (j?.ok) {
      setMsg({ ok: true, text: "start.gg link removed." });
    } else {
      setMsg({ ok: false, text: j?.message || j?.error || "Failed." });
    }
    if (j?.ok) onRefresh();
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div style={S.sectionTitle}>start.gg</div>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8, lineHeight: 1.45 }}>
        Paste a start.gg link and the lobby feed shows your next tournament, registration, the
        stream queue while it is live, and recent results. An organizer profile link
        (start.gg/user/…) follows every event you run; a tournament link follows just that one; a
        league link follows the series.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="https://www.start.gg/tournament/… or /user/… or /league/…"
          style={{ ...S.input, flex: 1, minWidth: 260 }}
          disabled={busy}
        />
        <button
          style={{ ...S.btnPri, padding: "8px 16px" }}
          onClick={() => submit(val.trim())}
          disabled={busy || !val.trim()}
        >
          {busy ? "Checking…" : "Link"}
        </button>
        {current?.ref && (
          <button
            style={{ ...S.btn, padding: "8px 12px" }}
            onClick={() => submit("")}
            disabled={busy}
          >
            Remove
          </button>
        )}
      </div>
      {current?.ref && !msg && (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          Currently linked to <b>{current.name || current.ref}</b>
          {current.setAt ? ` since ${new Date(current.setAt).toLocaleDateString()}` : ""}.
        </div>
      )}
      {msg && (
        <div
          style={{
            fontSize: 12,
            marginTop: 6,
            color: msg.ok ? "rgb(167,243,208)" : "rgb(252,165,165)",
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
