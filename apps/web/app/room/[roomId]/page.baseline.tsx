"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useWeered } from "../../../components/WeeredProvider";
import LobbyChatPanel from "../../../components/LobbyChatPanel";
import ModeratorToolsPanel from "../../../components/ModeratorToolsPanel";

function safeDecode(s: string): string {
  let out = String(s || "");
  for (let i = 0; i < 3; i++) {
    if (!out.includes("%")) break;
    try {
      const d = decodeURIComponent(out);
      if (d === out) break;
      out = d;
    } catch { break; }
  }
  return out;
}

function Avatar(props: { name: string; size?: number; ring?: boolean }) {
  const s = props.size || 30;
  const n = String(props.name || "?");
  const parts = n.trim().split(/\s+/).filter(Boolean);
  const initials = (parts[0]?.[0] || "?") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] || "") : (parts[0]?.[1] || ""));
  const ring = props.ring ? "0 0 0 2px var(--weered-accent-ring, rgba(14,165,233,.34))" : "0 0 0 1px rgba(148,163,184,.16)";
  return (
    <div style={{ width: s, height: s, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(255,255,255,.07)", border: "1px solid rgba(148,163,184,.16)", color: "rgba(243,244,246,.95)", fontWeight: 1000, boxShadow: ring, flex: "0 0 auto" }}>
      <span style={{ fontSize: Math.max(10, Math.round(s * 0.40)) }}>{initials.toUpperCase()}</span>
    </div>
  );
}

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const ridRaw = String(params?.roomId || "");
  const roomId = useMemo(() => safeDecode(ridRaw).trim(), [ridRaw]);

  const { me, users, joinedRoomId, joinStatus, setActiveRoomId } = useWeered();
  useEffect(() => { try { setActiveRoomId(roomId); } catch {} }, [roomId, setActiveRoomId]);

  const canChat = joinedRoomId === roomId && joinStatus === "joined";
  const page: React.CSSProperties = { padding: "14px", paddingRight: 420 };
  const panel: React.CSSProperties = { background: "var(--weered-panel, rgba(15,23,42,.90))", border: "1px solid rgba(148,163,184,.14)", borderRadius: 18, padding: 12 };

  return (
    <div style={page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={roomId} size={34} ring />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>room</div>
            <div style={{ fontSize: 20, fontWeight: 1100, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{roomId}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>status: {canChat ? "joined · chat enabled" : "not joined"} · users: {Array.isArray(users) ? users.length : 0}</div>
          </div>
        </div>

        <Link href="/lobby" style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(148,163,184,.20)", background: "rgba(255,255,255,.05)", fontWeight: 950, textDecoration: "none", color: "rgba(243,244,246,.98)" }}>
          ← Lobby
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr .9fr", gap: 14, alignItems: "start" }}>
        <section style={panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 1000 }}>Room chat</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{canChat ? "connected" : "disabled until joined/admitted"}</div>
          </div>
          <LobbyChatPanel title="Room chat" style={{ width: "100%" }} />
        </section>

        <section style={{ display: "grid", gap: 14 }}>
          <div style={panel}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 1000 }}>Participants</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{Array.isArray(users) ? users.length : 0}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(Array.isArray(users) ? users : []).map((u: any) => {
                const uname = String(u?.name || u?.username || u?.id || "user");
                const isMe = me?.id && (u?.id === me.id);
                const role = String(u?.role || u?.roomRole || "").toUpperCase();
                return (
                  <div key={String(u?.id || uname)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 14, border: "1px solid rgba(148,163,184,.14)", background: "rgba(255,255,255,.03)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <Avatar name={uname} size={28} ring={isMe} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{uname}{isMe ? " (you)" : ""}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{role ? `role: ${role}` : "role: member"}</div>
                      </div>
                    </div>

                    <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(148,163,184,.18)", background: "rgba(255,255,255,.04)", fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" }}>
                      {role || "MEMBER"}
                    </div>
                  </div>
                );
              })}
              {(!Array.isArray(users) || !users.length) ? <div style={{ opacity: 0.7 }}>No users yet.</div> : null}
            </div>
          </div>

          <div style={panel}>
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>Room tools</div>
            <ModeratorToolsPanel roomId={roomId} />
          </div>
        </section>
      </div>
    </div>
  );
}
