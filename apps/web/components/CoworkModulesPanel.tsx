"use client";

import React, { useEffect, useRef, useState } from "react";
import ModuleTabBar from "./ModuleTabBar";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#7FA89B"; // sage — calm, at work

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

const TABS = [
  { id: "floor" as const, label: "The Floor" },
  { id: "sprint" as const, label: "Sprint" },
  { id: "board" as const, label: "Day Board" },
];
type TabId = (typeof TABS)[number]["id"];

const S: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", overflow: "hidden" },
  body: { flex: 1, minHeight: 0, overflow: "auto", padding: "4px 14px 20px" },
  kick: {
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: ".16em",
    textTransform: "uppercase",
    color: "rgba(127,168,155,.9)",
    margin: "14px 0 8px",
  },
  card: {
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 10,
  },
  muted: { color: "rgba(148,163,184,.75)", fontSize: 12.5, lineHeight: 1.55 },
  row: { display: "flex", alignItems: "center", gap: 10 },
  btn: {
    padding: "7px 14px",
    borderRadius: 6,
    border: "1px solid rgba(127,168,155,.5)",
    background: "rgba(127,168,155,.15)",
    color: "#C9DED6",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnQuiet: {
    padding: "7px 12px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.14)",
    background: "transparent",
    color: "rgba(226,232,240,.85)",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  input: {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(0,0,0,.25)",
    color: "rgba(236,242,250,.95)",
    fontSize: 13,
  },
  medallion: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(226,232,240,.9)",
    background: "rgba(127,168,155,.18)",
    border: "1px solid rgba(127,168,155,.35)",
  },
};

// ---- The Floor -------------------------------------------------------------

type FloorRoom = {
  id: string;
  name: string;
  note: string;
  online: number;
  users: { id?: string; name: string; avatar?: string }[];
  accent?: string;
};

const FLOOR_ROOMS: FloorRoom[] = [
  {
    id: "cowork-floor",
    name: "The Floor",
    note: "Open chat. Say what you're on, ask the room, think out loud.",
    online: 0,
    users: [],
  },
  {
    id: "cowork-deepwork",
    name: "Deep Work",
    note: "Listen-only voice. Cameras optional, mics off. Sit down and be seen working.",
    online: 0,
    users: [],
  },
  {
    id: "cowork-watercooler",
    name: "The Watercooler",
    note: "Open voice for the break. Talk shop or complain about invoices. Be a person for ten minutes.",
    online: 0,
    users: [],
  },
  {
    id: "cowork-standup",
    name: "Standup",
    note: "Async check-ins: shipping, blocked-on, finished-yesterday. No meetings.",
    online: 0,
    users: [],
  },
];

// Per-room color + type chip. Unknown rooms (created later) fall back to the
// API accent or the lobby sage.
const ROOM_META: Record<string, { accent: string; chip: string }> = {
  "cowork-floor": { accent: "#7FA89B", chip: "open chat" },
  "cowork-deepwork": { accent: "#8B7FD4", chip: "listen-only voice" },
  "cowork-watercooler": { accent: "#E0B653", chip: "break voice" },
  "cowork-standup": { accent: "#C98B9B", chip: "async check-ins" },
};
const ROOM_ORDER = ["cowork-floor", "cowork-deepwork", "cowork-watercooler", "cowork-standup"];
const roomRank = (id: string) => {
  const i = ROOM_ORDER.indexOf(id);
  return i === -1 ? 99 : i;
};

