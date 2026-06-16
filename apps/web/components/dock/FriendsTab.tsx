"use client";
import React from "react";
import EmptyState from "../EmptyState";
import { Avatar } from "./shellHelpers";

// Friends tab (+ FriendRow + labels + lastSeenAgo) extracted from DockShell.

export function FriendsTab({
  apiBase,
  tokenMaybe,
  myId,
  myRoomId,
  rooms: roomUsers,
  onMessage,
  onJoin,
}: {
  apiBase: string;
  tokenMaybe: string;
  myId: string;
  rooms: any[];
  onMessage: (pn: string, pi: string) => void;
  onJoin: (r: string) => void;
  myRoomId?: string;
}) {
  const [friends, setFriends] = React.useState<any[]>([]);
  const [requests, setRequests] = React.useState<any[]>([]);
  const [addInput, setAddInput] = React.useState("");
  const [addNote, setAddNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [subTab, setSubTab] = React.useState<"friends" | "requests">("friends");

  async function load() {
    if (!apiBase || !tokenMaybe) return;
    setLoading(true);
    try {
      const [fr, rq] = await Promise.all([
        fetch(`${apiBase}/friends`, { headers: { Authorization: `Bearer ${tokenMaybe}` } }).then(
          (r) => r.json(),
        ),
        fetch(`${apiBase}/friends/requests`, {
          headers: { Authorization: `Bearer ${tokenMaybe}` },
        }).then((r) => r.json()),
      ]);
      setFriends(Array.isArray(fr?.friends) ? fr.friends : []);
      setRequests(Array.isArray(rq?.requests) ? rq.requests : []);
    } catch {}
    setLoading(false);
  }

  React.useEffect(() => {
    void load();
  }, [apiBase, tokenMaybe]);
  React.useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [apiBase, tokenMaybe]);

  async function sendRequest() {
    const target = addInput.trim();
    if (!target) return;
    setAddNote("");
    try {
      const profile = await fetch(`${apiBase}/profile/${encodeURIComponent(target)}`, {
        headers: { Authorization: `Bearer ${tokenMaybe}` },
      }).then((r) => r.json());
      if (!profile?.id) {
        setAddNote("User not found");
        return;
      }
      const res = await fetch(`${apiBase}/friends/request/${profile.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenMaybe}` },
      }).then((r) => r.json());
      if (res.ok) {
        setAddInput("");
        setAddNote("Request sent!");
        void load();
      } else setAddNote(res.error || "Failed");
    } catch {
      setAddNote("Error");
    }
  }

  async function accept(id: string) {
    await fetch(`${apiBase}/friends/accept/${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenMaybe}` },
    });
    void load();
  }
  async function decline(id: string) {
    await fetch(`${apiBase}/friends/decline/${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenMaybe}` },
    });
    void load();
  }
  async function remove(userId: string) {
    await fetch(`${apiBase}/friends/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenMaybe}` },
    });
    void load();
  }
  const [invited, setInvited] = React.useState<Record<string, boolean>>({});
  async function invite(userId: string) {
    try {
      const r = await fetch(`${apiBase}/friends/${userId}/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenMaybe}` },
      }).then((x) => x.json());
      if (r?.ok) setInvited((prev) => ({ ...prev, [userId]: true }));
    } catch {}
  }

  const online = friends.filter((f) => f.online);
  const offline = friends.filter((f) => !f.online);

  const iStyle: React.CSSProperties = {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--weered-bd2)",
    background: "rgba(255,255,255,.05)",
    color: "var(--weered-text)",
    outline: "none",
    fontSize: 12,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div
        style={{ padding: "10px 12px", borderBottom: "1px solid var(--weered-bd)", flexShrink: 0 }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            placeholder="Add by username…"
            style={iStyle}
            onKeyDown={(e) => e.key === "Enter" && sendRequest()}
          />
          <button
            onClick={sendRequest}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--weered-accent-ring)",
              background: "var(--weered-accent-bg)",
              color: "var(--weered-accent-text)",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            +
          </button>
        </div>
        {addNote && (
          <div style={{ fontSize: 11, marginTop: 5, color: "var(--weered-muted)" }}>{addNote}</div>
        )}
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid var(--weered-bd)", flexShrink: 0 }}>
        {(["friends", "requests"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            style={{
              flex: 1,
              padding: "8px 0",
              border: "none",
              background: "transparent",
              color: subTab === t ? "var(--weered-accent-text)" : "var(--weered-muted)",
              fontSize: 11,
              fontWeight: subTab === t ? 700 : 500,
              cursor: "pointer",
              borderBottom:
                subTab === t ? "2px solid var(--weered-accent-text)" : "2px solid transparent",
            }}
          >
            {t === "friends"
              ? `Friends${friends.length ? ` · ${friends.length}` : ""}`
              : `Requests${requests.length ? ` · ${requests.length}` : ""}`}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && !friends.length && !requests.length && (
          <div
            style={{
              padding: 20,
              textAlign: "center" as const,
              color: "var(--weered-muted)",
              fontSize: 13,
            }}
          >
            Loading…
          </div>
        )}
        {subTab === "requests" &&
          (requests.length === 0 ? (
            <EmptyState
              title="Inbox is clean."
              hint="When someone wants to connect, they'll land here."
            />
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--weered-bd)",
                }}
              >
                <Avatar name={r.fromName || "?"} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>@{r.fromName}</div>
                  <div style={{ fontSize: 11, color: "var(--weered-muted)" }}>wants to connect</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => accept(r.id)}
                    style={{
                      padding: "5px 9px",
                      borderRadius: 8,
                      border: "1px solid rgba(34,197,94,.4)",
                      background: "rgba(34,197,94,.12)",
                      color: "rgb(134,239,172)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => decline(r.id)}
                    style={{
                      padding: "5px 9px",
                      borderRadius: 8,
                      border: "1px solid var(--weered-bd)",
                      background: "transparent",
                      color: "var(--weered-muted)",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          ))}
        {subTab === "friends" &&
          (friends.length === 0 ? (
            <EmptyState title="Riding solo." hint="Search a name up top to pull someone in." />
          ) : (
            <>
              {online.length > 0 && (
                <div
                  style={{
                    padding: "10px 14px 4px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--weered-muted)",
                    textTransform: "uppercase" as const,
                    letterSpacing: 0.5,
                  }}
                >
                  Online · {online.length}
                </div>
              )}
              {online.map((f) => (
                <FriendRow
                  key={f.id}
                  f={f}
                  onMessage={onMessage}
                  onJoin={onJoin}
                  onRemove={remove}
                  onInvite={myRoomId ? invite : undefined}
                  invited={!!invited[f.id]}
                />
              ))}
              {offline.length > 0 && (
                <div
                  style={{
                    padding: "10px 14px 4px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--weered-muted)",
                    textTransform: "uppercase" as const,
                    letterSpacing: 0.5,
                    marginTop: 4,
                  }}
                >
                  Offline · {offline.length}
                </div>
              )}
              {offline.map((f) => (
                <FriendRow
                  key={f.id}
                  f={f}
                  onMessage={onMessage}
                  onJoin={onJoin}
                  onRemove={remove}
                />
              ))}
            </>
          ))}
      </div>
    </div>
  );
}

