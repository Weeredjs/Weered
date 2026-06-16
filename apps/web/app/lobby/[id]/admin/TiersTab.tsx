"use client";
import { useState, useEffect, useCallback } from "react";
import { LEVEL_COLORS, LevelBadge, S, apiFetch } from "./shared";
import { AdminTier } from "./MembersTab";

export function TiersTab({
  lobbyId,
  roleNames,
  onRefresh,
}: {
  lobbyId: string;
  roleNames: Record<string, string>;
  onRefresh: () => void;
}) {
  const [tiers, setTiers] = useState<AdminTier[]>([]);
  const [revShare, setRevShare] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    priceDollars: "",
    grantLevel: "2",
    color: "",
    sortOrder: "0",
  });

  const load = useCallback(async () => {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/tiers`);
    if (j.ok) {
      setTiers(j.tiers);
      setRevShare(j.revenueSharePct ?? 0);
    }
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function createTier() {
    const name = form.name.trim();
    if (!name) {
      setMsg("Name is required.");
      return;
    }
    const priceCents = Math.round(parseFloat(form.priceDollars || "0") * 100);
    if (priceCents < 100) {
      setMsg("Minimum price is $1.00.");
      return;
    }
    setCreating(true);
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/tiers`, {
      method: "POST",
      body: JSON.stringify({
        name,
        description: form.description.trim(),
        priceMonthly: priceCents,
        grantLevel: Number(form.grantLevel) || 2,
        color: form.color.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
      }),
    });
    setCreating(false);
    if (j.ok) {
      setMsg(`Created "${name}".`);
      setForm({
        name: "",
        description: "",
        priceDollars: "",
        grantLevel: "2",
        color: "",
        sortOrder: "0",
      });
      load();
      onRefresh();
    } else setMsg(j.error || "Failed to create tier.");
  }

  async function toggleActive(tier: AdminTier) {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/tiers/${tier.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !tier.active }),
    });
    if (j.ok) {
      setMsg(`${tier.name} ${tier.active ? "deactivated" : "activated"}.`);
      load();
    } else setMsg(j.error || "Failed.");
  }

  async function saveRevShare() {
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin/revenue-share`, {
      method: "PATCH",
      body: JSON.stringify({ revenueSharePct: revShare }),
    });
    if (j.ok) setMsg(`Revenue share set to ${revShare}%.`);
    else setMsg(j.error || "Failed.");
  }

  if (loading) return <div style={{ opacity: 0.4, fontSize: 13 }}>Loading tiers...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {msg && (
        <div
          style={{
            fontSize: 12,
            color: "rgba(167,243,208,.9)",
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(16,185,129,.08)",
            border: "1px solid rgba(16,185,129,.25)",
          }}
        >
          {msg}
        </div>
      )}

      <div>
        <div style={S.sectionTitle}>Active Tiers</div>
        {tiers.length === 0 && (
          <div style={{ opacity: 0.4, fontSize: 13, padding: "16px 0" }}>
            No paid tiers yet. Create one below.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tiers.map((t) => {
            const lc = LEVEL_COLORS[t.grantLevel] || LEVEL_COLORS[1];
            return (
              <div
                key={t.id}
                style={{
                  ...S.card,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: t.active ? 1 : 0.5,
                }}
              >
                {t.color && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: t.color,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                  {t.description && (
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{t.description}</div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "rgb(167,243,208)",
                    whiteSpace: "nowrap",
                  }}
                >
                  ${(t.priceMonthly / 100).toFixed(2)}/mo
                </div>
                <LevelBadge level={t.grantLevel} roleNames={roleNames} />
                <div style={{ fontSize: 11, opacity: 0.5, whiteSpace: "nowrap" }}>
                  {t._count?.subscribers ?? 0} subs
                </div>
                <button style={t.active ? S.danger : S.success} onClick={() => toggleActive(t)}>
                  {t.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={S.sectionTitle}>Create New Tier</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={S.label}>Name</div>
            <input
              style={S.input}
              placeholder="e.g. VIP, Patron..."
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <div style={S.label}>Price (USD/month)</div>
            <input
              style={S.input}
              type="number"
              step="0.01"
              min="1"
              placeholder="5.00"
              value={form.priceDollars}
              onChange={(e) => setForm((f) => ({ ...f, priceDollars: e.target.value }))}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={S.label}>Description</div>
            <input
              style={S.input}
              placeholder="What does this tier include?"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <div style={S.label}>Grants Role</div>
            <select
              style={{ ...S.input, appearance: "auto" }}
              value={form.grantLevel}
              onChange={(e) => setForm((f) => ({ ...f, grantLevel: e.target.value }))}
            >
              {[1, 2, 3, 4].map((lvl) => (
                <option key={lvl} value={lvl}>
                  {roleNames[String(lvl)] || `Level ${lvl}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={S.label}>Badge Color (hex)</div>
            <input
              style={S.input}
              placeholder="#7C3AED"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
          </div>
          <div>
            <div style={S.label}>Sort Order</div>
            <input
              style={S.input}
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </div>
        </div>
        <button style={{ ...S.btnPri, marginTop: 14 }} onClick={createTier} disabled={creating}>
          {creating ? "Creating..." : "Create Tier"}
        </button>
      </div>

      <div>
        <div style={S.sectionTitle}>Revenue Share</div>
        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 10 }}>
          Percentage of lobby tier revenue allocated to the lobby owner. Payouts are processed
          manually.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            style={{ ...S.input, width: 80 }}
            type="number"
            min="0"
            max="100"
            value={revShare}
            onChange={(e) => setRevShare(Number(e.target.value))}
          />
          <span style={{ fontSize: 13, opacity: 0.5 }}>%</span>
          <button style={S.btn} onClick={saveRevShare}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export type LobbyEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  coverImageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: string;
  promotionStatus: string;
  promotionNote: string | null;
  promotionDenyReason: string | null;
  createdByName: string;
  createdAt: string;
};
