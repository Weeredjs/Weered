"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWeered } from "../../../components/WeeredProvider";
import FlairBadge from "../../../components/FlairBadge";
import { invalidateEquippedFlair } from "../../../lib/useEquippedFlair";
import { weeredToast } from "../../../lib/toast";

interface FlairItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: "BADGE" | "BANNER" | "NAMEPLATE";
  imageUrl: string | null;
  color: string | null;
  rarity: string;
}

interface InventoryEntry {
  flairItem: FlairItem;
  acquiredAt: string;
  acquiredFrom: string;
  isEquipped: boolean;
}

const RARITY_COLOR: Record<string, string> = {
  LEGENDARY: "#facc15",
  EPIC: "#a78bfa",
  RARE: "#60a5fa",
  COMMON: "#94a3b8",
};

export default function FlairSettingsPage() {
  const { me, token, apiBase, globalRole } = useWeered() as any;
  const [inv, setInv] = useState<InventoryEntry[] | null>(null);
  const [equippedId, setEquippedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showMint, setShowMint] = useState(false);

  const isStaff = ["GOD", "ADMIN", "STAFF"].includes(String(globalRole || "").toUpperCase());

  async function loadInventory() {
    if (!token) return;
    try {
      const r = await fetch(`${apiBase}/flair/inventory`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const j = await r.json();
      if (!j?.ok) { setErr(j?.error || "load_failed"); return; }
      setInv(j.inventory || []);
      setEquippedId(j.equippedFlairId || null);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }
  useEffect(() => { loadInventory(); }, [token, apiBase]);

  async function equip(id: string | null) {
    if (!token) return;
    setBusy(true);
    try {
      const r = await fetch(`${apiBase}/flair/equip`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ flairItemId: id }),
      });
      const j = await r.json();
      if (!j?.ok) {
        weeredToast(j?.error === "not_owned" ? "You don't own that flair." : "Equip failed.");
      } else {
        setEquippedId(j.equippedFlairId);
        if (me?.id) invalidateEquippedFlair(me.id);
        await loadInventory();
        weeredToast(id ? "Flair equipped." : "Flair unequipped.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    return <div style={{ padding: 24, color: "var(--weered-muted)" }}>Sign in to manage flair.</div>;
  }

  const isEmpty = inv && inv.length === 0;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 20px 80px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 950, margin: 0, letterSpacing: "-0.5px" }}>Flair</h1>
        {equippedId && (
          <button
            type="button"
            onClick={() => equip(null)}
            disabled={busy}
            style={{
              padding: "6px 12px", fontSize: 12, fontWeight: 800,
              background: "transparent",
              border: "1px solid rgba(255,255,255,.15)",
              borderRadius: 8,
              color: "var(--weered-muted, rgba(148,163,184,.85))",
              cursor: busy ? "default" : "pointer",
            }}
          >
            Unequip
          </button>
        )}
      </div>

      {err && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {isEmpty ? (
        <div style={{
          padding: "40px 20px", textAlign: "center",
          background: "rgba(255,255,255,.03)",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 14, color: "var(--weered-muted, rgba(148,163,184,.85))", marginBottom: 10 }}>
            Win tournaments and contests to earn flair.
          </div>
          <Link href="/lobby" style={{ fontSize: 13, fontWeight: 800, color: "#a78bfa", textDecoration: "none" }}>
            Browse tournaments →
          </Link>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}>
          {(inv || []).map(entry => {
            const f = entry.flairItem;
            const ring = RARITY_COLOR[String(f.rarity).toUpperCase()] || "#94a3b8";
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => !entry.isEquipped && equip(f.id)}
                disabled={busy}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                  padding: 14,
                  background: entry.isEquipped ? `${ring}10` : "rgba(255,255,255,.03)",
                  border: `1px solid ${entry.isEquipped ? ring : "rgba(255,255,255,.08)"}`,
                  borderRadius: 12,
                  cursor: entry.isEquipped || busy ? "default" : "pointer",
                  textAlign: "center",
                  transition: "background .12s, border-color .12s",
                }}
              >
                <FlairBadge flair={f as any} size={f.kind === "BANNER" ? "md" : "lg"} />
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--weered-text, #f5f5f4)" }}>{f.name}</div>
                <div style={{ display: "flex", gap: 6, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <span style={{ color: ring }}>{f.rarity}</span>
                  <span style={{ color: "var(--weered-muted, rgba(148,163,184,.6))" }}>· {f.kind}</span>
                </div>
                {entry.isEquipped && (
                  <span style={{ fontSize: 10, fontWeight: 900, color: ring, letterSpacing: "1px" }}>EQUIPPED</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {isStaff && (
        <div style={{ marginTop: 32, padding: 16, background: "rgba(124,58,237,.06)", border: "1px solid rgba(124,58,237,.2)", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.5px", textTransform: "uppercase", color: "#c4b5fd" }}>
              Staff: Manage flair
            </div>
            <button
              type="button"
              onClick={() => setShowMint(s => !s)}
              style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", background: "transparent", color: "#c4b5fd", border: "1px solid rgba(196,181,253,.3)", borderRadius: 6, cursor: "pointer" }}
            >
              {showMint ? "Hide" : "Mint a flair"}
            </button>
          </div>
          {showMint && <MintForm apiBase={apiBase} token={token} />}
        </div>
      )}
    </div>
  );
}

function MintForm({ apiBase, token }: { apiBase: string; token: string }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"BADGE" | "BANNER" | "NAMEPLATE">("BADGE");
  const [imageUrl, setImageUrl] = useState("");
  const [color, setColor] = useState("");
  const [rarity, setRarity] = useState("COMMON");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!slug || !name) { weeredToast("Slug and name required."); return; }
    setBusy(true);
    try {
      const r = await fetch(`${apiBase}/flair/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slug, name, kind, imageUrl: imageUrl || undefined, color: color || undefined, rarity, source: "MANUAL" }),
      });
      const j = await r.json();
      if (!j?.ok) {
        weeredToast(j?.error === "slug_taken" ? "Slug already used." : `Mint failed: ${j?.error || "unknown"}`);
      } else {
        weeredToast(`Minted ${j.flairItem.slug}.`);
        setSlug(""); setName(""); setImageUrl(""); setColor("");
      }
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", fontSize: 13,
    background: "rgba(0,0,0,.25)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 8, color: "var(--weered-text, #f5f5f4)",
    outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
      <input style={inputStyle} placeholder="slug (unique)" value={slug} onChange={e => setSlug(e.target.value)} />
      <input style={inputStyle} placeholder="name" value={name} onChange={e => setName(e.target.value)} />
      <select style={inputStyle} value={kind} onChange={e => setKind(e.target.value as any)}>
        <option value="BADGE">BADGE</option>
        <option value="BANNER">BANNER</option>
        <option value="NAMEPLATE">NAMEPLATE</option>
      </select>
      <select style={inputStyle} value={rarity} onChange={e => setRarity(e.target.value)}>
        <option value="COMMON">COMMON</option>
        <option value="RARE">RARE</option>
        <option value="EPIC">EPIC</option>
        <option value="LEGENDARY">LEGENDARY</option>
      </select>
      <input style={inputStyle} placeholder="image url (optional)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
      <input style={inputStyle} placeholder="color #hex (optional)" value={color} onChange={e => setColor(e.target.value)} />
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        style={{ gridColumn: "1 / -1", padding: "8px 14px", fontSize: 12, fontWeight: 900, letterSpacing: "1px", textTransform: "uppercase", background: "rgba(124,58,237,.2)", border: "1px solid rgba(124,58,237,.45)", borderRadius: 8, color: "#c4b5fd", cursor: busy ? "default" : "pointer" }}
      >
        {busy ? "Minting…" : "Mint"}
      </button>
    </div>
  );
}
