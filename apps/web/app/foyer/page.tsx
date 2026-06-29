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

const API = "/api";
const wsBase = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

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
  selfLabel: () => string;
  onRoster: () => void;
  // unexpected disconnect of the CURRENTLY-active room (not an intentional teardown)
  onDropped: () => void;
  leavingRef: { current: boolean };
}) {
  const ref: { current: Room | null } = { current: null };
  const connId = `c${++_connSeq}`;

  function addTile(pid: string, label: string, video: HTMLVideoElement) {
    const host = opts.tilesEl();
    if (!host) return;
    removeTile(pid);
    const wrap = document.createElement("div");
    wrap.setAttribute("data-pid", pid);
    wrap.style.cssText =
      "position:relative;aspect-ratio:4/3;background:#0d1117;border:1px solid #283040;border-radius:12px;overflow:hidden";
    video.autoplay = true;
    video.playsInline = true;
    video.style.cssText = "width:100%;height:100%;object-fit:cover";
    const tag = document.createElement("div");
    tag.textContent = label;
    tag.style.cssText =
      "position:absolute;left:8px;bottom:8px;font:600 12px sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:2px 8px;border-radius:6px";
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

  // Detach old listeners and disconnect the given room without touching ref/media.
  function teardownRoom(r: Room | null) {
    if (!r) return;
    try {
      r.removeAllListeners();
    } catch {
      /* noop */
    }
    try {
      r.disconnect();
    } catch {
      /* noop */
    }
  }

  // returns the real mic state after connect (false if mic was denied/absent)
  async function connect(roomId: string, micWanted: boolean): Promise<{ micOn: boolean }> {
    const vr = await fetch(`${API}/voice/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.getToken()}` },
      body: JSON.stringify({ roomId }),
    });
    if (!vr.ok) throw new Error("Couldn't start audio/video.");
    const { url, token: lkToken } = await vr.json();
    const r = new Room({ adaptiveStream: true, dynacast: true });
    ref.current = r;

    // Every handler captures its own `r` and ignores events once this room is no
    // longer the active one — livekit emits trailing events AFTER disconnect().
    r.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
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
      } else if (track.kind === Track.Kind.Video) {
        addTile(participant.identity, participant.name || "Guest", el as HTMLVideoElement);
      }
      opts.onRoster();
    });
    r.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
      track.detach().forEach((e) => e.remove());
      if (ref.current !== r) return;
      if (track.kind === Track.Kind.Video) removeTile(participant.identity);
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
      if (ref.current !== r) return;
      if (pub.kind === Track.Kind.Video && pub.track)
        addTile(
          r.localParticipant.identity,
          `${opts.selfLabel()} (you)`,
          pub.track.attach() as HTMLVideoElement,
        );
    });
    r.on(RoomEvent.LocalTrackUnpublished, (pub) => {
      // Detach the local self-view track (not just its wrapper) to release the sink.
      try {
        pub.track?.detach().forEach((e) => e.remove());
      } catch {
        /* noop */
      }
      if (ref.current !== r) return;
      if (pub.kind === Track.Kind.Video) removeTile(r.localParticipant.identity);
    });

    await r.connect(url, lkToken);
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
    opts.onRoster();
    return { micOn };
  }

  // Purge ONLY this connection's body-appended <audio> + clear the tile host.
  function purgeMedia() {
    const host = opts.tilesEl();
    if (host) host.innerHTML = "";
    document.querySelectorAll(`audio[data-lk-conn="${connId}"]`).forEach((e) => e.remove());
  }

  function disconnect() {
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

  return { ref, connect, disconnect, roster, setMic, setCam, addTile, removeTile };
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
  const [title, setTitle] = useState("Office Hours");
  const [accent, setAccent] = useState("#1f6feb");

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const h = p.get("host");
    const i = p.get("invite") || p.get("i");
    const t = p.get("title");
    if (t) {
      setTitle(t);
      document.title = t;
    } else {
      document.title = "Office Hours";
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
  const joining = useRef(false);
  const leaving = useRef(false);
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

  const conn = useRef(
    makeRoomConn({
      getToken: () => token.current,
      tilesEl: () => tilesEl.current,
      selfLabel: () => nameRef.current || "You",
      onRoster: () => {}, // roster comes from WS presence:state, not LiveKit
      onDropped: () => {
        if (!leaving.current) {
          setErr("The connection dropped.");
          setPhase("error");
        }
      },
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
            setPhase("office");
            switchTo(officeRoom.current).catch(() => {
              setErr("Couldn't connect to the consult.");
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
            setInfo("The advisor isn't free right now — please keep waiting.");
            setPhase("foyer");
          } else if (phaseRef.current === "office") {
            // a real ejection from an active consult: tear the office down, return to foyer.
            setInfo("The consult was ended by the advisor.");
            setPhase("foyer");
            switchTo(foyerRoom.current).catch(() => {
              setErr("You were removed from the consult.");
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
    if (!invite) {
      setErr("This meeting link is missing its code.");
      setPhase("error");
      return;
    }
    joining.current = true;
    leaving.current = false;
    setPhase("connecting");
    setErr("");
    setInfo("");
    try {
      const gr = await fetch(`${API}/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken: invite, name: name.trim() }),
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
      await connectWS();
      currentRoom.current = foyerRoom.current;
      setPhase("foyer"); // mount the stage so tiles have a container before tracks arrive
      const res = await conn.connect(foyerRoom.current, micOnRef.current);
      setMicOn(res.micOn); // reflect a denied mic in the toolbar
      // roster now arrives via WS presence:state for the foyer
    } catch (e: any) {
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
  const leave = () => {
    leaving.current = true;
    joining.current = false;
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
        <div style={{ ...S.card, borderTop: `3px solid ${accent}` }}>
          <h1 style={S.h1}>{title}</h1>
          {phase === "error" ? (
            <>
              <p style={S.err}>{err}</p>
              <button style={{ ...S.btn, background: accent }} onClick={() => setPhase("enter")}>
                Try again
              </button>
            </>
          ) : phase === "connecting" ? (
            <p style={S.muted}>Connecting you to the room…</p>
          ) : (
            <>
              <p style={S.muted}>Enter your name to join.</p>
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
                style={{ ...S.btn, background: accent }}
                onClick={join}
                disabled={!name.trim()}
              >
                Join
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- live stage (foyer / knocking / office) ----
  const inOffice = phase === "office";
  return (
    <div style={S.live}>
      <header style={{ ...S.bar, borderBottom: `2px solid ${accent}` }}>
        <strong>{title}</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.ctl} onClick={toggleMic}>
            {micOn ? "Mute" : "Unmute"}
          </button>
          <button style={S.ctl} onClick={toggleCam}>
            {camOn ? "Stop video" : "Start video"}
          </button>
          <button style={{ ...S.ctl, background: "#b62324" }} onClick={leave}>
            Leave
          </button>
        </div>
      </header>

      {/* status banner */}
      <div
        style={{
          ...S.banner,
          background: inOffice ? "#13361f" : "#1c2230",
          borderBottom: `1px solid ${accent}`,
        }}
      >
        {inOffice ? (
          <span>In your private consult.</span>
        ) : phase === "knocking" ? (
          <span>Knocking… waiting to be admitted.</span>
        ) : (
          <span>You're in the waiting room — the advisor will be with you shortly.</span>
        )}
      </div>

      <div style={S.body}>
        <main style={S.stage}>
          {!inOffice && phase !== "knocking" && (
            <div style={S.knockBox}>
              <button style={{ ...S.bigBtn, background: accent }} onClick={knock}>
                Knock — request a private consult
              </button>
              {info && <p style={{ ...S.muted, marginTop: 12 }}>{info}</p>}
            </div>
          )}
          {phase === "knocking" && (
            <div style={S.knockBox}>
              <p style={{ ...S.muted, marginBottom: 12 }}>Knocking… waiting to be admitted.</p>
              <button style={{ ...S.bigBtn, background: "#30363d" }} onClick={cancelKnock}>
                Cancel
              </button>
            </div>
          )}
          <div ref={tilesEl} style={S.tiles} />
        </main>
        <aside style={S.side}>
          <div style={S.sideHead}>
            {inOffice ? "In the consult" : "Waiting room"} ({roster.length})
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
                <b style={{ color: accent }}>{m.name}:</b> {m.body}
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
            <button style={{ ...S.send, background: accent }} onClick={sendChat}>
              Send
            </button>
          </div>
        </aside>
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

  const foyerWS = useRef<WebSocket | null>(null);
  const officeWS = useRef<WebSocket | null>(null);
  const tilesEl = useRef<HTMLDivElement | null>(null);
  const leaving = useRef(false);
  const started = useRef(false);

  const conn = useRef(
    makeRoomConn({
      getToken: () => jwt,
      tilesEl: () => tilesEl.current,
      selfLabel: () => hostName,
      onRoster: () => {}, // office roster comes from WS presence:state, not LiveKit
      onDropped: () => {
        if (!leaving.current) {
          setErr("The consult connection dropped.");
          setPhase("error");
        }
      },
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
              setErr("Couldn't take ownership of the office — check the host link.");
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
  const sendOfficeChat = () => {
    const b = chatInput.trim();
    if (!b) return;
    sendOffice({ type: "chat:send", roomId: officeRoom, body: b });
    setChatInput("");
  };

  if (phase === "connecting" || phase === "error") {
    return (
      <div style={S.center}>
        <div style={{ ...S.card, borderTop: `3px solid ${accent}` }}>
          <h1 style={S.h1}>{title}</h1>
          {phase === "error" ? (
            <>
              <p style={S.err}>{err}</p>
              <button
                style={{ ...S.btn, background: accent }}
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
      <header style={{ ...S.bar, borderBottom: `2px solid ${accent}` }}>
        <strong>
          {title} · {hostName}
        </strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{ ...S.ctl, background: locked ? "#b62324" : "#1f7a37" }}
            onClick={toggleLock}
            title={locked ? "Door is closed — click to open" : "Door is open — click to close"}
          >
            {locked ? "Door closed" : "Door open"}
          </button>
          <button style={S.ctl} onClick={toggleMic}>
            {micOn ? "Mute" : "Unmute"}
          </button>
          <button style={S.ctl} onClick={toggleCam}>
            {camOn ? "Stop video" : "Start video"}
          </button>
        </div>
      </header>

      <div style={S.body}>
        <main style={S.stage}>
          <div style={S.sideHead}>My office ({officeRoster.length})</div>
          <div ref={tilesEl} style={{ ...S.tiles, marginTop: 12 }} />
          <div style={{ ...S.sideHead, marginTop: 16 }}>Office chat</div>
          <div style={{ ...S.chat, maxHeight: 200 }}>
            {officeMessages.map((m) => (
              <div key={m.id} style={S.msg}>
                <b style={{ color: accent }}>{m.name}:</b> {m.body}
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
            <button style={{ ...S.send, background: accent }} onClick={sendOfficeChat}>
              Send
            </button>
          </div>
        </main>

        <aside style={S.side}>
          <div style={S.sideHead}>Knocks ({knocks.length})</div>
          <ul style={S.roster}>
            {knocks.length === 0 && (
              <li style={{ ...S.rosterItem, color: "#8b949e" }}>No one knocking.</li>
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
                  <button
                    style={{ ...S.miniBtn, background: "#1f7a37" }}
                    onClick={() => admit(k.id)}
                  >
                    Admit
                  </button>
                  <button
                    style={{ ...S.miniBtn, background: "#b62324" }}
                    onClick={() => deny(k.id)}
                  >
                    Deny
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <div style={S.sideHead}>Waiting room ({waiting.length})</div>
          <ul style={S.roster}>
            {waiting.length === 0 && (
              <li style={{ ...S.rosterItem, color: "#8b949e" }}>No one waiting.</li>
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
                <b style={{ color: accent }}>{m.name}:</b> {m.body}
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
  center: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0d1117",
    color: "#e6edf3",
    fontFamily: "system-ui,sans-serif",
  },
  card: {
    width: 360,
    maxWidth: "90vw",
    background: "#161b22",
    border: "1px solid #283040",
    borderRadius: 14,
    padding: 28,
    textAlign: "center",
  },
  h1: { fontSize: 20, margin: "0 0 14px" },
  muted: { color: "#8b949e", fontSize: 14, margin: "0 0 16px" },
  err: { color: "#f85149", fontSize: 14, margin: "0 0 16px" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #283040",
    background: "#0d1117",
    color: "#e6edf3",
    fontSize: 15,
    marginBottom: 12,
  },
  btn: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: 0,
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  live: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0d1117",
    color: "#e6edf3",
    fontFamily: "system-ui,sans-serif",
  },
  bar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    background: "#161b22",
  },
  ctl: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #283040",
    background: "#21262d",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  banner: { padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#e6edf3" },
  body: { flex: 1, display: "flex", minHeight: 0 },
  stage: { flex: 1, padding: 16, overflow: "auto", display: "flex", flexDirection: "column" },
  knockBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "8px 0 20px",
    textAlign: "center",
  },
  bigBtn: {
    padding: "14px 24px",
    borderRadius: 10,
    border: 0,
    color: "#fff",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
    maxWidth: 420,
  },
  tiles: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 },
  side: {
    width: 320,
    borderLeft: "1px solid #283040",
    display: "flex",
    flexDirection: "column",
    background: "#11151c",
    overflow: "auto",
  },
  sideHead: {
    padding: "10px 14px",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    color: "#8b949e",
    borderBottom: "1px solid #283040",
  },
  roster: { listStyle: "none", margin: 0, padding: "6px 0", maxHeight: 220, overflow: "auto" },
  rosterItem: { padding: "6px 14px", fontSize: 14 },
  miniBtn: {
    padding: "3px 10px",
    borderRadius: 6,
    border: 0,
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  chat: { flex: 1, overflow: "auto", padding: "8px 14px", fontSize: 14, minHeight: 80 },
  msg: { marginBottom: 6, lineHeight: 1.35 },
  chatBar: { display: "flex", gap: 6, padding: 10, borderTop: "1px solid #283040" },
  chatInput: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #283040",
    background: "#0d1117",
    color: "#e6edf3",
  },
  send: {
    padding: "8px 12px",
    borderRadius: 8,
    border: 0,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
};
