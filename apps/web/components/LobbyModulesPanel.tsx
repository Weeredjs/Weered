"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import StreamInterceptModal, { type StreamInfo } from "./StreamInterceptModal";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

// ── Style ────────────────────────────────────────────────────────────────────

const S = {
  card: { borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: "10px 12px" } as React.CSSProperties,
  btn: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)" } as React.CSSProperties,
  btnPri: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(124,58,237,.35)", background: "rgba(124,58,237,.12)", fontSize: 12, cursor: "pointer", color: "rgb(216,180,254)", fontWeight: 600 } as React.CSSProperties,
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.10)", background: "rgba(0,0,0,.30)", fontSize: 13, color: "rgba(243,244,246,.92)", outline: "none", boxSizing: "border-box" as const },
  label: { fontSize: 10, fontWeight: 700, opacity: 0.45, letterSpacing: ".7px", textTransform: "uppercase" as const, marginBottom: 6 } as React.CSSProperties,
};

const ACCENT_DESTINY = "#4F88C6";

// ── Tier colors for item rarity ──────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = { Exotic: "#ceae33", Legendary: "#522f65", Rare: "#5076a3", Uncommon: "#366e42", Common: "#c3bcb4", Unknown: "rgba(255,255,255,.1)", Currency: "rgba(255,255,255,.1)" };
const TIER_BORDER: Record<string, string> = { Exotic: "rgba(206,174,51,.6)", Legendary: "rgba(82,47,101,.8)", Rare: "rgba(80,118,163,.6)", Uncommon: "rgba(54,110,66,.6)", Common: "rgba(195,188,180,.4)", Unknown: "rgba(255,255,255,.08)", Currency: "rgba(255,255,255,.08)" };

// ── Perk Row (small perk icons with tooltips) ───────────────────────────────

