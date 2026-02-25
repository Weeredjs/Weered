"use client";

import React, { useMemo, useState } from "react";
import { useWeered } from "./WeeredProvider";

function normRole(r: any) {
  return String(r ?? "").toLowerCase();
}
function canMod(role: string) {
  return ["owner", "admin", "mod", "moderator", "staff", "god"].includes(normRole(role));
}
function canStaffOrGod(role: string) {
  return ["staff", "god"].includes(normRole(role));
}
export default function ModeratorToolsPanel(props: { roomId?: string; title?: string } = {}) {
  const w: any = useWeered();

  // In this app, mod actions operate on the currently joined/active room in the provider.
  // We accept roomId for future use/clarity, but actions rely on provider state today.
  const roomId = props.roomId || w.activeRoomId || "";
  const role = String(w.role || w.me?.role || w.me?.globalRole || "");
  const allowed = useMemo(() => canMod(role), [role]);

  const [renameTo, setRenameTo] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [note, setNote] = useState("");

  const admin = w.admin || {};
  const knocks: any[] = Array.isArray(admin.knocks) ? admin.knocks : [];
  const banned: any[] = Array.isArray(admin.banned) ? admin.banned : [];
  const mods: any[] = Array.isArray(admin.mods) ? admin.mods : [];

  function safe(fn: Function, label: string) {
    try {
      fn();
      setNote(label);
    } catch (e: any) {
      setNote(`${label} failed`);
    }
  }

  if (!allowed) {
    return (
      <section style={{ border: "1px solid rgba(148,163,184,.14)", borderRadius: 16, padding: 12, background: "rgba(15,23,42,.7)" }}>
        <div style={{ fontWeight: 950, marginBottom: 6 }}>{props.title || "Moderator Tools"}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Visible to moderators/owners only.</div>
      </section>
    );
  }

  return (
    <section style={{ border: "1px solid rgba(148,163,184,.18)", borderRadius: 16, padding: 12, background: "rgba(15,23,42,.9)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 950 }}>{props.title || "Moderator Tools"}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>{roomId ? `room: ${roomId}` : "no room selected"}</div>
      </div>

      <div style={{ height: 1, background: "rgba(148,163,184,.14)", margin: "10px 0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button onClick={() => safe(() => w.lockRoom?.(), "locked")} style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}>
          Lock
        </button>
        <button onClick={() => safe(() => w.unlockRoom?.(), "unlocked")} style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}>
          Unlock
        </button>

        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Rename room</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={renameTo} onChange={(e) => setRenameTo(e.target.value)} placeholder="New room name" style={{ flex: 1, padding: "8px 10px", borderRadius: 12 }} />
            <button onClick={() => safe(() => w.renameRoom?.(renameTo), "renamed")} style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}>
              Rename
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(148,163,184,.14)", margin: "12px 0" }} />

      <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>User actions (room)</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
          placeholder="Target userId"
          style={{ flex: 1, padding: "8px 10px", borderRadius: 12 }}
        />
        <button onClick={() => safe(() => w.kick?.(targetUserId), "kicked")} style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}>
          Kick
        </button>        {canStaffOrGod(role) ? (
          <button onClick={() => safe(() => w.staffKick?.(targetUserId), "global kicked")} style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}>
            Global Kick
          </button>
        ) : null}

        <button onClick={() => safe(() => w.ban?.(targetUserId), "banned")} style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}>
          Ban
        </button>
        <button onClick={() => safe(() => w.unban?.(targetUserId), "unbanned")} style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}>
          Unban
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={() => safe(() => w.promote?.(targetUserId), "promoted")} style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}>
          Promote MOD
        </button>
        <button onClick={() => safe(() => w.demote?.(targetUserId), "demoted")} style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}>
          Demote
        </button>
      </div>

      {/* Knocks / Admission */}
      {knocks.length ? (
        <>
          <div style={{ height: 1, background: "rgba(148,163,184,.14)", margin: "12px 0" }} />
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Knocks</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {knocks.slice(-10).map((k: any) => (
              <div key={k.userId || Math.random()} style={{ display: "flex", justifyContent: "space-between", gap: 10, border: "1px solid rgba(148,163,184,.14)", borderRadius: 12, padding: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, fontSize: 12 }}>{String(k.name || k.userId)}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{String(k.userId)}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => safe(() => w.admit?.(String(k.userId)), "admitted")} style={{ padding: "6px 10px", borderRadius: 12, fontWeight: 950 }}>
                    Admit
                  </button>
                  <button onClick={() => safe(() => w.deny?.(String(k.userId)), "denied")} style={{ padding: "6px 10px", borderRadius: 12, fontWeight: 950 }}>
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {note ? <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>{note}</div> : null}

      {/* Quick visibility */}
      <div style={{ marginTop: 10, opacity: 0.6, fontSize: 12 }}>
        mods: {mods.length} | banned: {banned.length}
      </div>
    </section>
  );
}