import { fetchWithTimeout } from "./lib/fetchWithTimeout";
import type { PrismaClient } from "@prisma/client";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const LICHESS_GAMES_PER_USER = 20;
const CHESS_COM_MONTHS_BACK = 1;

function timeControlBucket(initialSeconds: number, incrementSeconds: number): string {
  const est = initialSeconds + 40 * incrementSeconds;
  if (est < 30)   return "ultraBullet";
  if (est < 180)  return "bullet";
  if (est < 480)  return "blitz";
  if (est < 1500) return "rapid";
  return "classical";
}

function parseLichessGame(g: any, myUsername: string): any | null {
  if (!g || !g.id) return null;
  const players = g.players || {};
  const white = players.white?.user?.name || players.white?.userId || "";
  const black = players.black?.user?.name || players.black?.userId || "";
  const myColor = (white && white.toLowerCase() === myUsername.toLowerCase()) ? "WHITE"
                : (black && black.toLowerCase() === myUsername.toLowerCase()) ? "BLACK"
                : null;
  if (!myColor) return null;
  const me = myColor === "WHITE" ? players.white : players.black;
  const opp = myColor === "WHITE" ? players.black : players.white;

  let result: "WIN" | "LOSS" | "DRAW";
  if (g.status === "draw" || g.status === "stalemate" || g.winner === undefined && !g.winner) {
    result = "DRAW";
  } else if (g.winner === (myColor === "WHITE" ? "white" : "black")) {
    result = "WIN";
  } else if (g.winner) {
    result = "LOSS";
  } else {
    result = "DRAW";
  }

  const clock = g.clock || {};
  const initial = clock.initial ?? null;
  const increment = clock.increment ?? null;
  const tc = (typeof initial === "number" && typeof increment === "number")
    ? timeControlBucket(initial, increment)
    : (g.perf || "unknown");

  return {
    provider: "LICHESS",
    externalGameId: `LICHESS:${g.id}`,
    username: myUsername,
    playedAt: new Date(g.createdAt || g.lastMoveAt || Date.now()),
    timeControl: tc,
    initialSeconds: initial,
    incrementSeconds: increment,
    rated: !!g.rated,
    variant: g.variant || "standard",
    color: myColor,
    rating: me?.rating ?? null,
    ratingDiff: me?.ratingDiff ?? null,
    opponent: opp?.user?.name || opp?.userId || null,
    opponentRating: opp?.rating ?? null,
    result,
    termination: g.status || null,
    movesCount: typeof g.moves === "string" ? g.moves.trim().split(/\s+/).length : null,
    ecoCode: g.opening?.eco || null,
    openingName: g.opening?.name || null,
  };
}

async function fetchLichessGames(username: string): Promise<any[]> {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${LICHESS_GAMES_PER_USER}&opening=true&clocks=false&evals=false&moves=false`;
  try {
    const r = await fetchWithTimeout(url, { headers: { Accept: "application/x-ndjson" } });
    if (!r.ok) return [];
    const text = await r.text();
    const lines = text.trim().split(/\n+/).filter(Boolean);
    const out: any[] = [];
    for (const line of lines) {
      try {
        const g = JSON.parse(line);
        const parsed = parseLichessGame(g, username);
        if (parsed) out.push(parsed);
      } catch {}
    }
    return out;
  } catch { return []; }
}

function parseChessComGame(g: any, myUsername: string): any | null {
  if (!g || !g.url) return null;
  const lower = myUsername.toLowerCase();
  const isWhite = (g.white?.username || "").toLowerCase() === lower;
  const isBlack = (g.black?.username || "").toLowerCase() === lower;
  if (!isWhite && !isBlack) return null;
  const myColor = isWhite ? "WHITE" : "BLACK";
  const me = isWhite ? g.white : g.black;
  const opp = isWhite ? g.black : g.white;

  const myResult = String(me?.result || "");
  let result: "WIN" | "LOSS" | "DRAW";
  if (myResult === "win") result = "WIN";
  else if (["agreed","stalemate","repetition","insufficient","50move","timevsinsufficient"].includes(myResult)) result = "DRAW";
  else result = "LOSS";

  const tc = String(g.time_class || "").toLowerCase();
  const idMatch = String(g.url).match(/\/(\d+)$/);
  const externalId = idMatch ? `CHESS_COM:${idMatch[1]}` : `CHESS_COM:${g.uuid || g.url}`;

  return {
    provider: "CHESS_COM",
    externalGameId: externalId,
    username: myUsername,
    playedAt: new Date((g.end_time || g.start_time || Date.now() / 1000) * 1000),
    timeControl: tc || "unknown",
    initialSeconds: null,
    incrementSeconds: null,
    rated: !!g.rated,
    variant: g.rules || "standard",
    color: myColor,
    rating: typeof me?.rating === "number" ? me.rating : null,
    ratingDiff: null,
    opponent: opp?.username || null,
    opponentRating: typeof opp?.rating === "number" ? opp.rating : null,
    result,
    termination: myResult || null,
    movesCount: null,
    ecoCode: null,
    openingName: g.eco || null,
  };
}

async function fetchChessComGames(username: string): Promise<any[]> {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const url = `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/${yyyy}/${mm}`;
  try {
    const r = await fetchWithTimeout(url, { headers: { "User-Agent": "Weered (https://weered.ca)" } });
    if (!r.ok) return [];
    const data = await r.json();
    const games = Array.isArray(data?.games) ? data.games : [];
    const recent = games.slice(-LICHESS_GAMES_PER_USER);
    const out: any[] = [];
    for (const g of recent) {
      const parsed = parseChessComGame(g, username);
      if (parsed) out.push(parsed);
    }
    return out;
  } catch { return []; }
}

export function startChessWorker(prisma: PrismaClient) {
  console.log("[chess] worker started — polling every 5min");

  async function cycle() {
    try {
      const users = await prisma.user.findMany({
        where: { OR: [{ lichessUsername: { not: null } }, { chessComUsername: { not: null } }] },
        select: { id: true, lichessUsername: true, chessComUsername: true },
      });
      if (users.length === 0) return;

      for (const u of users) {
        const games: any[] = [];
        if (u.lichessUsername) games.push(...await fetchLichessGames(u.lichessUsername));
        if (u.chessComUsername) games.push(...await fetchChessComGames(u.chessComUsername));

        for (const g of games) {
          try {
            await (prisma as any).chessActivityLog.upsert({
              where: { userId_externalGameId: { userId: u.id, externalGameId: g.externalGameId } },
              create: { userId: u.id, ...g },
              update: {},
            });
          } catch (err: any) {
          }
        }
      }
    } catch (err: any) {
      console.error("[chess] cycle error:", err?.message || err);
    }
  }

  setTimeout(() => { void cycle(); }, 30_000);
  setInterval(() => { void cycle(); }, POLL_INTERVAL_MS);
}
