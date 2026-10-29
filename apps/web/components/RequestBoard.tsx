"use client";

// The request board: people ask for game integrations and features, everyone
// votes, staff move requests through open → planned → building → shipped.
// Full mode is the /requests page; compact mode is a block on a lobby's Home
// canvas (fixed-height card, top N, one-line request input).

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useWeered } from "./WeeredProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

type ApiBody = {
  ok?: boolean;
  error?: string;
  message?: string;
  merged?: boolean;
  request?: BoardRequest;
  requests?: BoardRequest[];
} | null;

async function apiFetch(
  path: string,
  opts?: RequestInit,
): Promise<{ status: number; body: ApiBody }> {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  let body: ApiBody = null;
  try {
    body = await r.json();
  } catch {
    body = null;
  }
  return { status: r.status, body };
}

type Kind = "game" | "feature";
type Status = "open" | "planned" | "building" | "shipped" | "declined";
type Sort = "top" | "new";

export type BoardRequest = {
  id: string;
  kind: Kind;
  title: string;
  note: string;
  userId: string;
  userName: string;
  lobbyId: string | null;
  voteCount: number;
  status: Status;
  staffNote: string | null;
  createdAt: string;
  voted: boolean;
  pending?: boolean;
};

const STATUS_META: Record<Status, { label: string; fg: string; bg: string; bd: string }> = {
  open: {
    label: "Open",
    fg: "rgba(226,232,240,.85)",
    bg: "rgba(148,163,184,.12)",
    bd: "rgba(148,163,184,.3)",
  },
  planned: {
    label: "Planned",
    fg: "#93c5fd",
    bg: "rgba(59,130,246,.14)",
    bd: "rgba(59,130,246,.4)",
  },
  building: {
    label: "Building",
    fg: "#fcd34d",
    bg: "rgba(245,158,11,.14)",
    bd: "rgba(245,158,11,.4)",
  },
  shipped: { label: "Shipped", fg: "#86efac", bg: "rgba(34,197,94,.14)", bd: "rgba(34,197,94,.4)" },
  declined: {
    label: "Declined",
    fg: "#fca5a5",
    bg: "rgba(239,68,68,.12)",
    bd: "rgba(239,68,68,.38)",
  },
};
const STATUS_ORDER: Status[] = ["open", "planned", "building", "shipped", "declined"];
const STAFF_ROLES = new Set(["GOD", "STAFF", "ADMIN"]);

const TEXT = "var(--weered-text, rgba(243,244,246,.95))";
const MUTED = "var(--weered-muted, rgba(203,213,225,.72))";
const BORDER = "var(--weered-border, rgba(148,163,184,.18))";
const PANEL = "var(--weered-panel2, rgba(2,6,23,.92))";

