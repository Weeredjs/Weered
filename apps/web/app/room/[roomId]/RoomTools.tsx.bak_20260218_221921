"use client";

import React, { useMemo, useState } from "react";
import { useWeered } from "../../../components/WeeredProvider";

export default function RoomTools({ roomId }: { roomId: string }) {
  const {
    meta,
    admin,
    role,
    joinStatus,
    joinedRoomId,

    renameRoom,
    lockRoom,
    unlockRoom,
    admit,
    deny,
    unban,
  } = useWeered();

  const [draft, setDraft] = useState("");
  const canChat = useMemo(() => roomId && joinedRoomId === roomId && joinStatus === "joined", [roomId, joinedRoomId, joinStatus]);

  const isMod = role === "mod" || role === "owner";

  const card: React.CSSProperties = {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 12,
    background: "white",
  };
  const btn: React.CSSProperties = {
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: "6px 10px",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
  };
  const pill: React.CSSProperties = {
    border: "1px solid #eee",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 12,
    background: "#fafafa",
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>
            {meta?.name || roomId}
            {meta?.locked ? <span style={{ marginLeft: 8, ...pill, borderColor: "#f3c" }}>locked</span> : null}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            status: <b>{joinStatus}</b> • role: <b>{role}</b> • chat: {canChat ? "enabled" : "disabled"}
          </div>
        </div>
        {isMod ? (
          <div style={{ display: "flex", gap: 8 }}>
            {meta?.locked ? (
              <button style={btn} onClick={unlockRoom}>Unlock</button>
            ) : (
              <button style={btn} onClick={lockRoom}>Lock</button>
            )}
          </div>
        ) : null}
      </div>

      {isMod ? (
        <>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Rename room…"
              style={{ flex: 1, padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
            />
            <button
              style={{ ...btn, padding: "10px 12px", opacity: draft.trim() ? 1 : 0.5 }}
              disabled={!draft.trim()}
              onClick={() => { renameRoom(draft.trim()); setDraft(""); }}
            >
              Rename
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div style={{ ...card, padding: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Knocks</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{admin?.knocks?.length ?? 0}</div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {(admin?.knocks || []).slice(-10).reverse().map((k) => (
                  <div key={k.userId} style={{ border: "1px solid #eee", borderRadius: 12, padding: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{k.name}</div>
                      <div style={{ fontSize: 11, color: "#666", wordBreak: "break-all" }}>{k.userId}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={btn} onClick={() => admit(k.userId)}>Admit</button>
                      <button style={btn} onClick={() => deny(k.userId)}>Deny</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...card, padding: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Banned</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{admin?.banned?.length ?? 0}</div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {(admin?.banned || []).slice(-10).reverse().map((id) => (
                  <div key={id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 11, color: "#666", wordBreak: "break-all" }}>{id}</div>
                    <button style={btn} onClick={() => unban(id)}>Unban</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
