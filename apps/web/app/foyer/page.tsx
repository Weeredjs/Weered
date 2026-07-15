"use client";

// Standalone white-label office-hours foyer (v2). Served at meet.<host>/foyer.
// Two modes, selected by URL:
//   CLIENT: ?invite=<token>  -> POST /api/auth/guest -> { token, scope:{ office, foyer, lobbyId } }
//   HOST:   ?host=<jwt>      -> the jwt IS the token (decoded client-side for name/scope only).
//
// Same-origin /api + /ws (Caddy proxies them on meet.*), so the global api.weered.ca
// fetch-patch never strips the Authorization header and the .weered.ca cookie is irrelevant.
// No upstream branding anywhere. Reuses the PROVEN v1 tile/audio/LiveKit helpers.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { PlanModule, PresentedPlanViewer } from "./PlanModule";

const API = "/api";
const wsBase = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

// --- Review Room design tokens (visual only; no behavior lives here) ---
const EASE = "cubic-bezier(0.22,0.61,0.36,1)";
const GOLD_GRAD = "linear-gradient(180deg,#D9B878,#C6A15B 55%,#A8853F)";
const SERIF = "Georgia, 'Iowan Old Style', Cambria, 'Times New Roman', serif";
const UIFONT = "'Segoe UI', Inter, system-ui, -apple-system, sans-serif";
const INK_TEXT = "rgba(236,242,250,.95)";
const MUTED_TEXT = "rgba(163,180,202,.72)";
const PAPER = "#F7F4EC";
const PAPER_INK = "#10233F";

// --- shared types ---
type Scope = { office?: string; foyer?: string; lobbyId?: string | null };
type Msg = { id: string; name: string; body: string };
type Person = { id: string; name: string };
type Knock = { id: string; name: string };

// The "-office" suffix convention lives in exactly one place for both views.
function buildOfficeRoom(scope: Scope): string {
  return scope.office ? `${scope.office}-office` : "";
}

// decode a JWT payload client-side (name/scope only; NEVER trusted for security)
function decodeJwt(jwt: string): any {
  try {
    const seg = jwt.split(".")[1];
    if (!seg) return {};
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(pad));
  } catch {
    return {};
  }
}

// monotonically-increasing id for per-connection media namespacing
let _connSeq = 0;