function PerkRow({ perks, max = 6 }: { perks?: any[]; max?: number }) {
  if (!perks?.length) return null;
  // Filter out common cosmetic/tracker plugs by checking for icons
  const visible = perks.filter((p: any) => p.icon && p.name).slice(0, max);
  if (!visible.length) return null;
  return (
    <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
      {visible.map((p: any, i: number) => (
        <div key={i} title={p.name} style={{ width: 16, height: 16, borderRadius: 3, overflow: "hidden", background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)", flexShrink: 0 }}>
          <img src={p.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
    </div>
  );
}

// ── Armor Stat Bar ──────────────────────────────────────────────────────────

const STAT_BARS = [
  { key: "mobility", label: "MOB", color: "#7dd3fc" },
  { key: "resilience", label: "RES", color: "#f87171" },
  { key: "recovery", label: "REC", color: "#a3e635" },
  { key: "discipline", label: "DIS", color: "#818cf8" },
  { key: "intellect", label: "INT", color: "#fbbf24" },
  { key: "strength", label: "STR", color: "#f472b6" },
];

function ArmorStatBar({ stats }: { stats: any }) {
  if (!stats) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {STAT_BARS.map(s => (
        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
          <span style={{ width: 24, fontWeight: 700, color: s.color, opacity: 0.8, textAlign: "right" }}>{s.label}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
            <div style={{ width: `${Math.min((stats[s.key] || 0) / 42 * 100, 100)}%`, height: "100%", borderRadius: 3, background: s.color, opacity: 0.6 }} />
          </div>
          <span style={{ width: 18, fontWeight: 700, color: "rgba(255,255,255,.6)", textAlign: "right" }}>{stats[s.key] || 0}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 10, fontWeight: 800, color: "rgba(253,230,138,.7)", marginTop: 2 }}>
        Total: {stats.total || 0}
      </div>
    </div>
  );
}

// ── Perk Detail (expanded perk row with description + alternatives) ──────────

function PerkDetail({ perk }: { perk: any }) {
  const [expanded, setExpanded] = useState(false);
  const hasAlts = perk.availablePlugs?.length > 0;

  return (
    <div>
      <div
        onClick={() => hasAlts && setExpanded(v => !v)}
        style={{
          display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px", borderRadius: 6,
          background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.05)",
          cursor: hasAlts ? "pointer" : "default",
        }}
      >
        <div style={{ width: 28, height: 28, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)" }}>
          {perk.icon && <img src={perk.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            {perk.name}
            {hasAlts && (
              <span style={{ fontSize: 8, opacity: 0.35, fontWeight: 400 }}>
                {expanded ? "▲" : "▼"} {perk.availablePlugs.length} options
              </span>
            )}
          </div>
          {perk.description && (
            <div style={{ fontSize: 10, opacity: 0.45, marginTop: 2, lineHeight: 1.4 }}>
              {perk.description}
            </div>
          )}
        </div>
      </div>

      {/* Available alternatives */}
      {expanded && perk.availablePlugs && (
        <div style={{ marginLeft: 36, display: "flex", flexDirection: "column", gap: 2, marginTop: 2, marginBottom: 2 }}>
          {perk.availablePlugs.map((alt: any, j: number) => (
            <div key={j} style={{
              display: "flex", alignItems: "flex-start", gap: 6, padding: "4px 6px", borderRadius: 4,
              background: "rgba(124,58,237,.04)", border: "1px solid rgba(124,58,237,.08)",
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 3, overflow: "hidden", flexShrink: 0, background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.06)" }}>
                {alt.icon && <img src={alt.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(167,139,250,.8)" }}>{alt.name}</div>
                {alt.description && <div style={{ fontSize: 9, opacity: 0.35, marginTop: 1, lineHeight: 1.3 }}>{alt.description}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Item Detail Panel (overlay when clicking an item) ───────────────────────

function ItemDetailPanel({ item, onClose, onEquip, onTransfer, characters, currentCharId }: {
  item: any; onClose: () => void;
  onEquip?: (itemId: string, charId: string) => void;
  onTransfer?: (item: any, toVault: boolean, charId: string) => void;
  characters?: any[]; currentCharId?: string;
}) {
  const tier = item.tierName || "Unknown";
  const borderColor = TIER_BORDER[tier] || "rgba(255,255,255,.08)";

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(5,8,16,.92)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, letterSpacing: ".5px", textTransform: "uppercase" }}>Item Detail</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Icon + Name */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 80, height: 80, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: `2px solid ${borderColor}`, position: "relative", background: "rgba(0,0,0,.5)" }}>
            {item.icon && <img src={item.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            {item.watermark && <img src={item.watermark} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.25, pointerEvents: "none" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: tier === "Exotic" ? "#ceae33" : "#fff" }}>{item.name}</div>
            <div style={{ fontSize: 11, opacity: 0.5, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ padding: "1px 6px", borderRadius: 4, background: `${TIER_COLORS[tier] || "rgba(255,255,255,.1)"}40`, border: `1px solid ${borderColor}`, fontSize: 9, fontWeight: 700 }}>{tier}</span>
              {item.slotName && <span>{item.slotName}</span>}
              {item.damageType && item.damageType !== "None" && (
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  {item.damageIcon && <img src={item.damageIcon} alt="" style={{ width: 11, height: 11, opacity: 0.7 }} />}
                  {item.damageType}
                </span>
              )}
            </div>
            {item.primaryStat && <div style={{ fontSize: 24, fontWeight: 900, color: "rgb(253,230,138)", marginTop: 4 }}>{item.primaryStat}</div>}
          </div>
        </div>

        {/* Description */}
        {item.description && <div style={{ fontSize: 12, opacity: 0.5, lineHeight: 1.5 }}>{item.description}</div>}

        {/* Perks — split into real perks and mods/cosmetics */}
        {item.perks?.length > 0 && (() => {
          const realPerks = item.perks.filter((p: any) => p.icon && p.name && !p.isJunk);
          const junkPerks = item.perks.filter((p: any) => p.icon && p.name && p.isJunk);
          return (
            <>
              {realPerks.length > 0 && (
                <div>
                  <div style={S.label}>Perks</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {realPerks.map((p: any, i: number) => (
                      <PerkDetail key={i} perk={p} />
                    ))}
                  </div>
                </div>
              )}
              {junkPerks.length > 0 && (
                <div>
                  <div style={{ ...S.label, opacity: 0.25 }}>Mod Slots</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {junkPerks.map((p: any, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,.015)", border: "1px solid rgba(255,255,255,.03)" }}>
                        <div style={{ width: 20, height: 20, borderRadius: 4, overflow: "hidden", flexShrink: 0, background: "rgba(0,0,0,.3)", border: "1px dashed rgba(255,255,255,.08)" }}>
                          {p.icon && <img src={p.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.3 }} />}
                        </div>
                        <span style={{ fontSize: 10, opacity: 0.3, fontStyle: "italic" }}>{p.name}</span>
                        {p.availablePlugs?.length > 0 && (
                          <span style={{ fontSize: 9, opacity: 0.35, marginLeft: "auto" }}>{p.availablePlugs.length} available</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Armor Stats */}
        {item.armorStats && (
          <div>
            <div style={S.label}>Stats</div>
            <ArmorStatBar stats={item.armorStats} />
          </div>
        )}

        {/* Actions */}
        {(onEquip || onTransfer) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            {onEquip && currentCharId && !item.isEquipped && (
              <button onClick={() => onEquip(item.itemInstanceId, currentCharId)} style={{ ...S.btnPri, width: "100%", padding: "10px 0", fontWeight: 800 }}>
                Equip
              </button>
            )}
            {onTransfer && currentCharId && (
              <button onClick={() => onTransfer(item, true, currentCharId)} style={{ ...S.btn, width: "100%", padding: "8px 0", fontSize: 11 }}>
                Send to Vault
              </button>
            )}
            {onTransfer && characters && characters.filter(c => c.characterId !== currentCharId).map((c: any) => (
              <button key={c.characterId} onClick={() => onTransfer(item, false, c.characterId)} style={{ ...S.btn, width: "100%", padding: "8px 0", fontSize: 11 }}>
                Transfer to {c.className}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Item Tile (compact or full, with perks + click support) ─────────────────

function ItemTile({ item, compact, onClick }: { item: any; compact?: boolean; onClick?: () => void }) {
  const tier = item.tierName || "Unknown";
  const borderColor = TIER_BORDER[tier] || "rgba(255,255,255,.08)";
  const bgColor = TIER_COLORS[tier] || "rgba(255,255,255,.03)";
  const clickStyle = onClick ? { cursor: "pointer" } : {};

  if (compact) {
    return (
      <div title={`${item.name || "?"}${item.primaryStat ? ` (${item.primaryStat})` : ""}`} onClick={onClick} style={{
        width: 44, height: 44, borderRadius: 8, background: item.icon ? "rgba(0,0,0,.5)" : bgColor,
        border: `1.5px solid ${borderColor}`, overflow: "hidden", position: "relative", ...clickStyle,
      }}>
        {item.icon && <img src={item.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        {item.primaryStat && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,.75)", textAlign: "center",
            fontSize: 9, fontWeight: 800, color: tier === "Exotic" ? "#ceae33" : "#fff", padding: "1px 0" }}>{item.primaryStat}</div>
        )}
        {item.watermark && <img src={item.watermark} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.25, pointerEvents: "none" }} />}
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${borderColor}`, background: `${bgColor}18`, ...clickStyle }}>
      <div style={{ width: 40, height: 40, borderRadius: 7, overflow: "hidden", flexShrink: 0, background: item.icon ? "rgba(0,0,0,.5)" : bgColor, border: `1px solid ${borderColor}`, position: "relative" }}>
        {item.icon && <img src={item.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        {item.watermark && <img src={item.watermark} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3, pointerEvents: "none" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: tier === "Exotic" ? "#ceae33" : "rgba(243,244,246,.9)" }}>{item.name || "Unknown Item"}</div>
        <div style={{ fontSize: 10, opacity: 0.4, display: "flex", alignItems: "center", gap: 6 }}>
          {item.slotName && <span>{item.slotName}</span>}
          {item.damageType && item.damageType !== "None" && <><span style={{ opacity: 0.3 }}>·</span>{item.damageIcon && <img src={item.damageIcon} alt="" style={{ width: 10, height: 10, opacity: 0.6 }} />}<span>{item.damageType}</span></>}
        </div>
        <PerkRow perks={item.perks} max={5} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        {item.primaryStat && <div style={{ fontSize: 14, fontWeight: 900, color: tier === "Exotic" ? "#ceae33" : "rgba(253,230,138,.9)" }}>{item.primaryStat}</div>}
        {item.armorStats && <div style={{ fontSize: 9, opacity: 0.35, fontWeight: 600 }}>T{item.armorStats.total}</div>}
      </div>
    </div>
  );
}

// ── Twitch Streams ───────────────────────────────────────────────────────────

function TwitchStreams({ gameName = "Destiny 2", lobbyId, accentColor }: { gameName?: string; lobbyId?: string; accentColor?: string }) {
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [interceptStream, setInterceptStream] = useState<StreamInfo | null>(null);

  useEffect(() => {
    apiFetch(`/twitch/streams?game=${encodeURIComponent(gameName)}`)
      .then(j => { setStreams(j.streams || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [gameName]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading streams...</div>;

  function handleCardClick(s: any) {
    setInterceptStream({
      userLogin: s.userLogin || s.user_login || "",
      userName: s.userName || s.user_name || "",
      title: s.title || "",
      viewerCount: Number(s.viewerCount || s.viewer_count || 0),
      thumbnailUrl: s.thumbnailUrl || s.thumbnail_url || "",
      gameName,
    });
  }

  function handleWatchHere(stream: StreamInfo) {
    setActiveStream(stream.userLogin);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Embed player */}
      {activeStream && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(145,70,255,.25)", background: "#000", marginBottom: 4 }}>
          <iframe
            src={`https://player.twitch.tv/?channel=${activeStream}&parent=${typeof window !== "undefined" ? window.location.hostname : "weered.ca"}&muted=true`}
            width="100%"
            height="280"
            style={{ border: "none", display: "block" }}
            allowFullScreen
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(145,70,255,.08)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(216,180,254,.9)" }}>{activeStream}</span>
            <button onClick={() => setActiveStream(null)} style={{ ...S.btn, fontSize: 11, padding: "4px 10px" }}>Close</button>
          </div>
        </div>
      )}

      {/* Stream grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {streams.map(s => (
          <div
            key={s.id}
            onClick={() => handleCardClick(s)}
            style={{
              ...S.card,
              cursor: "pointer",
              transition: "border-color .15s, background .15s",
              border: activeStream === s.userLogin ? "1px solid rgba(145,70,255,.40)" : "1px solid rgba(255,255,255,.08)",
              background: activeStream === s.userLogin ? "rgba(145,70,255,.08)" : "rgba(255,255,255,.03)",
            }}
          >
            {s.thumbnailUrl && (
              <img src={s.thumbnailUrl} alt="" style={{ width: "100%", borderRadius: 6, marginBottom: 6, aspectRatio: "16/9", objectFit: "cover" }} />
            )}
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.userName}
            </div>
            <div style={{ fontSize: 11, opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
              {s.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0, boxShadow: "0 0 6px rgba(34,197,94,.6)" }} />
              <span style={{ fontSize: 11, color: "rgba(230,235,240,.75)", fontWeight: 600 }}>
                {s.viewerCount?.toLocaleString()} viewers
              </span>
            </div>
          </div>
        ))}
      </div>

      {streams.length === 0 && (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.4, fontSize: 13 }}>No live {gameName} streams right now.</div>
      )}

      <StreamInterceptModal
        stream={interceptStream}
        lobbyId={lobbyId}
        accentColor={accentColor}
        onClose={() => setInterceptStream(null)}
        onWatchHere={handleWatchHere}
      />
    </div>
  );
}

// ── LFG Board ────────────────────────────────────────────────────────────────

const D2_ACTIVITIES = [
  "Raid: Crota's End", "Raid: Root of Nightmares", "Raid: King's Fall",
  "Raid: Vow of the Disciple", "Raid: Vault of Glass", "Raid: Garden of Salvation",
  "Dungeon: Warlord's Ruin", "Dungeon: Ghosts of the Deep", "Dungeon: Spire of the Watcher",
  "Nightfall: Grandmaster", "Nightfall: Legend", "Nightfall: Hero",
  "Trials of Osiris", "Iron Banner", "Crucible: Competitive",
  "Gambit", "Exotic Quest", "Campaign (Legendary)", "Other",
];

const PLATFORMS = ["crossplay", "pc", "xbox", "psn"];

function LfgBoard({ lobbyId }: { lobbyId: string }) {
  const [posts, setPosts]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activity, setActivity]     = useState(D2_ACTIVITIES[0]);
  const [desc, setDesc]             = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [platform, setPlatform]     = useState("crossplay");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`)
      .then(j => { setPosts(j.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lobbyId]);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  async function create() {
    const j = await apiFetch(`/lfg/${encodeURIComponent(lobbyId)}`, {
      method: "POST",
      body: JSON.stringify({ activity, description: desc, maxPlayers, platform }),
    });
    if (j.ok) { setShowForm(false); setDesc(""); load(); }
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

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading fireteams...</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.6 }}>{posts.length} active fireteams</div>
        <button style={S.btnPri} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Create Fireteam"}
        </button>
      </div>
      {msg && <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.7 }}>{msg}</div>}

      {showForm && (
        <div style={{ ...S.card, marginBottom: 14, border: `1px solid ${ACCENT_DESTINY}35`, background: `${ACCENT_DESTINY}08` }}>
          <div style={S.label}>Activity</div>
          <select
            value={activity} onChange={e => setActivity(e.target.value)}
            style={{ ...S.input, marginBottom: 8, cursor: "pointer" }}
          >
            {D2_ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <div style={S.label}>Description (optional)</div>
          <input style={{ ...S.input, marginBottom: 8 }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="KWTD, chill run, teaching..." />

          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Max Players</div>
              <input type="number" style={S.input} value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))} min={2} max={12} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Platform</div>
              <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...S.input, cursor: "pointer" }}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <button style={{ ...S.btnPri, width: "100%", padding: "8px 0" }} onClick={create}>Post Fireteam</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {posts.map(p => {
          const isFull = p.status === "FULL";
          const slots = `${(p.players || []).length}/${p.maxPlayers}`;
          return (
            <div key={p.id} style={{
              ...S.card,
              display: "flex", alignItems: "center", gap: 12,
              border: isFull ? "1px solid rgba(245,158,11,.20)" : "1px solid rgba(255,255,255,.08)",
              opacity: isFull ? 0.7 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  {p.activity}
                  {isFull && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 999, background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.25)", color: "rgb(253,230,138)" }}>FULL</span>}
                </div>
                {p.description && <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>{p.description}</div>}
                <div style={{ display: "flex", gap: 8, fontSize: 11, opacity: 0.5 }}>
                  <span>{p.platform}</span>
                  <span>by {p.userName}</span>
                  <span>{slots} guardians</span>
                </div>
                {(p.playerNames || []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {p.playerNames.map((n: string, i: number) => (
                      <span key={i} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "rgba(79,136,198,.12)", border: "1px solid rgba(79,136,198,.25)", color: "rgba(147,197,253,.85)" }}>{n}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                {!isFull && (
                  <button style={{ ...S.btnPri, fontSize: 11 }} onClick={() => join(p.id)}>Join</button>
                )}
                <button style={{ ...S.btn, fontSize: 11 }} onClick={() => leave(p.id)}>Leave</button>
              </div>
            </div>
          );
        })}
        {posts.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, opacity: 0.35, fontSize: 13 }}>
            No active fireteams. Be the first to create one!
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bungie Weekly / Xur ──────────────────────────────────────────────────────

function BungieWeekly({ accentColor }: { accentColor?: string }) {
  const accent = accentColor || ACCENT_DESTINY;
  const [data, setData] = useState<any>(null);
  const [xur, setXur]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch("/bungie/weekly"), apiFetch("/bungie/xur")])
      .then(([w, x]) => { setData(w); setXur(x); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading Bungie data...</div>;

  const milestones = data?.milestones || [];
  const hasManifest = !!data?.manifestVersion;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Xur Status + Inventory */}
      <div style={{ ...S.card, border: xur?.available ? "1px solid rgba(245,158,11,.30)" : "1px solid rgba(255,255,255,.08)", background: xur?.available ? "rgba(245,158,11,.06)" : "rgba(255,255,255,.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: xur?.available && xur?.items?.length ? 10 : 0 }}>
          <span style={{ fontSize: 22 }}>🐍</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: xur?.available ? "rgb(253,230,138)" : "rgba(255,255,255,.6)" }}>Xur {xur?.available ? "is here!" : "is away"}</div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>{xur?.available ? "Exotic vendor is selling..." : "Returns every Friday at reset"}</div>
          </div>
        </div>
        {xur?.available && xur?.items?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid rgba(245,158,11,.12)", paddingTop: 8 }}>
            {xur.items.map((item: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, border: `1px solid ${TIER_BORDER[item.tierName] || "rgba(255,255,255,.08)"}`, background: `${TIER_COLORS[item.tierName] || "rgba(255,255,255,.03)"}18` }}>
                <div style={{ width: 40, height: 40, borderRadius: 7, overflow: "hidden", flexShrink: 0, background: "rgba(0,0,0,.5)", border: `1px solid ${TIER_BORDER[item.tierName] || "rgba(255,255,255,.08)"}`, position: "relative" }}>
                  {item.icon && <img src={item.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: item.tierName === "Exotic" ? "#ceae33" : "rgba(243,244,246,.9)" }}>{item.name || "Unknown"}</div>
                  <div style={{ fontSize: 10, opacity: 0.4 }}>{item.tierName}{item.slotName ? ` · ${item.slotName}` : ""}</div>
                  <PerkRow perks={item.perks} max={5} />
                </div>
                {item.armorStats && <div style={{ fontSize: 9, opacity: 0.35, fontWeight: 600, flexShrink: 0 }}>T{item.armorStats.total}</div>}
              </div>
            ))}
            {xur.cachedAt && <div style={{ fontSize: 9, opacity: 0.2, textAlign: "center", marginTop: 2 }}>Cached {new Date(xur.cachedAt).toLocaleTimeString()}</div>}
          </div>
        )}
      </div>

      {/* Milestones */}
      {milestones.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {milestones.filter((ms: any) => !ms.name.startsWith("Milestone")).slice(0, 20).map((ms: any) => (
            <div key={ms.hash} style={{ ...S.card }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: ms.activities?.length ? 8 : 0 }}>
                {ms.icon ? (
                  <img src={ms.icon} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>📋</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{ms.name}</div>
                  {ms.description && <div style={{ fontSize: 10, opacity: 0.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ms.description}</div>}
                </div>
                {ms.activities?.length > 0 && <span style={{ fontSize: 10, opacity: 0.35, flexShrink: 0 }}>{ms.activities.length} activities</span>}
              </div>
              {hasManifest && ms.activities?.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {ms.activities.slice(0, 5).map((act: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.04)" }}>
                      {act.icon && <img src={act.icon} alt="" style={{ width: 24, height: 24, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{act.name}</div>
                        {act.lightLevel > 0 && <span style={{ fontSize: 9, opacity: 0.4 }}>{act.lightLevel} Power</span>}
                      </div>
                      {act.modifiers?.length > 0 && (
                        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                          {act.modifiers.slice(0, 6).map((mod: any, mi: number) => (
                            <div key={mi} title={`${mod.name}: ${mod.description || ""}`} style={{ width: 20, height: 20, borderRadius: 4, overflow: "hidden", background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.06)" }}>
                              {mod.icon && <img src={mod.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...S.card, fontSize: 12, opacity: 0.4 }}>{data?.error ? "Bungie API unavailable — check back later" : "No milestone data available"}</div>
      )}

      <div style={{ ...S.card, textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.4, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 4 }}>Weekly Reset</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Every Tuesday at 17:00 UTC</div>
        {hasManifest && <div style={{ fontSize: 9, opacity: 0.25, marginTop: 4 }}>Manifest v{data.manifestVersion}</div>}
      </div>
    </div>
  );
}

// ── Guardian Lookup ──────────────────────────────────────────────────────────

function GuardianLookup() {
  const [query, setQuery]     = useState("");
  const [result, setResult]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const CLASS_NAMES: Record<number, string> = { 0: "Titan", 1: "Hunter", 2: "Warlock" };
  const CLASS_EMOJI: Record<number, string> = { 0: "🛡", 1: "🗡", 2: "✨" };

  async function search() {
    if (!query.trim()) return;
    setLoading(true); setError(""); setResult(null); setSelectedItem(null);
    try {
      const j = await apiFetch(`/bungie/player/${encodeURIComponent(query.trim())}`);
      if (j.ok && j.found) setResult(j);
      else if (j.ok && !j.found) setError("Guardian not found. Try BungieName#1234 format.");
      else setError(j.error || "Lookup failed");
    } catch { setError("Network error"); }
    setLoading(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          placeholder="BungieName#1234"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
        />
        <button style={S.btnPri} onClick={search} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: "rgba(252,165,165,.8)", marginBottom: 10 }}>{error}</div>}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Player card */}
          <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, border: `1px solid ${ACCENT_DESTINY}30`, background: `${ACCENT_DESTINY}08` }}>
            {result.player?.iconPath && (
              <img src={result.player.iconPath} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {result.player?.displayName}
                {result.player?.displayNameCode ? `#${result.player.displayNameCode}` : ""}
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                {result.totalCharacters} characters · Platform {result.player?.membershipType}
              </div>
            </div>
          </div>

          {result.privacyRestricted && (
            <div style={{ ...S.card, textAlign: "center", fontSize: 12, opacity: 0.5 }}>This guardian's equipment is private.</div>
          )}

          {/* Characters with equipment */}
          {(result.characters || []).map((c: any) => (
            <div key={c.characterId} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{
                ...S.card,
                position: "relative",
                overflow: "hidden",
              }}>
                {c.emblemBackgroundPath && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: `url(${c.emblemBackgroundPath}) center/cover no-repeat`,
                    opacity: 0.15,
                  }} />
                )}
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{CLASS_EMOJI[c.classType] || "?"}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{CLASS_NAMES[c.classType] || "Unknown"}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "rgb(253,230,138)", lineHeight: 1.1 }}>
                        {c.light} <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.5 }}>Power</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.4 }}>
                    {Math.round((c.minutesPlayedTotal || 0) / 60)}h played
                  </div>
                </div>
              </div>
              {/* Equipped items grid */}
              {(c.weapons?.length > 0 || c.armor?.length > 0 || c.equipped?.length > 0) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 4 }}>
                  {(c.weapons || []).concat(c.armor || []).concat(c.otherEquipped || []).slice(0, 12).map((item: any, i: number) => (
                    <ItemTile key={i} item={item} compact onClick={() => setSelectedItem(item)} />
                  ))}
                  {/* Fallback: if no grouped data, use flat equipped */}
                  {!c.weapons?.length && !c.armor?.length && (c.equipped || []).slice(0, 12).map((item: any, i: number) => (
                    <ItemTile key={`e${i}`} item={item} compact onClick={() => setSelectedItem(item)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!result && !error && !loading && (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.3, fontSize: 13 }}>
          Search for any Destiny 2 guardian to see their characters and loadout
        </div>
      )}

      {/* Read-only detail panel (no equip/transfer — it's someone else's guardian) */}
      {selectedItem && <ItemDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}

// ── My Guardian (linked Bungie account) ─────────────────────────────────────

function MyGuardian({ accentColor }: { accentColor?: string }) {
  const accent = accentColor || ACCENT_DESTINY;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChar, setSelectedChar] = useState(0);
  const [subTab, setSubTab] = useState<"equipped" | "inventory" | "vault">("equipped");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState("");

  const fetchProfile = useCallback(() => {
    apiFetch("/bungie/me")
      .then(j => { setData(j); setLoading(false); })
      .catch(() => { setError("Failed to load"); setLoading(false); });
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  async function handleEquip(itemId: string, charId: string) {
    setActionMsg("Equipping...");
    try {
      const j = await apiFetch("/bungie/equip", { method: "POST", body: JSON.stringify({ itemId, characterId: charId, membershipType: data?.platform }) });
      if (j.ok) { setActionMsg("Equipped!"); setSelectedItem(null); fetchProfile(); }
      else setActionMsg(j.error || j.message || "Equip failed");
    } catch { setActionMsg("Network error"); }
    setTimeout(() => setActionMsg(""), 3000);
  }

  async function handleTransfer(item: any, toVault: boolean, charId: string) {
    setActionMsg(toVault ? "Vaulting..." : "Transferring...");
    try {
      const j = await apiFetch("/bungie/transfer", { method: "POST", body: JSON.stringify({ itemReferenceHash: item.itemHash, stackSize: 1, transferToVault: toVault, itemId: item.itemInstanceId, characterId: charId, membershipType: data?.platform }) });
      if (j.ok) { setActionMsg(toVault ? "Vaulted!" : "Transferred!"); setSelectedItem(null); fetchProfile(); }
      else setActionMsg(j.error || j.message || "Transfer failed");
    } catch { setActionMsg("Network error"); }
    setTimeout(() => setActionMsg(""), 3000);
  }

  if (loading) return <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>Loading your Guardian...</div>;

  if (!data?.linked) {
    const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : "";
    const linkUrl = `${API}/auth/bungie?token=${encodeURIComponent(token)}`;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 16 }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>🔗</div>
        <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center" }}>Link your Bungie account</div>
        <div style={{ fontSize: 12, opacity: 0.45, textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>
          Connect your Bungie.net account to view your characters, inventory, vault, and loadouts right here on Weered.
        </div>
        <a href={linkUrl} style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 12,
          background: `${accent}20`, border: `1px solid ${accent}50`, color: accent, fontWeight: 800, fontSize: 14,
          textDecoration: "none", cursor: "pointer",
        }}>Link Bungie Account</a>
        <div style={{ fontSize: 10, opacity: 0.25 }}>You will be redirected to Bungie.net to authorize</div>
      </div>
    );
  }

  if (error || data?.error) {
    const isExpired = data?.error === "token_expired" || data?.error === "no_profile_data" || data?.error === "fetch_failed";
    if (isExpired && data?.linked) {
      const token = typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : "";
      const linkUrl = `${API}/auth/bungie?token=${encodeURIComponent(token)}`;
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 16 }}>
          <div style={{ fontSize: 48, opacity: 0.3 }}>🔄</div>
          <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center" }}>Session expired</div>
          <div style={{ fontSize: 12, opacity: 0.45, textAlign: "center", maxWidth: 320, lineHeight: 1.5 }}>
            Your Bungie authorization has expired. Re-link to restore access to your characters, inventory, and vault.
          </div>
          <a href={linkUrl} style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 12,
            background: `${accent}20`, border: `1px solid ${accent}50`, color: accent, fontWeight: 800, fontSize: 14,
            textDecoration: "none", cursor: "pointer",
          }}>Re-link Bungie Account</a>
          <div style={{ fontSize: 10, opacity: 0.25 }}>You will be redirected to Bungie.net</div>
        </div>
      );
    }
    return <div style={{ padding: 20, textAlign: "center", color: "rgba(252,165,165,.8)", fontSize: 13 }}>{error || data?.message || data?.error}</div>;
  }

  const characters: any[] = Array.isArray(data?.characters) ? data.characters : typeof data?.characters === "object" && data.characters ? Object.values(data.characters) : [];
  const vault: any[] = data?.vault || [];
  const char = characters[selectedChar];
  const hasManifest = !!data?.manifestVersion;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%", position: "relative" }}>
      {/* Account header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: `${accent}25`, border: `1px solid ${accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>⚔</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            {data.displayName}
            <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.25)", color: "rgba(134,239,172,.9)" }}>LINKED</span>
          </div>
          <div style={{ fontSize: 9, opacity: 0.4 }}>Platform {data.platform} · {characters.length} chars{data.vaultCount ? ` · ${data.vaultCount} vault` : ""}</div>
        </div>
        <button onClick={() => { const t = typeof window !== "undefined" ? localStorage.getItem("weered_token") || "" : ""; window.location.href = `${API}/auth/bungie?token=${encodeURIComponent(t)}`; }} style={{ ...S.btn, fontSize: 10, padding: "3px 8px" }}>Re-link</button>
      </div>

      {/* Character tabs */}
      {characters.length > 0 && (
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(255,255,255,.06)", flexShrink: 0, overflow: "hidden" }}>
          {characters.map((c: any, i: number) => (
            <button key={c.characterId || i} onClick={() => { setSelectedChar(i); if (subTab === "vault") setSubTab("equipped"); }} style={{
              flex: 1, padding: "6px 4px", border: "none", cursor: "pointer", minWidth: 0,
              background: selectedChar === i && subTab !== "vault" ? `${accent}18` : "transparent",
              borderBottom: selectedChar === i && subTab !== "vault" ? `2px solid ${accent}` : "2px solid transparent",
              color: selectedChar === i && subTab !== "vault" ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.55)",
              fontWeight: selectedChar === i && subTab !== "vault" ? 700 : 400, fontSize: 11, transition: "all .12s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              overflow: "hidden", whiteSpace: "nowrap",
            }}>
              <span style={{ fontSize: 12 }}>{c.classType === 0 ? "🛡" : c.classType === 1 ? "🗡" : "✨"}</span>
              {c.className || ["Titan", "Hunter", "Warlock"][c.classType]}
              <span style={{ fontSize: 13, fontWeight: 900, color: "rgb(253,230,138)" }}>{c.light}</span>
            </button>
          ))}
          <button onClick={() => setSubTab("vault")} style={{
            padding: "6px 8px", border: "none", cursor: "pointer", flexShrink: 0,
            background: subTab === "vault" ? "rgba(245,158,11,.08)" : "transparent",
            borderBottom: subTab === "vault" ? "2px solid rgba(245,158,11,.6)" : "2px solid transparent",
            color: subTab === "vault" ? "rgba(253,230,138,.9)" : "rgba(148,163,184,.55)",
            fontWeight: subTab === "vault" ? 700 : 400, fontSize: 11, transition: "all .12s",
          }}>🔒 Vault{data.vaultCount ? ` (${data.vaultCount})` : ""}</button>
        </div>
      )}

      {/* Sub-tabs for character view */}
      {subTab !== "vault" && char && (
        <div style={{ display: "flex", gap: 2, padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,.04)", flexShrink: 0 }}>
          {(["equipped", "inventory"] as const).map(st => (
            <button key={st} onClick={() => setSubTab(st)} style={{
              padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, cursor: "pointer",
              background: subTab === st ? `${accent}20` : "transparent",
              color: subTab === st ? "rgba(243,244,246,.9)" : "rgba(148,163,184,.5)",
              fontWeight: subTab === st ? 700 : 400, textTransform: "capitalize",
            }}>{st}{st === "inventory" ? ` (${char.inventory?.length || 0})` : ""}</button>
          ))}
        </div>
      )}

      {/* Action message */}
      {actionMsg && (
        <div style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, textAlign: "center", color: actionMsg.includes("failed") || actionMsg.includes("error") ? "rgba(252,165,165,.9)" : "rgba(134,239,172,.9)", background: actionMsg.includes("failed") || actionMsg.includes("error") ? "rgba(252,165,165,.06)" : "rgba(34,197,94,.06)", borderBottom: "1px solid rgba(255,255,255,.04)", flexShrink: 0 }}>
          {actionMsg}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
        {subTab === "vault" ? (
          <VaultView items={vault} onItemClick={setSelectedItem} />
        ) : char ? (
          subTab === "equipped" ? (
            <EquippedView char={char} hasManifest={hasManifest} accent={accent} onItemClick={setSelectedItem} />
          ) : (
            <InventoryGrid items={char.inventory || []} hasManifest={hasManifest} onItemClick={setSelectedItem} />
          )
        ) : (
          <div style={{ textAlign: "center", padding: 20, opacity: 0.35, fontSize: 13 }}>No character data available</div>
        )}
      </div>

      {/* Item detail overlay — positioned over entire MyGuardian panel */}
      {selectedItem && (
        <ItemDetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEquip={handleEquip}
          onTransfer={handleTransfer}
          characters={characters}
          currentCharId={char?.characterId}
        />
      )}
    </div>
  );
}

function EquippedView({ char, hasManifest, accent, onItemClick }: { char: any; hasManifest: boolean; accent: string; onItemClick?: (item: any) => void }) {
  const weapons = char.weapons || [];
  const armor = char.armor || [];
  const other = char.otherEquipped || [];
  const allEquipped = char.equipped || [];
  const hasGrouped = weapons.length > 0 || armor.length > 0;

  if (!hasGrouped && allEquipped.length > 0) {
    return (
      <div>
        <div style={S.label}>Equipped</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {allEquipped.slice(0, 12).map((item: any, i: number) => <ItemTile key={i} item={item} compact onClick={onItemClick ? () => onItemClick(item) : undefined} />)}
        </div>
        {!hasManifest && <div style={{ fontSize: 10, opacity: 0.25, marginTop: 12, textAlign: "center" }}>Manifest not synced — item names unavailable</div>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {char.emblemBackgroundPath && (
        <div style={{ borderRadius: 10, overflow: "hidden", position: "relative", height: 56,
          background: `url(${char.emblemBackgroundPath?.startsWith("http") ? char.emblemBackgroundPath : "https://www.bungie.net" + char.emblemBackgroundPath}) center/cover` }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,.7) 0%, transparent 60%)", display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{char.classType === 0 ? "🛡" : char.classType === 1 ? "🗡" : "✨"}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{char.className} <span style={{ opacity: 0.4, fontWeight: 400, fontSize: 11 }}>{char.raceName}</span></div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "rgb(253,230,138)", lineHeight: 1 }}>{char.light} <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.5 }}>POWER</span></div>
            </div>
          </div>
        </div>
      )}
      {weapons.length > 0 && (
        <div><div style={S.label}>Weapons</div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{weapons.map((item: any, i: number) => <ItemTile key={i} item={item} onClick={onItemClick ? () => onItemClick(item) : undefined} />)}</div></div>
      )}
      {armor.length > 0 && (
        <div><div style={S.label}>Armor</div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{armor.map((item: any, i: number) => <ItemTile key={i} item={item} onClick={onItemClick ? () => onItemClick(item) : undefined} />)}</div></div>
      )}
      {other.length > 0 && (
        <div><div style={S.label}>Other</div><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{other.map((item: any, i: number) => <ItemTile key={i} item={item} compact onClick={onItemClick ? () => onItemClick(item) : undefined} />)}</div></div>
      )}
      <div style={{ fontSize: 10, opacity: 0.2, textAlign: "center" }}>Last played: {char.dateLastPlayed ? new Date(char.dateLastPlayed).toLocaleDateString() : "—"} · {Math.round((char.minutesPlayedTotal || 0) / 60)}h total</div>
    </div>
  );
}

function InventoryGrid({ items, hasManifest, onItemClick }: { items: any[]; hasManifest: boolean; onItemClick?: (item: any) => void }) {
  if (!items.length) return <div style={{ textAlign: "center", padding: 20, opacity: 0.35, fontSize: 13 }}>Inventory empty</div>;
  const exotics = items.filter((i: any) => i.tierName === "Exotic");
  const legendaries = items.filter((i: any) => i.tierName === "Legendary");
  const rest = items.filter((i: any) => i.tierName !== "Exotic" && i.tierName !== "Legendary");

  const renderGroup = (label: string, group: any[]) => group.length === 0 ? null : (
    <div>
      <div style={S.label}>{label} ({group.length})</div>
      {hasManifest ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{group.map((item: any, i: number) => <ItemTile key={i} item={item} onClick={onItemClick ? () => onItemClick(item) : undefined} />)}</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{group.map((item: any, i: number) => <ItemTile key={i} item={item} compact onClick={onItemClick ? () => onItemClick(item) : undefined} />)}</div>
      )}
    </div>
  );
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{renderGroup("Exotics", exotics)}{renderGroup("Legendaries", legendaries)}{renderGroup("Other", rest)}</div>;
}

function VaultView({ items, onItemClick }: { items: any[]; onItemClick?: (item: any) => void }) {
  const [filter, setFilter] = useState<"all" | "weapons" | "armor">("all");
  if (!items.length) return <div style={{ textAlign: "center", padding: 20, opacity: 0.35, fontSize: 13 }}>Vault empty or not loaded</div>;
  const weaponBuckets = new Set([1498876634, 2465295065, 953998645]);
  const armorBuckets = new Set([3448274439, 3551918588, 14239492, 20886954, 1585787867]);
  const filtered = items.filter((i: any) => {
    if (filter === "weapons") return weaponBuckets.has(i.bucketHash);
    if (filter === "armor") return armorBuckets.has(i.bucketHash);
    return true;
  });
  filtered.sort((a: any, b: any) => { const ta = a.tierType || 0, tb = b.tierType || 0; if (ta !== tb) return tb - ta; return (b.primaryStat || 0) - (a.primaryStat || 0); });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {(["all", "weapons", "armor"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, cursor: "pointer",
            background: filter === f ? "rgba(245,158,11,.15)" : "transparent",
            color: filter === f ? "rgba(253,230,138,.9)" : "rgba(148,163,184,.5)",
            fontWeight: filter === f ? 700 : 400, textTransform: "capitalize",
          }}>{f} ({f === "all" ? items.length : items.filter((i: any) => f === "weapons" ? weaponBuckets.has(i.bucketHash) : armorBuckets.has(i.bucketHash)).length})</button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {filtered.slice(0, 100).map((item: any, i: number) => <ItemTile key={i} item={item} compact onClick={onItemClick ? () => onItemClick(item) : undefined} />)}
      </div>
      {filtered.length > 100 && <div style={{ fontSize: 10, opacity: 0.3, textAlign: "center" }}>Showing first 100 of {filtered.length}</div>}
    </div>
  );
}



// ── Challenge Board ──────────────────────────────────────────────────────────

const DIFFICULTY_STARS = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];
const CATEGORY_COLORS: Record<string, string> = {
  crucible: "#ef4444", pve: "#22c55e", raid: "#a855f7", seasonal: "#f59e0b", dungeon: "#6366f1",
};

function ChallengeCard({ challenge, enrollment, onEnroll, onAbandon }: {
  challenge: any;
  enrollment: any;
  onEnroll: () => void;
  onAbandon: () => void;
}) {
  const def = challenge.definition;
  const objectives = (def.objectives || []) as any[];
  const progress = enrollment?.progress || {};
  const isEnrolled = enrollment && enrollment.status === "ACTIVE";
  const isCompleted = enrollment?.status === "COMPLETED";
  const catColor = CATEGORY_COLORS[def.category] || ACCENT_DESTINY;
  const timeLeft = challenge.endsAt ? Math.max(0, new Date(challenge.endsAt).getTime() - Date.now()) : null;
  const daysLeft = timeLeft ? Math.ceil(timeLeft / 86400000) : null;

  return (
    <div style={{
      ...S.card,
      borderColor: isCompleted ? "rgba(34,197,94,.3)" : isEnrolled ? `${catColor}44` : "rgba(255,255,255,.08)",
      background: isCompleted ? "rgba(34,197,94,.05)" : isEnrolled ? `${catColor}08` : "rgba(255,255,255,.03)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{
              fontSize: 8, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase",
              padding: "1px 6px", borderRadius: 4,
              background: `${catColor}20`, color: catColor,
            }}>
              {def.category || "general"}
            </span>
            <span style={{ fontSize: 10, color: "#fcd34d", letterSpacing: "1px" }}>
              {DIFFICULTY_STARS[def.difficulty] || "★"}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(243,244,246,.92)" }}>
            {def.title}
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
            {def.description}
          </div>
        </div>
        {/* Reward badge */}
        <div style={{
          textAlign: "center", padding: "6px 10px", borderRadius: 8,
          background: "rgba(124,58,237,.1)", border: "1px solid rgba(124,58,237,.2)",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#a78bfa" }}>{def.notorietyReward}</div>
          <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>XP</div>
        </div>
      </div>

      {/* Objectives with progress */}
      {objectives.map((obj: any) => {
        const p = progress[obj.id] || { current: 0, target: obj.target, completed: false };
        const pct = Math.min(100, Math.round((p.current / p.target) * 100));
        return (
          <div key={obj.id}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
              <span style={{ opacity: 0.7 }}>{obj.description}</span>
              {isEnrolled && (
                <span style={{ fontWeight: 700, fontFamily: "monospace", color: p.completed ? "#22c55e" : "rgba(255,255,255,.6)" }}>
                  {p.current}/{p.target}
                </span>
              )}
            </div>
            {isEnrolled && (
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${pct}%`,
                  background: p.completed ? "#22c55e" : catColor,
                  transition: "width .3s ease",
                }} />
              </div>
            )}
          </div>
        );
      })}

      {/* Footer — time + action */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        <div style={{ fontSize: 10, opacity: 0.35 }}>
          {daysLeft != null ? `${daysLeft}d remaining` : "No deadline"}
          {challenge._count?.enrollments > 0 && ` · ${challenge._count.enrollments} enrolled`}
        </div>
        {isCompleted ? (
          <span style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: "rgba(34,197,94,.15)", color: "#86efac",
          }}>
            ✓ Completed
          </span>
        ) : isEnrolled ? (
          <button onClick={onAbandon} style={{
            ...S.btn, fontSize: 10, padding: "3px 10px",
            borderColor: "rgba(239,68,68,.25)", color: "rgba(252,165,165,.7)",
          }}>
            Abandon
          </button>
        ) : (
          <button onClick={onEnroll} style={{ ...S.btnPri, fontSize: 11, padding: "5px 14px" }}>
            Enroll
          </button>
        )}
      </div>
    </div>
  );
}

// ── Leaderboard Component ─────────────────────────────────────────────────

function ChallengeLeaderboard({ instanceId, challengeTitle }: { instanceId: string; challengeTitle: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/challenges/${instanceId}/leaderboard`).then(res => {
      if (res?.leaderboard) setRows(res.leaderboard);
      setLoading(false);
    });
  }, [instanceId]);

  if (loading) return <div style={{ padding: 12, opacity: 0.4, fontSize: 11 }}>Loading...</div>;
  if (rows.length === 0) return <div style={{ padding: 12, opacity: 0.3, fontSize: 11 }}>No completions yet.</div>;

  const RANK_COLORS = ["#fcd34d", "#94a3b8", "#cd7f32"]; // gold, silver, bronze

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginBottom: 4 }}>{challengeTitle}</div>
      {rows.map((r: any) => (
        <div key={r.rank} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 8,
          background: r.rank <= 3 ? `${RANK_COLORS[r.rank - 1]}08` : "transparent",
          borderLeft: r.rank <= 3 ? `3px solid ${RANK_COLORS[r.rank - 1]}` : "3px solid transparent",
        }}>
          <span style={{
            width: 22, textAlign: "center", fontWeight: 900, fontSize: 13,
            color: r.rank <= 3 ? RANK_COLORS[r.rank - 1] : "rgba(255,255,255,.3)",
            fontFamily: "monospace",
          }}>
            {r.rank}
          </span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.85)" }}>
            {r.name}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
            background: "rgba(124,58,237,.1)", color: "#a78bfa", textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            {r.tier}
          </span>
          <span style={{ fontSize: 10, opacity: 0.35, fontFamily: "monospace" }}>
            {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChallengeBoard({ lobbyId }: { lobbyId: string }) {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"active" | "mine" | "completed" | "leaderboard">("active");
  const [leaderboardId, setLeaderboardId] = useState<string | null>(null);
  const enrollmentsRef = useRef(myEnrollments);
  enrollmentsRef.current = myEnrollments;

  const fetchAll = useCallback(async () => {
    const [cRes, mRes] = await Promise.all([
      apiFetch(`/challenges?lobbyId=${encodeURIComponent(lobbyId)}`),
      apiFetch("/challenges/my"),
    ]);
    if (cRes?.challenges) setChallenges(cRes.challenges);
    if (mRes?.enrollments) setMyEnrollments(mRes.enrollments);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Live WS updates ──
  useEffect(() => {
    function onChallengeEvent(e: Event) {
      const d = (e as CustomEvent).detail;
      if (!d?.instanceId) return;

      if (d.type === "challenge:progress") {
        setMyEnrollments(prev => prev.map(en =>
          en.instanceId === d.instanceId ? { ...en, progress: d.progress } : en
        ));
      }

      if (d.type === "challenge:completed") {
        setMyEnrollments(prev => prev.map(en =>
          en.instanceId === d.instanceId
            ? { ...en, progress: d.progress, status: "COMPLETED", completedAt: new Date().toISOString() }
            : en
        ));
      }
    }

    window.addEventListener("weered:challenge", onChallengeEvent);
    return () => window.removeEventListener("weered:challenge", onChallengeEvent);
  }, []);

  const enroll = async (instanceId: string) => {
    await apiFetch(`/challenges/${instanceId}/enroll`, { method: "POST", body: JSON.stringify({}) });
    fetchAll();
  };
  const abandon = async (instanceId: string) => {
    await apiFetch(`/challenges/${instanceId}/enroll`, { method: "DELETE", body: JSON.stringify({}) });
    fetchAll();
  };

  // Build enrollment map by instanceId
  const enrollMap = new Map<string, any>();
  for (const e of myEnrollments) enrollMap.set(e.instanceId, e);

  const activeChallenges = challenges.filter(c => c.status === "ACTIVE");
  const myChallenges = myEnrollments.filter(e => e.status === "ACTIVE");
  const completedChallenges = myEnrollments.filter(e => e.status === "COMPLETED");

  // Find leaderboard title
  const lbChallenge = leaderboardId ? challenges.find(c => c.id === leaderboardId) : null;

  if (loading) return <div style={{ padding: 20, opacity: 0.4, fontSize: 12 }}>Loading challenges...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["active", "mine", "completed", "leaderboard"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            padding: "5px 12px", borderRadius: 6,
            border: subTab === t ? "1px solid rgba(79,136,198,.4)" : "1px solid rgba(255,255,255,.08)",
            background: subTab === t ? "rgba(79,136,198,.12)" : "rgba(255,255,255,.03)",
            color: subTab === t ? "rgba(243,244,246,.9)" : "rgba(148,163,184,.6)",
            fontSize: 11, fontWeight: subTab === t ? 700 : 400, cursor: "pointer",
          }}>
            {t === "active" ? `Challenges (${activeChallenges.length})` :
             t === "mine" ? `My Active (${myChallenges.length})` :
             t === "completed" ? `Completed (${completedChallenges.length})` :
             "🏆 Leaderboard"}
          </button>
        ))}
      </div>

      {/* Challenge list */}
      {subTab === "active" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeChallenges.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>No active challenges right now.</div>
          ) : activeChallenges.map(c => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              enrollment={enrollMap.get(c.id)}
              onEnroll={() => enroll(c.id)}
              onAbandon={() => abandon(c.id)}
            />
          ))}
        </div>
      )}

      {subTab === "mine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myChallenges.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>You haven&apos;t enrolled in any challenges yet.</div>
          ) : myChallenges.map(e => {
            const c = challenges.find(ch => ch.id === e.instanceId) || { definition: e.instance?.definition, _count: { enrollments: 0 }, ...e.instance };
            return (
              <ChallengeCard
                key={e.id}
                challenge={c}
                enrollment={e}
                onEnroll={() => {}}
                onAbandon={() => abandon(e.instanceId)}
              />
            );
          })}
        </div>
      )}

      {subTab === "completed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {completedChallenges.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>No completed challenges yet. Get grinding!</div>
          ) : completedChallenges.map(e => {
            const c = challenges.find(ch => ch.id === e.instanceId) || { definition: e.instance?.definition, _count: { enrollments: 0 }, ...e.instance };
            return (
              <ChallengeCard
                key={e.id}
                challenge={c}
                enrollment={e}
                onEnroll={() => {}}
                onAbandon={() => {}}
              />
            );
          })}
        </div>
      )}

      {subTab === "leaderboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Challenge selector for leaderboard */}
          {!leaderboardId ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>Select a challenge to view its leaderboard:</div>
              {activeChallenges.map(c => (
                <button key={c.id} onClick={() => setLeaderboardId(c.id)} style={{
                  ...S.card, cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.9)" }}>{c.definition.title}</div>
                    <div style={{ fontSize: 10, opacity: 0.4 }}>{c._count?.enrollments || 0} enrolled</div>
                  </div>
                  <span style={{ fontSize: 16, opacity: 0.3 }}>→</span>
                </button>
              ))}
              {activeChallenges.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>No challenges available.</div>
              )}
            </div>
          ) : (
            <div>
              <button onClick={() => setLeaderboardId(null)} style={{
                ...S.btn, fontSize: 10, marginBottom: 8, padding: "3px 10px",
              }}>
                ← Back
              </button>
              <ChallengeLeaderboard
                instanceId={leaderboardId}
                challengeTitle={lbChallenge?.definition?.title || "Challenge"}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tournament Board ────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = { LEADERBOARD: "Leaderboard", BRACKET: "Bracket", ROUND_ROBIN: "Round Robin" };
const STATUS_COLORS: Record<string, string> = { REGISTRATION: "#22c55e", ACTIVE: "#3b82f6", COMPLETED: "#94a3b8", CANCELED: "#ef4444" };

function TournamentCard({ tournament, myEntry, onRegister, onWithdraw, onView }: {
  tournament: any; myEntry: any; onRegister: () => void; onWithdraw: () => void; onView: () => void;
}) {
  const t = tournament;
  const isRegistered = !!myEntry;
  const statusColor = STATUS_COLORS[t.status] || "#94a3b8";
  const startsAt = new Date(t.startsAt);
  const endsAt = new Date(t.endsAt);
  const now = Date.now();
  const isLive = t.status === "ACTIVE";
  const isOpen = t.status === "REGISTRATION";

  return (
    <div style={{
      ...S.card,
      borderColor: isLive ? "rgba(59,130,246,.3)" : isRegistered ? "rgba(34,197,94,.2)" : "rgba(255,255,255,.08)",
      background: isLive ? "rgba(59,130,246,.05)" : "rgba(255,255,255,.03)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{
              fontSize: 8, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase",
              padding: "1px 6px", borderRadius: 4,
              background: `${statusColor}20`, color: statusColor,
            }}>
              {t.status}
            </span>
            <span style={{ fontSize: 9, opacity: 0.4 }}>{FORMAT_LABELS[t.format] || t.format}</span>
            <span style={{ fontSize: 9, opacity: 0.4 }}>{t.entryType}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(243,244,246,.92)" }}>
            {t.title}
          </div>
          {t.description && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{t.description}</div>}
        </div>
        <div style={{
          textAlign: "center", padding: "6px 10px", borderRadius: 8,
          background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.2)",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#93c5fd" }}>{t._count?.entries || 0}</div>
          <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            /{t.maxEntries}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ display: "flex", gap: 12, fontSize: 10, opacity: 0.4 }}>
        <span>Starts: {startsAt.toLocaleDateString()} {startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        <span>Ends: {endsAt.toLocaleDateString()}</span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        <button onClick={onView} style={{ ...S.btn, fontSize: 10, padding: "4px 10px" }}>
          View Leaderboard
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {isOpen && !isRegistered && (
            <button onClick={onRegister} style={{ ...S.btnPri, fontSize: 11, padding: "5px 14px" }}>Register</button>
          )}
          {isOpen && isRegistered && (
            <button onClick={onWithdraw} style={{
              ...S.btn, fontSize: 10, padding: "3px 10px",
              borderColor: "rgba(239,68,68,.25)", color: "rgba(252,165,165,.7)",
            }}>Withdraw</button>
          )}
          {isRegistered && (
            <span style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: "rgba(34,197,94,.12)", color: "#86efac",
            }}>Registered</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TournamentLeaderboardView({ tournamentId, title, onBack }: { tournamentId: string; title: string; onBack: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/tournaments/${tournamentId}/leaderboard`).then(res => {
      if (res?.leaderboard) setRows(res.leaderboard);
      setLoading(false);
    });
  }, [tournamentId]);

  const RANK_COLORS = ["#fcd34d", "#94a3b8", "#cd7f32"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button onClick={onBack} style={{ ...S.btn, fontSize: 10, padding: "3px 10px", alignSelf: "flex-start" }}>
        ← Back
      </button>
      <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(243,244,246,.9)" }}>{title}</div>
      {loading ? (
        <div style={{ padding: 12, opacity: 0.4, fontSize: 11 }}>Loading...</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 12, opacity: 0.3, fontSize: 11 }}>No entries yet.</div>
      ) : rows.map((r: any) => (
        <div key={r.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 8,
          background: r.rank <= 3 ? `${RANK_COLORS[r.rank - 1]}08` : "transparent",
          borderLeft: r.rank <= 3 ? `3px solid ${RANK_COLORS[r.rank - 1]}` : "3px solid transparent",
        }}>
          <span style={{
            width: 22, textAlign: "center", fontWeight: 900, fontSize: 13,
            color: r.rank <= 3 ? RANK_COLORS[r.rank - 1] : "rgba(255,255,255,.3)",
            fontFamily: "monospace",
          }}>
            {r.rank}
          </span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.85)" }}>
            {r.displayName || "Unknown"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 900, color: "#93c5fd", fontFamily: "monospace" }}>
            {r.score.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function TournamentBoard({ lobbyId }: { lobbyId: string }) {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const res = await apiFetch(`/tournaments?lobbyId=${encodeURIComponent(lobbyId)}`);
    if (res?.tournaments) setTournaments(res.tournaments);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const register = async (id: string) => {
    await apiFetch(`/tournaments/${id}/register`, { method: "POST", body: JSON.stringify({}) });
    fetchAll();
  };
  const withdraw = async (id: string) => {
    await apiFetch(`/tournaments/${id}/register`, { method: "DELETE", body: JSON.stringify({}) });
    fetchAll();
  };

  if (loading) return <div style={{ padding: 20, opacity: 0.4, fontSize: 12 }}>Loading tournaments...</div>;

  if (viewId) {
    const t = tournaments.find(t => t.id === viewId);
    return (
      <TournamentLeaderboardView
        tournamentId={viewId}
        title={t?.title || "Tournament"}
        onBack={() => setViewId(null)}
      />
    );
  }

  if (tournaments.length === 0) {
    return <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>No tournaments right now. Check back soon.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tournaments.map(t => (
        <TournamentCard
          key={t.id}
          tournament={t}
          myEntry={null}
          onRegister={() => register(t.id)}
          onWithdraw={() => withdraw(t.id)}
          onView={() => setViewId(t.id)}
        />
      ))}
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "streams",    label: "Live Streams",  icon: "📺" },
  { id: "lfg",        label: "Fireteams",     icon: "🔥" },
  { id: "challenges", label: "Challenges",    icon: "🎯" },
  { id: "tournaments", label: "Tournaments",  icon: "🏆" },
  { id: "weekly",     label: "Weekly Reset",  icon: "📋" },
  { id: "guardian",   label: "Guardian Lookup", icon: "🔍" },
  { id: "myguardian", label: "My Guardian",   icon: "⚔" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function LobbyModulesPanel({
  lobbyId,
  gameName = "Destiny 2",
  accentColor = ACCENT_DESTINY,
  style,
}: {
  lobbyId: string;
  gameName?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}) {
  const [tab, setTab] = useState<TabId>("streams");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "8px 12px 0", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 12px",
              borderRadius: "8px 8px 0 0",
              border: "none",
              background: tab === t.id ? `${accentColor}20` : "transparent",
              color: tab === t.id ? "rgba(243,244,246,.92)" : "rgba(148,163,184,.65)",
              fontWeight: tab === t.id ? 700 : 400,
              fontSize: 12,
              cursor: "pointer",
              transition: "background .1s, color .1s",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: tab === "myguardian" ? "hidden" : "auto", padding: tab === "myguardian" ? 0 : "14px 14px 14px", display: "flex", flexDirection: "column" }}>
        {tab === "streams"    && <TwitchStreams gameName={gameName} lobbyId={lobbyId} accentColor={accentColor} />}
        {tab === "lfg"        && <LfgBoard lobbyId={lobbyId} />}
        {tab === "challenges"  && <ChallengeBoard lobbyId={lobbyId} />}
        {tab === "tournaments" && <TournamentBoard lobbyId={lobbyId} />}
        {tab === "weekly"     && <BungieWeekly accentColor={accentColor} />}
        {tab === "guardian"   && <GuardianLookup />}
        {tab === "myguardian" && <MyGuardian accentColor={accentColor} />}
      </div>

      {/* Bungie required legal disclaimer */}
      <div style={{ padding: "6px 14px 8px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <p style={{ fontSize: 9, color: "rgba(100,116,139,.35)", lineHeight: 1.4, margin: 0, textAlign: "center" }}>
          Weered is not affiliated with, endorsed by, or sponsored by Bungie, Inc. Destiny, Destiny 2, and all related logos and trademarks are the property of Bungie, Inc.
        </p>
      </div>
    </div>
  );
}
