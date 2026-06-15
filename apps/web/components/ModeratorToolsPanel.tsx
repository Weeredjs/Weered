"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useWeered } from "./WeeredProvider";

type Person = { id?: string; name?: string; handle?: string; role?: string; flags?: any };

function normRole(r: any) {
  return String(r ?? "").toLowerCase();
}
function canMod(role: string) {
  return ["owner", "admin", "mod", "moderator", "staff", "god"].includes(normRole(role));
}
function canStaffOrGod(role: string) {
  return ["staff", "god"].includes(normRole(role));
}

function normUser(u: any): Person {
  if (!u) return {};
  if (typeof u === "string") return { id: u, name: u };
  return {
    id: u.id ?? u.userId ?? u.uid,
    name: u.name ?? u.handle ?? u.username ?? u.displayName ?? u.id ?? "unknown",
    handle: u.handle ?? u.username,
    role: u.role ?? u.kind ?? u.badge,
    flags: u.flags ?? u.meta,
  };
}

function extractParticipants(ctx: any, roomId?: string): Person[] {
  const rid = String(roomId || ctx?.activeRoomId || ctx?.roomId || "");
  const tries = [
    ["presence", rid],
    ["rooms", rid, "presence"],
    ["rooms", rid, "participants"],
    ["room", "presence"],
    ["participants"],
    ["users"],
    ["presenceUsers"],
  ] as any[];

  function get(obj: any, path: any[]) {
    let cur = obj;
    for (const k of path) {
      if (!cur) return null;
      cur = cur[k];
    }
    return cur;
  }

  for (const path of tries) {
    const v = get(ctx, path.filter(Boolean));
    if (!v) continue;
    const vv: any = Array.isArray(v)
      ? v
      : v && typeof v === "object"
        ? Object.values(v as any)
        : null;
    if (Array.isArray(vv) && vv.length) return vv.map(normUser).filter(Boolean);
  }

  const me = ctx?.me ?? ctx?.user ?? ctx?.auth?.user;
  if (me) return [normUser(me)];
  return [];
}

