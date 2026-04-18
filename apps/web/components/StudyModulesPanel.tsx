"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import StudyQuiz from "./StudyQuiz";
import EmptyState from "./EmptyState";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ── Style ────────────────────────────────────────────────────────────────────

const ACCENT = "#6366F1";
const ACCENT_AMBER = "#F59E0B";
const ACCENT_GREEN = "#22C55E";

const S = {
  card: { borderRadius: 12, border: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.03)", padding: "14px 16px" } as React.CSSProperties,
  btn: { padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  btnPri: { padding: "7px 14px", borderRadius: 8, border: `1px solid ${ACCENT}50`, background: `${ACCENT}15`, fontSize: 12, cursor: "pointer", color: ACCENT, fontWeight: 600 } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  select: { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 12, color: "rgba(243,244,246,.92)", outline: "none", cursor: "pointer", width: "100%", boxSizing: "border-box" as const } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "timer" as const,   label: "Focus Timer", icon: "⏱" },
  { id: "quiz" as const,    label: "Practice Test", icon: "🧠" },
  { id: "rooms" as const,   label: "Study Rooms", icon: "📚" },
  { id: "lfg" as const,     label: "Find Partners", icon: "🤝" },
  { id: "ambient" as const, label: "Ambient",       icon: "🎧" },
];
type TabId = typeof TABS[number]["id"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getStudyStats(date: string): { focusMinutes: number; sessions: number } {
  try {
    const raw = localStorage.getItem(`weered:study:${date}`);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return { focusMinutes: 0, sessions: 0 };
}

function saveStudyStats(date: string, stats: { focusMinutes: number; sessions: number }) {
  try { localStorage.setItem(`weered:study:${date}`, JSON.stringify(stats)); } catch { /* empty */ }
}

function calcStreak(): number {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const stats = getStudyStats(key);
    if (stats.sessions > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Focus Timer ──────────────────────────────────────────────────────────────

const FOCUS_DURATIONS = [25, 45, 60, 90];
const BREAK_DURATIONS = [5, 10, 15];
const SESSIONS_BEFORE_LONG_BREAK = 4;
const LONG_BREAK_MINUTES = 15;

function FocusTimer({ accent }: { accent: string }) {
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stats
  const [todayStats, setTodayStats] = useState(() => getStudyStats(todayKey()));
  const [streak, setStreak] = useState(() => calcStreak());

  // Timer logic
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;

          // Flash celebration
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 1200);

          if (phase === "focus") {
            // Record completed focus session
            const key = todayKey();
            const stats = getStudyStats(key);
            stats.focusMinutes += focusDuration;
            stats.sessions += 1;
            saveStudyStats(key, stats);

            const newSessions = sessions + 1;
            setSessions(newSessions);
            setPhase("break");

            // Long break after 4 sessions
            const isLongBreak = newSessions % SESSIONS_BEFORE_LONG_BREAK === 0;
            const nextBreak = isLongBreak ? LONG_BREAK_MINUTES : breakDuration;

            // Defer stats refresh
            setTimeout(() => { setTodayStats(getStudyStats(key)); setStreak(calcStreak()); }, 50);

            return nextBreak * 60;
          } else {
            setPhase("focus");
            return focusDuration * 60;
          }
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, phase, focusDuration, breakDuration, sessions]);

  // Stop running on phase auto-switch so user can start manually
  useEffect(() => {
    if (showFlash) setRunning(false);
  }, [showFlash]);

  function handleStart() { setRunning(true); }
  function handlePause() { setRunning(false); }
  function handleReset() {
    setRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setPhase("focus");
    setTimeLeft(focusDuration * 60);
  }

  function selectFocusDuration(d: number) {
    if (running) return;
    setFocusDuration(d);
    if (phase === "focus") setTimeLeft(d * 60);
  }

  function selectBreakDuration(d: number) {
    if (running) return;
    setBreakDuration(d);
    if (phase === "break") setTimeLeft(d * 60);
  }

  // SVG progress ring
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const totalSeconds = phase === "focus" ? focusDuration * 60 : breakDuration * 60;
  const progress = 1 - (timeLeft / totalSeconds);
  const dashOffset = circumference * (1 - progress);
  const ringColor = phase === "focus" ? accent : ACCENT_GREEN;

  // Session dots
  const currentCycle = sessions % SESSIONS_BEFORE_LONG_BREAK;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "8px 0" }}>

      {/* Celebration flash overlay */}
      {showFlash && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: phase === "focus" ? `${ACCENT_GREEN}12` : `${accent}12`,
          pointerEvents: "none", zIndex: 9999,
          animation: "none",
          transition: "opacity .6s ease-out",
          opacity: 1,
        }} />
      )}

      {/* Timer circle */}
      <div style={{ position: "relative", width: 200, height: 200 }}>
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle
            cx="100" cy="100" r={radius}
            fill="none"
            stroke="rgba(255,255,255,.06)"
            strokeWidth="6"
          />
          {/* Progress */}
          <circle
            cx="100" cy="100" r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
          />
        </svg>
        {/* Center content */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            fontSize: 42, fontWeight: 300, letterSpacing: "2px",
            color: "rgba(243,244,246,.92)", fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}>
            {formatTime(timeLeft)}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase",
            color: ringColor, marginTop: 8, opacity: 0.8,
          }}>
            {phase === "focus" ? "FOCUS" : "BREAK"}
          </div>
        </div>
      </div>

      {/* Quiet mode indicator */}
      {phase === "focus" && running && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px", borderRadius: 8,
          background: `${accent}10`, border: `1px solid ${accent}25`,
          fontSize: 12, color: "rgba(243,244,246,.6)",
        }}>
          <span style={{ fontSize: 14 }}>🔇</span>
          Quiet Mode — mics muted during focus
        </div>
      )}

      {/* Phase duration selectors */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 340 }}>
        <div>
          <div style={{ ...S.label, textAlign: "center" }}>Focus Duration</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {FOCUS_DURATIONS.map(d => (
              <button key={d} onClick={() => selectFocusDuration(d)} style={{
                padding: "6px 14px", borderRadius: 20, border: "1px solid",
                borderColor: focusDuration === d ? `${accent}60` : "rgba(255,255,255,.08)",
                background: focusDuration === d ? `${accent}18` : "rgba(255,255,255,.03)",
                color: focusDuration === d ? "rgba(243,244,246,.92)" : "rgba(243,244,246,.4)",
                fontWeight: focusDuration === d ? 600 : 400,
                fontSize: 12, cursor: running ? "default" : "pointer",
                transition: "all .15s ease",
                opacity: running ? 0.5 : 1,
              }}>
                {d}m
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ ...S.label, textAlign: "center" }}>Break Duration</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {BREAK_DURATIONS.map(d => (
              <button key={d} onClick={() => selectBreakDuration(d)} style={{
                padding: "6px 14px", borderRadius: 20, border: "1px solid",
                borderColor: breakDuration === d ? `${ACCENT_GREEN}60` : "rgba(255,255,255,.08)",
                background: breakDuration === d ? `${ACCENT_GREEN}18` : "rgba(255,255,255,.03)",
                color: breakDuration === d ? "rgba(243,244,246,.92)" : "rgba(243,244,246,.4)",
                fontWeight: breakDuration === d ? 600 : 400,
                fontSize: 12, cursor: running ? "default" : "pointer",
                transition: "all .15s ease",
                opacity: running ? 0.5 : 1,
              }}>
                {d}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {!running ? (
          <button onClick={handleStart} style={{
            padding: "10px 28px", borderRadius: 10, border: `1px solid ${ACCENT_GREEN}50`,
            background: `${ACCENT_GREEN}15`, color: ACCENT_GREEN,
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            transition: "all .15s ease",
          }}>
            {timeLeft < totalSeconds ? "Resume" : "Start"}
          </button>
        ) : (
          <button onClick={handlePause} style={{
            padding: "10px 28px", borderRadius: 10, border: `1px solid ${ACCENT_AMBER}50`,
            background: `${ACCENT_AMBER}15`, color: ACCENT_AMBER,
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            transition: "all .15s ease",
          }}>
            Pause
          </button>
        )}
        <button onClick={handleReset} style={{
          padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,.08)",
          background: "rgba(255,255,255,.04)", color: "rgba(243,244,246,.4)",
          fontWeight: 500, fontSize: 13, cursor: "pointer",
          transition: "all .15s ease",
        }}>
          Reset
        </button>
      </div>

      {/* Session counter */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 12, color: "rgba(243,244,246,.5)" }}>
          Session {currentCycle + 1} of {SESSIONS_BEFORE_LONG_BREAK}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: SESSIONS_BEFORE_LONG_BREAK }).map((_, i) => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: "50%",
              background: i < currentCycle ? accent : "rgba(255,255,255,.08)",
              border: i === currentCycle ? `2px solid ${accent}80` : "2px solid transparent",
              transition: "all .3s ease",
            }} />
          ))}
        </div>
        {sessions > 0 && sessions % SESSIONS_BEFORE_LONG_BREAK === 0 && !running && phase === "break" && (
          <div style={{ fontSize: 11, color: ACCENT_GREEN, opacity: 0.7, marginTop: 2 }}>
            Long break earned — you've completed {SESSIONS_BEFORE_LONG_BREAK} sessions!
          </div>
        )}
      </div>

      {/* Today's stats */}
      <div style={{
        ...S.card, width: "100%", maxWidth: 340,
        display: "flex", justifyContent: "space-around", textAlign: "center",
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 300, color: "rgba(243,244,246,.85)" }}>
            {formatMinutes(todayStats.focusMinutes)}
          </div>
          <div style={{ ...S.label, marginBottom: 0, marginTop: 4 }}>Focus Today</div>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,.06)" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 300, color: "rgba(243,244,246,.85)" }}>
            {todayStats.sessions}
          </div>
          <div style={{ ...S.label, marginBottom: 0, marginTop: 4 }}>Sessions</div>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,.06)" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 300, color: "rgba(243,244,246,.85)" }}>
            {streak}
          </div>
          <div style={{ ...S.label, marginBottom: 0, marginTop: 4 }}>Day Streak</div>
        </div>
      </div>
    </div>
  );
}

