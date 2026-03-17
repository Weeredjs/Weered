"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders() {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) } });
  return r.json();
}

const TIERS = [
  {
    id: "FREE", name: "Innocent", price: "Free", monthly: 0,
    color: "rgba(148,163,184,.8)", border: "rgba(255,255,255,.10)", bg: "rgba(255,255,255,.03)",
    features: ["Access all public lobbies", "Chat in any room", "Voice chat", "Join fireteams", "Basic profile"],
  },
  {
    id: "INDICTED", name: "Indicted", price: "$6/mo", monthly: 6,
    color: "rgb(216,180,254)", border: "rgba(124,58,237,.35)", bg: "rgba(124,58,237,.08)",
    features: ["Everything in Innocent", "Colored username & icon", "Custom text colors & fonts", "Unlimited video streaming", "Priority in matchmaking", "Indicted badge"],
  },
  {
    id: "FELON", name: "Felon", price: "$14/mo", monthly: 14,
    color: "rgb(252,165,165)", border: "rgba(239,68,68,.30)", bg: "rgba(239,68,68,.06)",
    features: ["Everything in Indicted", "Own up to 3 branded lobbies", "Custom lobby branding & modules", "Admin panel for your lobbies", "Twitch & YouTube embeds", "LFG board in your lobbies", "Felon badge"],
  },
  {
    id: "KINGPIN", name: "Kingpin", price: "Invite only", monthly: -1,
    color: "rgb(253,230,138)", border: "rgba(245,158,11,.35)", bg: "rgba(245,158,11,.06)",
    features: ["Everything in Felon", "Unlimited lobbies", "All premium modules", "Direct staff support", "Early access to features", "Kingpin crown badge", "You don't find us. We find you."],
  },
];

export default function SubscribePage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const [success] = useState(!!sessionId);

  useEffect(() => {
    apiFetch("/subscribe/status").then(j => { if (j.ok) setSub(j); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function checkout(tier: string) {
    setChecking(tier);
    const j = await apiFetch("/subscribe/checkout", { method: "POST", body: JSON.stringify({ tier }) });
    if (j.ok && j.url) window.location.href = j.url;
    else { alert(j.error || "Checkout failed. Stripe may not be configured yet."); setChecking(null); }
  }

  async function manageSubscription() {
    const j = await apiFetch("/subscribe/portal", { method: "POST", body: JSON.stringify({}) });
    if (j.ok && j.url) window.location.href = j.url;
    else alert(j.error || "Failed to open billing portal.");
  }

  const currentTier = sub?.tier || "FREE";

  return (
    <div style={{ minHeight: "100vh", background: "var(--weered-bg, #080810)", color: "rgba(243,244,246,.92)", fontFamily: "system-ui, sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <a href="/lobby" style={{ fontSize: 12, opacity: 0.4, textDecoration: "none", color: "inherit", marginBottom: 8, display: "block" }}>back to lobby</a>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.5px", marginBottom: 8 }}>Choose Your Path</h1>
          <p style={{ fontSize: 14, opacity: 0.5, maxWidth: 400, margin: "0 auto" }}>Upgrade to unlock premium features, branded lobbies, and more</p>
          {success && (
            <div style={{ marginTop: 16, padding: "12px 20px", borderRadius: 10, background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.30)", color: "rgb(167,243,208)", fontSize: 14, fontWeight: 600 }}>
              Subscription activated! Welcome to the crew.
            </div>
          )}
        </div>

        {sub?.status === "active" && (
          <div style={{ marginBottom: 24, padding: "14px 20px", borderRadius: 12, background: "rgba(124,58,237,.08)", border: "1px solid rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Current plan: <span style={{ color: "rgb(216,180,254)" }}>{currentTier}</span></div>
              {sub.currentPeriodEnd && <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>{sub.cancelAtPeriodEnd ? "Cancels" : "Renews"} on {new Date(sub.currentPeriodEnd).toLocaleDateString()}</div>}
            </div>
            <button onClick={manageSubscription} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.06)", color: "rgba(243,244,246,.8)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Manage Billing</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {TIERS.map(tier => {
            const isCurrent = currentTier === tier.id;
            const isUpgrade = tier.monthly > 0 && (currentTier === "FREE" || (currentTier === "INDICTED" && tier.id === "FELON"));
            const isKingpin = tier.id === "KINGPIN";
            return (
              <div key={tier.id} style={{ borderRadius: 14, border: isCurrent ? `2px solid ${tier.border}` : `1px solid ${tier.border}`, background: tier.bg, padding: "24px 20px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
                {isCurrent && <div style={{ position: "absolute", top: 12, right: 12, fontSize: 9, padding: "2px 8px", borderRadius: 999, background: tier.border, color: "#080810", fontWeight: 800, letterSpacing: ".5px" }}>CURRENT</div>}
                <div style={{ fontSize: 13, fontWeight: 800, color: tier.color, letterSpacing: ".3px", marginBottom: 4 }}>{tier.name}</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 16, lineHeight: 1.1 }}>{tier.price}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, marginBottom: 20 }}>
                  {tier.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, opacity: 0.75 }}>
                      <span style={{ color: tier.color, flexShrink: 0, fontSize: 11 }}>+</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                {isKingpin ? (
                  <div style={{ padding: "10px 0", borderRadius: 9, textAlign: "center", border: `1px solid ${tier.border}`, background: "rgba(245,158,11,.06)", color: tier.color, fontSize: 12, fontWeight: 700, opacity: 0.6 }}>By invitation only</div>
                ) : isCurrent ? (
                  <div style={{ padding: "10px 0", borderRadius: 9, textAlign: "center", border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.5)", fontSize: 12, fontWeight: 600 }}>Active</div>
                ) : isUpgrade ? (
                  <button onClick={() => checkout(tier.id)} disabled={!!checking} style={{ padding: "10px 0", borderRadius: 9, border: "none", background: tier.color, color: "#080810", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: checking === tier.id ? 0.6 : 1 }}>
                    {checking === tier.id ? "Redirecting..." : `Upgrade to ${tier.name}`}
                  </button>
                ) : (
                  <div style={{ padding: "10px 0", borderRadius: 9, textAlign: "center", border: "1px solid rgba(255,255,255,.06)", background: "transparent", color: "rgba(255,255,255,.3)", fontSize: 12 }}>{tier.monthly === 0 ? "Default" : "Contact support"}</div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "center", marginTop: 32, opacity: 0.35, fontSize: 12 }}>Payments processed securely by Stripe . Test mode . No real charges</div>
      </div>
    </div>
  );
}