export const FRIEND_TIER_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  KINGPIN: { label: "KINGPIN", color: "#fde68a", bg: "rgba(252,211,77,.15)" },
  FELON: { label: "FELON", color: "#fdba74", bg: "rgba(249,115,22,.15)" },
  INDICTED: { label: "INDICTED", color: "rgba(243,244,246,.85)", bg: "rgba(88,0,229,.15)" },
};
export const FRIEND_ROLE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  GOD: { label: "GOD", color: "#fde68a", bg: "rgba(234,179,8,.18)" },
  ADMIN: { label: "ADMIN", color: "#fca5a5", bg: "rgba(239,68,68,.14)" },
  STAFF: { label: "STAFF", color: "#93c5fd", bg: "rgba(59,130,246,.14)" },
  SUPPORT: { label: "SUPPORT", color: "#6ee7b7", bg: "rgba(16,185,129,.14)" },
  MOD: { label: "MOD", color: "rgba(216,180,254,.95)", bg: "rgba(124,58,237,.14)" },
};

export function lastSeenAgo(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function FriendRow({
  f,
  onMessage,
  onJoin,
  onRemove,
  onInvite,
  invited,
}: {
  f: any;
  onMessage: (n: string, i: string) => void;
  onJoin: (r: string) => void;
  onRemove: (id: string) => void;
  onInvite?: (id: string) => void;
  invited?: boolean;
}) {
  const role = String(f.globalRole || "").toUpperCase();
  const tier = String(f.tier || "").toUpperCase();
  const roleChip = FRIEND_ROLE_LABEL[role];
  const tierChip = FRIEND_TIER_LABEL[tier];
  const crewTag = f.primaryCrew?.tag ? `[${f.primaryCrew.tag}]` : "";
  const crewAccent = f.primaryCrew?.accentColor || "rgba(124,58,237,.85)";
  const tagShape = String(f.primaryCrew?.tagShape || "rounded");
  const tagRadius = tagShape === "square" ? 0 : tagShape === "pill" ? 999 : 4;
  const validPillBg = f.pillBgColor && /^#[0-9a-f]{6}$/i.test(f.pillBgColor) ? f.pillBgColor : null;

  const [pillIntensity, setPillIntensity] = React.useState<number>(60);
  React.useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("weered:pillBgIntensity");
        const n = raw == null ? 60 : Math.max(0, Math.min(100, Number(raw)));
        if (Number.isFinite(n)) setPillIntensity(n);
      } catch {}
    };
    read();
    const onChange = () => read();
    window.addEventListener("weered:pillBgIntensity", onChange);
    return () => window.removeEventListener("weered:pillBgIntensity", onChange);
  }, []);

  const pillTint = (() => {
    if (!validPillBg) return undefined;
    const r = parseInt(validPillBg.slice(1, 3), 16);
    const g = parseInt(validPillBg.slice(3, 5), 16);
    const b = parseInt(validPillBg.slice(5, 7), 16);
    const a = pillIntensity / 100;
    if (a <= 0.01) return undefined;
    return `linear-gradient(90deg, rgba(${r},${g},${b},${a.toFixed(3)}) 0%, rgba(${r},${g},${b},${(a * 0.45).toFixed(3)}) 60%, transparent 100%)`;
  })();

  const secondary = (() => {
    if (f.online) {
      if (f.isAway) return f.roomName ? `lying low in ${f.roomName}` : "lying low";
      return f.roomName ? `in ${f.roomName}` : "online";
    }
    if (f.lastSeenLocation && f.lastSeenAt) {
      return `last seen in ${f.lastSeenLocation} · ${lastSeenAgo(f.lastSeenAt)}`;
    }
    if (f.lastSeenAt) return `last seen ${lastSeenAgo(f.lastSeenAt)}`;
    return "offline";
  })();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 14px",
        borderBottom: "1px solid var(--weered-bd)",
        background: pillTint,
      }}
    >
      <div style={{ position: "relative" as const }}>
        <Avatar name={f.name || "?"} size={32} chosenColor={f.avatarColor} src={f.avatar} />
        <span
          style={{
            position: "absolute" as const,
            bottom: 0,
            right: 0,
            width: 9,
            height: 9,
            borderRadius: 999,
            background: f.online ? (f.isAway ? "#facc15" : "#22c55e") : "rgba(255,255,255,.2)",
            border: "2px solid var(--weered-panel2)",
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: "var(--weered-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap" as const,
            }}
          >
            {f.name}
          </span>
          {crewTag && (
            <span
              title={f.primaryCrew?.name || ""}
              style={{
                fontSize: 9,
                fontWeight: 900,
                padding: "1px 5px",
                borderRadius: tagRadius,
                color: crewAccent,
                background: `${crewAccent}1f`,
                border: `1px solid ${crewAccent}40`,
                letterSpacing: ".05em",
                flexShrink: 0,
                fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
              }}
            >
              {crewTag}
            </span>
          )}
          {roleChip && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                padding: "1px 5px",
                borderRadius: 4,
                color: roleChip.color,
                background: roleChip.bg,
                letterSpacing: ".06em",
                flexShrink: 0,
              }}
            >
              {roleChip.label}
            </span>
          )}
          {tierChip && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                padding: "1px 5px",
                borderRadius: 4,
                color: tierChip.color,
                background: tierChip.bg,
                letterSpacing: ".06em",
                flexShrink: 0,
              }}
            >
              {tierChip.label}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--weered-muted)",
            marginTop: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap" as const,
          }}
        >
          {secondary}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => onMessage(f.name, f.id)}
          style={{
            padding: "5px 9px",
            borderRadius: 8,
            border: "1px solid var(--weered-bd2)",
            background: "rgba(255,255,255,.05)",
            color: "var(--weered-text)",
            fontSize: 11,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          DM
        </button>
        {onInvite && (
          <button
            disabled={invited}
            onClick={() => onInvite(f.id)}
            style={{
              padding: "5px 9px",
              borderRadius: 8,
              border: invited ? "1px solid rgba(34,197,94,.25)" : "1px solid rgba(34,197,94,.35)",
              background: invited ? "rgba(34,197,94,.05)" : "rgba(34,197,94,.10)",
              color: invited ? "rgba(134,239,172,.55)" : "rgba(134,239,172,.95)",
              fontSize: 11,
              cursor: invited ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {invited ? "Invited \u2713" : "Invite"}
          </button>
        )}
        {f.online && f.roomId && (
          <button
            onClick={() => onJoin(f.roomId)}
            style={{
              padding: "5px 9px",
              borderRadius: 8,
              border: "1px solid var(--weered-accent-ring)",
              background: "var(--weered-accent-bg)",
              color: "var(--weered-accent-text)",
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Join
          </button>
        )}
      </div>
    </div>
  );
}
