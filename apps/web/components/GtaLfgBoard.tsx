"use client";

import React, { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#e84393";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

type Post = {
  id: string;
  userId: string;
  userName: string;
  activity: string;
  description: string;
  platform: string;
  region?: string | null;
  status: string;
  roleSlots: string[];
  roleClaims: string[];
  roleClaimNames: string[];
  createdAt: string;
  scheduledFor?: string | null;
  scheduledTz?: string;
  hostCompleted?: number;
  hostTier?: string;
};

function whenLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = Date.now();
  const diff = d.getTime() - now;
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diff < 0) return `started ${day}`;
  const hrs = diff / 3600000;
  if (hrs < 1) return `in ${Math.max(1, Math.round(diff / 60000))} min · ${time}`;
  if (hrs < 24) return `${day} · ${time}`;
  return `${day} · ${time}`;
}

function tierColor(tier?: string): string {
  switch (tier) {
    case "Veteran":  return "#fbbf24";
    case "Trusted":  return "#86efac";
    case "Reliable": return "#c4b5fd";
    case "Proven":   return "rgba(148,163,184,.9)";
    default:         return "rgba(148,163,184,.5)";
  }
}

const ACTIVITY_PRESETS: { label: string; roles: string[] }[] = [
  { label: "Co-op Mission",    roles: ["Host", "Driver", "Gunman", "Gunman"] },
  { label: "Heist / Job",      roles: ["Host", "Driver", "Hacker", "Gunman"] },
  { label: "Car Meet",         roles: ["Host", "Racer", "Racer", "Racer"] },
  { label: "Crew Session",     roles: ["Host", "Crew", "Crew", "Crew"] },
  { label: "Freemode / Grind", roles: ["Host", "Player", "Player"] },
  { label: "Custom",           roles: ["Host", "Player"] },
];
const PLATFORMS = ["Any", "PS5", "Xbox", "PC"];
const REGIONS = ["Any", "NA-East", "NA-West", "EU", "OCE", "ASIA", "SA"];