// ============================================================================
// LiveKit room connection. Self-contained, idempotent, cleanly torn down.
// Tiles render into `tilesEl`. Audio <audio> els are tagged data-lk-conn=<connId>
// so a hard disconnect()-based room switch can purge only THIS conn's media even
// if two Rooms transiently coexist (StrictMode remount, host+preview, etc.).
// TrackUnsubscribed may not fire per-track on a hard disconnect, hence the tag.
// ============================================================================
function makeRoomConn(opts: {
  getToken: () => string;
  tilesEl: () => HTMLDivElement | null;
  screenEl: () => HTMLDivElement | null; // large featured container for a screen-share
  selfLabel: () => string;
  onRoster: () => void;
  // unexpected disconnect of the CURRENTLY-active room (not an intentional teardown)
  onDropped: () => void;
  // local screen-share ended (incl. the browser's native "Stop sharing")
  onLocalScreenEnd: () => void;
  leavingRef: { current: boolean };
}) {
  const ref: { current: Room | null } = { current: null };
  const connId = `c${++_connSeq}`;
  // Connection generation. Every connect() and disconnect() bumps it; an in-flight
  // connect() re-checks it after each await and ABORTS if superseded. Without this,
  // disconnect() during connect()'s token fetch is a no-op (ref not yet assigned) and
  // the stale connect survives to stomp ref.current / linger as a zombie Room — the
  // exact race behind "guest drops right after a fast admit" (the arrival knock can
  // now be answered while the foyer connect is still in flight).
  let gen = 0;

  function addTile(pid: string, label: string, video: HTMLVideoElement) {
    const host = opts.tilesEl();
    if (!host) return;
    removeTile(pid);
    const wrap = document.createElement("div");
    wrap.setAttribute("data-pid", pid);
    wrap.style.cssText =
      "position:relative;aspect-ratio:4/3;background:#0A1D35;border:1px solid #1E3A5F;border-radius:6px;overflow:hidden";
    video.autoplay = true;
    video.playsInline = true;
    video.style.cssText = "width:100%;height:100%;object-fit:cover";
    const tag = document.createElement("div");
    tag.textContent = label;
    tag.style.cssText =
      "position:absolute;left:8px;bottom:8px;font:600 11px 'Segoe UI',sans-serif;color:rgba(236,242,250,.95);background:rgba(10,29,53,.72);padding:2px 8px;border-radius:4px";
    wrap.appendChild(video);
    wrap.appendChild(tag);
    host.appendChild(wrap);
  }
  function removeTile(pid: string) {
    opts
      .tilesEl()
      ?.querySelector(`[data-pid="${CSS.escape(pid)}"]`)
      ?.remove();
  }

  // A screen-share renders LARGE (the focus of a consult), not as a grid tile.
  // Only one screen at a time — a new share replaces the old.
  function setScreenVideo(video: HTMLVideoElement, label: string) {
    const host = opts.screenEl();
    if (!host) return;
    host.innerHTML = "";
    video.autoplay = true;
    video.playsInline = true;
    video.style.cssText =
      "width:100%;max-height:62vh;object-fit:contain;background:#000;border-radius:6px;display:block";
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative";
    const tag = document.createElement("div");
    tag.textContent = label;
    tag.style.cssText =
      "position:absolute;left:8px;top:8px;font:600 11px 'Segoe UI',sans-serif;color:rgba(236,242,250,.95);background:rgba(10,29,53,.72);padding:2px 8px;border-radius:4px";
    wrap.appendChild(video);
    wrap.appendChild(tag);
    host.appendChild(wrap);
  }
  function clearScreen() {
    const host = opts.screenEl();
    if (host) host.innerHTML = "";
  }

  // Detach old listeners and disconnect the given room without touching ref/media.
  function teardownRoom(r: Room | null) {
    if (!r) return;
    try {
      r.removeAllListeners();
    } catch {
      /* noop */
    }
    // disconnect() is async; fire-and-forget with its own rejection handler (teardown is best-effort)
    void r.disconnect().catch(() => {});
  }

  // returns the real mic state after connect (false if mic was denied/absent)
  async function connect(roomId: string, micWanted: boolean): Promise<{ micOn: boolean }> {
    const myGen = ++gen; // supersedes any older in-flight connect
    const vr = await fetch(`${API}/voice/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.getToken()}` },
      body: JSON.stringify({ roomId }),
    });
    if (!vr.ok) throw new Error("Couldn't start audio/video.");
    const { url, token: lkToken } = await vr.json();
    // A disconnect()/newer connect() won while we fetched the token: abort BEFORE
    // creating a Room or touching ref (the ref-stomp half of the fast-admit race).
    if (myGen !== gen) throw new Error("superseded");
    const r = new Room({ adaptiveStream: true, dynacast: true });
    ref.current = r;

    // Every handler captures its own `r` and ignores events once this room is no
    // longer the active one — livekit emits trailing events AFTER disconnect().
    r.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (ref.current !== r) return;
      const el = track.attach();
      if (track.kind === Track.Kind.Audio) {
        const a = el as HTMLAudioElement;
        a.autoplay = true;
        a.volume = 1;
        a.style.display = "none";
        a.setAttribute("data-lk-audio", participant.identity);
        a.setAttribute("data-lk-conn", connId);
        document.body.appendChild(a);
        a.play?.().catch(() => {});
      } else if (pub?.source === Track.Source.ScreenShare) {
        setScreenVideo(el as HTMLVideoElement, `${participant.name || "Guest"} · screen`);
      } else if (track.kind === Track.Kind.Video) {
        addTile(participant.identity, participant.name || "Guest", el as HTMLVideoElement);
      }
      opts.onRoster();
    });
    r.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
      track.detach().forEach((e) => e.remove());
      if (ref.current !== r) return;
      if (pub?.source === Track.Source.ScreenShare) clearScreen();
      else if (track.kind === Track.Kind.Video) removeTile(participant.identity);
      opts.onRoster();
    });
    r.on(RoomEvent.ParticipantConnected, () => {
      if (ref.current !== r) return;
      opts.onRoster();
    });
    r.on(RoomEvent.ParticipantDisconnected, (p) => {
      if (ref.current !== r) return;
      removeTile(p.identity);
      document
        .querySelectorAll(
          `audio[data-lk-conn="${connId}"][data-lk-audio="${CSS.escape(p.identity)}"]`,
        )
        .forEach((e) => e.remove());
      opts.onRoster();
    });
    r.on(RoomEvent.Disconnected, () => {
      // Only route a drop for the CURRENTLY-active room. A trailing Disconnected
      // from an already-superseded room (foyer->office switch) is ignored.
      if (ref.current !== r) return;
      purgeMedia(); // reclaim DOM media on a remote/server-driven drop too
      if (!opts.leavingRef.current) opts.onDropped();
    });
    // Self-view: drive off the publish event (the synchronous getter races publish-lag).
    r.on(RoomEvent.LocalTrackPublished, (pub) => {
      if (ref.current !== r || !pub.track) return;
      if (pub.source === Track.Source.ScreenShare) {
        setScreenVideo(pub.track.attach() as HTMLVideoElement, "Your screen");
      } else if (pub.kind === Track.Kind.Video) {
        addTile(
          r.localParticipant.identity,
          `${opts.selfLabel()} (you)`,
          pub.track.attach() as HTMLVideoElement,
        );
      }
    });
    r.on(RoomEvent.LocalTrackUnpublished, (pub) => {
      // Detach the local track (not just its wrapper) to release the sink.
      try {
        pub.track?.detach().forEach((e) => e.remove());
      } catch {
        /* noop */
      }
      if (ref.current !== r) return;
      if (pub.source === Track.Source.ScreenShare) {
        clearScreen();
        opts.onLocalScreenEnd(); // incl. the browser's native "Stop sharing" control
      } else if (pub.kind === Track.Kind.Video) {
        removeTile(r.localParticipant.identity);
      }
    });

    await r.connect(url, lkToken);
    // Superseded while LiveKit connected: hand the zombie straight back. Null ref
    // only if it is still ours (a newer connect may already own it).
    if (myGen !== gen) {
      if (ref.current === r) ref.current = null;
      teardownRoom(r);
      throw new Error("superseded");
    }
    // Mic-deny is non-fatal: a participant with no/denied mic still joins listen/watch-only.
    let micOn = false;
    if (micWanted) {
      try {
        await r.localParticipant.setMicrophoneEnabled(true);
        micOn = true;
      } catch {
        /* listen-only */
      }
    }
    if (myGen !== gen) throw new Error("superseded"); // torn down by whoever superseded us
    opts.onRoster();
    return { micOn };
  }

  // Purge ONLY this connection's body-appended <audio> + clear the tile host.
  function purgeMedia() {
    const host = opts.tilesEl();
    if (host) host.innerHTML = "";
    const sh = opts.screenEl();
    if (sh) sh.innerHTML = "";
    document.querySelectorAll(`audio[data-lk-conn="${connId}"]`).forEach((e) => e.remove());
  }

  function disconnect() {
    gen++; // abort any in-flight connect at its next checkpoint
    const r = ref.current;
    ref.current = null; // do this first so trailing events early-return
    teardownRoom(r);
    purgeMedia();
  }

  function roster(self: string): Person[] {
    const r = ref.current;
    if (!r) return [];
    const out: Person[] = [
      {
        id: r.localParticipant.identity,
        name: `${r.localParticipant.name || self || "You"} (you)`,
      },
    ];
    r.remoteParticipants.forEach((p) => out.push({ id: p.identity, name: p.name || "Guest" }));
    return out;
  }

  // returns the actual resulting state (false if the enable was rejected)
  async function setMic(on: boolean): Promise<boolean> {
    const r = ref.current;
    if (!r) return on;
    try {
      await r.localParticipant.setMicrophoneEnabled(on);
      return on;
    } catch {
      // mic blocked/absent: stay off regardless of requested state
      return false;
    }
  }
  async function setCam(on: boolean): Promise<boolean> {
    const r = ref.current;
    if (!r) return on;
    try {
      await r.localParticipant.setCameraEnabled(on);
      // setCameraEnabled(false) may NOT fire LocalTrackUnpublished — clear the tile manually.
      if (!on) removeTile(r.localParticipant.identity);
      return on;
    } catch {
      if (!on) removeTile(r.localParticipant.identity);
      return false;
    }
  }
  // Screen share. Browser shows its own picker on enable; cancel/deny -> stays off.
  async function setScreen(on: boolean): Promise<boolean> {
    const r = ref.current;
    if (!r) return false;
    try {
      await r.localParticipant.setScreenShareEnabled(on);
      if (!on) clearScreen();
      return on;
    } catch {
      clearScreen();
      return false;
    }
  }

  return { ref, connect, disconnect, roster, setMic, setCam, setScreen, addTile, removeTile };
}

// dedupe-on-append helper shared by every chat:new handler
function pushMsg(prev: Msg[], m: any): Msg[] {
  if (!m || !m.msg || !m.msg.id) return prev;
  if (prev.some((p) => p.id === m.msg.id)) return prev;
  return [
    ...prev.slice(-199),
    {
      id: m.msg.id,
      name: (m.msg.user && m.msg.user.name) || m.msg.userName || "Guest",
      body: String(m.msg.body || ""),
    },
  ];
}

// Build a roster from the AUTHORITATIVE WS presence:state users[] (NOT LiveKit, which
// only lists people who connected A/V — unreliable, the source of the host's empty
// office). Drops the AI operator + system rows. Self is pinned first + labelled, or
// excluded entirely (the host must not appear in his own waiting room).
function toPeople(users: any[], selfId: string, excludeSelf: boolean): Person[] {
  const out: Person[] = [];
  for (const u of users || []) {
    if (!u || !u.id) continue;
    if (u.id === "operator" || (u.name || "") === "The Operator" || u.role === "SYSTEM") continue;
    if (u.id === selfId) {
      if (!excludeSelf) out.unshift({ id: u.id, name: `${u.name || "You"} (you)` });
    } else {
      out.push({ id: u.id, name: u.name || "Guest" });
    }
  }
  return out;
}

