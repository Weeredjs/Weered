"use client";

import React from "react";
import { API } from "./chatShared";

export const MTG_DECK_URL_RE =
  /^https?:\/\/(?:www\.)?(moxfield\.com\/decks\/[\w-]+|archidekt\.com\/decks\/\d+)/i;
type DeckLite = {
  source: "moxfield" | "archidekt";
  id: string;
  name: string;
  format: string | null;
  author: string | null;
  cardCount: number | null;
  colors: string[];
  commanders: string[];
  url: string;
  thumbnail: string | null;
};
const _mtgDeckCache = new Map<string, DeckLite | null>();
const _mtgDeckInflight = new Map<string, Promise<DeckLite | null>>();
async function fetchMoxfieldClient(deckId: string, url: string): Promise<DeckLite | null> {
  try {
    const r = await fetch(`https://api.moxfield.com/v2/decks/all/${encodeURIComponent(deckId)}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    const commanders: string[] = [];
    const commandersBlock = j?.commanders ?? j?.boards?.commanders?.cards ?? {};
    for (const k of Object.keys(commandersBlock)) {
      const c = commandersBlock[k];
      const n = c?.card?.name || c?.name;
      if (n) commanders.push(n);
    }
    const colors: string[] = Array.isArray(j?.colors)
      ? j.colors
      : Array.isArray(j?.colorIdentity)
        ? j.colorIdentity
        : [];
    const cardCount =
      typeof j?.mainboardCount === "number"
        ? j.mainboardCount
        : typeof j?.boards?.mainboard?.count === "number"
          ? j.boards.mainboard.count
          : null;
    return {
      source: "moxfield",
      id: deckId,
      name: String(j?.name || "Untitled deck"),
      format: j?.format ?? null,
      author: j?.createdByUser?.userName ?? j?.createdByUser?.displayName ?? null,
      cardCount,
      colors,
      commanders,
      url,
      thumbnail: commanders[0]
        ? `https://api.scryfall.com/cards/named?format=image&version=art_crop&fuzzy=${encodeURIComponent(commanders[0])}`
        : null,
    };
  } catch {
    return null;
  }
}
function fetchMtgDeck(url: string): Promise<DeckLite | null> {
  const key = url.toLowerCase();
  if (_mtgDeckCache.has(key)) return Promise.resolve(_mtgDeckCache.get(key) ?? null);
  if (_mtgDeckInflight.has(key)) return _mtgDeckInflight.get(key)!;
  const moxMatch = url.match(/moxfield\.com\/decks\/([\w-]+)/i);
  const p: Promise<DeckLite | null> = moxMatch
    ? fetchMoxfieldClient(moxMatch[1], url)
    : fetch(`${API}/mtg/deck?url=${encodeURIComponent(url)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j?.ok && j?.deck ? (j.deck as DeckLite) : null))
        .catch(() => null);
  const cached = p
    .then((deck) => {
      _mtgDeckCache.set(key, deck);
      _mtgDeckInflight.delete(key);
      return deck;
    })
    .catch(() => {
      _mtgDeckInflight.delete(key);
      _mtgDeckCache.set(key, null);
      return null;
    });
  _mtgDeckInflight.set(key, cached);
  return cached;
}
export function MtgDeckChip({ url }: { url: string }) {
  const [deck, setDeck] = React.useState<DeckLite | null>(
    _mtgDeckCache.get(url.toLowerCase()) ?? null,
  );
  React.useEffect(() => {
    if (deck !== null) return;
    let cancel = false;
    fetchMtgDeck(url).then((d) => {
      if (!cancel) setDeck(d);
    });
    return () => {
      cancel = true;
    };
  }, [url, deck]);
  const source = /moxfield/i.test(url) ? "moxfield" : "archidekt";
  if (!deck) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 6,
          background: "rgba(156,124,63,0.12)",
          color: "rgba(255,235,200,0.85)",
          border: "1px solid rgba(156,124,63,0.35)",
          fontSize: "0.92em",
          textDecoration: "none",
          fontWeight: 600,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {source} · deck link
      </a>
    );
  }
  const colorPips =
    deck.colors.length > 0
      ? deck.colors
          .map(
            (c) =>
              ({ W: "#fffcd8", U: "#b8d6f5", B: "#34292a", R: "#f29c93", G: "#9bd3a7" })[c] ||
              "#888",
          )
          .join(",")
      : "";
  return (
    <a
      href={deck.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        margin: "2px 0",
        borderRadius: 8,
        background: "linear-gradient(135deg, rgba(156,124,63,0.18) 0%, rgba(91,74,58,0.32) 100%)",
        color: "rgba(255,235,200,0.95)",
        border: "1px solid rgba(156,124,63,0.45)",
        textDecoration: "none",
        maxWidth: 380,
        verticalAlign: "middle",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {deck.thumbnail && (
        <img
          src={deck.thumbnail}
          alt=""
          style={{ width: 40, height: 30, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
        />
      )}
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {deck.name}
        </span>
        <span
          style={{
            display: "block",
            fontSize: "0.82em",
            opacity: 0.8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {deck.commanders[0] ? `${deck.commanders[0]} · ` : ""}
          {deck.format || deck.source}
          {deck.author ? ` · ${deck.author}` : ""}
          {deck.cardCount ? ` · ${deck.cardCount} cards` : ""}
        </span>
      </span>
      {colorPips && (
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 2, flexShrink: 0 }}>
          {deck.colors.map((c, i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background:
                  { W: "#fffcd8", U: "#b8d6f5", B: "#34292a", R: "#f29c93", G: "#9bd3a7" }[c] ||
                  "#888",
                border: "1px solid rgba(0,0,0,0.3)",
              }}
            />
          ))}
        </span>
      )}
    </a>
  );
}

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
const _mtgCardCache = new Map<string, ScryfallLite | null>();
const _mtgCardInflight = new Map<string, Promise<ScryfallLite | null>>();
function fetchMtgCard(name: string): Promise<ScryfallLite | null> {
  const key = name.trim().toLowerCase();
  if (_mtgCardCache.has(key)) return Promise.resolve(_mtgCardCache.get(key) ?? null);
  if (_mtgCardInflight.has(key)) return _mtgCardInflight.get(key)!;
  const p = fetch(`${API}/scryfall/card?name=${encodeURIComponent(name)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const card = j?.ok && j?.card ? (j.card as ScryfallLite) : null;
      _mtgCardCache.set(key, card);
      _mtgCardInflight.delete(key);
      return card;
    })
    .catch(() => {
      _mtgCardInflight.delete(key);
      _mtgCardCache.set(key, null);
      return null;
    });
  _mtgCardInflight.set(key, p);
  return p;
}
export function MtgCardChip({ name }: { name: string }) {
  const [card, setCard] = React.useState<ScryfallLite | null>(
    _mtgCardCache.get(name.trim().toLowerCase()) ?? null,
  );
  const [hover, setHover] = React.useState(false);
  React.useEffect(() => {
    if (card !== null) return;
    let cancel = false;
    fetchMtgCard(name).then((c) => {
      if (!cancel) setCard(c);
    });
    return () => {
      cancel = true;
    };
  }, [name, card]);
  const display = card?.name || name;
  const href = card?.scryfall_uri || `https://scryfall.com/search?q=${encodeURIComponent(name)}`;
  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "0 6px",
          borderRadius: 4,
          background: "rgba(156,124,63,0.18)",
          color: "rgba(255,235,200,0.95)",
          border: "1px solid rgba(156,124,63,0.45)",
          fontWeight: 600,
          textDecoration: "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {display}
      </a>
      {hover && card?.image && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            zIndex: 60,
            pointerEvents: "none",
            background: "transparent",
          }}
        >
          <img
            src={card.image}
            alt={card.name}
            style={{
              width: 220,
              borderRadius: 12,
              boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
              display: "block",
            }}
          />
        </span>
      )}
    </span>
  );
}