function mix(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

function errorText(body: ApiBody, status: number, fallback: string): string {
  if (status === 401) return "Sign in first.";
  if (body?.error === "slow_down") return body?.message || "Five requests a day. Vote on the rest.";
  if (body?.error === "title_required") return "Give it a title (2 characters or more).";
  if (status === 403) return "Staff only.";
  return fallback;
}

const KEYFRAMES = `
@keyframes weeredReqPulse { 0%,100% { opacity: .45 } 50% { opacity: .9 } }
.weered-req-skel { animation: weeredReqPulse 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .weered-req-skel { animation: none; } }
.weered-req-btn:focus-visible, .weered-req-input:focus-visible { outline: 2px solid var(--weered-accent-1, #7c3aed); outline-offset: 2px; }
`;

export default function RequestBoard({
  lobbyId,
  compact = false,
  limit = 5,
  accent,
  title,
}: {
  lobbyId?: string;
  compact?: boolean;
  limit?: number;
  accent?: string;
  title?: string;
}) {
  const { me, globalRole } = useWeered();
  const pathname = usePathname() || "/requests";
  const signedIn = !!me;
  const isStaff = STAFF_ROLES.has(String(globalRole || "").toUpperCase());
  const color = accent || "var(--weered-accent-1, #7c3aed)";
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  const [items, setItems] = useState<BoardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [sort, setSort] = useState<Sort>("top");
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);

  const [fKind, setFKind] = useState<Kind>("game");
  const [fTitle, setFTitle] = useState("");
  const [fNote, setFNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [rowErr, setRowErr] = useState<Record<string, string>>({});

  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setLoadErr("");
    const qs = new URLSearchParams();
    qs.set("sort", compact ? "top" : sort);
    if (!compact && kindFilter !== "all") qs.set("kind", kindFilter);
    if (!compact && statusFilter) qs.set("status", statusFilter);
    try {
      const { body } = await apiFetch(`/requests?${qs.toString()}`);
      if (my !== seq.current) return;
      if (body?.ok && Array.isArray(body.requests)) setItems(body.requests);
      else setLoadErr("Couldn't load the board.");
    } catch {
      if (my !== seq.current) return;
      setLoadErr("Couldn't load the board.");
    }
    if (my === seq.current) setLoading(false);
  }, [compact, sort, kindFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load, signedIn]);

  const replaceItem = (id: string, next: BoardRequest | null) =>
    setItems((cur) =>
      next ? cur.map((r) => (r.id === id ? next : r)) : cur.filter((r) => r.id !== id),
    );

  const setRowError = (id: string, text: string) =>
    setRowErr((cur) => {
      const n = { ...cur };
      if (text) n[id] = text;
      else delete n[id];
      return n;
    });

  const toggleVote = async (r: BoardRequest) => {
    if (r.pending) return;
    const before = r;
    const optimistic: BoardRequest = {
      ...r,
      voted: !r.voted,
      voteCount: Math.max(0, r.voteCount + (r.voted ? -1 : 1)),
    };
    replaceItem(r.id, optimistic);
    setRowError(r.id, "");
    try {
      const { status, body } = await apiFetch(`/requests/${encodeURIComponent(r.id)}/vote`, {
        method: "POST",
        body: "{}",
      });
      if (body?.ok && body.request) replaceItem(r.id, { ...body.request });
      else {
        replaceItem(r.id, before);
        setRowError(r.id, errorText(body, status, "Vote didn't count. Try again."));
      }
    } catch {
      replaceItem(r.id, before);
      setRowError(r.id, "Vote didn't count. Try again.");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = fTitle.trim();
    if (t.length < 2 || submitting) return;
    const kind: Kind = compact ? "game" : fKind;
    const note = compact ? "" : fNote.trim();
    const tmpId = `tmp-${Date.now()}`;
    const temp: BoardRequest = {
      id: tmpId,
      kind,
      title: t,
      note,
      userId: String(me?.id || ""),
      userName: String(me?.name || me?.username || "You"),
      lobbyId: lobbyId || null,
      voteCount: 1,
      status: "open",
      staffNote: null,
      createdAt: new Date().toISOString(),
      voted: true,
      pending: true,
    };
    setSubmitting(true);
    setNotice(null);
    setItems((cur) => [temp, ...cur]);
    try {
      const { status, body } = await apiFetch(`/requests`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          title: t,
          note: note || undefined,
          lobbyId: lobbyId || undefined,
        }),
      });
      if (body?.ok && body.request) {
        const saved: BoardRequest = body.request;
        if (body.merged) {
          setItems((cur) => {
            const rest = cur.filter((r) => r.id !== tmpId);
            return rest.some((r) => r.id === saved.id)
              ? rest.map((r) => (r.id === saved.id ? saved : r))
              : [saved, ...rest];
          });
          setNotice({
            tone: "ok",
            text: "Merged into an existing request. Your vote is on it.",
          });
        } else {
          setItems((cur) => cur.map((r) => (r.id === tmpId ? saved : r)));
          setNotice({ tone: "ok", text: "Request posted. Your vote is on it." });
        }
        setFTitle("");
        setFNote("");
      } else {
        setItems((cur) => cur.filter((r) => r.id !== tmpId));
        setNotice({ tone: "err", text: errorText(body, status, "Couldn't post that request.") });
      }
    } catch {
      setItems((cur) => cur.filter((r) => r.id !== tmpId));
      setNotice({ tone: "err", text: "Couldn't post that request." });
    }
    setSubmitting(false);
  };

  const staffPatch = async (
    r: BoardRequest,
    patch: { status?: Status; staffNote?: string },
  ): Promise<boolean> => {
    const before = r;
    replaceItem(r.id, { ...before, ...patch });
    setRowError(r.id, "");
    try {
      const { status, body } = await apiFetch(`/requests/${encodeURIComponent(r.id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (body?.ok && body.request) {
        replaceItem(r.id, { ...body.request });
        return true;
      }
      replaceItem(r.id, before);
      setRowError(r.id, errorText(body, status, "Update failed."));
    } catch {
      replaceItem(r.id, before);
      setRowError(r.id, "Update failed.");
    }
    return false;
  };

  const shown = compact ? items.slice(0, Math.max(1, limit)) : items;

  // ── shared pieces ────────────────────────────────────────────────────────
  const inputStyle: CSSProperties = {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: compact ? "7px 10px" : "9px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(0,0,0,.28)",
    color: TEXT,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  };

  const pill = (active: boolean): CSSProperties => ({
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? color : "rgba(255,255,255,.14)"}`,
    background: active ? mix(color, 18) : "transparent",
    color: active ? TEXT : MUTED,
    fontSize: 12.5,
    fontWeight: 650,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  });

  const voteButton = (r: BoardRequest) => {
    const size = compact ? 40 : 52;
    const style: CSSProperties = {
      flexShrink: 0,
      width: size,
      minHeight: size,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      borderRadius: 10,
      border: `1px solid ${r.voted ? color : "rgba(255,255,255,.14)"}`,
      background: r.voted ? color : "rgba(255,255,255,.03)",
      color: r.voted ? "#fff" : TEXT,
      cursor: r.pending ? "default" : "pointer",
      fontFamily: "inherit",
      textDecoration: "none",
      opacity: r.pending ? 0.6 : 1,
      padding: 0,
      lineHeight: 1,
    };
    const inner = (
      <>
        <span aria-hidden="true" style={{ fontSize: compact ? 11 : 13 }}>
          ▲
        </span>
        <span style={{ fontSize: compact ? 12.5 : 15, fontWeight: 800 }}>{r.voteCount}</span>
      </>
    );
    if (!signedIn) {
      return (
        <Link
          href={loginHref}
          className="weered-req-btn"
          aria-label={`Sign in to vote for ${r.title} (${r.voteCount} votes)`}
          title="Sign in to vote"
          style={style}
        >
          {inner}
        </Link>
      );
    }
    return (
      <button
        type="button"
        className="weered-req-btn"
        onClick={() => void toggleVote(r)}
        disabled={r.pending}
        aria-pressed={r.voted}
        aria-label={`${r.voted ? "Remove your vote for" : "Vote for"} ${r.title} (${r.voteCount} votes)`}
        style={style}
      >
        {inner}
      </button>
    );
  };

  const statusPill = (s: Status, small = false) => {
    const m = STATUS_META[s] || STATUS_META.open;
    return (
      <span
        style={{
          display: "inline-block",
          padding: small ? "1px 7px" : "2px 9px",
          borderRadius: 999,
          border: `1px solid ${m.bd}`,
          background: m.bg,
          color: m.fg,
          fontSize: small ? 10.5 : 11,
          fontWeight: 700,
          letterSpacing: ".2px",
          whiteSpace: "nowrap",
        }}
      >
        {m.label}
      </span>
    );
  };

  const skeleton = (n: number) => (
    <div aria-busy="true" aria-label="Loading requests" style={{ display: "grid", gap: 8 }}>
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="weered-req-skel"
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: compact ? 6 : 12,
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
          }}
        >
          <div
            style={{
              width: compact ? 40 : 52,
              height: compact ? 40 : 52,
              borderRadius: 10,
              background: "rgba(255,255,255,.07)",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, display: "grid", gap: 6 }}>
            <div
              style={{
                height: 12,
                width: "60%",
                borderRadius: 6,
                background: "rgba(255,255,255,.08)",
              }}
            />
            {!compact && (
              <div
                style={{
                  height: 10,
                  width: "35%",
                  borderRadius: 6,
                  background: "rgba(255,255,255,.05)",
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const errorBox = (
    <div
      role="alert"
      style={{
        padding: compact ? 10 : 16,
        borderRadius: 10,
        border: "1px solid rgba(239,68,68,.35)",
        background: "rgba(239,68,68,.08)",
        color: "#fca5a5",
        fontSize: 13,
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{loadErr}</span>
      <button
        type="button"
        className="weered-req-btn"
        onClick={() => void load()}
        style={pill(false)}
      >
        Retry
      </button>
    </div>
  );

  const emptyBox = (
    <div
      style={{
        padding: compact ? "14px 10px" : "32px 16px",
        borderRadius: 10,
        border: `1px dashed ${BORDER}`,
        textAlign: "center",
        color: MUTED,
        fontSize: 13,
      }}
    >
      Nothing yet. Be first.
    </div>
  );

  const noticeLine = notice && (
    <div
      role="status"
      style={{
        fontSize: 12.5,
        color: notice.tone === "ok" ? "#86efac" : "#fca5a5",
      }}
    >
      {notice.text}
    </div>
  );

  // ── compact mode ─────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div
        style={{
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          color: TEXT,
          minWidth: 0,
        }}
      >
        <style>{KEYFRAMES}</style>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title || "Most requested"}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "grid",
            gap: 6,
            alignContent: "start",
          }}
        >
          {loading && items.length === 0
            ? skeleton(Math.min(3, limit))
            : loadErr
              ? errorBox
              : shown.length === 0
                ? emptyBox
                : shown.map((r) => (
                    <div
                      key={r.id}
                      style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}
                    >
                      {voteButton(r)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          title={r.title}
                          style={{
                            fontSize: 13,
                            fontWeight: 650,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.title}
                        </div>
                        <div
                          style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}
                        >
                          {statusPill(r.status, true)}
                          <span style={{ fontSize: 11, color: MUTED }}>
                            {r.kind === "feature" ? "Feature" : "Game"}
                          </span>
                        </div>
                        {rowErr[r.id] && (
                          <div
                            role="alert"
                            style={{ fontSize: 11, color: "#fca5a5", marginTop: 2 }}
                          >
                            {rowErr[r.id]}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
        </div>
        {signedIn ? (
          <form onSubmit={submit} style={{ display: "flex", gap: 6, minWidth: 0 }}>
            <label style={{ flex: 1, minWidth: 0, display: "flex" }}>
              <span style={visuallyHidden}>Request a game</span>
              <input
                className="weered-req-input"
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                placeholder="Request a game…"
                maxLength={80}
                style={inputStyle}
              />
            </label>
            <button
              type="submit"
              className="weered-req-btn"
              disabled={submitting || fTitle.trim().length < 2}
              aria-label="Submit request"
              style={{
                flexShrink: 0,
                padding: "0 12px",
                borderRadius: 8,
                border: `1px solid ${color}`,
                background: mix(color, 22),
                color: TEXT,
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                opacity: submitting || fTitle.trim().length < 2 ? 0.55 : 1,
              }}
            >
              {submitting ? "…" : "Add"}
            </button>
          </form>
        ) : (
          <Link
            href={loginHref}
            style={{
              fontSize: 12.5,
              color: TEXT,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Sign in to vote or request a game
          </Link>
        )}
        {noticeLine}
        <Link
          href="/requests"
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color,
            textDecoration: "none",
            alignSelf: "flex-start",
          }}
        >
          See the full board →
        </Link>
      </div>
    );
  }

  // ── full mode ────────────────────────────────────────────────────────────
  const kindTabs: { key: "all" | Kind; label: string }[] = [
    { key: "game", label: "Games" },
    { key: "feature", label: "Features" },
    { key: "all", label: "All" },
  ];
  const statusChips: Status[] = isStaff
    ? ["open", "planned", "building", "shipped", "declined"]
    : ["open", "planned", "building", "shipped"];

  return (
    <div style={{ color: TEXT, display: "grid", gap: 16, minWidth: 0 }}>
      <style>{KEYFRAMES}</style>
      <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: "-0.3px" }}>
        {title || "What should Weered build next?"}
      </h2>

      {/* Submit */}
      <section
        aria-label="Make a request"
        style={{
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          background: PANEL,
          padding: 14,
          display: "grid",
          gap: 10,
        }}
      >
        {signedIn ? (
          <form onSubmit={submit} style={{ display: "grid", gap: 10, minWidth: 0 }}>
            <div
              role="group"
              aria-label="Request type"
              style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
            >
              {(["game", "feature"] as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="weered-req-btn"
                  aria-pressed={fKind === k}
                  onClick={() => setFKind(k)}
                  style={pill(fKind === k)}
                >
                  {k === "game" ? "Game integration" : "Feature"}
                </button>
              ))}
            </div>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={visuallyHidden}>Title</span>
              <input
                className="weered-req-input"
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                placeholder={
                  fKind === "game" ? "Which game should we wire in?" : "What should Weered do?"
                }
                maxLength={80}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={visuallyHidden}>Note (optional)</span>
              <textarea
                className="weered-req-input"
                value={fNote}
                onChange={(e) => setFNote(e.target.value)}
                placeholder="Why it matters, what you'd use it for (optional)"
                maxLength={600}
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="submit"
                className="weered-req-btn"
                disabled={submitting || fTitle.trim().length < 2}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: `1px solid ${color}`,
                  background: mix(color, 22),
                  color: TEXT,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  opacity: submitting || fTitle.trim().length < 2 ? 0.55 : 1,
                }}
              >
                {submitting ? "Posting…" : "Request it"}
              </button>
              <span style={{ fontSize: 11.5, color: MUTED }}>
                Already on the board? We fold it in as your vote.
              </span>
            </div>
            {noticeLine}
          </form>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, color: MUTED, flex: 1, minWidth: 180 }}>
              Sign in to vote and request games or features.
            </span>
            <Link
              href={loginHref}
              className="weered-req-btn"
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: `1px solid ${color}`,
                background: mix(color, 22),
                color: TEXT,
                fontWeight: 800,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Sign in to vote
            </Link>
          </div>
        )}
      </section>

      {/* Filters */}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div
            role="group"
            aria-label="Request type filter"
            style={{
              display: "inline-flex",
              padding: 3,
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: "rgba(0,0,0,.2)",
            }}
          >
            {kindTabs.map((t) => {
              const active = kindFilter === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  className="weered-req-btn"
                  aria-pressed={active}
                  onClick={() => setKindFilter(t.key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 7,
                    border: "none",
                    background: active ? mix(color, 28) : "transparent",
                    color: active ? TEXT : MUTED,
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div role="group" aria-label="Sort" style={{ display: "inline-flex", gap: 6 }}>
            {(["top", "new"] as Sort[]).map((s) => (
              <button
                key={s}
                type="button"
                className="weered-req-btn"
                aria-pressed={sort === s}
                onClick={() => setSort(s)}
                style={pill(sort === s)}
              >
                {s === "top" ? "Top" : "New"}
              </button>
            ))}
          </div>
        </div>
        <div
          role="group"
          aria-label="Status filter"
          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
        >
          {statusChips.map((s) => {
            const active = statusFilter === s;
            const m = STATUS_META[s];
            return (
              <button
                key={s}
                type="button"
                className="weered-req-btn"
                aria-pressed={active}
                onClick={() => setStatusFilter(active ? null : s)}
                style={{
                  padding: "4px 11px",
                  borderRadius: 999,
                  border: `1px solid ${active ? m.bd : "rgba(255,255,255,.12)"}`,
                  background: active ? m.bg : "transparent",
                  color: active ? m.fg : MUTED,
                  fontSize: 12,
                  fontWeight: 650,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading && items.length === 0 ? (
        skeleton(5)
      ) : loadErr ? (
        errorBox
      ) : items.length === 0 ? (
        emptyBox
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {items.map((r) => (
            <RequestRow
              key={r.id}
              r={r}
              vote={voteButton(r)}
              status={statusPill(r.status)}
              isStaff={isStaff && !r.pending}
              err={rowErr[r.id] || ""}
              onPatch={(p) => staffPatch(r, p)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

function RequestRow({
  r,
  vote,
  status,
  isStaff,
  err,
  onPatch,
}: {
  r: BoardRequest;
  vote: ReactNode;
  status: ReactNode;
  isStaff: boolean;
  err: string;
  onPatch: (p: { status?: Status; staffNote?: string }) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(r.staffNote || "");
  const [saving, setSaving] = useState(false);

  const saveNote = async () => {
    setSaving(true);
    const ok = await onPatch({ staffNote: draft.trim() });
    setSaving(false);
    if (ok) setEditing(false);
  };

  const smallBtn: CSSProperties = {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(255,255,255,.04)",
    color: TEXT,
    fontSize: 11.5,
    fontWeight: 650,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <li
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: PANEL,
        minWidth: 0,
        opacity: r.pending ? 0.75 : 1,
      }}
    >
      {vote}
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
        <div
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 750,
              overflowWrap: "anywhere",
              minWidth: 0,
            }}
          >
            {r.title}
          </span>
          {status}
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".5px",
              color: MUTED,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              padding: "1px 6px",
            }}
          >
            {r.kind === "feature" ? "Feature" : "Game"}
          </span>
        </div>
        {r.note && (
          <div
            style={{
              fontSize: 13,
              color: MUTED,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              lineHeight: 1.45,
            }}
          >
            {r.note}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: MUTED }}>
          {r.pending
            ? "Posting…"
            : `Requested by ${r.userName || "someone"} · ${relTime(r.createdAt)}`}
        </div>
        {r.staffNote && !editing && (
          <div
            style={{
              borderLeft: "3px solid var(--weered-accent-1, #7c3aed)",
              background: "rgba(124,58,237,.08)",
              borderRadius: "0 8px 8px 0",
              padding: "8px 10px",
              fontSize: 13,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            <div
              style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".5px", marginBottom: 3 }}
            >
              WEERED TEAM
            </div>
            {r.staffNote}
          </div>
        )}
        {isStaff && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 11.5,
                  color: MUTED,
                }}
              >
                Status
                <select
                  className="weered-req-input"
                  value={r.status}
                  onChange={(e) => void onPatch({ status: e.target.value as Status })}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,.14)",
                    background: "rgba(0,0,0,.35)",
                    color: TEXT,
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
              </label>
              {!editing && (
                <button
                  type="button"
                  className="weered-req-btn"
                  onClick={() => {
                    setDraft(r.staffNote || "");
                    setEditing(true);
                  }}
                  style={smallBtn}
                >
                  {r.staffNote ? "Edit reply" : "Reply as staff"}
                </button>
              )}
            </div>
            {editing && (
              <div style={{ display: "grid", gap: 6 }}>
                <label>
                  <span style={visuallyHidden}>Staff reply</span>
                  <textarea
                    className="weered-req-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={400}
                    rows={2}
                    placeholder="Official reply shown on this request"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(0,0,0,.3)",
                      color: TEXT,
                      fontSize: 13,
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="weered-req-btn"
                    disabled={saving}
                    onClick={() => void saveNote()}
                    style={{ ...smallBtn, opacity: saving ? 0.55 : 1 }}
                  >
                    {saving ? "Saving…" : "Save reply"}
                  </button>
                  <button
                    type="button"
                    className="weered-req-btn"
                    onClick={() => setEditing(false)}
                    style={smallBtn}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {err && (
          <div role="alert" style={{ fontSize: 12, color: "#fca5a5" }}>
            {err}
          </div>
        )}
      </div>
    </li>
  );
}