// ============================================================================
// Top-level component: branches into client vs host on mount.
// ============================================================================
type Mode = "loading" | "client" | "host";

export default function Foyer() {
  const [mode, setMode] = useState<Mode>("loading");
  const [invite, setInvite] = useState<string | null>(null);
  const [hostJwt, setHostJwt] = useState<string | null>(null);
  const [title, setTitle] = useState("The Review Room");
  // ECEB satin brass by default (the office is ECEB's until per-domain branding lands);
  // still overridable via ?accent= for future white-label tenants.
  const [accent, setAccent] = useState("#C6A15B");

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const h = p.get("host");
    const i = p.get("invite") || p.get("i");
    const t = p.get("title");
    if (t) {
      setTitle(t);
      document.title = t + " · East Coast Employee Benefits";
    } else {
      document.title = "The Review Room · East Coast Employee Benefits";
    }
    // Validate accent is an actual hex color before use; otherwise keep default.
    const a = p.get("accent");
    if (a && /^#?[0-9a-fA-F]{3,8}$/.test(a)) setAccent("#" + a.replace(/^#/, ""));
    if (h) {
      setHostJwt(h);
      setMode("host");
    } else {
      setInvite(i || "");
      setMode("client");
    }
  }, []);

  if (mode === "loading") return <div style={S.center} />;
  if (mode === "host") return <HostView jwt={hostJwt || ""} title={title} accent={accent} />;
  return <ClientView invite={invite} title={title} accent={accent} />;
}

// ============================================================================
// CLIENT VIEW — waiting room -> knock -> admitted -> private consult.
// ============================================================================
type ClientPhase = "enter" | "connecting" | "foyer" | "knocking" | "office" | "error";

