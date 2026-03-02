"use client";

import React, { useMemo, useState } from "react";
import { useWeered } from "./WeeredProvider";

function fmt(ts: number) {
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

export default function RoomAdminPanel({ roomId }: { roomId: string }) {
  const w = useWeered();
  const meta = w.meta;
  const admin = w.admin;
  const role = w.role;

  const isAdmin = role === "owner" || role === "mod";
  const isOwner = role === "owner";

  const [rename, setRename] = useState("");
  const [banInput, setBanInput] = useState("");

  const users = useMemo(() => (Array.isArray(w.users) ? w.users : []), [w.users]);

  if (!roomId) return null;
  if (!isAdmin) return null;

  const locked = Boolean(meta?.locked);

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12, marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 700 }}>Admin Tools</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Role: <b>{role}</b> · Locked: <b>{String(locked)}</b>
        </div>
      </div>

      {/* Rename + Lock */}
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={rename}
          onChange={(e) => setRename(e.target.value)}
          placeholder="Room name…"
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--weered-border)", minWidth: 220 }}
        />
        <button
          onClick={() => {
            const v = rename.trim();
            if (!v) return;
            w.renameRoom(v);
            setRename("");
          }}
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}
        >
          Rename
        </button>

        {!locked ? (
          <button
            onClick={() => w.lockRoom()}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}
          >
            Lock
          </button>
        ) : (
          <button
            onClick={() => w.unlockRoom()}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}
          >
            Unlock
          </button>
        )}
      </div>

      {/* Knock queue */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Knocks</div>
        {(admin?.knocks?.length || 0) === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No knocks.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {admin!.knocks!.slice().reverse().map((k) => (
              <div
                key={k.userId}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 8, border: "1px solid var(--weered-border)", borderRadius: 10 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{k.userId} · {fmt(k.ts)}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => w.admit(k.userId)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}>Admit</button>
                  <button onClick={() => w.deny(k.userId)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}>Deny</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users list + actions */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Users</div>
        {(users.length || 0) === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No users.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {users.map((u) => {
              const isMe = w.me?.id && u.id === w.me.id;
              const uRole = (u.role as any) || "member";

              const canPromote = isOwner && !isMe && uRole !== "owner" && uRole !== "mod";
              const canDemote = isOwner && !isMe && uRole === "mod";
              const canKick = isAdmin && !isMe && uRole !== "owner";
              const canBan = isAdmin && !isMe && uRole !== "owner";

              return (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 8, border: "1px solid var(--weered-border)", borderRadius: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.name} {isMe ? "(you)" : ""} <span style={{ fontSize: 12, opacity: 0.7 }}>· {uRole}</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.id}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {canPromote && (
                      <button onClick={() => w.promote(u.id)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}>Promote</button>
                    )}
                    {canDemote && (
                      <button onClick={() => w.demote(u.id)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}>Demote</button>
                    )}
                    {canKick && (
                      <button onClick={() => w.kick(u.id)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}>Kick</button>
                    )}
                    {canBan && (
                      <button onClick={() => w.ban(u.id)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}>Ban</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bans */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Bans</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={banInput}
            onChange={(e) => setBanInput(e.target.value)}
            placeholder="UserId to unban…"
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--weered-border)", minWidth: 240 }}
          />
          <button
            onClick={() => {
              const v = banInput.trim();
              if (!v) return;
              w.unban(v);
              setBanInput("");
            }}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--weered-border)" }}
          >
            Unban
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          {admin?.banned?.length ? admin.banned.join(", ") : "No banned users."}
        </div>
      </div>

      {/* Audit */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Audit</div>
        {(admin?.audit?.length || 0) === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No audit yet.</div>
        ) : (
          <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--weered-border)", borderRadius: 10, padding: 8 }}>
            {admin!.audit!.slice().reverse().map((a) => (
              <div key={a.id} style={{ fontSize: 12, padding: "6px 0", borderBottom: "1px solid #f2f2f2" }}>
                <div>
                  <b>{a.type}</b> · {fmt(a.ts)}
                </div>
                <div style={{ opacity: 0.8 }}>
                  {a.actorName} ({a.actorId})
                  {a.targetId ? <> → {a.targetId}</> : null}
                  {a.note ? <> · <i>{a.note}</i></> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


