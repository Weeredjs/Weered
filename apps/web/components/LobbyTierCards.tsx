"use client";

import React, { useCallback, useEffect, useState } from "react";
import { weeredToast } from "../lib/toast";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

type Tier = { id: string; name: string; description: string; priceMonthly: number; grantLevel: number; color: string | null; sortOrder: number };
type MySub = { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;

export default function LobbyTierCards({ lobbyId }: { lobbyId: string }) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [roleNames, setRoleNames] = useState<Record<string, string>>({});
  const [myTier, setMyTier] = useState<Tier | null>(null);
  const [mySub, setMySub] = useState<MySub>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tiersRes, myRes] = await Promise.all([
      apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/tiers`),
      apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/my-tier`).catch(() => ({ ok: false })),
    ]);
    if (tiersRes.ok) { setTiers(tiersRes.tiers); setRoleNames(tiersRes.roleNames || {}); }
    if (myRes.ok) { setMyTier(myRes.tier); setMySub(myRes.sub); }
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => { load(); }, [load]);

  async function checkout(tierId: string) {
    setChecking(tierId);
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/tiers/${tierId}/checkout`, { method: "POST" });
    if (j.ok && j.url) window.location.href = j.url;
    else { weeredToast.error(j.error || "Checkout failed."); setChecking(null); }
  }

  async function manage() {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/tiers/portal`, { method: "POST" });
    if (j.ok && j.url) window.location.href = j.url;
    else weeredToast.error(j.error || "Failed to open billing portal.");
  }

  if (loading || tiers.length === 0) return null;

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.5, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 12 }}>
        Lobby Tiers
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {tiers.map(t => {
          const isCurrent = myTier?.id === t.id && mySub?.status === "active";
          const accent = t.color || "#7C3AED";
          return (
            <div
              key={t.id}
              style={{
                flex: "1 1 200px", maxWidth: 280, padding: "16px 18px", borderRadius: 12,
                border: `1px solid ${isCurrent ? accent + "55" : "rgba(255,255,255,.08)"}`,
                background: isCurrent ? accent + "12" : "rgba(255,255,255,.03)",
                display: "flex", flexDirection: "column", gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {t.color && <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color }} />}
                <div style={{ fontSize: 16, fontWeight: 700 }}>{t.name}</div>
              </div>
              {t.description && <div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.4 }}>{t.description}</div>}
              <div style={{ fontSize: 20, fontWeight: 700, color: "rgb(167,243,208)" }}>
                ${(t.priceMonthly / 100).toFixed(2)}<span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>/mo</span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                Grants: {roleNames[String(t.grantLevel)] || `Level ${t.grantLevel}`}
              </div>

              {isCurrent ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: ".3px" }}>CURRENT TIER</div>
                  {mySub?.cancelAtPeriodEnd && mySub?.currentPeriodEnd && (
                    <div style={{ fontSize: 10, opacity: 0.5 }}>Expires {new Date(mySub.currentPeriodEnd).toLocaleDateString()}</div>
                  )}
                  <button
                    onClick={manage}
                    style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${accent}44`, background: `${accent}18`, fontSize: 12, cursor: "pointer", color: "rgba(243,244,246,.88)", fontWeight: 600 }}
                  >
                    Manage
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => checkout(t.id)}
                  disabled={checking === t.id || (mySub?.status === "active")}
                  style={{
                    marginTop: 4, padding: "8px 16px", borderRadius: 8,
                    border: `1px solid ${accent}55`, background: `${accent}22`,
                    fontSize: 13, cursor: "pointer", color: "rgba(243,244,246,.95)", fontWeight: 700,
                    opacity: (mySub?.status === "active") ? 0.4 : 1,
                  }}
                >
                  {checking === t.id ? "Redirecting..." : "Subscribe"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