function ClientView({
  invite,
  title,
  accent,
}: {
  invite: string | null;
  title: string;
  accent: string;
}) {
  const [phase, setPhase] = useState<ClientPhase>("enter");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState(""); // transient non-fatal notice (e.g. denied knock)
  const [roster, setRoster] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const token = useRef("");
  const scope = useRef<Scope>({});
  const selfId = useRef(""); // our own user id (from /auth/guest) — to label "(you)"
  const foyerRoom = useRef("");
  const officeRoom = useRef("");
  const currentRoom = useRef(""); // which LiveKit room we are connected to
  // last authoritative presence:state per room, so a foyer->office switch shows the
  // office roster immediately (its presence:state arrives BEFORE room:admitted).
  const lastUsers = useRef<Record<string, any[]>>({});
  const tilesEl = useRef<HTMLDivElement | null>(null);
  const screenEl = useRef<HTMLDivElement | null>(null);
  const joining = useRef(false);
  const leaving = useRef(false);
  // walk-in support: a self-minted invite (bare /foyer with the office open)
  const mintedInvite = useRef("");
  const switchEpoch = useRef(0); // guards against interleaved/concurrent switches
  const phaseRef = useRef<ClientPhase>("enter");
  phaseRef.current = phase;
  // name is entered on the gate screen AFTER mount; the once-created conn closures
  // must read the latest value, so drive labels through a ref.
  const nameRef = useRef("");
  nameRef.current = name;
  // mirror cam state into a ref so switchTo can re-assert it without a stale closure.
  const camOnRef = useRef(false);
  camOnRef.current = camOn;
  const micOnRef = useRef(true);
  micOnRef.current = micOn;

  // Receiving choreography (parlour -> receiving -> in). PURELY visual: the
  // LiveKit switch in room:admitted starts immediately; only the cross-fade is
  // held (~700ms door, then a 420ms settle on the easing token).
  const [entry, setEntry] = useState<"hold" | "fading" | "in">("in");
  const entryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearEntryTimers = () => {
    entryTimers.current.forEach(clearTimeout);
    entryTimers.current = [];
  };
  const beginEntry = () => {
    clearEntryTimers();
    setEntry("hold");
    entryTimers.current.push(setTimeout(() => setEntry("fading"), 700));
    entryTimers.current.push(setTimeout(() => setEntry("in"), 1140));
  };
  // The gate button reads "Let James know you're here": the knock is part of
  // arrival, sent once the WS authenticates (auth:ok), so it can never race auth.
  const autoKnock = useRef(false);

  const conn = useRef(
    makeRoomConn({
      getToken: () => token.current,
      tilesEl: () => tilesEl.current,
      screenEl: () => screenEl.current,
      selfLabel: () => nameRef.current || "You",
      onRoster: () => {}, // roster comes from WS presence:state, not LiveKit
      onDropped: () => {
        if (!leaving.current) {
          setErr("The connection dropped.");
          setPhase("error");
        }
      },
      onLocalScreenEnd: () => setScreenOn(false),
      leavingRef: leaving,
    }),
  ).current;

  const sendWS = (m: any) => {
    try {
      ws.current?.send(JSON.stringify(m));
    } catch {
      /* noop */
    }
  };

  // Recompute the visible roster from the cached presence of the CURRENT room.
  function refreshClientRoster() {
    setRoster(toPeople(lastUsers.current[currentRoom.current] || [], selfId.current, false));
  }

  // Foyer -> office (or back). Keeps drop-detection armed across the whole
  // teardown+reconnect critical section, and is guarded against concurrent calls.
  async function switchTo(roomId: string) {
    if (currentRoom.current === roomId && conn.ref.current) return;
    const epoch = ++switchEpoch.current;
    leaving.current = true; // suppress the dropped-error for the WHOLE switch
    conn.disconnect();
    setRoster([]);
    setScreenOn(false); // a local share doesn't carry across a room switch
    currentRoom.current = roomId;
    try {
      const res = await conn.connect(roomId, micOnRef.current);
      if (epoch !== switchEpoch.current) {
        // a newer switch superseded us; this room is now orphaned — drop it.
        conn.disconnect();
        return;
      }
      // sync mic UI to reality (denied mic -> listen-only)
      setMicOn(res.micOn);
      // re-enable camera if it was on before the switch (LiveKit does not carry it).
      if (camOnRef.current) {
        const cam = await conn.setCam(true);
        if (epoch === switchEpoch.current) setCamOn(cam);
      }
      if (epoch === switchEpoch.current) refreshClientRoster();
    } catch (e: any) {
      // A superseded connect (a newer switch/disconnect won) is expected and silent;
      // anything else keeps its previous behavior (propagates).
      if (epoch !== switchEpoch.current || String(e?.message || "").includes("superseded")) return;
      throw e;
    } finally {
      if (epoch === switchEpoch.current) leaving.current = false;
    }
  }

  async function connectWS() {
    const tr = await fetch(`${API}/auth/ws-ticket`, {
      headers: { Authorization: `Bearer ${token.current}` },
    });
    if (!tr.ok) throw new Error("Couldn't connect to the room.");
    const { ticket } = await tr.json();
    const sock = new WebSocket(wsBase());
    ws.current = sock;
    sock.onopen = () => sock.send(JSON.stringify({ type: "auth:hello", token: ticket }));
    sock.onmessage = (ev) => {
      let m: any;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (m.type) {
        case "auth:ok":
          sock.send(JSON.stringify({ type: "presence:join", roomId: foyerRoom.current }));
          // Arrival knock: the client already asked for James at the gate.
          if (autoKnock.current && officeRoom.current) {
            autoKnock.current = false;
            sock.send(JSON.stringify({ type: "presence:join", roomId: officeRoom.current }));
            setPhase("knocking"); // optimistic; confirmed by room:knock:queued
          }
          break;
        case "auth:fail":
          try {
            sock.close();
          } catch {}
          setErr("This meeting session has ended. Please rejoin.");
          setPhase("error");
          break;
        case "chat:new":
          setMessages((x) => pushMsg(x, m));
          break;
        case "presence:state":
          if (m.roomId) {
            lastUsers.current[m.roomId] = m.users || [];
            if (m.roomId === currentRoom.current) refreshClientRoster();
          }
          break;
        case "presence:join":
          if (m.roomId && m.user && m.user.id) {
            const arr = lastUsers.current[m.roomId] || [];
            if (!arr.some((u: any) => u.id === m.user.id))
              lastUsers.current[m.roomId] = [...arr, m.user];
            if (m.roomId === currentRoom.current) refreshClientRoster();
          }
          break;
        case "presence:leave":
          if (m.roomId) {
            lastUsers.current[m.roomId] = (lastUsers.current[m.roomId] || []).filter(
              (u: any) => u.id !== m.userId,
            );
            if (m.roomId === currentRoom.current) refreshClientRoster();
          }
          break;
        case "room:knock:queued":
          // server acknowledged our knock on the office; keep waiting to be admitted.
          if (m.roomId === officeRoom.current) {
            setInfo("");
            setPhase("knocking");
          }
          break;
        case "room:admitted":
          if (m.roomId === officeRoom.current) {
            // Server already doJoin'd us to the office. Switch LiveKit foyer -> office.
            setInfo("");
            if (phaseRef.current !== "office") beginEntry(); // visual held-door only
            setPhase("office");
            switchTo(officeRoom.current).catch(() => {
              setErr("Couldn't connect to the review.");
              setPhase("error");
            });
          }
          break;
        case "room:denied":
          // Overloaded: a mod-deny has NO reason; a scope/meeting rejection has one.
          // Only treat as the soft "advisor not free" while we are still KNOCKING.
          // An already-admitted (phase 'office') guest must NOT be silently bounced
          // to the foyer label while still A/V-connected to the office.
          if (phaseRef.current === "knocking") {
            setInfo("James is with someone just now. He'll come to the door when he's free.");
            setPhase("foyer");
          } else if (phaseRef.current === "office") {
            // a real ejection from an active consult: tear the office down, return to foyer.
            clearEntryTimers();
            setEntry("in");
            setInfo("The review has ended.");
            setPhase("foyer");
            switchTo(foyerRoom.current).catch(() => {
              setErr("The review has ended.");
              setPhase("error");
            });
          } else {
            setErr("You don't have access to this meeting room.");
            setPhase("error");
          }
          break;
        case "room:locked":
          // informational; the office may toggle while we wait.
          break;
        case "room:banned":
          setErr("You have been removed from this meeting.");
          setPhase("error");
          break;
        default:
          break;
      }
    };
    // A dropped chat socket must not kill a live LiveKit meeting; only a revoke (4001) ends it.
    sock.onclose = (e) => {
      if (e.code === 4001 && !leaving.current) {
        setErr("This guest session was revoked.");
        setPhase("error");
      }
    };
  }

  const join = useCallback(async () => {
    if (joining.current) return;
    let inviteCode = invite || mintedInvite.current;
    if (!inviteCode) {
      // No coded link: treat bare /foyer as a WALK-IN. While the office is open,
      // self-mint the same single-use invite the ECEB-site badge mints — the
      // foyer IS the door. Closed office = a polite hours card, not a dead end.
      setPhase("connecting");
      setErr("");
      try {
        const st = await (await fetch(`${API}/office/status`)).json();
        if (!st?.open) {
          setErr(
            st?.schedule
              ? `The office is receiving by appointment. Walk-in hours: ${st.schedule}.`
              : "The office is receiving by appointment just now.",
          );
          setPhase("error");
          return;
        }
        const wr = await fetch(`${API}/office/walkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() || "Visitor" }),
        });
        const wj = await wr.json().catch(() => null);
        const m = String(wj?.url || "").match(/invite=([^&]+)/);
        if (!wr.ok || !m) {
          setErr("Couldn't open the door. Try again in a moment.");
          setPhase("error");
          return;
        }
        inviteCode = decodeURIComponent(m[1]);
        mintedInvite.current = inviteCode;
      } catch {
        setErr("Couldn't reach the office. Try again in a moment.");
        setPhase("error");
        return;
      }
    }
    joining.current = true;
    leaving.current = false;
    setPhase("connecting");
    setErr("");
    setInfo("");
    let joinEpoch = switchEpoch.current; // re-captured just before conn.connect
    try {
      const gr = await fetch(`${API}/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken: inviteCode, name: name.trim() }),
      });
      if (!gr.ok) {
        throw new Error(
          gr.status === 410
            ? "This meeting link has expired."
            : gr.status === 409
              ? "This meeting link has already been used."
              : "This meeting link isn't valid.",
        );
      }
      const gd = await gr.json();
      token.current = gd.token;
      scope.current = gd.scope || {};
      selfId.current = (gd.user && gd.user.id) || "";
      // Mirror the host guard: a guest whose scope lacks foyer/office can never
      // correlate room:admitted (officeRoom would be the literal "-office").
      if (!scope.current.foyer || !scope.current.office) {
        throw new Error("This meeting link is missing its room scope.");
      }
      foyerRoom.current = scope.current.foyer || "";
      officeRoom.current = buildOfficeRoom(scope.current);
      // Persist under a neutral, host-agnostic key only (white-label surface).
      try {
        sessionStorage.setItem("foyer_guest", gd.token);
      } catch {}
      autoKnock.current = true; // knock as soon as the socket authenticates
      await connectWS();
      currentRoom.current = foyerRoom.current;
      setPhase("foyer"); // mount the stage so tiles have a container before tracks arrive
      // The arrival knock can be answered while this foyer connect is still in
      // flight (a fast admit calls switchTo -> conn.disconnect on the in-flight
      // Room, rejecting this await). That rejection must not kick an
      // already-admitted guest to the error gate: capture the switch epoch and
      // swallow the abort when a newer switch superseded us.
      joinEpoch = switchEpoch.current;
      const res = await conn.connect(foyerRoom.current, micOnRef.current);
      setMicOn(res.micOn); // reflect a denied mic in the toolbar
      // roster now arrives via WS presence:state for the foyer
    } catch (e: any) {
      if (joinEpoch !== switchEpoch.current || phaseRef.current === "office") {
        // superseded by an admit-driven room switch: the office connection owns
        // the session now; this foyer abort is expected and non-fatal.
        return;
      }
      // a spent self-minted walk-in invite must not wedge retries: mint fresh next time
      if (!invite) mintedInvite.current = "";
      setErr(e?.message || "Could not join the meeting.");
      setPhase("error");
    } finally {
      joining.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite, name]);

  const knock = () => {
    if (!officeRoom.current) return;
    setInfo("");
    setPhase("knocking"); // optimistic; confirmed by room:knock:queued
    sendWS({ type: "presence:join", roomId: officeRoom.current });
  };
  const cancelKnock = () => {
    // If the arrival knock hasn't been sent yet (auth still in flight), disarm it
    // so auth:ok doesn't knock on behalf of a guest who just cancelled.
    autoKnock.current = false;
    // Leaving the office clears our pending knock (else leaves current room) per WS contract.
    sendWS({ type: "presence:leave", roomId: officeRoom.current });
    setInfo("");
    setPhase("foyer");
  };

  const toggleMic = async () => {
    const next = !micOn;
    const actual = await conn.setMic(next); // guarded: rejects when mic blocked
    setMicOn(actual);
    if (next && !actual) setInfo("Your microphone is blocked or unavailable.");
  };
  const toggleCam = async () => {
    const next = !camOn;
    const actual = await conn.setCam(next);
    setCamOn(actual);
    if (next && !actual) setInfo("Your camera is blocked or unavailable.");
  };
  const toggleScreen = async () => {
    const next = !screenOn;
    const actual = await conn.setScreen(next);
    setScreenOn(actual);
    if (next && !actual) setInfo("Screen share was cancelled or blocked.");
  };
  const leave = () => {
    leaving.current = true;
    joining.current = false;
    autoKnock.current = false;
    clearEntryTimers();
    setEntry("in");
    switchEpoch.current++; // invalidate any in-flight switch
    conn.disconnect();
    try {
      ws.current?.close();
    } catch {}
    currentRoom.current = "";
    setPhase("enter");
    setRoster([]);
    setMessages([]);
    setInfo("");
    setScreenOn(false);
    setCamOn(false);
  };
  const sendChat = () => {
    const b = chatInput.trim();
    if (!b || !ws.current) return;
    sendWS({ type: "chat:send", roomId: currentRoom.current, body: b });
    setChatInput("");
  };

  useEffect(
    () => () => {
      leaving.current = true;
      switchEpoch.current++;
      clearEntryTimers();
      conn.disconnect();
      try {
        ws.current?.close();
      } catch {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ---- gate screens (enter / connecting / error) ----
  if (phase === "enter" || phase === "connecting" || phase === "error") {
    return (
      <div style={S.center}>
        <div style={S.card}>
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(163,180,202,.8)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ display: "block", margin: "0 auto 14px" }}
          >
            <circle cx="12" cy="5" r="2.4" />
            <line x1="12" y1="7.4" x2="12" y2="21" />
            <line x1="7.5" y1="10.5" x2="16.5" y2="10.5" />
            <path d="M5 16a7 5 0 0 0 14 0" />
          </svg>
          <div style={S.kicker}>East Coast Employee Benefits</div>
          <h1 style={S.serifH}>{title}</h1>
          {phase === "error" ? (
            <>
              <p style={{ ...S.err, marginTop: 14 }}>{err}</p>
              <button style={S.btn} onClick={() => setPhase("enter")}>
                Try again
              </button>
            </>
          ) : phase === "connecting" ? (
            <p style={{ ...S.muted, marginTop: 16 }}>Showing you in…</p>
          ) : (
            <>
              <input
                style={S.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={40}
                onKeyDown={(e) => e.key === "Enter" && join()}
                autoFocus
              />
              <button
                style={{ ...S.btn, opacity: name.trim() ? 1 : 0.55 }}
                onClick={join}
                disabled={!name.trim()}
              >
                {"Let James know you're here"}
              </button>
            </>
          )}
          <p style={S.foot}>Private advisory office · Halifax, Nova Scotia</p>
        </div>
      </div>
    );
  }

  // ---- live stage (foyer / knocking / office) ----
  const inOffice = phase === "office";
  return (
    <div style={S.live}>
      {/* Receiving: a ~700ms held door, then a single settled cross-fade. Visual only. */}
      {inOffice && entry !== "in" && (
        <div style={{ ...S.overlay, opacity: entry === "hold" ? 1 : 0 }}>
          <div style={{ textAlign: "center" }}>
            <div style={S.kicker}>East Coast Employee Benefits</div>
            <div style={S.serifH}>Welcome{name.trim() ? `, ${name.trim()}` : ""}.</div>
            <p style={S.parlourLine}>James will see you now.</p>
          </div>
        </div>
      )}
      <div
        style={{
          ...S.fadeWrap,
          opacity: inOffice && entry === "hold" ? 0 : 1,
          // While the held-door overlay is up, the invisible room UI beneath must
          // not be clickable or tab-focusable.
          pointerEvents: inOffice && entry === "hold" ? "none" : "auto",
        }}
      >
        <header style={inOffice ? S.paperBar : S.bar}>
          {inOffice ? (
            <div style={S.paperTitle}>East Coast Employee Benefits · The Review Room</div>
          ) : (
            <div>
              <div style={S.kicker}>East Coast Employee Benefits</div>
              <div style={{ ...S.serifH, fontSize: 17, margin: "2px 0 0" }}>{title}</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={inOffice ? S.ctlPaper : S.ctl} onClick={toggleMic}>
              {micOn ? "Mute" : "Unmute"}
            </button>
            <button style={inOffice ? S.ctlPaper : S.ctl} onClick={toggleCam}>
              {camOn ? "Stop video" : "Start video"}
            </button>
            <button
              style={
                inOffice
                  ? { ...S.ctlPaper, background: screenOn ? "rgba(16,35,63,.08)" : "transparent" }
                  : { ...S.ctl, background: screenOn ? "#1E3A5F" : "#122A4A" }
              }
              onClick={toggleScreen}
            >
              {screenOn ? "Stop sharing" : "Share screen"}
            </button>
            <button style={inOffice ? S.ctlPaper : S.ctl} onClick={leave}>
              Leave
            </button>
          </div>
        </header>

        <div style={S.body}>
          <main style={S.stage}>
            {!inOffice && (
              <div style={S.parlourWrap}>
                <div style={S.card}>
                  <div style={S.kicker}>East Coast Employee Benefits</div>
                  <div style={S.serifH}>Welcome{name.trim() ? `, ${name.trim()}` : ""}.</div>
                  {phase === "knocking" || autoKnock.current ? (
                    /* autoKnock armed counts as knocking: the knock IS the arrival, so
                       the manual-button parlour must never flash during the WS
                       handshake window before auth:ok confirms it. */
                    <>
                      <p style={S.parlourLine}>{"We've let James know you're here."}</p>
                      <p style={S.parlourLine}>{"When he's ready, the door opens on its own."}</p>
                      <p style={S.parlourLine}>Your review is prepared and waiting.</p>
                      {info && <p style={{ ...S.parlourLine, color: INK_TEXT }}>{info}</p>}
                      <button style={{ ...S.textBtn, marginTop: 12 }} onClick={cancelKnock}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <p style={S.parlourLine}>{"Take a seat. Whenever you're ready:"}</p>
                      {info && <p style={{ ...S.parlourLine, color: INK_TEXT }}>{info}</p>}
                      <button style={{ ...S.btn, marginTop: 10 }} onClick={knock}>
                        {"Let James know you're here"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
            {inOffice && <PresentedPlanViewer getToken={() => token.current} accent={accent} />}
            <div ref={screenEl} style={S.screen} />
            <div ref={tilesEl} style={S.tiles} />
          </main>
          <aside style={S.side}>
            <div style={S.sideHead}>
              {inOffice ? "In the room" : "Reception"} ({roster.length})
            </div>
            <ul style={S.roster}>
              {roster.map((p) => (
                <li key={p.id} style={S.rosterItem}>
                  {p.name}
                </li>
              ))}
            </ul>
            <div style={S.sideHead}>Chat</div>
            <div style={S.chat}>
              {messages.map((m) => (
                <div key={m.id} style={S.msg}>
                  <b style={S.msgName}>{m.name}:</b> {m.body}
                </div>
              ))}
            </div>
            <div style={S.chatBar}>
              <input
                style={S.chatInput}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message"
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
              />
              <button style={S.send} onClick={sendChat}>
                Send
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HOST VIEW — two WS sockets (foyer presence + office ownership), one LiveKit
// room (the office). No name modal: name is decoded from the host jwt.
// ============================================================================
type HostPhase = "connecting" | "live" | "error";

function HostView({ jwt, title, accent }: { jwt: string; title: string; accent: string }) {
  const payload = decodeJwt(jwt);
  const scope: Scope = (payload && payload.scope) || {};
  const hostName: string = (payload && (payload.name || payload.sub)) || "Advisor";
  const hostId: string = (payload && payload.sub) || "eceb-host";
  const foyerRoom = scope.foyer || "";
  const officeRoom = buildOfficeRoom(scope);

  const [phase, setPhase] = useState<HostPhase>("connecting");
  const [err, setErr] = useState("");
  const [locked, setLocked] = useState(true); // host owns a locked office by default
  const [waiting, setWaiting] = useState<Person[]>([]); // foyer roster
  const [foyerMessages, setFoyerMessages] = useState<Msg[]>([]);
  const [knocks, setKnocks] = useState<Knock[]>([]);
  const [officeRoster, setOfficeRoster] = useState<Person[]>([]);
  const [officeMessages, setOfficeMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);

  const foyerWS = useRef<WebSocket | null>(null);
  const officeWS = useRef<WebSocket | null>(null);
  const tilesEl = useRef<HTMLDivElement | null>(null);
  const screenEl = useRef<HTMLDivElement | null>(null);
  const leaving = useRef(false);
  const started = useRef(false);

  const conn = useRef(
    makeRoomConn({
      getToken: () => jwt,
      tilesEl: () => tilesEl.current,
      screenEl: () => screenEl.current,
      selfLabel: () => hostName,
      onRoster: () => {}, // office roster comes from WS presence:state, not LiveKit
      onDropped: () => {
        if (!leaving.current) {
          setErr("The consult connection dropped.");
          setPhase("error");
        }
      },
      onLocalScreenEnd: () => setScreenOn(false),
      leavingRef: leaving,
    }),
  ).current;

  const sendOffice = (m: any) => {
    try {
      officeWS.current?.send(JSON.stringify(m));
    } catch {}
  };
  const sendFoyer = (m: any) => {
    try {
      foyerWS.current?.send(JSON.stringify(m));
    } catch {}
  };
  void sendFoyer; // reserved for host->foyer broadcasts; keep the symmetric helper

  // Track foyer roster from presence:state / presence:join / presence:leave.
  function applyFoyerState(users: any[]) {
    setWaiting(toPeople(users, hostId, true)); // exclude the host himself from his waiting room
  }

  async function openSocket(
    roomId: string,
    handlers: (sock: WebSocket, m: any) => void,
  ): Promise<WebSocket> {
    const tr = await fetch(`${API}/auth/ws-ticket`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!tr.ok) throw new Error("Couldn't connect.");
    const { ticket } = await tr.json();
    const sock = new WebSocket(wsBase());
    sock.onopen = () => sock.send(JSON.stringify({ type: "auth:hello", token: ticket }));
    sock.onmessage = (ev) => {
      let m: any;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.type === "auth:ok") {
        sock.send(JSON.stringify({ type: "presence:join", roomId }));
        return;
      }
      if (m.type === "auth:fail") {
        try {
          sock.close();
        } catch {}
        setErr("This host session has ended. Please reopen the office.");
        setPhase("error");
        return;
      }
      handlers(sock, m);
    };
    sock.onclose = (e) => {
      if (e.code === 4001 && !leaving.current) {
        setErr("This host session was revoked.");
        setPhase("error");
      }
    };
    return sock;
  }

  const start = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    leaving.current = false;
    setPhase("connecting");
    setErr("");
    if (!foyerRoom || !scope.office) {
      setErr("This host link is missing its room scope.");
      setPhase("error");
      return;
    }
    try {
      // FOYER socket: see who is waiting (roster + chat). Presence only.
      foyerWS.current = await openSocket(foyerRoom, (_sock, m) => {
        switch (m.type) {
          case "presence:state":
            if (m.roomId === foyerRoom) applyFoyerState(m.users);
            break;
          case "presence:join":
            // reject synthetic/system users + the host himself.
            if (
              m.roomId === foyerRoom &&
              m.user &&
              m.user.id &&
              m.user.id !== "operator" &&
              m.user.id !== hostId &&
              m.user.role !== "SYSTEM"
            )
              setWaiting((w) =>
                w.some((x) => x.id === m.user.id)
                  ? w
                  : [...w, { id: m.user.id, name: m.user.name || "Guest" }],
              );
            break;
          case "presence:leave":
            if (m.roomId === foyerRoom) setWaiting((w) => w.filter((x) => x.id !== m.userId));
            break;
          case "chat:new":
            setFoyerMessages((x) => pushMsg(x, m));
            break;
          default:
            break;
        }
      });

      // OFFICE socket: host OWNS it -> joins the locked room directly. Receives knocks;
      // sends admit/deny/lock/unlock here.
      //
      // LOAD-BEARING SERVER ASSUMPTION: the ?host= identity must be seeded as
      // OWNER/mod of `<office>-office` so presence:join resolves to doJoin (not a
      // knock) and isModOrOwner is true for admit/deny/lock. If that guarantee
      // fails, the server replies room:knock:queued / room:denied instead of
      // presence:state — so we surface a HARD error rather than hang on an empty
      // office the host can never enter or moderate.
      officeWS.current = await openSocket(officeRoom, (_sock, m) => {
        switch (m.type) {
          case "presence:state":
            if (m.roomId === officeRoom) {
              setOfficeRoster(toPeople(m.users, hostId, false));
              if (typeof m.locked === "boolean") setLocked(m.locked);
            }
            break;
          case "presence:join":
            if (m.roomId === officeRoom && m.user && m.user.id && m.user.id !== "operator")
              setOfficeRoster((r) =>
                r.some((x) => x.id === m.user.id)
                  ? r
                  : [
                      ...r,
                      {
                        id: m.user.id,
                        name:
                          m.user.id === hostId
                            ? `${m.user.name || "You"} (you)`
                            : m.user.name || "Guest",
                      },
                    ],
              );
            break;
          case "presence:leave":
            if (m.roomId === officeRoom) setOfficeRoster((r) => r.filter((x) => x.id !== m.userId));
            break;
          case "room:adminState":
            // surfaces knocks queued before we were connected
            if (m.roomId === officeRoom && Array.isArray(m.knocks)) {
              setKnocks((prev) => {
                const merged = [...prev];
                for (const k of m.knocks) {
                  if (k && k.userId && !merged.some((x) => x.id === k.userId))
                    merged.push({ id: k.userId, name: k.name || "Guest" });
                }
                return merged;
              });
              if (typeof m.locked === "boolean") setLocked(m.locked);
            }
            break;
          case "room:knock":
            if (m.roomId === officeRoom && m.user && m.user.id)
              setKnocks((k) =>
                k.some((x) => x.id === m.user.id)
                  ? k
                  : [...k, { id: m.user.id, name: m.user.name || "Guest" }],
              );
            break;
          case "room:locked":
            if (m.roomId === officeRoom && typeof m.locked === "boolean") setLocked(m.locked);
            break;
          case "chat:new":
            setOfficeMessages((x) => pushMsg(x, m));
            break;
          // Defensive: if the server did NOT recognize us as owner of the office,
          // our presence:join is parked as a knock or rejected. Make that visible.
          case "room:knock:queued":
          case "room:denied":
            if (m.roomId === officeRoom) {
              leaving.current = true;
              setErr("Couldn't take ownership of the office. Check the host link.");
              setPhase("error");
            }
            break;
          default:
            break;
        }
      });

      // Host LiveKit -> the office.
      const res = await conn.connect(officeRoom, micOn);
      if (leaving.current) return; // teardown happened while connecting
      setMicOn(res.micOn); // reflect a denied/absent mic in the toolbar
      // office roster arrives via WS presence:state
      setPhase("live");
    } catch (e: any) {
      if (leaving.current) return;
      setErr(e?.message || "Could not open the office.");
      setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foyerRoom, officeRoom]);

  useEffect(() => {
    start();
    return () => {
      leaving.current = true;
      started.current = false; // re-arm so a StrictMode remount can re-run start()
      conn.disconnect();
      try {
        foyerWS.current?.close();
      } catch {}
      try {
        officeWS.current?.close();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mod actions resolve roomId from the OFFICE socket's joined room — userId is flat top-level.
  const admit = (id: string) => {
    sendOffice({ type: "room:admit", userId: id });
    setKnocks((k) => k.filter((x) => x.id !== id));
    // self-heal: re-sync the authoritative knocks[] in case the admit didn't take.
    sendOffice({ type: "room:adminState", roomId: officeRoom });
  };
  const deny = (id: string) => {
    sendOffice({ type: "room:deny", userId: id });
    setKnocks((k) => k.filter((x) => x.id !== id));
    sendOffice({ type: "room:adminState", roomId: officeRoom });
  };
  const toggleLock = () => {
    // optimistic; confirmed by room:locked broadcast
    if (locked) {
      sendOffice({ type: "room:unlock" });
      setLocked(false);
    } else {
      sendOffice({ type: "room:lock" });
      setLocked(true);
    }
  };

  const toggleMic = async () => {
    const next = !micOn;
    const actual = await conn.setMic(next);
    setMicOn(actual);
  };
  const toggleCam = async () => {
    const next = !camOn;
    const actual = await conn.setCam(next);
    setCamOn(actual);
  };
  const toggleScreen = async () => {
    const next = !screenOn;
    const actual = await conn.setScreen(next);
    setScreenOn(actual);
  };
  const sendOfficeChat = () => {
    const b = chatInput.trim();
    if (!b) return;
    sendOffice({ type: "chat:send", roomId: officeRoom, body: b });
    setChatInput("");
  };

  if (phase === "connecting" || phase === "error") {
    return (
      <div style={S.center}>
        <div style={S.card}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/eceb-logo-white.png?v=2"
            alt="East Coast Employee Benefits"
            style={{ height: 62, width: "auto", display: "inline-block", verticalAlign: "middle" }}
          />
          <div style={{ ...S.wordmarkSub, color: accent, marginBottom: 16 }}>{title}</div>
          {phase === "error" ? (
            <>
              <p style={S.err}>{err}</p>
              <button
                style={S.btn}
                onClick={() => {
                  started.current = false;
                  leaving.current = false;
                  start();
                }}
              >
                Try again
              </button>
            </>
          ) : (
            <p style={S.muted}>Opening your office…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={S.live}>
      <header style={S.bar}>
        <div style={{ lineHeight: 1.15 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/eceb-logo-white.png?v=2"
            alt="East Coast Employee Benefits"
            style={{ height: 58, width: "auto", display: "inline-block", verticalAlign: "middle" }}
          />
          <div style={{ ...S.wordmarkSub, color: accent }}>
            {title} · {hostName}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{ ...S.ctl, color: locked ? INK_TEXT : "#D9B878" }}
            onClick={toggleLock}
            title={locked ? "Door is closed. Click to open." : "Door is open. Click to close."}
          >
            {locked ? "Door closed" : "Door open"}
          </button>
          <button style={S.ctl} onClick={toggleMic}>
            {micOn ? "Mute" : "Unmute"}
          </button>
          <button style={S.ctl} onClick={toggleCam}>
            {camOn ? "Stop video" : "Start video"}
          </button>
          <button
            style={{ ...S.ctl, background: screenOn ? "#1E3A5F" : "#122A4A" }}
            onClick={toggleScreen}
          >
            {screenOn ? "Stop sharing" : "Share screen"}
          </button>
        </div>
      </header>

      <div style={S.body}>
        <main style={S.stage}>
          <PlanModule jwt={jwt} accent={accent} />
          <div style={S.sideHead}>My office ({officeRoster.length})</div>
          <div ref={screenEl} style={{ ...S.screen, marginTop: 12 }} />
          <div ref={tilesEl} style={{ ...S.tiles, marginTop: 12 }} />
          <div style={{ ...S.sideHead, marginTop: 16 }}>Office chat</div>
          <div style={{ ...S.chat, maxHeight: 200 }}>
            {officeMessages.map((m) => (
              <div key={m.id} style={S.msg}>
                <b style={S.msgName}>{m.name}:</b> {m.body}
              </div>
            ))}
          </div>
          <div style={S.chatBar}>
            <input
              style={S.chatInput}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message the consult"
              onKeyDown={(e) => e.key === "Enter" && sendOfficeChat()}
            />
            <button style={S.send} onClick={sendOfficeChat}>
              Send
            </button>
          </div>
        </main>

        <aside style={S.side}>
          <div style={S.sideHead}>Knocks ({knocks.length})</div>
          <ul style={S.roster}>
            {knocks.length === 0 && (
              <li style={{ ...S.rosterItem, color: MUTED_TEXT }}>No one knocking.</li>
            )}
            {knocks.map((k) => (
              <li
                key={k.id}
                style={{
                  ...S.rosterItem,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{k.name}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button style={S.miniBtn} onClick={() => admit(k.id)}>
                    Admit
                  </button>
                  <button style={S.miniBtnQuiet} onClick={() => deny(k.id)}>
                    Deny
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <div style={S.sideHead}>Waiting room ({waiting.length})</div>
          <ul style={S.roster}>
            {waiting.length === 0 && (
              <li style={{ ...S.rosterItem, color: MUTED_TEXT }}>No one waiting.</li>
            )}
            {waiting.map((p) => (
              <li key={p.id} style={S.rosterItem}>
                {p.name}
              </li>
            ))}
          </ul>

          <div style={S.sideHead}>Waiting-room chat</div>
          <div style={S.chat}>
            {foyerMessages.map((m) => (
              <div key={m.id} style={S.msg}>
                <b style={S.msgName}>{m.name}:</b> {m.body}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ============================================================================
const S: Record<string, CSSProperties> = {
  // The Review Room shell: ink-navy ground, milled panels, hairline rules,
  // satin brass used once per surface, serif figures with tabular numerals.
  wordmark: {
    fontFamily: SERIF,
    fontSize: 17,
    fontWeight: 400,
    color: INK_TEXT,
    letterSpacing: ".01em",
  },
  wordmarkSub: {
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: ".18em",
    textTransform: "uppercase",
    marginTop: 2,
    fontFamily: UIFONT,
  },
  kicker: {
    fontFamily: UIFONT,
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: ".22em",
    textTransform: "uppercase",
    color: MUTED_TEXT,
  },
  serifH: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: 400,
    color: INK_TEXT,
    letterSpacing: ".01em",
    margin: "10px 0 6px",
    fontVariantNumeric: "tabular-nums lining-nums",
  },
  parlourLine: {
    fontFamily: UIFONT,
    fontSize: 14,
    color: MUTED_TEXT,
    margin: "0 0 8px",
    lineHeight: 1.55,
  },
  foot: { marginTop: 18, marginBottom: 0, fontSize: 12, color: MUTED_TEXT, fontFamily: UIFONT },
  center: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0A1D35",
    color: INK_TEXT,
    fontFamily: UIFONT,
  },
  card: {
    width: 400,
    maxWidth: "92vw",
    background: "#122A4A",
    border: "1px solid #1E3A5F",
    borderRadius: 8,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 8px 24px rgba(0,0,0,.35)",
    padding: "36px 36px 28px",
    textAlign: "center",
  },
  h1: { fontSize: 20, margin: "0 0 14px" },
  muted: { color: MUTED_TEXT, fontSize: 14, margin: "0 0 16px" },
  err: { color: INK_TEXT, fontSize: 14, margin: "0 0 16px", lineHeight: 1.55 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 4,
    border: "1px solid #1E3A5F",
    background: "#0A1D35",
    color: INK_TEXT,
    fontSize: 15,
    fontFamily: UIFONT,
    marginTop: 16,
    marginBottom: 12,
  },
  btn: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 4,
    border: "1px solid #A8853F",
    background: GOLD_GRAD,
    color: PAPER_INK,
    fontWeight: 600,
    fontSize: 15,
    fontFamily: UIFONT,
    cursor: "pointer",
    transition: `opacity 260ms ${EASE}`,
  },
  textBtn: {
    background: "transparent",
    border: 0,
    color: MUTED_TEXT,
    fontSize: 13,
    fontFamily: UIFONT,
    cursor: "pointer",
    padding: "6px 10px",
    transition: `color 260ms ${EASE}`,
  },
  live: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0A1D35",
    color: INK_TEXT,
    fontFamily: UIFONT,
  },
  fadeWrap: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    transition: `opacity 420ms ${EASE}`,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    background: "#0A1D35",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: `opacity 420ms ${EASE}`,
    pointerEvents: "none",
  },
  bar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    background: "#0A1D35",
    borderBottom: "1px solid #1E3A5F",
  },
  paperBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "7px 16px",
    background: PAPER,
    color: PAPER_INK,
    borderBottom: "1px solid rgba(16,35,63,.18)",
    boxShadow: "0 1px 6px rgba(0,0,0,.25)",
  },
  paperTitle: { fontFamily: SERIF, fontSize: 14, color: PAPER_INK, letterSpacing: ".01em" },
  ctl: {
    padding: "6px 12px",
    borderRadius: 4,
    border: "1px solid #1E3A5F",
    background: "#122A4A",
    color: INK_TEXT,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: UIFONT,
    transition: `background-color 260ms ${EASE}`,
  },
  ctlPaper: {
    padding: "4px 10px",
    borderRadius: 4,
    border: "1px solid rgba(16,35,63,.3)",
    background: "transparent",
    color: PAPER_INK,
    cursor: "pointer",
    fontSize: 12.5,
    fontFamily: UIFONT,
    transition: `background-color 260ms ${EASE}`,
  },
  banner: { padding: "10px 16px", fontSize: 14, fontWeight: 600, color: INK_TEXT },
  body: { flex: 1, display: "flex", minHeight: 0 },
  stage: { flex: 1, padding: 16, overflow: "auto", display: "flex", flexDirection: "column" },
  parlourWrap: { display: "flex", justifyContent: "center", padding: "9vh 0 24px" },
  knockBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "8px 0 20px",
    textAlign: "center",
  },
  bigBtn: {
    padding: "14px 24px",
    borderRadius: 4,
    border: "1px solid #A8853F",
    background: GOLD_GRAD,
    color: PAPER_INK,
    fontWeight: 600,
    fontSize: 16,
    fontFamily: UIFONT,
    cursor: "pointer",
    maxWidth: 420,
  },
  screen: { width: "100%" }, // empty = 0 height; fills only when a share is attached
  tiles: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 },
  side: {
    width: 320,
    borderLeft: "1px solid #1E3A5F",
    display: "flex",
    flexDirection: "column",
    background: "#122A4A",
    overflow: "auto",
  },
  sideHead: {
    padding: "12px 14px 8px",
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".18em",
    color: MUTED_TEXT,
    borderBottom: "1px solid #1E3A5F",
    fontVariantNumeric: "tabular-nums lining-nums",
  },
  roster: { listStyle: "none", margin: 0, padding: "6px 0", maxHeight: 220, overflow: "auto" },
  rosterItem: { padding: "6px 14px", fontSize: 14, color: INK_TEXT },
  miniBtn: {
    padding: "3px 10px",
    borderRadius: 4,
    border: "1px solid #1E3A5F",
    background: "#1E3A5F",
    color: INK_TEXT,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: UIFONT,
    cursor: "pointer",
    transition: `background-color 260ms ${EASE}`,
  },
  miniBtnQuiet: {
    padding: "3px 10px",
    borderRadius: 4,
    border: "1px solid #1E3A5F",
    background: "transparent",
    color: MUTED_TEXT,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: UIFONT,
    cursor: "pointer",
    transition: `background-color 260ms ${EASE}`,
  },
  chat: {
    flex: 1,
    overflow: "auto",
    padding: "8px 14px",
    fontSize: 14,
    minHeight: 80,
    color: INK_TEXT,
  },
  msg: { marginBottom: 6, lineHeight: 1.35 },
  msgName: { color: INK_TEXT },
  chatBar: { display: "flex", gap: 6, padding: 10, borderTop: "1px solid #1E3A5F" },
  chatInput: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 4,
    border: "1px solid #1E3A5F",
    background: "#0A1D35",
    color: INK_TEXT,
    fontFamily: UIFONT,
  },
  send: {
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #1E3A5F",
    background: "#122A4A",
    color: INK_TEXT,
    fontWeight: 600,
    fontFamily: UIFONT,
    cursor: "pointer",
    transition: `background-color 260ms ${EASE}`,
  },
};
