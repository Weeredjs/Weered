"use client";

// The web side of what a lobby's staff build into it (api routes/lobbyExtras.ts,
// James 2026-10-31 "Do everything"): scheduled posts and feeds, members' alerts,
// the lobby's AI host, custom blocks and games with what they keep, pages, and
// the stream overlay's look (api routes/overlay.ts). The describe-it jobs that
// propose these live in lib/aiBuild.ts (describeJob).
import { API, authHeaders } from "./apiClient";

export class ExtrasError extends Error {
  constructor(
    public code: string,
    public detail = "",
  ) {
    super(detail || code);
  }
}

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API}${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ExtrasError("network");
  }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok)
    throw new ExtrasError(String(j?.error || `http_${r.status}`), String(j?.message || ""));
  return j as T;
}

const L = (lobbyId: string) => `/lobbies/${encodeURIComponent(lobbyId)}`;

/** What to tell the person when a save doesn't go through. */
export function extrasErrorText(e: unknown): string {
  if (!(e instanceof ExtrasError)) return "That didn't save. Try again.";
  if (e.detail) return e.detail;
  switch (e.code) {
    case "network":
      return "Couldn't reach Weered. Check your connection.";
    case "unauthorized":
    case "sign_in":
      return "Sign in first.";
    case "forbidden":
    case "no_permission":
      return "Only this lobby's staff can do that.";
    case "too_many":
      return "That's the most this lobby can have. Remove one first.";
    case "in_the_past":
      return "That time has already passed. Pick a later one.";
    case "bad_feed":
      return "That doesn't look like a channel or feed address.";
    case "paid_feature":
      return "Custom blocks and games are for paid accounts.";
    case "persona_required":
      return "Say who your host is first.";
    case "staff_only":
      return "Only the lobby's staff can change that.";
    case "too_big":
      return "That's too much to save in one go.";
    case "full":
      return "This block is full.";
    default:
      return "That didn't save. Try again.";
  }
}

// ── Automations ─────────────────────────────────────────────────────────────

export type PostSpec = {
  cadence: "once" | "daily" | "weekly";
  days: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[];
  time: string;
  tz: string;
  date: string | null;
  message: string;
  pingLevel: number;
};
export type FeedSpec = { source: "youtube" | "twitch" | "rss"; target: string; message: string };
export type AlertSpec = { roomId: string; roomName: string; threshold: number };
export type Automation<S = any> = {
  id: string;
  kind: "post" | "feed" | "alert";
  spec: S;
  active: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastResult: string | null;
  createdAt: string;
};

function tz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const automations = {
  list: (lobbyId: string) =>
    call<{ automations: Automation[] }>(`${L(lobbyId)}/admin/automations`).then(
      (j) => j.automations,
    ),
  add: (lobbyId: string, kind: "post" | "feed", spec: PostSpec | FeedSpec) =>
    call<{ automation: Automation }>(`${L(lobbyId)}/admin/automations`, "POST", {
      kind,
      spec,
      tz: tz(),
    }).then((j) => j.automation),
  update: (lobbyId: string, id: string, patch: { active?: boolean; spec?: PostSpec | FeedSpec }) =>
    call<{ automation: Automation }>(
      `${L(lobbyId)}/admin/automations/${encodeURIComponent(id)}`,
      "PATCH",
      {
        ...patch,
        tz: tz(),
      },
    ).then((j) => j.automation),
  remove: (lobbyId: string, id: string) =>
    call(`${L(lobbyId)}/admin/automations/${encodeURIComponent(id)}`, "DELETE"),
};

export const alerts = {
  list: (lobbyId: string) =>
    call<{ alerts: Automation<AlertSpec>[] }>(`${L(lobbyId)}/alerts`).then((j) => j.alerts),
  add: (lobbyId: string, roomId: string, threshold: number) =>
    call<{ alert: Automation<AlertSpec> }>(`${L(lobbyId)}/alerts`, "POST", {
      roomId,
      threshold,
    }).then((j) => j.alert),
  remove: (lobbyId: string, id: string) =>
    call(`${L(lobbyId)}/alerts/${encodeURIComponent(id)}`, "DELETE"),
};

/** "Every Tue and Fri at 19:00", "Daily at 08:30", "Once, 2026-11-07 at 20:00". */
export function cadenceText(s: PostSpec): string {
  const names: Record<string, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  };
  if (s.cadence === "daily") return `Every day at ${s.time}`;
  if (s.cadence === "once") return `Once, ${s.date || "?"} at ${s.time}`;
  return `Every ${s.days.map((d) => names[d] || d).join(", ")} at ${s.time}`;
}

// ── The lobby's host ────────────────────────────────────────────────────────

export type HostConfig = {
  on: boolean;
  name: string;
  emoji: string;
  persona: string;
  welcome: boolean;
  welcomeLines: string[];
};
export const HOST_OFF: HostConfig = {
  on: false,
  name: "",
  emoji: "",
  persona: "",
  welcome: false,
  welcomeLines: [],
};

