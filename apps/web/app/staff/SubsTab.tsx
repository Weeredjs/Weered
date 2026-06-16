"use client";
import { useState, useEffect } from "react";
import { S, StaffUser, TierBadge, UserTier, apiFetch, tierColor } from "./shared";

export function SubsTab() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<UserTier | "ALL">("ALL");

  useEffect(() => {
    setLoading(true);
    apiFetch("/staff/subscriptions").then((j) => {
      setUsers(j.users || []);
      setLoading(false);
    });
  }, []);

  async function setTier(userId: string, tier: UserTier) {
    const j = await apiFetch(`/staff/users/${userId}/tier`, {
      method: "POST",
      body: JSON.stringify({ tier }),
    });
    if (j.ok) {
      setMsg(`Tier updated to ${tier}`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, tier } : u)));
    } else setMsg(j.error || "Failed.");
  }

  const TIERS: UserTier[] = ["INNOCENT", "INDICTED", "FELON", "KINGPIN"];
  const filtered = filter === "ALL" ? users : users.filter((u) => u.tier === filter);

  const counts = TIERS.reduce(
    (acc, t) => ({ ...acc, [t]: users.filter((u) => u.tier === t).length }),
    {} as Record<string, number>,
  );

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {TIERS.map((t) => {
          const c = tierColor(t);
          return (
            <div
              key={t}
              style={{
                padding: "14px",
                borderRadius: 10,
                border: `1px solid ${c.border}`,
                background: c.bg,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{counts[t] || 0}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{t}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["ALL", ...TIERS] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              ...S.btn,
              background: filter === t ? "rgba(124,58,237,.15)" : "rgba(255,255,255,.04)",
              borderColor: filter === t ? "rgba(124,58,237,.35)" : "rgba(255,255,255,.10)",
              color: filter === t ? "rgb(216,180,254)" : "rgba(243,244,246,.65)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {msg && <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.7 }}>{msg}</div>}

      {loading && <div style={{ opacity: 0.4 }}>Loading…</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {filtered.map((u) => (
          <div key={u.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name || u.usernameKey}</div>
              <div style={{ fontSize: 11, opacity: 0.45, marginTop: 1 }}>
                @{u.usernameKey} · {u.notoriety} notoriety
              </div>
            </div>
            <TierBadge tier={u.tier} />
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              {TIERS.filter((t) => t !== u.tier).map((t) => (
                <button
                  key={t}
                  style={{ ...S.btn, fontSize: 11, padding: "4px 8px" }}
                  onClick={() => setTier(u.id, t)}
                >
                  → {t}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!filtered.length && !loading && (
          <div style={{ opacity: 0.4, fontSize: 13 }}>No users.</div>
        )}
      </div>
    </div>
  );
}
