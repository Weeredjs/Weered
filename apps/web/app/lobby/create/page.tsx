"use client";

// The create-lobby composer. Six steps on one scrolling page with a sticky
// step rail, and a live preview of the lobby that redraws on every pick.
// Creating posts the lobby with its layout and enabled modules, opens the
// starter rooms, throws confetti, and lands the owner in Design mode.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TAB_DEFAULT_LABEL,
  newBlock,
  starterBlocks,
  stockLayout,
  type EffectId,
  type EntranceId,
  type FontId,
  type LobbyLayout,
  type TabId,
} from "../../../lib/lobbyLayout";
import {
  EFFECT_LABEL,
  FONT_LABEL,
  PRESET_BY_ID,
  SWATCH_WHEEL,
  THEME_PRESETS,
  type ThemePreset,
} from "../../../lib/lobbyThemePresets";
import {
  DEFAULT_FEATURES,
  DEFAULT_ROOMS,
  GAME_BY_ID,
  moduleOf,
  MODULE_FEATURES,
  ROOM_PRESETS,
  type FeatureId,
  type GameEntry,
  type RoomPreset,
} from "../../../components/composer/catalog";
import GameGrid from "../../../components/composer/GameGrid";
import ThemePicker, { type ThemeValue } from "../../../components/composer/ThemePicker";
import { FeatureToggles, RoomChips } from "../../../components/composer/InsidePicker";
import Preview, { type PreviewRoom } from "../../../components/composer/Preview";
import Confetti from "../../../components/composer/Confetti";
import {
  ComposerStyles,
  FAINT,
  MUTED,
  Section,
  TEXT,
  alpha,
  inputStyle,
  labelStyle,
} from "../../../components/composer/ui";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}
type ApiResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  merged?: boolean;
  lobby?: unknown;
  user?: { tier?: string };
  globalRole?: string;
};
async function apiFetch(path: string, opts?: RequestInit): Promise<ApiResult> {
  try {
    const r = await fetch(`${API}${path}`, {
      credentials: "include",
      ...opts,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
    });
    return await r.json().catch(() => ({ ok: false, error: `http_${r.status}` }));
  } catch {
    return {
      ok: false,
      error: "network",
      message: "Couldn't reach Weered. Check your connection.",
    };
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/(^-)|(-$)/g, "")
    .slice(0, 40);
}
/** While typing: keep a trailing hyphen so "my-" can become "my-lobby". */
function slugTyping(s: string): string {
  return s
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/g, "-")
    .replaceAll(/-+/g, "-")
    .replace(/^-/, "")
    .slice(0, 40);
}

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

type SlugStatus = "idle" | "checking" | "available" | "taken" | "reserved";
type Phase = "idle" | "creating" | "rooms" | "done";

const STEPS = [
  { id: "cz-name", label: "Name" },
  { id: "cz-game", label: "Game" },
  { id: "cz-look", label: "Look" },
  { id: "cz-inside", label: "Inside" },
  { id: "cz-rooms", label: "Rooms" },
  { id: "cz-launch", label: "Launch" },
] as const;

/** Tabs the lobby page only shows when it has data for them (an LFG board, a
 *  subreddit, a start.gg link). A new lobby has none, so the preview skips them. */
const DATA_GATED_TABS: TabId[] = ["lfg", "reddit", "brackets"];

/** The room's opening module, given what the lobby has switched on. */
function roomModule(r: RoomPreset, enabled: Set<string>): string | null {
  if (!r.module) return null;
  if (enabled.has(r.module)) return r.module;
  if (r.module === "youtube" && enabled.has("video")) return "video";
  return null;
}

const DEFAULT_THEME: ThemeValue = {
  preset: "midnight",
  accent: "#7c3aed",
  effect: "stars",
  font: "default",
  entrance: "rise",
  intensity: 1,
};

