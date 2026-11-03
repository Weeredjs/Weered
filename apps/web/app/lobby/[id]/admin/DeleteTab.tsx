"use client";
// Deleting the lobby, for its owner (api lib/lobbyDelete.ts, James 2026-11-02).
// Typing the name confirms it. It's gone from everywhere at once and erased
// after 30 days; until then Weered's staff can bring it back.
import { useState } from "react";
import { S, apiFetch } from "./shared";

export function DeleteTab({
  lobby,
  isOwner,
}: {
  lobby: { id: string; name?: string };
  isOwner: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const name = lobby.name || lobby.id;
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  if (!isOwner)
    return (
      <div style={{ maxWidth: 560, fontSize: 13, lineHeight: 1.6, opacity: 0.8 }}>
        Only this lobby&apos;s owner can delete it here. Weered&apos;s staff delete and restore
        lobbies from Ops → Lobbies.
      </div>
    );

  async function remove() {
    if (!matches || busy) return;
    setBusy(true);
    setErr("");
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/delete`, {
      method: "POST",
      body: JSON.stringify({ confirm: typed.trim() }),
    });
    setBusy(false);
    if (j?.ok) {
      window.location.assign("/home");
      return;
    }
    setErr(j?.message || "That didn't work. Try again.");
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Delete {name}</div>
      <ul
        style={{
          fontSize: 13,
          lineHeight: 1.65,
          opacity: 0.85,
          margin: "0 0 14px",
          paddingLeft: 18,
        }}
      >
        <li>
          It disappears from Weered at once: lists, search, its address and its custom domain.
        </li>
        <li>Everyone in its rooms is sent out, and its invite links stop working.</li>
        <li>It no longer counts toward your three free lobbies.</li>
        <li>
          It&apos;s erased for good after 30 days. Until then nobody else can take its name, and
          Weered&apos;s staff can bring it back if this was a mistake.
        </li>
      </ul>
      <label style={{ display: "block", fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
        Type <b>{name}</b> to confirm
      </label>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void remove();
        }}
        placeholder={name}
        aria-label="The lobby's name, to confirm"
        style={{ ...S.input, width: "100%", marginBottom: 10 }}
      />
      <button
        type="button"
        onClick={() => void remove()}
        disabled={!matches || busy}
        style={{ ...S.btn, ...S.danger, opacity: matches && !busy ? 1 : 0.5 }}
      >
        {busy ? "Deleting…" : "Delete this lobby"}
      </button>
      {err && <div style={{ marginTop: 10, fontSize: 12, color: "#fca5a5" }}>{err}</div>}
    </div>
  );
}