function Floor() {
  const [users, setUsers] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Live room cards so flair edits show up here; FLOOR_ROOMS is the fallback
  // when the fetch hasn't landed (or fails).
  const [rooms, setRooms] = useState<FloorRoom[] | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`${API}/lobbies/cowork/presence`, { headers: authHeaders() });
        const j = await r.json();
        if (!stop) setUsers(Array.isArray(j?.users) ? j.users : []);
      } catch {}
      if (!stop) setLoaded(true);
    };
    const loadRooms = async () => {
      try {
        const r = await fetch(`${API}/lobbies/cowork/rooms`);
        const j = await r.json();
        if (!stop && Array.isArray(j?.rooms) && j.rooms.length) {
          setRooms(
            j.rooms
              .map((x: any) => ({
                id: String(x.id || ""),
                name: x.name,
                note: x.description || "",
                online: x.onlineCount || 0,
                users: Array.isArray(x.onlineUsers) ? x.onlineUsers : [],
                accent: x.accentColor || undefined,
              }))
              .sort((a: FloorRoom, b: FloorRoom) => roomRank(a.id) - roomRank(b.id)),
          );
        }
      } catch {}
    };
    void load();
    void loadRooms();
    const iv = setInterval(load, 30_000);
    const ivRooms = setInterval(loadRooms, 60_000);
    return () => {
      stop = true;
      clearInterval(iv);
      clearInterval(ivRooms);
    };
  }, []);

  return (
    <div>
      <div style={S.kick}>Clocked in · {users.length}</div>
      {!loaded && <div style={S.muted}>Checking the floor…</div>}
      {loaded && users.length === 0 && (
        <div style={S.card}>
          <div style={{ ...S.muted }}>
            Nobody on the floor right now. First one in turns on the lights. Join a room and set
            your status to what you&rsquo;re shipping.
          </div>
        </div>
      )}
      {users.map((u: any) => (
        <div key={u.id || u.name} style={{ ...S.card, ...S.row }}>
          {u?.avatar ? (
            <img
              src={u.avatar}
              alt=""
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
                border: "1px solid rgba(255,255,255,.16)",
                background: "rgba(0,0,0,.3)",
              }}
            />
          ) : (
            <span
              style={{
                ...S.medallion,
                ...(u?.avatarColor
                  ? { background: `${u.avatarColor}33`, borderColor: u.avatarColor }
                  : {}),
              }}
            >
              {String(u?.name || "?")
                .charAt(0)
                .toUpperCase()}
            </span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(236,242,250,.95)" }}>
              {u?.name || "Someone"}
            </div>
            {(u?.statusText || u?.status) && (
              <div style={{ ...S.muted, marginTop: 2 }}>
                {u?.statusEmoji ? `${u.statusEmoji} ` : ""}
                {u?.statusText || u?.status}
              </div>
            )}
          </div>
          {u?.isAway && <span style={{ ...S.muted, fontSize: 11 }}>lying low</span>}
        </div>
      ))}
      <div style={S.kick}>The rooms</div>
      <style>{`
        .cw-roomcard{transition:transform .12s ease,border-color .12s ease,background .12s ease}
        .cw-roomcard:hover{transform:translateY(-1px);border-color:var(--cw-a);background:rgba(255,255,255,.05)}
      `}</style>
      {(rooms ?? FLOOR_ROOMS).map((r) => {
        const meta = ROOM_META[r.id] || { accent: r.accent || ACCENT, chip: "room" };
        const acc = meta.accent;
        return (
          <a
            key={r.id}
            href={`/room/${encodeURIComponent(r.id)}`}
            className="cw-roomcard"
            style={
              {
                display: "block",
                textDecoration: "none",
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.07)",
                borderLeft: `3px solid ${acc}`,
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 10,
                "--cw-a": acc,
              } as React.CSSProperties
            }
          >
            <div style={{ ...S.row, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(236,242,250,.95)" }}>
                {r.name}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: acc,
                  border: `1px solid ${acc}55`,
                  background: `${acc}1f`,
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                {meta.chip}
              </span>
              <span style={{ flex: 1 }} />
              {r.users.length > 0 ? (
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  {r.users.slice(0, 4).map((u, i) =>
                    u.avatar ? (
                      <img
                        key={u.id || u.name}
                        src={u.avatar}
                        alt=""
                        title={u.name}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          objectFit: "cover",
                          marginLeft: i ? -7 : 0,
                          border: "2px solid #17171c",
                          background: "#17171c",
                        }}
                      />
                    ) : (
                      <span
                        key={u.id || u.name}
                        title={u.name}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          marginLeft: i ? -7 : 0,
                          border: "2px solid #17171c",
                          background: `${acc}44`,
                          color: "rgba(236,242,250,.9)",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {String(u.name || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    ),
                  )}
                  <span style={{ color: acc, fontSize: 11.5, fontWeight: 700, marginLeft: 7 }}>
                    {r.online} in
                  </span>
                </span>
              ) : (
                <span style={{ ...S.muted, fontSize: 11 }}>door&rsquo;s open</span>
              )}
            </div>
            <div style={{ ...S.muted, marginTop: 4 }}>{r.note}</div>
          </a>
        );
      })}
    </div>
  );
}

// ---- Sprint ----------------------------------------------------------------

type SprintState = {
  phase: "FOCUS" | "BREAK";
  phaseEndsInSec: number;
  roster: { id: string; name: string; goal: string }[];
  nextRoster: { id: string; name: string; goal: string }[];
  joined: boolean;
};