export default function CreateLobbyPage() {
  const router = useRouter();

  // ── Who's here (same gate as before) ───────────────────────────────────
  const [tier, setTier] = useState("INNOCENT");
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<{ kind: "tier" | "limit"; message: string } | null>(null);

  useEffect(() => {
    // Signed-in is the cached user: the session itself is an httpOnly cookie,
    // and the layout script deletes the old weered_token on every load, so
    // checking the token sent every signed-in visitor to /subscribe.
    let signedIn = false;
    try {
      signedIn = !!JSON.parse(localStorage.getItem("weered_user") || "null")?.id;
    } catch {}
    if (!signedIn) {
      router.replace(`/login?next=${encodeURIComponent("/lobby/create")}`);
      return;
    }
    apiFetch("/staff/me")
      .then((j) => {
        if (j?.user) setTier(String(j.user?.tier || "INNOCENT").toUpperCase());
        else if (j?.globalRole) setTier("KINGPIN");
        setLoading(false);
      })
      .catch(() => setLoading(false));
    try {
      const u = JSON.parse(localStorage.getItem("weered_user") || "null");
      if (u) setTier(String(u?.tier || "INNOCENT").toUpperCase());
    } catch {}
  }, [router]);

  // ── 1. Name ─────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [slugRaw, setSlugRaw] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const slug = slugify(slugRaw);

  useEffect(() => {
    if (!slugManual) setSlugRaw(slugify(name));
  }, [name, slugManual]);

  useEffect(() => {
    if (!slug || slug.length < 2) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      const j = await apiFetch(`/lobbies/${encodeURIComponent(slug)}`);
      setSlugStatus(j?.ok && j?.lobby ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  // ── 2. Game ─────────────────────────────────────────────────────────────
  const [gameId, setGameId] = useState("NONE");
  const [gameTouched, setGameTouched] = useState(false);
  const game: GameEntry = GAME_BY_ID[gameId] || GAME_BY_ID.NONE;
  const hasGame = moduleOf(game) !== "NONE";

  // ── 3. Look ─────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<ThemeValue>(DEFAULT_THEME);
  const [themeTouched, setThemeTouched] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const preset: ThemePreset = PRESET_BY_ID[theme.preset] || THEME_PRESETS[0];

  const applyPreset = useCallback((p: ThemePreset) => {
    setTheme((t) => ({ ...t, preset: p.id, accent: p.accent, effect: p.effect, font: p.font }));
  }, []);

  function pickGame(g: GameEntry) {
    if (g.action === "meeting") {
      window.open("/requests?meeting=1", "_blank", "noopener");
      return;
    }
    setGameId(g.id);
    if (g.rooms) setRoomIds(g.rooms);
    setGameTouched(true);
    // Until the owner styles it themselves, the theme follows the game.
    if (!themeTouched && PRESET_BY_ID[g.preset]) {
      applyPreset(PRESET_BY_ID[g.preset]);
      setReplayKey((k) => k + 1);
    }
  }

  function surprise() {
    const p = pick(THEME_PRESETS);
    const effects = (Object.keys(EFFECT_LABEL) as EffectId[]).filter((e) => e !== "none");
    const entrances: EntranceId[] = ["fade", "rise", "glitch"];
    setTheme({
      preset: p.id,
      accent: Math.random() < 0.65 ? pick(p.swatches.slice(0, 3)) : pick(SWATCH_WHEEL),
      effect: Math.random() < 0.85 ? pick(effects) : "none",
      font: pick(Object.keys(FONT_LABEL) as FontId[]),
      entrance: pick(entrances),
      intensity: Math.round((0.7 + Math.random() * 0.7) * 10) / 10,
    });
    setThemeTouched(true);
    setSpinKey((k) => k + 1);
    setReplayKey((k) => k + 1);
  }

  // ── 4. Inside / 5. Rooms ────────────────────────────────────────────────
  const [features, setFeatures] = useState<Record<FeatureId, boolean>>(DEFAULT_FEATURES);
  const [roomIds, setRoomIds] = useState<string[]>(DEFAULT_ROOMS);

  // The design survives a trip to the upgrade page (and a refresh).
  const DRAFT_KEY = "weered:composer-draft:v1";
  const restored = React.useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!d || typeof d !== "object") return;
      if (typeof d.name === "string") setName(d.name);
      if (typeof d.slugRaw === "string") setSlugRaw(d.slugRaw);
      if (typeof d.slugManual === "boolean") setSlugManual(d.slugManual);
      if (typeof d.description === "string") setDescription(d.description);
      if (typeof d.gameId === "string") {
        setGameId(d.gameId);
        setGameTouched(true);
      }
      if (d.theme && typeof d.theme === "object") {
        setTheme({ ...DEFAULT_THEME, ...d.theme });
        setThemeTouched(true);
      }
      if (d.features && typeof d.features === "object")
        setFeatures({ ...DEFAULT_FEATURES, ...d.features });
      if (Array.isArray(d.roomIds)) setRoomIds(d.roomIds.map(String));
    } catch {}
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          name,
          slugRaw,
          slugManual,
          description,
          gameId,
          theme,
          features,
          roomIds,
        }),
      );
    } catch {}
  }, [name, slugRaw, slugManual, description, gameId, theme, features, roomIds]);

  const enabledModules = useMemo(() => {
    const m: string[] = MODULE_FEATURES.filter((f) => features[f]);
    // Reddit is on for every lobby by default (Lobby.enabledModules); keep it.
    m.push("reddit");
    return m;
  }, [features]);

  const starterRooms: PreviewRoom[] = useMemo(() => {
    const on = new Set(enabledModules);
    return ROOM_PRESETS.filter((r) => roomIds.includes(r.id)).flatMap((r) =>
      r.names.map((n) => ({ name: n, module: roomModule(r, on) })),
    );
  }, [roomIds, enabledModules]);

  const tabsFor = useCallback(
    (): LobbyLayout["tabs"] =>
      stockLayout().tabs.map((t) => {
        if (t.id === "home") return { ...t, hidden: !features.home };
        if (t.id === "requests") return { ...t, hidden: !features.requests };
        if (t.id === "events") return { ...t, hidden: !features.events };
        if (t.id === "modules") return { ...t, hidden: !hasGame };
        return t;
      }),
    [features, hasGame],
  );

  const landing: TabId = features.home ? "home" : "rooms";
  const previewTabs = useMemo(
    () =>
      tabsFor()
        .filter((t) => !t.hidden && !DATA_GATED_TABS.includes(t.id))
        .map((t) => ({
          id: t.id,
          label: t.id === "feed" && gameId === "TRADING" ? "The Tape" : TAB_DEFAULT_LABEL[t.id],
        })),
    [tabsFor, gameId],
  );

  function buildLayout(): LobbyLayout {
    const base = stockLayout();
    let blocks: LobbyLayout["blocks"] = [];
    if (features.home) {
      blocks = starterBlocks(hasGame).filter((b) => features.events || b.type !== "events");
      const welcome = blocks.find((b) => b.type === "welcome");
      if (welcome) {
        welcome.props = {
          ...welcome.props,
          title: `Welcome to ${name.trim()}`.slice(0, 120),
          body: description.trim() || welcome.props.body,
        };
      }
      if (features.requests) blocks.push(newBlock("requests"));
    }
    return {
      ...base,
      tabs: tabsFor(),
      landing,
      theme: {
        preset: theme.preset,
        accent: theme.accent,
        effect: theme.effect,
        intensity: theme.intensity,
        font: theme.font,
        entrance: theme.entrance,
      },
      blocks,
    };
  }

  // ── Step rail ───────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState<string>(STEPS[0].id);
  const nameOk = name.trim().length >= 2 && slug.length >= 2 && slugStatus === "available";
  const stepDone: Record<string, boolean> = {
    "cz-name": nameOk,
    "cz-game": gameTouched,
    "cz-look": themeTouched || gameTouched,
    "cz-inside": true,
    "cz-rooms": true,
    "cz-launch": false,
  };

  useEffect(() => {
    if (loading) return;
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveStep(e.target.id);
      },
      { root, rootMargin: "-25% 0px -65% 0px" },
    );
    for (const s of STEPS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [loading, blocked]);

  const goTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ── Toast ───────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  async function requestGame(title: string) {
    const j = await apiFetch("/requests", {
      method: "POST",
      body: JSON.stringify({ kind: "game", title, note: "Asked from the create-lobby composer." }),
    });
    let r: { ok: boolean; message: string };
    if (j?.ok)
      r = {
        ok: true,
        message: j.merged
          ? `“${title}” was already on the board. Your vote is in.`
          : `“${title}” is on the request board.`,
      };
    else if (j?.error === "sign_in_to_request")
      r = { ok: false, message: "Sign in to request a game." };
    else if (j?.error === "slow_down")
      r = { ok: false, message: j.message || "Five requests a day. Vote on the rest." };
    else r = { ok: false, message: j?.message || "Couldn't send that. Try again." };
    setToast({ ok: r.ok, text: r.message });
    return r;
  }

  // ── Launch ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [roomProgress, setRoomProgress] = useState({ made: 0, tried: 0, total: 0 });
  const [confetti, setConfetti] = useState(0);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const blocker =
    name.trim().length < 2
      ? "Give it a name first"
      : slug.length < 2
        ? "It needs an address"
        : slugStatus === "checking" || slugStatus === "idle"
          ? "Checking the address…"
          : slugStatus === "taken"
            ? "That address is taken"
            : slugStatus === "reserved"
              ? "That address is reserved"
              : "";
  const canCreate = !blocker && phase === "idle";

  async function launch(e: React.MouseEvent<HTMLButtonElement>) {
    if (!canCreate) {
      if (blocker) goTo("cz-name");
      return;
    }
    if (tier === "INNOCENT") {
      setBlocked({
        kind: "tier",
        message:
          "Your design is saved in this browser. Upgrade, come back to this page, and hit Create.",
      });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setPhase("creating");
    setError("");

    const j = await apiFetch("/lobbies", {
      method: "POST",
      body: JSON.stringify({
        id: slug,
        name: name.trim(),
        description: description.trim(),
        moduleType: moduleOf(game),
        accentColor: theme.accent,
        layout: buildLayout(),
        enabledModules,
      }),
    });
    if (!j?.ok) {
      setPhase("idle");
      const code = String(j?.error || "");
      if (code === "tier_required") {
        setBlocked({ kind: "tier", message: j?.message || "" });
        return;
      }
      if (code === "lobby_limit") {
        setBlocked({ kind: "limit", message: j?.message || "" });
        return;
      }
      if (code === "lobby_exists") {
        setSlugStatus("taken");
        setError("Someone just took that address. Pick another and launch again.");
        goTo("cz-name");
        return;
      }
      if (code === "name_reserved") {
        setSlugStatus("reserved");
        setError(j?.message || "This lobby name is reserved and cannot be used.");
        goTo("cz-name");
        return;
      }
      if (code === "Unauthorized")
        setError("Your session has expired. Sign in again, then come back.");
      else setError(j?.message || j?.error || "Failed to create lobby");
      return;
    }

    // Starter rooms, one at a time (POST /rooms rate-limits bursts).
    setPhase("rooms");
    const total = starterRooms.length;
    let made = 0;
    setRoomProgress({ made: 0, tried: 0, total });
    for (let i = 0; i < starterRooms.length; i++) {
      const r = starterRooms[i];
      const rj = await apiFetch("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: r.name,
          lobbyId: slug,
          ...(r.module ? { defaultModule: r.module } : {}),
        }),
      });
      if (rj?.ok) made++;
      setRoomProgress({ made, tried: i + 1, total });
    }

    setPhase("done");
    setConfetti((c) => c + 1);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setTimeout(() => router.push(`/lobby/${encodeURIComponent(slug)}?design=1`), 1900);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const accent = theme.accent;

  if (loading) {
    return (
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          background: "#050810",
          color: "rgba(255,255,255,.4)",
          fontSize: 13,
        }}
      >
        Loading...
      </div>
    );
  }

  if (blocked) {
    const limit = blocked?.kind === "limit";
    return (
      <div
        style={{
          height: "100%",
          overflowY: "auto",
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(124,58,237,.25), transparent 70%), #050810",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 16px",
          boxSizing: "border-box",
        }}
      >
        <ComposerStyles />
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            textAlign: "center",
            padding: "32px 24px",
            borderRadius: 20,
            border: "1px solid rgba(167,139,250,.25)",
            background: "rgba(255,255,255,.03)",
            boxShadow: "0 30px 80px -30px rgba(124,58,237,.6)",
          }}
        >
          <div
            aria-hidden
            className="cz-anim"
            style={{
              fontSize: 46,
              marginBottom: 14,
              animation: "cz-float 3s ease-in-out infinite",
            }}
          >
            {limit ? "🏰" : "⚖️"}
          </div>
          <h1
            style={{
              fontWeight: 900,
              fontSize: 24,
              color: TEXT,
              margin: "0 0 8px",
              letterSpacing: "-0.5px",
            }}
          >
            {limit ? "You've hit your lobby cap" : "Upgrade to build a lobby"}
          </h1>
          <p style={{ fontSize: 14, color: MUTED, margin: "0 0 24px", lineHeight: 1.5 }}>
            {limit
              ? blocked?.message ||
                "Your plan's lobbies are all in use. Upgrade for more, or reuse one you own."
              : `Lobbies come with an Indicted subscription or higher: your own address, theme, rooms and game integration.${blocked?.message ? ` ${blocked.message}` : ""}`}
          </p>
          <button
            type="button"
            className="cz-btn"
            onClick={() => router.push("/subscribe")}
            style={{
              width: "100%",
              padding: "13px 28px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, rgba(88,0,229,.95), rgba(167,139,250,.9))",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
              boxShadow: "0 6px 24px rgba(88,0,229,.4)",
              fontFamily: "inherit",
            }}
          >
            View plans
          </button>
          <button
            type="button"
            className="cz-btn"
            onClick={() => router.push("/home")}
            style={{
              marginTop: 10,
              padding: "9px 20px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.10)",
              background: "transparent",
              color: "rgba(255,255,255,.5)",
              fontSize: 12.5,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const roomCount = starterRooms.length;
  const featureCount = (Object.keys(features) as FeatureId[]).filter((f) => features[f]).length;

  const launchButton = (big: boolean) => (
    <button
      type="button"
      className="cz-btn"
      onClick={launch}
      aria-disabled={!canCreate}
      style={{
        width: "100%",
        padding: big ? "18px 22px" : "13px 18px",
        borderRadius: big ? 16 : 12,
        border: "none",
        background: canCreate
          ? `linear-gradient(110deg, ${accent} 0%, ${alpha(accent, 0.75)} 40%, #ffffff55 50%, ${alpha(accent, 0.75)} 60%, ${accent} 100%) 0 0 / 200% 100%`
          : "rgba(255,255,255,.06)",
        animation: canCreate ? "cz-shimmer 3.5s linear infinite" : undefined,
        color: canCreate ? "#fff" : "rgba(255,255,255,.35)",
        fontWeight: 900,
        fontSize: big ? 19 : 15,
        letterSpacing: "-0.3px",
        cursor: canCreate ? "pointer" : "not-allowed",
        fontFamily: "inherit",
        boxShadow: canCreate ? `0 10px 40px ${alpha(accent, 0.5)}` : "none",
        textShadow: canCreate ? "0 1px 8px rgba(0,0,0,.35)" : "none",
        transition: "box-shadow .2s, color .2s",
      }}
    >
      {phase !== "idle" ? "Building…" : canCreate ? "Create lobby  →" : blocker}
    </button>
  );

  return (
    <div
      ref={scrollRef}
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        background: `radial-gradient(70% 40% at 85% 0%, ${alpha(accent, 0.14)}, transparent 70%), #050810`,
        color: TEXT,
        transition: "background .5s",
      }}
    >
      <ComposerStyles />
      <style>{`.cz-mobile-only{display:inline-flex}@media (min-width:1080px){.cz-mobile-only{display:none}}`}</style>

      <div className="cz-shell">
        {/* ── Form column ── */}
        <div style={{ minWidth: 0 }}>
          <header style={{ marginBottom: 18 }}>
            <button
              type="button"
              className="cz-btn"
              onClick={() => router.push("/home")}
              style={{
                background: "none",
                border: "none",
                color: FAINT,
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
                marginBottom: 14,
                fontFamily: "inherit",
              }}
            >
              ← Back
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h1
                  style={{
                    margin: 0,
                    fontWeight: 900,
                    fontSize: "clamp(28px, 5vw, 40px)",
                    letterSpacing: "-1px",
                    lineHeight: 1.02,
                    backgroundImage: `linear-gradient(90deg, #fff 30%, ${accent})`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Build your lobby
                </h1>
                <div style={{ fontSize: 13.5, color: MUTED, marginTop: 8 }}>
                  Name it, pick the game, paint the walls. The preview updates as you go.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="cz-btn cz-mobile-only"
                  onClick={() =>
                    document
                      .getElementById("cz-preview")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  style={{
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "rgba(255,255,255,.04)",
                    color: TEXT,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Preview ↓
                </button>
                <button
                  type="button"
                  className="cz-btn"
                  onClick={surprise}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 16px",
                    borderRadius: 12,
                    border: `1px solid ${alpha(accent, 0.55)}`,
                    background: `linear-gradient(135deg, ${alpha(accent, 0.3)}, ${alpha(accent, 0.08)})`,
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: 13.5,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: `0 6px 24px ${alpha(accent, 0.3)}`,
                  }}
                >
                  <span
                    key={spinKey}
                    aria-hidden
                    className="cz-anim"
                    style={{
                      display: "inline-block",
                      fontSize: 17,
                      animation: spinKey ? "cz-spin .6s cubic-bezier(.2,.8,.2,1)" : undefined,
                    }}
                  >
                    🎲
                  </span>
                  Surprise me
                </button>
              </div>
            </div>
          </header>

          {/* Step rail */}
          <nav
            aria-label="Steps"
            className="cz-rail"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              display: "flex",
              gap: 6,
              overflowX: "auto",
              scrollbarWidth: "none",
              padding: "10px 0",
              marginBottom: 8,
              background: "linear-gradient(180deg, #050810 75%, rgba(5,8,16,0))",
            }}
          >
            {STEPS.map((s, i) => {
              const on = activeStep === s.id;
              const done = stepDone[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  className="cz-chip"
                  aria-current={on ? "step" : undefined}
                  onClick={() => goTo(s.id)}
                  style={{
                    flex: "0 0 auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 12px 7px 8px",
                    borderRadius: 99,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: on ? "#fff" : MUTED,
                    background: on ? alpha(accent, 0.22) : "rgba(255,255,255,.03)",
                    border: `1px solid ${on ? alpha(accent, 0.6) : "rgba(255,255,255,.08)"}`,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 99,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10.5,
                      fontWeight: 900,
                      background: done ? accent : "rgba(255,255,255,.08)",
                      color: done ? "#fff" : FAINT,
                      transition: "background .25s",
                    }}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  {s.label}
                </button>
              );
            })}
          </nav>

          {/* 1. Name */}
          <Section
            id="cz-name"
            n={1}
            title="Name it"
            kicker="What people call it, and where they find it."
            accent={accent}
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label htmlFor="cz-lobby-name" style={labelStyle}>
                  Lobby name
                </label>
                <input
                  id="cz-lobby-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Friday Night Raids"
                  maxLength={48}
                  autoComplete="off"
                  style={{ ...inputStyle, fontSize: 18, fontWeight: 800, padding: "14px 16px" }}
                />
              </div>
              <div>
                <label htmlFor="cz-slug" style={labelStyle}>
                  Address
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    borderRadius: 10,
                    overflow: "hidden",
                    border: `1px solid ${
                      slugStatus === "available"
                        ? "rgba(34,197,94,.45)"
                        : slugStatus === "taken" || slugStatus === "reserved"
                          ? "rgba(239,68,68,.45)"
                          : "rgba(255,255,255,.10)"
                    }`,
                    background: "rgba(255,255,255,.04)",
                    transition: "border-color .15s",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "0 4px 0 14px",
                      fontSize: 13,
                      color: FAINT,
                      whiteSpace: "nowrap",
                      flex: "0 0 auto",
                    }}
                  >
                    weered.ca/lobby/
                  </span>
                  <input
                    id="cz-slug"
                    value={slugRaw}
                    onChange={(e) => {
                      setSlugRaw(slugTyping(e.target.value));
                      setSlugManual(true);
                    }}
                    onBlur={() => setSlugRaw(slug)}
                    placeholder="your-lobby"
                    maxLength={40}
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby="cz-slug-status"
                    style={{
                      ...inputStyle,
                      border: "none",
                      background: "transparent",
                      paddingLeft: 0,
                      minWidth: 0,
                      flex: 1,
                      borderRadius: 0,
                    }}
                  />
                </div>
                <div
                  id="cz-slug-status"
                  role="status"
                  style={{ fontSize: 11.5, marginTop: 6, minHeight: 16 }}
                >
                  {slugStatus === "checking" && (
                    <span style={{ color: FAINT }}>Checking availability…</span>
                  )}
                  {slugStatus === "available" && (
                    <span style={{ color: "rgba(74,222,128,.85)" }}>
                      ✓ weered.ca/lobby/{slug} is yours to take
                    </span>
                  )}
                  {slugStatus === "taken" && (
                    <span style={{ color: "rgba(252,165,165,.9)" }}>
                      ✗ Already taken. Try another.
                    </span>
                  )}
                  {slugStatus === "reserved" && (
                    <span style={{ color: "rgba(252,165,165,.9)" }}>✗ This name is reserved</span>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="cz-desc" style={labelStyle}>
                  One-line description
                </label>
                <input
                  id="cz-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Weekly raids, zero toxicity, snacks encouraged."
                  maxLength={160}
                  autoComplete="off"
                  style={inputStyle}
                />
              </div>
            </div>
          </Section>

          {/* 2. Game */}
          <Section
            id="cz-game"
            n={2}
            title="What are you doing here?"
            kicker="Work, a club, a game. Pick one and the lobby sets itself up for it."
            accent={accent}
          >
            <GameGrid value={gameId} accent={accent} onPick={pickGame} onRequest={requestGame} />
          </Section>

          {/* 3. Look */}
          <Section
            id="cz-look"
            n={3}
            title="Make it yours"
            kicker="A theme, a colour, something drifting in the background."
            accent={accent}
          >
            <ThemePicker
              value={theme}
              onPreset={(p) => {
                applyPreset(p);
                setThemeTouched(true);
                setReplayKey((k) => k + 1);
              }}
              onChange={(p) => {
                setTheme((t) => ({ ...t, ...p }));
                setThemeTouched(true);
              }}
              onReplayEntrance={() => setReplayKey((k) => k + 1)}
            />
          </Section>

          {/* 4. Inside */}
          <Section
            id="cz-inside"
            n={4}
            title="What's inside"
            kicker="Switch on what your people will use. All of it can change later."
            accent={accent}
          >
            <FeatureToggles
              value={features}
              accent={accent}
              onToggle={(id) => setFeatures((f) => ({ ...f, [id]: !f[id] }))}
            />
            <div style={{ fontSize: 11.5, color: FAINT, marginTop: 10 }}>
              {features.home
                ? "Visitors land on your Home canvas. You'll arrange its blocks in Design mode."
                : "Visitors land on the room list."}
            </div>
          </Section>

          {/* 5. Rooms */}
          <Section
            id="cz-rooms"
            n={5}
            title="Starter rooms"
            kicker="Open a few doors so the place isn't empty on day one."
            accent={accent}
          >
            <RoomChips
              value={roomIds}
              accent={accent}
              onToggle={(id) =>
                setRoomIds((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]))
              }
            />
          </Section>

          {/* 6. Launch */}
          <Section
            id="cz-launch"
            n={6}
            title="Launch"
            kicker="Doors open the moment you hit it."
            accent={accent}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 14,
                fontSize: 12,
                color: MUTED,
              }}
            >
              {[
                `weered.ca/lobby/${slug || "…"}`,
                game.name,
                `${preset.name} theme`,
                `${featureCount} features`,
                `${roomCount} room${roomCount === 1 ? "" : "s"}`,
              ].map((t) => (
                <span
                  key={t}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.08)",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            {error && (
              <div
                role="alert"
                style={{
                  marginBottom: 14,
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,.08)",
                  border: "1px solid rgba(239,68,68,.25)",
                  color: "rgba(252,165,165,.95)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}
            {launchButton(true)}
            <div style={{ fontSize: 11.5, color: FAINT, textAlign: "center", marginTop: 12 }}>
              You&apos;ll land in Design mode to arrange the Home page, add a logo and fine-tune.
            </div>
          </Section>
        </div>

        {/* ── Preview column ── */}
        <aside
          id="cz-preview"
          className="cz-previewcol"
          aria-label="Live preview"
          style={{ scrollMarginTop: 16 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span style={{ ...labelStyle, marginBottom: 0 }}>Live preview</span>
            <span style={{ fontSize: 11, color: FAINT }}>
              {EFFECT_LABEL[theme.effect]} · {FONT_LABEL[theme.font]}
            </span>
          </div>
          <Preview
            name={name}
            slug={slug}
            description={description}
            game={game}
            preset={preset}
            theme={theme}
            tabs={previewTabs}
            landing={landing}
            rooms={starterRooms}
            features={features}
            spinKey={spinKey}
            replayKey={replayKey}
          />
          <div style={{ marginTop: 14 }}>{launchButton(false)}</div>
        </aside>
      </div>

      {/* Launch overlay */}
      {phase !== "idle" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Creating your lobby"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9000,
            display: "grid",
            placeItems: "center",
            padding: 16,
            background: "rgba(3,4,10,.72)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            className="cz-anim"
            style={{
              width: "100%",
              maxWidth: 380,
              borderRadius: 20,
              padding: "26px 22px",
              background: `radial-gradient(90% 70% at 50% 0%, ${alpha(accent, 0.3)}, transparent 70%), #0b0b14`,
              border: `1px solid ${alpha(accent, 0.45)}`,
              boxShadow: `0 30px 90px ${alpha(accent, 0.45)}`,
              animation: "cz-pop .4s both",
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "-0.5px",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              {phase === "done" ? `${name.trim()} is open 🎉` : "Building your lobby…"}
            </div>
            {[
              { label: `Claiming weered.ca/lobby/${slug}`, done: phase !== "creating" },
              { label: `Painting it ${preset.name}`, done: phase !== "creating" },
              {
                label:
                  roomProgress.total === 0
                    ? "No starter rooms"
                    : phase === "rooms"
                      ? `Opening rooms ${roomProgress.tried}/${roomProgress.total}`
                      : phase === "done"
                        ? `${roomProgress.made} of ${roomProgress.total} rooms open`
                        : `Opening ${roomCount} rooms`,
                done: phase === "done",
              },
              { label: "Doors open", done: phase === "done" },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 0",
                  fontSize: 13.5,
                  color: s.done ? TEXT : MUTED,
                }}
              >
                <span
                  aria-hidden
                  className="cz-anim"
                  style={{
                    width: 20,
                    height: 20,
                    flex: "0 0 20px",
                    borderRadius: 99,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 900,
                    background: s.done ? accent : "transparent",
                    border: s.done ? "none" : `2px solid ${alpha(accent, 0.4)}`,
                    borderTopColor: s.done ? undefined : accent,
                    animation: s.done ? "cz-pop .3s both" : "cz-spin .8s linear infinite",
                    color: "#fff",
                  }}
                >
                  {s.done ? "✓" : ""}
                </span>
                {s.label}
              </div>
            ))}
            {phase === "done" && roomProgress.made < roomProgress.total && (
              <div style={{ fontSize: 11.5, color: FAINT, marginTop: 8 }}>
                Some rooms didn&apos;t open. Add them from the lobby in a moment.
              </div>
            )}
            {phase === "done" && (
              <div style={{ fontSize: 12, color: MUTED, marginTop: 12, textAlign: "center" }}>
                Taking you to Design mode…
              </div>
            )}
          </div>
        </div>
      )}

      <Confetti
        fire={confetti}
        origin={origin}
        colors={[accent, ...preset.swatches.slice(0, 4), "#ffffff"]}
      />

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            zIndex: 9500,
            maxWidth: "calc(100vw - 32px)",
            padding: "11px 18px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            background: toast.ok ? "rgba(21,128,61,.92)" : "rgba(153,27,27,.92)",
            boxShadow: "0 10px 40px rgba(0,0,0,.5)",
            animation: "cz-toast .25s both",
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
