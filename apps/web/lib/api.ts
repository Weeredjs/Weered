"use client";

import { weeredToast } from "./toast";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const tok = localStorage.getItem("weered_token") || "";
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  } catch {
    return {};
  }
}

export type ApiFetchOptions = RequestInit & {
  silent?: boolean;
  errorLabel?: string;
};

export type ApiResult<T = any> = T & { ok?: boolean; error?: string; message?: string };

export async function apiFetch<T = any>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<ApiResult<T>> {
  const { silent, errorLabel, headers: callerHeaders, body, ...rest } = opts;
  const finalHeaders: Record<string, string> = {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...authHeaders(),
    ...((callerHeaders as Record<string, string>) || {}),
  };

  let r: Response;
  try {
    r = await fetch(`${API}${path}`, { ...rest, headers: finalHeaders, body });
  } catch (e: any) {
    if (!silent) weeredToast.error(errorLabel || "Network error. Try again.");
    return {
      ok: false,
      error: "network_error",
      message: e?.message || "Network error",
    } as ApiResult<T>;
  }

  let json: any;
  try {
    json = await r.json();
  } catch {
    json = {};
  }

  const failed = !r.ok || json?.ok === false;
  if (failed && !silent) {
    const msg =
      errorLabel || json?.message || prettyError(json?.error) || `Request failed (${r.status})`;
    if (r.status === 401) {
      weeredToast.error("Sign in required.");
    } else {
      weeredToast.error(msg);
    }
  }
  return json as ApiResult<T>;
}

const ERROR_COPY: Record<string, string> = {
  bungie_not_linked:
    'Link your Bungie account first — hit the "Link Bungie" pill in the destiny2 lobby tab bar, or open My Guardian.',
  challenge_not_active: "This challenge is no longer active.",
  challenge_expired: "This challenge has expired.",
  unauthorized: "Sign in required.",
  forbidden: "You don't have permission for that.",
  not_found: "Not found.",
  already_registered: "You're already registered.",
  already_enrolled: "You're already enrolled.",
  not_ready: "This match isn't ready yet.",
  not_reported: "Match needs to be reported first.",
  match_closed: "This match is already closed.",
  bad_winner: "Pick a valid winner.",
  no_fields: "Nothing to update.",
  format_locked: "Can't change format once entries exist.",
  entry_type_locked: "Can't change entry type once entries exist.",
  not_enough_entries: "Need more entries to start.",
  already_completed: "Already completed.",
  already_finalized: "Already finalized.",
  has_matches: "Cancel matches before deleting.",
  network_error: "Network error. Try again.",
};

function prettyError(code?: string): string | null {
  if (!code) return null;
  return ERROR_COPY[code] || null;
}