function fmtMMSS(s: number): string {
  const m = Math.floor(Math.max(0, s) / 60);
  const ss = Math.max(0, s) % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

function Sprint({ accent, currentUserId }: { accent: string; currentUserId?: string }) {
  const [st, setSt] = useState<SprintState | null>(null);
  const [left, setLeft] = useState(0);
  const [goal, setGoal] = useState("");
  const fetchedAt = useRef(0);

  const load = async () => {
    try {
      const r = await fetch(`${API}/cowork/sprint`, { headers: authHeaders() });
      const j = await r.json();
      if (j?.ok) {
        setSt(j);
        setLeft(j.phaseEndsInSec);
        fetchedAt.current = Date.now();
      }
    } catch {}
  };

  useEffect(() => {
    void load();
    const iv = setInterval(load, 30_000);
    const tick = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          void load(); // phase boundary — resync
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => {
      clearInterval(iv);
      clearInterval(tick);
    };
  }, []);

  const act = async (path: string, body?: any) => {
    try {
      await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: body ? JSON.stringify(body) : undefined,
      });
      await load();
    } catch {}
  };

  if (!st) return <div style={{ ...S.muted, marginTop: 14 }}>Winding the clock…</div>;

  const focus = st.phase === "FOCUS";
  const shownRoster = focus ? st.roster : st.nextRoster;
  return (
    <div>
      <div style={{ ...S.card, marginTop: 12, textAlign: "center", padding: "22px 14px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".22em",
            color: focus ? accent : "#E0B653",
          }}
        >
          {focus ? "FOCUS" : "BREAK"}
        </div>
        <div
          style={{
            fontSize: 58,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            color: "rgba(236,242,250,.96)",
            lineHeight: 1.1,
            margin: "6px 0 2px",
          }}
        >
          {fmtMMSS(left)}
        </div>
        <div
          aria-hidden
          style={{
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,.08)",
            maxWidth: 280,
            margin: "10px auto 10px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 2,
              width: `${Math.max(0, Math.min(1, 1 - left / (focus ? 3000 : 600))) * 100}%`,
              background: focus ? accent : "#E0B653",
              transition: "width 1s linear",
            }}
          />
        </div>
        <div style={S.muted}>
          {focus
            ? "Deep work until :50. The room is watching, in the good way."
            : "Break. Stretch, water, Watercooler. Next sprint at the top of the hour."}
        </div>
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {currentUserId ? (
            st.joined ? (
              <button style={S.btnQuiet} onClick={() => act("/cowork/sprint/leave")}>
                Step out
              </button>
            ) : (
              <>
                <input
                  style={{ ...S.input, width: 260, maxWidth: "60vw" }}
                  placeholder={
                    focus ? "What are you on? (optional)" : "Goal for the :00 sprint (optional)"
                  }
                  value={goal}
                  maxLength={140}
                  onChange={(e) => setGoal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && act("/cowork/sprint/join", { goal })}
                />
                <button style={S.btn} onClick={() => act("/cowork/sprint/join", { goal })}>
                  {focus ? "Join this sprint" : "I'm in at :00"}
                </button>
              </>
            )
          ) : (
            <span style={S.muted}>Sign in to join the sprint</span>
          )}
        </div>
      </div>

      <div style={S.kick}>
        {focus
          ? `In this sprint · ${shownRoster.length}`
          : `Committed for :00 · ${shownRoster.length}`}
      </div>
      {shownRoster.length === 0 && (
        <div style={S.muted}>
          {focus
            ? "Nobody's declared this hour yet. Join and set the tone."
            : "Nobody's committed yet. Be the reason someone else shows up."}
        </div>
      )}
      {shownRoster.map((p) => (
        <div key={p.id} style={{ ...S.card, ...S.row }}>
          <span style={S.medallion}>{p.name.charAt(0).toUpperCase()}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(236,242,250,.95)" }}>
              {p.name}
            </div>
            {p.goal && <div style={{ ...S.muted, marginTop: 2 }}>{p.goal}</div>}
          </div>
        </div>
      ))}
      <div style={{ ...S.muted, marginTop: 8 }}>
        The clock is the same for everyone: 50 on, 10 off, every hour. Deep Work is the listen-only
        room if you want company without conversation.
      </div>
    </div>
  );
}

// ---- Day Board -------------------------------------------------------------

type BoardEntry = { id: string; name: string; text: string; done: boolean; mine: boolean };