// ── Study Rooms ──────────────────────────────────────────────────────────────

function StudyRooms({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [presence, setPresence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/rooms`),
      apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/presence`),
    ]).then(([rj, pj]) => {
      setRooms(rj.rooms || rj || []);
      setPresence(pj.users || pj || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  if (loading) return <div style={{ padding: 32, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading rooms...</div>;

  const onlineCount = Array.isArray(presence) ? presence.length : 0;

  // Count users per room from presence data
  const roomUserCounts: Record<string, number> = {};
  if (Array.isArray(presence)) {
    for (const u of presence) {
      const rid = u.roomId || u.room_id;
      if (rid) roomUserCounts[rid] = (roomUserCounts[rid] || 0) + 1;
    }
  }

  const ROOM_ICONS: Record<string, string> = {
    library: "📚", stem: "🧪", essay: "📝", creative: "🎨",
    math: "🔢", code: "💻", reading: "📖", study: "📚",
  };

  function roomIcon(name: string): string {
    const lower = name.toLowerCase();
    for (const [key, icon] of Object.entries(ROOM_ICONS)) {
      if (lower.includes(key)) return icon;
    }
    return "📚";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Online banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderRadius: 10,
        background: `${accent}08`, border: `1px solid ${accent}20`,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: ACCENT_GREEN,
          boxShadow: `0 0 8px ${ACCENT_GREEN}80`, flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, color: "rgba(243,244,246,.7)" }}>
          {onlineCount > 0 ? `${onlineCount} ${onlineCount === 1 ? "person" : "people"} studying right now` : "Nobody's studying. Be the first to lock in."}
        </span>
      </div>

      {/* Room grid */}
      {rooms.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {rooms.map((room: any) => {
            const count = roomUserCounts[room.id] || 0;
            const status = count > 0 ? "Active Session" : "Quiet Study";
            return (
              <div key={room.id} style={{
                ...S.card, display: "flex", flexDirection: "column", gap: 8,
                transition: "border-color .15s ease, background .15s ease",
              }}>
                <div style={{ fontSize: 15 }}>
                  {roomIcon(room.name || "")}
                  <span style={{ fontWeight: 600, fontSize: 13, marginLeft: 6, color: "rgba(243,244,246,.88)" }}>
                    {room.name || "Study Room"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: count > 0 ? ACCENT_GREEN : "rgba(255,255,255,.15)",
                    boxShadow: count > 0 ? `0 0 6px ${ACCENT_GREEN}60` : "none",
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, color: "rgba(243,244,246,.5)" }}>
                    {count} {count === 1 ? "person" : "people"} — {status}
                  </span>
                </div>

                <button
                  onClick={() => router.push(`/room/${room.id}`)}
                  style={{
                    ...S.btnPri, width: "100%", padding: "7px 0", marginTop: "auto",
                    textAlign: "center", fontSize: 12,
                  }}
                >
                  Enter
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No study rooms yet." hint="Create one to get started." />
      )}
    </div>
  );
}

// ── Find Partners (LFG) ─────────────────────────────────────────────────────

const STUDY_LEVELS = ["High School", "Undergraduate", "Graduate", "Professional", "Self-Study"];
const SESSION_LENGTHS = ["25min", "45min", "1hr", "2hr", "Open-ended"];
const STUDY_STYLES = [
  { value: "silent", label: "Silent", desc: "cameras optional" },
  { value: "quiet", label: "Quiet", desc: "whisper OK" },
  { value: "active", label: "Active", desc: "discussion welcome" },
];

function FindPartners({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState(STUDY_LEVELS[1]);
  const [sessionLen, setSessionLen] = useState(SESSION_LENGTHS[0]);
  const [studyStyle, setStudyStyle] = useState(STUDY_STYLES[0].value);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then(j => { setPosts(j.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  async function create() {
    if (!subject.trim()) { setMsg("Add a subject or topic"); return; }
    const activity = `${subject.trim()} — ${level} — ${sessionLen} — ${STUDY_STYLES.find(s => s.value === studyStyle)?.label || studyStyle}`;
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({ activity, description: note, maxPlayers: 8, platform: "any" }),
    });
    if (j.ok) { setShowForm(false); setSubject(""); setNote(""); load(); }
    else setMsg(j.message || j.error || "Failed");
  }

  async function join(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/join`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed");
  }

  async function leave(postId: string) {
    const j = await apiFetch(`/lfg/${postId}/leave`, { method: "POST", body: JSON.stringify({}) });
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed");
  }

  if (loading) return <div style={{ padding: 32, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading study partners...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "rgba(243,244,246,.5)" }}>{posts.length} looking for partners</div>
        <button style={S.btnPri} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Find Partner"}
        </button>
      </div>
      {msg && <div style={{ fontSize: 12, color: "rgba(243,244,246,.6)", padding: "4px 0" }}>{msg}</div>}

      {/* Post form */}
      {showForm && (
        <div style={{ ...S.card, border: `1px solid ${accent}25`, background: `${accent}06` }}>
          <div style={S.label}>Subject / Topic</div>
          <input
            style={{ ...S.input, marginBottom: 10 }}
            value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Calculus II, MCAT Prep, Thesis Writing..."
          />

          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Level</div>
              <select value={level} onChange={e => setLevel(e.target.value)} style={S.select}>
                {STUDY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Session Length</div>
              <select value={sessionLen} onChange={e => setSessionLen(e.target.value)} style={S.select}>
                {SESSION_LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div style={S.label}>Study Style</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {STUDY_STYLES.map(ss => (
              <button key={ss.value} onClick={() => setStudyStyle(ss.value)} style={{
                padding: "6px 14px", borderRadius: 20, border: "1px solid",
                borderColor: studyStyle === ss.value ? `${accent}60` : "rgba(255,255,255,.08)",
                background: studyStyle === ss.value ? `${accent}15` : "rgba(255,255,255,.03)",
                color: studyStyle === ss.value ? "rgba(243,244,246,.92)" : "rgba(243,244,246,.4)",
                fontWeight: studyStyle === ss.value ? 600 : 400,
                fontSize: 11, cursor: "pointer", transition: "all .15s ease",
              }}>
                {ss.label} <span style={{ opacity: 0.5, marginLeft: 4 }}>({ss.desc})</span>
              </button>
            ))}
          </div>

          <div style={S.label}>Note (optional)</div>
          <input
            style={{ ...S.input, marginBottom: 12 }}
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Any details for potential study partners..."
          />

          <button style={{ ...S.btnPri, width: "100%", padding: "9px 0" }} onClick={create}>
            Post
          </button>
        </div>
      )}

      {/* Posts list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {posts.map(p => {
          const slots = `${(p.players || []).length}/${p.maxPlayers || 8}`;
          const isFull = p.status === "FULL";
          return (
            <div key={p.id} style={{
              ...S.card, display: "flex", alignItems: "center", gap: 12,
              opacity: isFull ? 0.6 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "rgba(243,244,246,.85)", marginBottom: 3 }}>
                  {p.activity}
                </div>
                {p.description && (
                  <div style={{ fontSize: 11, color: "rgba(243,244,246,.4)", marginBottom: 3 }}>{p.description}</div>
                )}
                <div style={{ fontSize: 11, color: "rgba(243,244,246,.35)" }}>
                  {slots} joined
                  {p.owner?.username && <span> — by {p.owner.username}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button style={S.btnPri} onClick={() => join(p.id)}>Join</button>
                <button style={S.btn} onClick={() => leave(p.id)}>Leave</button>
              </div>
            </div>
          );
        })}
      </div>

      {posts.length === 0 && !showForm && (
        <EmptyState title="No study partners yet." hint="Post what you're studying — find a buddy." />
      )}
    </div>
  );
}

// ── Ambient ──────────────────────────────────────────────────────────────────

const AMBIENT_SCENES = [
  { id: "coffee", emoji: "☕", label: "Coffee Shop", gradient: "linear-gradient(135deg, #3E2723 0%, #5D4037 50%, #4E342E 100%)" },
  { id: "rain", emoji: "🌧", label: "Rainy Day", gradient: "linear-gradient(135deg, #37474F 0%, #546E7A 50%, #455A64 100%)" },
  { id: "library", emoji: "📚", label: "Library", gradient: "linear-gradient(135deg, #4E342E 0%, #6D4C41 50%, #5D4037 100%)" },
  { id: "ocean", emoji: "🌊", label: "Ocean", gradient: "linear-gradient(135deg, #0D47A1 0%, #1565C0 50%, #0D47A1 100%)" },
  { id: "forest", emoji: "🌲", label: "Forest", gradient: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #1B5E20 100%)" },
  { id: "night", emoji: "🌙", label: "Night Sky", gradient: "linear-gradient(135deg, #1A237E 0%, #283593 50%, #1A237E 100%)" },
  { id: "fire", emoji: "🔥", label: "Fireplace", gradient: "linear-gradient(135deg, #BF360C 0%, #E65100 50%, #BF360C 100%)" },
  { id: "winter", emoji: "❄️", label: "Winter Cabin", gradient: "linear-gradient(135deg, #B0BEC5 0%, #CFD8DC 50%, #B0BEC5 100%)" },
];

function AmbientTab({ accent, onSceneChange }: { accent: string; onSceneChange: (gradient: string | null) => void }) {
  const [selected, setSelected] = useState<string | null>(() => {
    try { return localStorage.getItem("weered:study:ambient") || null; } catch { return null; }
  });

  function select(id: string) {
    if (selected === id) {
      // Deselect
      setSelected(null);
      onSceneChange(null);
      try { localStorage.removeItem("weered:study:ambient"); } catch { /* empty */ }
    } else {
      setSelected(id);
      const scene = AMBIENT_SCENES.find(s => s.id === id);
      onSceneChange(scene?.gradient || null);
      try { localStorage.setItem("weered:study:ambient", id); } catch { /* empty */ }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 13, color: "rgba(243,244,246,.5)", lineHeight: 1.5 }}>
        Set the mood for your study session. Choose an ambient scene to subtly color the background.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {AMBIENT_SCENES.map(scene => {
          const isActive = selected === scene.id;
          return (
            <button key={scene.id} onClick={() => select(scene.id)} style={{
              padding: "20px 14px", borderRadius: 12, cursor: "pointer",
              border: isActive ? `2px solid ${accent}80` : "2px solid rgba(255,255,255,.06)",
              background: scene.gradient,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              transition: "all .2s ease",
              opacity: isActive ? 1 : 0.7,
              transform: isActive ? "scale(1.02)" : "scale(1)",
            }}>
              <span style={{ fontSize: 28 }}>{scene.emoji}</span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.85)",
                textShadow: "0 1px 4px rgba(0,0,0,.5)",
              }}>
                {scene.label}
              </span>
              {isActive && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.7)",
                  textTransform: "uppercase", letterSpacing: "1px", marginTop: 2,
                }}>
                  Active
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Recommendation */}
      <div style={{
        ...S.card, textAlign: "center",
        fontSize: 12, color: "rgba(243,244,246,.4)", lineHeight: 1.6,
      }}>
        <div style={{ marginBottom: 6 }}>
          🎵 Ambient sounds coming soon
        </div>
        <div>
          For now, try{" "}
          <a
            href="https://lofi.cafe"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: accent, textDecoration: "none", fontWeight: 600 }}
          >
            lofi.cafe
          </a>
          {" "}or{" "}
          <a
            href="https://mynoise.net"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: accent, textDecoration: "none", fontWeight: 600 }}
          >
            mynoise.net
          </a>
          {" "}alongside Weered
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  lobbyId: string;
  accentColor?: string;
  style?: React.CSSProperties;
}

export default function StudyModulesPanel({ lobbyId, accentColor = ACCENT, style }: Props) {
  const [tab, setTab] = useState<TabId>("timer");
  const [ambientGradient, setAmbientGradient] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem("weered:study:ambient");
      if (saved) {
        const scene = AMBIENT_SCENES.find(s => s.id === saved);
        return scene?.gradient || null;
      }
    } catch { /* empty */ }
    return null;
  });

  // Subtle ambient overlay (very translucent so it doesn't overwhelm)
  const ambientOverlay: React.CSSProperties = ambientGradient ? {
    position: "relative" as const,
  } : {};

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
      ...style,
      ...ambientOverlay,
    }}>
      {/* Ambient background layer */}
      {ambientGradient && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: ambientGradient,
          opacity: 0.06,
          borderRadius: "inherit",
          pointerEvents: "none",
          transition: "opacity .5s ease, background .5s ease",
        }} />
      )}

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 2, padding: "8px 12px 0",
        borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0, overflowX: "auto",
        position: "relative", zIndex: 1,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px", borderRadius: "8px 8px 0 0", border: "none",
            background: tab === t.id ? `${accentColor}20` : "transparent",
            color: tab === t.id ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.65)",
            fontWeight: tab === t.id ? 700 : 400, fontSize: 12, cursor: "pointer",
            transition: "background .15s ease, color .15s ease",
            display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        padding: "18px 16px 18px",
        display: "flex", flexDirection: "column",
        position: "relative", zIndex: 1,
      }}>
        {tab === "timer"   && <FocusTimer accent={accentColor} />}
        {tab === "quiz"    && <StudyQuiz />}
        {tab === "rooms"   && <StudyRooms lobbyId={lobbyId} accent={accentColor} />}
        {tab === "lfg"     && <FindPartners lobbyId={lobbyId} accent={accentColor} />}
        {tab === "ambient" && <AmbientTab accent={accentColor} onSceneChange={setAmbientGradient} />}
      </div>
    </div>
  );
}
