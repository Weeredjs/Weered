import { API_BASE } from "./config";
import { getAuthToken } from "./storage";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOptions = Omit<RequestInit, "body"> & { body?: unknown; auth?: boolean };

export async function api<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { body, auth = true, headers: hdrs, ...rest } = opts;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(hdrs as Record<string, string> | undefined),
  };
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (auth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) {
    const message = (parsed as any)?.error || (parsed as any)?.message || res.statusText || "Request failed";
    throw new ApiError(res.status, message, parsed);
  }
  return parsed as T;
}
