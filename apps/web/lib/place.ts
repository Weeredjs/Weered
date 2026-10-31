// Your place (api routes/places.ts): a lobby of your own, free, at
// weered.ca/u/<label> and <label>.weered.ca. Made once; it opens in Design
// mode with Describe, so "a neon arcade with my stream and a couch" builds it.
import { newBlock, stockLayout, type LobbyLayout } from "./lobbyLayout";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export type Place = {
  id: string;
  name: string;
  label: string;
  path: string;
  host: string;
  /** Who can come in (components/PlaceGate.tsx); the owner sees it. */
  gate?: "anyone" | "friends" | "ask" | "me";
};

/** <label>.weered.ca: the wildcard DNS record went in 2026-10-31 and
 *  donkey.weered.ca was checked end to end (padlock, redirect, page, API).
 *  false shows the weered.ca/u/<label> path instead. */
export const PLACE_SUBDOMAINS = true;
export const placeAddress = (p: Place) => (PLACE_SUBDOMAINS ? p.host : `weered.ca${p.path}`);

async function getJson(path: string): Promise<any> {
  try {
    const r = await fetch(`${API}${path}`, { credentials: "include" });
    return await r.json();
  } catch {
    return null;
  }
}

export async function myPlace(): Promise<Place | null> {
  return (await getJson("/places/mine"))?.place || null;
}
export async function placeOf(userId: string): Promise<Place | null> {
  return (await getJson(`/places/of/${encodeURIComponent(userId)}`))?.place || null;
}

/** A new place's Home: a welcome and who lives here. Places are text only:
 *  the place's chat is its lobby chat, and talking happens in lobbies, which
 *  the Who lives here card links to (James 2026-10-31: places mustn't pull
 *  people out of lobbies). */
function starterLayout(name: string, accent: string): LobbyLayout {
  const base = stockLayout();
  const welcome = newBlock("welcome");
  welcome.props = {
    ...welcome.props,
    title: "Come on in",
    body: `This is ${name}'s place. Pull up a seat and say hi in the chat.`,
    cta: "",
  };
  return {
    ...base,
    tabs: base.tabs.map((t) =>
      t.id === "home"
        ? { ...t, hidden: false }
        : t.id === "events" || t.id === "rooms"
          ? { ...t, hidden: true }
          : t,
    ),
    landing: "home",
    theme: {
      preset: "midnight",
      accent,
      effect: "stars",
      font: "default",
      entrance: "rise",
      intensity: 0.8,
    },
    blocks: [welcome, newBlock("owner")],
  };
}

/** Make the caller's place, or find the one they have. */
export async function makePlace(name: string, accent: string): Promise<Place> {
  const r = await fetch(`${API}/places/mine`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout: starterLayout(name, accent), accentColor: accent }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j?.place) throw new Error(j?.error || `http_${r.status}`);
  return j.place as Place;
}
