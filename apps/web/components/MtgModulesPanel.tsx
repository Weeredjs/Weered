"use client";
import React, { useEffect, useState, useCallback } from "react";

const ACCENT_MTG = "#9C7C3F";
const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

type ScryfallLite = {
  name: string;
  set: string;
  set_name: string;
  mana_cost: string | null;
  type_line: string | null;
  oracle_text: string | null;
  image: string | null;
  image_small: string | null;
  scryfall_uri: string;
  colors: string[];
  cmc: number;
};

async function fetchRandomCard(): Promise<ScryfallLite | null> {
  try {
    const r = await fetch("https://api.scryfall.com/cards/random", { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j: any = await r.json();
    const img = j?.image_uris?.normal || j?.card_faces?.[0]?.image_uris?.normal || null;
    return {
      name: String(j?.name || ""),
      set: String(j?.set || ""),
      set_name: String(j?.set_name || ""),
      mana_cost: j?.mana_cost ?? j?.card_faces?.[0]?.mana_cost ?? null,
      type_line: j?.type_line ?? null,
      oracle_text: j?.oracle_text ?? j?.card_faces?.[0]?.oracle_text ?? null,
      image: img,
      image_small: j?.image_uris?.small ?? j?.card_faces?.[0]?.image_uris?.small ?? null,
      scryfall_uri: String(j?.scryfall_uri || ""),
      colors: Array.isArray(j?.colors) ? j.colors : [],
      cmc: Number.isFinite(j?.cmc) ? j.cmc : 0,
    };
  } catch { return null; }
}

async function lookupCard(name: string): Promise<ScryfallLite | null> {
  try {
    const r = await fetch(`${API}/scryfall/card?name=${encodeURIComponent(name)}`);
    if (!r.ok) return null;
    const j: any = await r.json();
    return j?.ok && j?.card ? (j.card as ScryfallLite) : null;
  } catch { return null; }
}

function CardDisplay({ card }: { card: ScryfallLite }) {
  return (
    <a
      href={card.scryfall_uri}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      {card.image && (
        <img
          src={card.image}
          alt={card.name}
          style={{ width: "100%", maxWidth: 320, borderRadius: 2, display: "block", margin: "0 auto" }}
        />
      )}
      <div style={{ marginTop: 10, textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "rgba(255,235,200,0.95)" }}>{card.name}</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
          {card.type_line}{card.set_name ? ` · ${card.set_name}` : ""}
        </div>
      </div>
    </a>
  );
}

function Section({ title, children, stripe }: { title: string; children: React.ReactNode; stripe?: boolean }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderRadius: 2,
      background: "rgba(20,16,12,0.5)",
      border: `1px solid ${ACCENT_MTG}55`,
      ...(stripe ? { borderLeft: `2px solid ${ACCENT_MTG}` } : null),
      marginBottom: 12,
    }}>
      <div style={{
        fontFamily: "var(--font-display, inherit)",
        fontSize: 11,
        letterSpacing: 1.6,
        textTransform: "uppercase",
        color: ACCENT_MTG,
        fontWeight: 700,
        marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  );
}

export default function MtgModulesPanel({ style }: { lobbyId: string; style?: React.CSSProperties }) {
  const [featured, setFeatured] = useState<ScryfallLite | null>(null);
  const [refreshingFeatured, setRefreshingFeatured] = useState(false);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<ScryfallLite | null>(null);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const loadFeatured = useCallback(async () => {
    setRefreshingFeatured(true);
    const card = await fetchRandomCard();
    if (card) setFeatured(card);
    setRefreshingFeatured(false);
  }, []);

  useEffect(() => { loadFeatured(); }, [loadFeatured]);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchErr(null);
    const card = await lookupCard(q);
    if (!card) { setSearchErr(`No card found for "${q}"`); setSearched(null); }
    else { setSearched(card); setSearchErr(null); }
    setSearching(false);
  }, [query]);

  return (
    <div style={{
      ...style,
      padding: 14,
      overflowY: "auto",
      color: "rgba(243,244,246,0.9)",
    }}>

      <Section title="Card of the Day" stripe>
        {featured ? <CardDisplay card={featured} /> : <div style={{ opacity: 0.5, fontSize: 12 }}>Drawing a card…</div>}
        <button
          onClick={loadFeatured}
          disabled={refreshingFeatured}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "6px 10px",
            borderRadius: 2,
            border: `1px solid ${ACCENT_MTG}66`,
            background: `${ACCENT_MTG}22`,
            color: "rgba(255,235,200,0.9)",
            fontSize: 12,
            fontWeight: 600,
            cursor: refreshingFeatured ? "wait" : "pointer",
          }}
        >
          {refreshingFeatured ? "Drawing…" : "Draw another"}
        </button>
      </Section>

      <Section title="Quick Card Lookup">
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            placeholder="e.g. Doubling Season"
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.35)",
              color: "rgba(243,244,246,0.95)",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={search}
            disabled={searching || !query.trim()}
            style={{
              padding: "6px 14px",
              borderRadius: 2,
              border: `1px solid ${ACCENT_MTG}66`,
              background: `${ACCENT_MTG}33`,
              color: "rgba(255,235,200,0.95)",
              fontSize: 12,
              fontWeight: 700,
              cursor: searching ? "wait" : "pointer",
            }}
          >{searching ? "…" : "Search"}</button>
        </div>
        {searchErr && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#f87171" }}>{searchErr}</div>
        )}
        {searched && (
          <div style={{ marginTop: 12 }}><CardDisplay card={searched} /></div>
        )}
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.55 }}>
          Tip: type <code style={{ background: "rgba(255,255,255,0.06)", padding: "0 4px", borderRadius: 3 }}>[[card name]]</code> in any chat for inline previews.
        </div>
      </Section>

      <Section title="Banlist + Reference">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "Wizards B&R Announcements", href: "https://magic.wizards.com/en/banned-restricted-list" },
            { label: "Commander RC Banlist", href: "https://commanderrules.com/banned-list/" },
            { label: "EDHREC — popular commanders", href: "https://edhrec.com/" },
            { label: "Scryfall — advanced search", href: "https://scryfall.com/advanced" },
            { label: "Moxfield — deckbuilder", href: "https://www.moxfield.com" },
            { label: "Archidekt — deckbuilder", href: "https://archidekt.com" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                padding: "6px 10px",
                borderRadius: 2,
                border: "1px solid rgba(156,124,63,0.3)",
                background: "rgba(156,124,63,0.06)",
                color: "rgba(255,235,200,0.85)",
                textDecoration: "none",
                fontSize: 12,
              }}
            >{l.label}</a>
          ))}
        </div>
      </Section>

    </div>
  );
}
