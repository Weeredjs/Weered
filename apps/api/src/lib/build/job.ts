import type { BuildTool } from "../buildAi";

// One "describe it" job (routes/aiDescribe.ts): a sentence becomes an event, a
// room, roles, chat rules, a crew look, an overlay, a lobby host, a schedule,
// an alert, a feed, a custom block, a game or a page. Each job says who may
// run it, what the model is shown, and how its answer is made safe. Nothing a
// job returns is saved by the job: the person sees it and saves it through the
// feature's own route, which checks permissions again.

export type JobUser = { id: string; name: string; globalRole?: string };

export type JobCtx = {
  user: JobUser;
  body: Record<string, any>;
  prompt: string;
  /** The lobby row, for lobby jobs. */
  lobby?: any;
  /** The caller's level in that lobby (5 owner … 1 member). */
  level?: number;
};

export type BuildJob<T = unknown> = {
  id: string;
  /** lobby: POST /ai/describe/<id>/<lobbyId>, at minLevel with perm.
   *  user: POST /ai/describe/<id>, about the caller's own things. */
  scope: "lobby" | "user";
  minLevel?: number;
  perm?: string;
  system: string;
  tool: BuildTool;
  maxTokens: number;
  /** A longer limit per model call, for jobs that write a lot (code). */
  timeoutMs?: number;
  /** The current state the model should see (JSON as text), if any. */
  context?: (c: JobCtx) => Promise<string> | string;
  /** Turns the model's call into something safe to show and save. */
  clean: (raw: unknown, c: JobCtx & { given: string }) => Promise<T> | T;
};