export default function GtaLfgBoard({ lobbyId, accent = ACCENT, currentUserId }: { lobbyId: string; accent?: string; currentUserId?: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const [preset, setPreset] = useState(0);
  const [roles, setRoles] = useState<string[]>(ACTIVITY_PRESETS[0].roles);
  const [activity, setActivity] = useState(ACTIVITY_PRESETS[0].label);
  const [desc, setDesc] = useState("");
  const [platform, setPlatform] = useState("Any");
  const [region, setRegion] = useState("Any");
  const [micRequired, setMicRequired] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");

  const meId = currentUserId || (() => { try { return JSON.parse(localStorage.getItem("weered_user") || "{}")?.id || ""; } catch { return ""; } })();

  const load = useCallback(() => {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then(j => { setPosts((j.posts || []).filter((p: Post) => (p.roleSlots || []).length > 0)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  function pickPreset(i: number) {
    setPreset(i);
    setRoles(ACTIVITY_PRESETS[i].roles);
    if (ACTIVITY_PRESETS[i].label !== "Custom") setActivity(ACTIVITY_PRESETS[i].label);
  }
  function setRole(i: number, v: string) { setRoles(r => r.map((x, idx) => idx === i ? v : x)); }
  function addRole() { setRoles(r => r.length < 12 ? [...r, "Player"] : r); }
  function removeRole(i: number) { setRoles(r => r.length > 1 ? r.filter((_, idx) => idx !== i) : r); }

  async function create() {
    if (!authHeaders().Authorization) { setMsg("Log in to post a session."); return; }
    setBusy("create");
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({
        activity: activity.slice(0, 60),
        description: desc,
        platform: platform === "Any" ? "crossplay" : platform,
        region: region === "Any" ? null : region,
        roleSlots: roles.map(r => r.trim()).filter(Boolean),
        tags: micRequired ? ["mic-required"] : [],
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        scheduledTz: scheduledFor ? (Intl.DateTimeFormat().resolvedOptions().timeZone || "") : "",
      }),
    });
    setBusy("");
    if (j.ok) { setShowForm(false); setDesc(""); setMicRequired(false); setScheduledFor(""); load(); }
    else setMsg(j.message || j.error || "Failed");
  }

  async function claim(postId: string, index: number) {
    if (!authHeaders().Authorization) { setMsg("Log in to claim a slot."); return; }
    setBusy(`${postId}:${index}`);
    const j = await apiFetch(`/lfg/${postId}/roles/${index}/claim`, { method: "POST", body: JSON.stringify({}) });
    setBusy("");
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed");
  }
  async function release(postId: string) {
    setBusy(`${postId}:rel`);
    const j = await apiFetch(`/lfg/${postId}/roles/release`, { method: "POST", body: JSON.stringify({}) });
    setBusy("");
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed");
  }
  async function complete(postId: string) {
    setBusy(`${postId}:done`);
    const j = await apiFetch(`/lfg/${postId}/complete`, { method: "POST", body: JSON.stringify({}) });
    setBusy("");
    if (j.ok) load(); else setMsg(j.message || j.error || "Failed");
  }
  async function del(postId: string) {
    setBusy(`${postId}:del`);
    await apiFetch(`/lfg/${postId}`, { method: "DELETE" }).catch(() => {});
    setBusy("");
    load();
  }

  const label = (s: string) => ({ display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase" as const, color: "rgba(148,163,184,.8)" });

  return (
    <div style={{ padding: "14px 16px", color: "rgba(243,244,246,.92)", fontFamily: "var(--font-rajdhani), system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "0.5px", textTransform: "uppercase" }}>Find Players</div>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,.7)" }}>Post a session, claim a role, run it. Completing a session builds your reputation.</div>
        </div>
        <button type="button" onClick={() => setShowForm(s => !s)} style={{
          padding: "8px 16px", border: "none", cursor: "pointer",
          fontFamily: "var(--font-barlow), sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: "1.5px", textTransform: "uppercase",
          background: showForm ? "transparent" : accent, color: showForm ? "rgba(148,163,184,.9)" : "#fff",
          clipPath: showForm ? undefined : "polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
        }}>{showForm ? "Cancel" : "+ Post a session"}</button>
      </div>

      {msg && <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 8 }}>{msg}</div>}

      {showForm && (
        <div style={{ border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)", padding: 14, marginBottom: 14 }}>
          <div style={label("")}>Activity</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 12px" }}>
            {ACTIVITY_PRESETS.map((p, i) => (
              <button key={p.label} type="button" onClick={() => pickPreset(i)} style={{
                padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${preset === i ? accent : "rgba(255,255,255,.12)"}`,
                background: preset === i ? `${accent}22` : "transparent",
                color: "rgba(243,244,246,.9)",
              }}>{p.label}</button>
            ))}
          </div>
          {preset === ACTIVITY_PRESETS.length - 1 && (
            <input value={activity} onChange={e => setActivity(e.target.value)} placeholder="Activity name" style={inputStyle} />
          )}

          <div style={{ ...label(""), marginTop: 8 }}>Roles ({roles.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "6px 0 12px" }}>
            {roles.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input value={r} onChange={e => setRole(i, e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                {i === 0 ? <span style={{ fontSize: 9, color: "rgba(148,163,184,.6)", width: 50 }}>you</span>
                  : <button type="button" onClick={() => removeRole(i)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.12)", color: "rgba(148,163,184,.8)", cursor: "pointer", padding: "4px 8px", fontSize: 11 }}>×</button>}
              </div>
            ))}
            {roles.length < 12 && <button type="button" onClick={addRole} style={{ background: "transparent", border: "1px dashed rgba(255,255,255,.15)", color: "rgba(148,163,184,.8)", cursor: "pointer", padding: "5px", fontSize: 11, fontFamily: "inherit" }}>+ Add role</button>}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            <select value={platform} onChange={e => setPlatform(e.target.value)} style={selectStyle}>{PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}</select>
            <select value={region} onChange={e => setRegion(e.target.value)} style={selectStyle}>{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}</select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(203,213,225,.85)", cursor: "pointer" }}>
              <input type="checkbox" checked={micRequired} onChange={e => setMicRequired(e.target.checked)} /> Mic required
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <span style={{ ...label(""), margin: 0 }}>When</span>
            <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} style={{ ...selectStyle, colorScheme: "dark" }} />
            {scheduledFor ? <button type="button" onClick={() => setScheduledFor("")} style={{ background: "transparent", border: "none", color: "rgba(148,163,184,.7)", cursor: "pointer", fontSize: 11 }}>clear (now)</button>
              : <span style={{ fontSize: 11, color: "rgba(148,163,184,.6)" }}>leave empty for now / ASAP</span>}
          </div>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Notes (optional)" style={inputStyle} />
          <button type="button" onClick={create} disabled={busy === "create"} style={{
            marginTop: 6, padding: "9px 18px", border: "none", cursor: "pointer", background: accent, color: "#fff",
            fontFamily: "var(--font-barlow), sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: "1.5px", textTransform: "uppercase",
            opacity: busy === "create" ? 0.6 : 1, clipPath: "polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
          }}>{busy === "create" ? "Posting…" : "Post session"}</button>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: "rgba(148,163,184,.6)", padding: "20px 0", textAlign: "center" }}>Loading sessions…</div>
      ) : posts.length === 0 ? (
        <div style={{ fontSize: 13, color: "rgba(148,163,184,.6)", padding: "24px 0", textAlign: "center", fontStyle: "italic" }}>
          No open sessions. Be the first — post a heist crew, car meet, or grind session.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
          {posts.map(p => {
            const isHost = p.userId === meId;
            const inIt = (p.roleClaims || []).indexOf(meId) !== -1;
            const filled = (p.roleClaims || []).filter(Boolean).length;
            return (
              <div key={p.id} style={{ border: `1px solid ${p.status === "FULL" ? `${accent}55` : "rgba(255,255,255,.08)"}`, background: "rgba(255,255,255,.02)", padding: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontFamily: "var(--font-barlow), sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: "0.3px", textTransform: "uppercase", color: "rgba(243,244,246,.96)" }}>{p.activity || "Session"}</div>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", color: p.status === "FULL" ? "#86efac" : p.status === "COMPLETED" ? "rgba(148,163,184,.7)" : accent }}>{p.status}</span>
                </div>
                {whenLabel(p.scheduledFor) && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: "4px 0 2px", padding: "2px 8px", background: `${accent}1a`, border: `1px solid ${accent}44`, fontSize: 10, fontWeight: 700, color: "#f9a8d4", fontFamily: "ui-monospace, monospace", letterSpacing: "0.5px" }}>
                    🕑 {whenLabel(p.scheduledFor)}
                  </div>
                )}
                <div style={{ fontSize: 10, color: "rgba(148,163,184,.7)", fontFamily: "ui-monospace, monospace", letterSpacing: "0.5px", margin: "2px 0 8px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span>{p.platform && p.platform !== "crossplay" ? p.platform : "Any platform"}{p.region ? ` · ${p.region}` : ""} · host {p.userName} · {filled}/{p.roleSlots.length}</span>
                  {(p.hostCompleted ?? 0) > 0 && (
                    <span title={`${p.hostCompleted} sessions completed`} style={{ fontFamily: "var(--font-barlow), sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: tierColor(p.hostTier), border: `1px solid ${tierColor(p.hostTier)}55`, padding: "1px 5px" }}>
                      ★ {p.hostTier} · {p.hostCompleted}
                    </span>
                  )}
                </div>
                {p.description && <div style={{ fontSize: 12, color: "rgba(203,213,225,.8)", marginBottom: 8 }}>{p.description}</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {p.roleSlots.map((role, i) => {
                    const claimedBy = p.roleClaimNames?.[i] || "";
                    const open = !p.roleClaims?.[i];
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: open ? "transparent" : "rgba(124,58,237,0.08)", border: `1px solid ${open ? "rgba(255,255,255,.06)" : `${accent}33`}` }}>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: open ? "rgba(148,163,184,.85)" : "rgba(243,244,246,.95)" }}>{role}</span>
                        {open ? (
                          (p.status === "OPEN" && !inIt) ? (
                            <button type="button" onClick={() => claim(p.id, i)} disabled={busy === `${p.id}:${i}`} style={{ padding: "3px 10px", fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", border: "none", background: accent, color: "#fff", cursor: "pointer", opacity: busy === `${p.id}:${i}` ? 0.5 : 1 }}>Claim</button>
                          ) : <span style={{ fontSize: 10, color: "rgba(148,163,184,.5)", fontStyle: "italic" }}>open</span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 600 }}>{claimedBy}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  {inIt && !isHost && <button type="button" onClick={() => release(p.id)} style={miniBtn("rgba(148,163,184,.85)")}>Leave</button>}
                  {isHost && p.status !== "COMPLETED" && <button type="button" onClick={() => complete(p.id)} style={miniBtn("#86efac", "rgba(34,197,94,0.4)")}>Mark complete</button>}
                  {isHost && <button type="button" onClick={() => del(p.id)} style={miniBtn("rgba(252,165,165,.85)")}>Delete</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: "inherit", marginBottom: 8,
  background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(243,244,246,.95)", outline: "none",
};
const selectStyle: React.CSSProperties = {
  padding: "7px 10px", fontSize: 12, fontFamily: "inherit",
  background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(243,244,246,.95)", cursor: "pointer", outline: "none",
};
function miniBtn(color: string, border = "rgba(255,255,255,.12)"): React.CSSProperties {
  return { padding: "5px 12px", fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", border: `1px solid ${border}`, background: "transparent", color, cursor: "pointer", fontFamily: "var(--font-barlow), sans-serif" };
}