export default function ModeratorToolsPanel(props: { roomId?: string; title?: string } = {}) {
  const w: any = useWeered();

  const roomId = props.roomId || w.activeRoomId || "";
  const me = w?.me ?? w?.user ?? w?.auth?.user ?? null;
  const myId = String(me?.id ?? "");
  const role = String(w.role || w.me?.role || w.me?.globalRole || "");
  const allowed = useMemo(() => canMod(role), [role]);

  const wired = useMemo(() => {
    return {
      lock: !!w?.lockRoom,
      unlock: !!w?.unlockRoom,
      rename: !!w?.renameRoom,
      kick: !!w?.kick,
      mute: !!w?.mute,
      promote: !!w?.promote,
      demote: !!w?.demote,
      ban: !!w?.ban,
      unban: !!w?.unban,
      staffKick: !!w?.staffKick,
    };
  }, [w]);

  const people = useMemo(() => {
    const arr = extractParticipants(w, roomId);
    const seen = new Set<string>();
    return arr.filter((p) => {
      const k = String(p.id ?? p.name ?? "");
      if (!k) return true;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [w, roomId]);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [note, setNote] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => {
      const s = `${p.name ?? ""} ${p.handle ?? ""} ${p.id ?? ""}`.toLowerCase();
      return s.includes(q);
    });
  }, [people, query]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return filtered.find((p) => String(p.id ?? p.name ?? "") === selectedId) || null;
  }, [filtered, selectedId]);

  const safe = useCallback((fn: () => any, labelOk: string, labelFail?: string) => {
    try {
      fn();
      setNote(labelOk);
    } catch {
      setNote(labelFail || `${labelOk} failed`);
    }
  }, []);

  const targetId = String(selected?.id ?? selected?.name ?? "");
  const targetName = String(selected?.name ?? selected?.handle ?? targetId ?? "unknown");

  const copyDebug = useCallback(async () => {
    const payload = {
      roomId,
      role,
      me: me ? { id: String(me.id ?? ""), name: String(me.name ?? me.username ?? "") } : null,
      wired,
      peopleCount: people.length,
      people: people.map((p) => ({
        id: String(p.id ?? ""),
        name: String(p.name ?? ""),
        role: String(p.role ?? ""),
      })),
      selected: selected ? { id: targetId, name: targetName } : null,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setNote("Copied debug snapshot.");
    } catch {
      setNote("Copy failed (clipboard blocked).");
    }
  }, [me, people, roomId, role, selected, targetId, targetName, wired]);

  if (!allowed) {
    return (
      <section className="weered-panel2 p-3" style={{ borderRadius: 16 }}>
        <div style={{ fontWeight: 950, marginBottom: 6 }}>{props.title || "Moderator Tools"}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Visible to moderators/owners only.</div>
      </section>
    );
  }

  const canTarget = !!targetId;
  const isSelf = canTarget && !!myId && targetId === myId;

  return (
    <section className="weered-panel2 p-3" style={{ borderRadius: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
        }}
      >
        <div style={{ fontWeight: 950 }}>{props.title || "Moderator Tools"}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          {roomId ? `room: ${roomId}` : "no room selected"}
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(148,163,184,.14)", margin: "10px 0" }} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, opacity: 0.85 }}>
        {Object.entries(wired).map(([k, v]) => (
          <div
            key={k}
            style={{
              padding: "3px 8px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,.18)",
              background: v ? "rgba(34,197,94,.10)" : "rgba(148,163,184,.06)",
            }}
          >
            {k}: {v ? "wired" : "off"}
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: "rgba(148,163,184,.14)", margin: "12px 0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          onClick={() =>
            safe(() => w.lockRoom?.(), wired.lock ? "lock sent" : "lock not wired (UI-only)")
          }
          style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}
        >
          Lock
        </button>
        <button
          onClick={() =>
            safe(
              () => w.unlockRoom?.(),
              wired.unlock ? "unlock sent" : "unlock not wired (UI-only)",
            )
          }
          style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}
        >
          Unlock
        </button>

        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>Rename room</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
              placeholder="New room name"
              style={{ flex: 1, padding: "8px 10px", borderRadius: 12 }}
            />
            <button
              onClick={() =>
                safe(
                  () => w.renameRoom?.(renameTo),
                  wired.rename ? "rename sent" : "rename not wired (UI-only)",
                )
              }
              style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}
            >
              Rename
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(148,163,184,.14)", margin: "12px 0" }} />

      <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 6 }}>User picker</div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search users…"
        style={{ width: "100%", padding: "8px 10px", borderRadius: 12, marginBottom: 8 }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 12 }}
        >
          <option value="">(auto)</option>
          {filtered.slice(0, 60).map((p, i) => {
            const id = String(p.id ?? p.name ?? i);
            const name = String(p.name ?? p.handle ?? id);
            return (
              <option key={id} value={id}>
                {name}
              </option>
            );
          })}
        </select>
        <button
          onClick={() => {
            setQuery("");
            setSelectedId("");
          }}
          style={{ padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}
        >
          Clear
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
        selected:{" "}
        <span style={{ opacity: 0.95, fontWeight: 800 }}>{selected ? targetName : "none"}</span>
        {isSelf ? <span style={{ marginLeft: 8, opacity: 0.75 }}>(self)</span> : null}
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          disabled={!canTarget || isSelf}
          onClick={() =>
            safe(
              () => w.kick?.(targetId),
              wired.kick ? `kick sent → ${targetName}` : "kick not wired (UI-only)",
            )
          }
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            fontWeight: 950,
            opacity: !canTarget || isSelf ? 0.5 : 1,
          }}
        >
          Kick
        </button>

        <button
          disabled={!canTarget || isSelf}
          onClick={() =>
            safe(
              () => w.mute?.(targetId),
              wired.mute ? `mute sent → ${targetName}` : "mute not wired (UI-only)",
            )
          }
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            fontWeight: 950,
            opacity: !canTarget || isSelf ? 0.5 : 1,
          }}
        >
          Mute
        </button>

        <button
          disabled={!canTarget || isSelf}
          onClick={() =>
            safe(
              () => w.promote?.(targetId),
              wired.promote ? `promote sent → ${targetName}` : "promote not wired (UI-only)",
            )
          }
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            fontWeight: 950,
            opacity: !canTarget || isSelf ? 0.5 : 1,
          }}
        >
          Promote MOD
        </button>

        <button
          disabled={!canTarget || isSelf}
          onClick={() =>
            safe(
              () => w.demote?.(targetId),
              wired.demote ? `demote sent → ${targetName}` : "demote not wired (UI-only)",
            )
          }
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            fontWeight: 950,
            opacity: !canTarget || isSelf ? 0.5 : 1,
          }}
        >
          Demote
        </button>

        <button
          disabled={!canTarget || isSelf}
          onClick={() =>
            safe(
              () => w.ban?.(targetId),
              wired.ban ? `ban sent → ${targetName}` : "ban not wired (UI-only)",
            )
          }
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            fontWeight: 950,
            opacity: !canTarget || isSelf ? 0.5 : 1,
          }}
        >
          Ban
        </button>

        <button
          disabled={!canTarget || isSelf}
          onClick={() =>
            safe(
              () => w.unban?.(targetId),
              wired.unban ? `unban sent → ${targetName}` : "unban not wired (UI-only)",
            )
          }
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            fontWeight: 950,
            opacity: !canTarget || isSelf ? 0.5 : 1,
          }}
        >
          Unban
        </button>

        {canStaffOrGod(role) ? (
          <button
            disabled={!canTarget || isSelf}
            onClick={() =>
              safe(
                () => w.staffKick?.(targetId),
                wired.staffKick
                  ? `staffKick sent → ${targetName}`
                  : "staffKick not wired (UI-only)",
              )
            }
            style={{
              gridColumn: "1 / -1",
              padding: "8px 10px",
              borderRadius: 12,
              fontWeight: 950,
              opacity: !canTarget || isSelf ? 0.5 : 1,
            }}
          >
            Staff Kick (global)
          </button>
        ) : null}

        <button
          onClick={copyDebug}
          style={{ gridColumn: "1 / -1", padding: "8px 10px", borderRadius: 12, fontWeight: 950 }}
        >
          Copy debug snapshot
        </button>
      </div>

      {note ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>{note}</div> : null}
    </section>
  );
}