export const host = {
  get: (lobbyId: string) =>
    call<{ host: HostConfig }>(`${L(lobbyId)}/admin/host`).then((j) => j.host),
  save: (lobbyId: string, h: HostConfig) =>
    call<{ host: HostConfig }>(`${L(lobbyId)}/admin/host`, "PATCH", { host: h }).then(
      (j) => j.host,
    ),
};

// ── Custom blocks and games ─────────────────────────────────────────────────

export type CustomBlock = {
  id: string;
  kind: "block" | "game";
  title: string;
  height: "s" | "m" | "l";
  code: string;
  updatedAt: string;
};
export type CodeResult =
  | { ok: true; title: string; height: "s" | "m" | "l"; code: string }
  | { ok: false; reason: string };

export const blocks = {
  get: (lobbyId: string, id: string) =>
    call<{ block: CustomBlock }>(`${L(lobbyId)}/blocks/${encodeURIComponent(id)}`).then(
      (j) => j.block,
    ),
  list: (lobbyId: string) =>
    call<{ blocks: Omit<CustomBlock, "code">[]; canWrite: boolean }>(`${L(lobbyId)}/admin/blocks`),
  add: (
    lobbyId: string,
    b: { kind: "block" | "game"; title: string; height: string; code: string; prompt?: string },
  ) => call<{ block: CustomBlock }>(`${L(lobbyId)}/admin/blocks`, "POST", b).then((j) => j.block),
  update: (
    lobbyId: string,
    id: string,
    b: Partial<Pick<CustomBlock, "title" | "height" | "code">> & { prompt?: string },
  ) =>
    call<{ block: CustomBlock }>(
      `${L(lobbyId)}/admin/blocks/${encodeURIComponent(id)}`,
      "PATCH",
      b,
    ).then((j) => j.block),
  remove: (lobbyId: string, id: string) =>
    call(`${L(lobbyId)}/admin/blocks/${encodeURIComponent(id)}`, "DELETE"),
};

export type BlockItem = {
  key: string;
  value: unknown;
  by: { id: string; name: string } | null;
  at: string;
};
const BD = (blockId: string) => `/blocks/${encodeURIComponent(blockId)}/data`;

export const blockData = {
  list: (blockId: string, prefix = "") =>
    call<{ items: BlockItem[] }>(
      `${BD(blockId)}${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ""}`,
    ).then((j) => j.items),
  get: (blockId: string, key: string) =>
    call<{ item: BlockItem | null }>(`${BD(blockId)}/${encodeURIComponent(key)}`).then(
      (j) => j.item,
    ),
  set: (blockId: string, key: string, value: unknown) =>
    call<{ item: BlockItem | null }>(`${BD(blockId)}/${encodeURIComponent(key)}`, "PUT", {
      value,
    }).then((j) => j.item),
};

// ── Pages ───────────────────────────────────────────────────────────────────

export type LobbyPageMeta = {
  id: string;
  slug: string;
  title: string;
  order: number;
  updatedAt: string;
};
export type LobbyPage = LobbyPageMeta & { body: string };

export const pages = {
  list: (lobbyId: string) =>
    call<{ pages: LobbyPageMeta[] }>(`${L(lobbyId)}/pages`).then((j) => j.pages),
  get: (lobbyId: string, slug: string) =>
    call<{ page: LobbyPage }>(`${L(lobbyId)}/pages/${encodeURIComponent(slug)}`).then(
      (j) => j.page,
    ),
  add: (lobbyId: string, p: { title: string; body: string }) =>
    call<{ page: LobbyPage }>(`${L(lobbyId)}/admin/pages`, "POST", p).then((j) => j.page),
  update: (
    lobbyId: string,
    id: string,
    p: Partial<{ title: string; body: string; order: number; slug: string }>,
  ) =>
    call<{ page: LobbyPage }>(
      `${L(lobbyId)}/admin/pages/${encodeURIComponent(id)}`,
      "PATCH",
      p,
    ).then((j) => j.page),
  remove: (lobbyId: string, id: string) =>
    call(`${L(lobbyId)}/admin/pages/${encodeURIComponent(id)}`, "DELETE"),
};

// ── The stream overlay's look ───────────────────────────────────────────────

export type OverlayConfig = {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size: "s" | "m" | "l";
  style: "glass" | "solid" | "minimal" | "neon";
  accent: string;
  show: {
    avatar: boolean;
    tier: boolean;
    place: boolean;
    count: boolean;
    join: boolean;
    status: boolean;
    people: boolean;
    chat: boolean;
  };
  tagline: string;
  hideOffline: boolean;
};
export const OVERLAY_DEFAULT: OverlayConfig = {
  position: "top-left",
  size: "m",
  style: "glass",
  accent: "#7c3aed",
  show: {
    avatar: true,
    tier: true,
    place: true,
    count: true,
    join: true,
    status: true,
    people: false,
    chat: false,
  },
  tagline: "",
  hideOffline: false,
};

export const overlayLook = {
  get: () => call<{ config: OverlayConfig }>(`/me/overlay/config`).then((j) => j.config),
  save: (config: OverlayConfig) =>
    call<{ config: OverlayConfig }>(`/me/overlay/config`, "PATCH", { config }).then(
      (j) => j.config,
    ),
};
