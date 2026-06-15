const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export async function forumFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

export function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "just now";
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return "yesterday";
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BUG_REPORT: { label: "Bug Report", color: "#ef4444", bg: "rgba(239,68,68,.12)" },
  FEATURE_REQUEST: { label: "Feature Request", color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  DISCUSSION: { label: "Discussion", color: "#22c55e", bg: "rgba(34,197,94,.12)" },
  ANNOUNCEMENT: { label: "Announcement", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
};

export const TIER_COLORS: Record<string, string> = {
  INNOCENT: "#94a3b8",
  INDICTED: "#a78bfa",
  FELON: "#f97316",
  KINGPIN: "#eab308",
};

export const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