function DayBoard({ currentUserId }: { currentUserId?: string }) {
  const [entries, setEntries] = useState<BoardEntry[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const r = await fetch(`${API}/cowork/today`, { headers: authHeaders() });
      const j = await r.json();
      if (j?.ok) setEntries(j.entries || []);
    } catch {}
    setLoaded(true);
  };

  useEffect(() => {
    void load();
    const iv = setInterval(load, 45_000);
    return () => clearInterval(iv);
  }, []);

  const add = async () => {
    if (!text.trim()) return;
    setErr("");
    try {
      const r = await fetch(`${API}/cowork/today`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!j?.ok) {
        setErr(
          j?.error === "board_full" ? "Five per day. Finish something first." : "Didn't post.",
        );
        return;
      }
      setText("");
      await load();
    } catch {
      setErr("Didn't post.");
    }
  };

  const act = async (path: string) => {
    try {
      await fetch(`${API}${path}`, { method: "POST", headers: authHeaders() });
      await load();
    } catch {}
  };

  const doneCount = entries.filter((e) => e.done).length;
  return (
    <div>
      <div style={{ ...S.card, marginTop: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(236,242,250,.95)" }}>
          Say it where people can see it
        </div>
        <div style={{ ...S.muted, marginTop: 4 }}>
          Up to five intentions for today. The board wipes clean every day, so yesterday can&rsquo;t
          guilt you. Today only, in public.
        </div>
        {currentUserId ? (
          <div style={{ ...S.row, marginTop: 10 }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder="Today I will…"
              value={text}
              maxLength={120}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <button style={S.btn} onClick={add}>
              Post it
            </button>
          </div>
        ) : (
          <div style={{ ...S.muted, marginTop: 8 }}>Sign in to post yours.</div>
        )}
        {err && <div style={{ ...S.muted, color: "#E08A83", marginTop: 6 }}>{err}</div>}
      </div>

      <div style={S.kick}>
        Today&rsquo;s board · {entries.length} posted{doneCount ? ` · ${doneCount} done` : ""}
      </div>
      {!loaded && <div style={S.muted}>Reading the board…</div>}
      {loaded && entries.length === 0 && (
        <div style={S.muted}>Empty board. Whatever you post first sets the bar.</div>
      )}
      {entries.map((e) => (
        <div key={e.id} style={{ ...S.card, ...S.row }}>
          {e.mine ? (
            <button
              title={e.done ? "Mark not done" : "Mark done"}
              style={{
                ...S.medallion,
                cursor: "pointer",
                background: e.done ? "rgba(127,168,155,.35)" : "rgba(255,255,255,.05)",
                borderColor: e.done ? "rgba(127,168,155,.6)" : "rgba(255,255,255,.16)",
              }}
              onClick={() => act(`/cowork/today/${e.id}/toggle`)}
            >
              {e.done ? "✓" : ""}
            </button>
          ) : (
            <span
              style={{
                ...S.medallion,
                background: e.done ? "rgba(127,168,155,.35)" : "rgba(255,255,255,.05)",
              }}
            >
              {e.done ? "✓" : e.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13.5,
                color: "rgba(236,242,250,.95)",
                textDecoration: e.done ? "line-through" : "none",
                opacity: e.done ? 0.65 : 1,
              }}
            >
              {e.text}
            </div>
            <div style={{ ...S.muted, marginTop: 2, fontSize: 11.5 }}>{e.name}</div>
          </div>
          {e.mine && (
            <button
              title="Remove"
              style={{ ...S.btnQuiet, padding: "2px 9px" }}
              onClick={() => act(`/cowork/today/${e.id}/delete`)}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- shell -----------------------------------------------------------------

export default function CoworkModulesPanel({
  lobbyId: _lobbyId,
  accentColor,
  currentUserId,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  currentUserId?: string;
  style?: React.CSSProperties;
}) {
  const accent = accentColor || ACCENT;
  const [tab, setTab] = useState<TabId>("floor");

  return (
    <div style={{ ...S.wrap, ...style }}>
      <ModuleTabBar
        tabs={TABS}
        active={tab}
        onSelect={(id) => setTab(id as TabId)}
        accent={accent}
      />
      <div style={S.body}>
        {tab === "floor" && <Floor />}
        {tab === "sprint" && <Sprint accent={accent} currentUserId={currentUserId} />}
        {tab === "board" && <DayBoard currentUserId={currentUserId} />}
      </div>
    </div>
  );
}
