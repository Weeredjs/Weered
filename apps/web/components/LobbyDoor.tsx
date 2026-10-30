"use client";

// The lobby's front door, as a visitor meets it: the owner's welcome, the
// rules to accept, their questions, the 18+ and account-age gates, then the
// way in that the lobby's join mode allows (straight in, a password, a
// request for the admins to review, or a paid tier). Set in Admin → Front
// door (app/lobby/[id]/admin/FrontDoorTab.tsx); shape in lib/lobbyLayout.ts.
// Only asks: POST /lobbies/:id/join checks everything again on the server.
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import LobbyTierCards from "./LobbyTierCards";
import type { LobbyDoor as Door } from "../lib/lobbyLayout";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

const seenKey = (lobbyId: string) => `weered:door-seen:${lobbyId}`;

/** Closed with "Just looking" this session: don't open it again by itself. */
export function doorDismissed(lobbyId: string): boolean {
  try {
    return sessionStorage.getItem(seenKey(lobbyId)) === "1";
  } catch {
    return false;
  }
}

export default function LobbyDoor({
  lobbyId,
  lobbyName,
  door,
  accent = "#7c3aed",
  banner,
  joinMode = "OPEN",
  signedIn,
  pending = false,
  preview = false,
  onJoined,
  onClose,
}: {
  lobbyId: string;
  lobbyName: string;
  door: Door;
  accent?: string;
  /** The lobby's banner, used when the door has no picture of its own. */
  banner?: string | null;
  joinMode?: string;
  signedIn: boolean;
  /** They already asked to join and are waiting. */
  pending?: boolean;
  /** The owner's look from the editor: nothing is sent, and it always closes. */
  preview?: boolean;
  /** After a join or a request: reload the lobby. */
  onJoined?: () => void;
  onClose?: () => void;
}) {
  const [agree, setAgree] = useState(false);
  const [adult, setAdult] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(pending);
  useEffect(() => setSent(pending), [pending]);

  const mode = (joinMode || "OPEN").toUpperCase();
  // An Open lobby can be looked round first, unless the owner locked it; any
  // other join mode keeps the door up (the lobby is closed to them anyway)
  // until they're in or have asked.
  const canClose = preview || sent || (!door.lock && mode === "OPEN");
  const image = door.image || banner || "";
  const title = door.title || `Welcome to ${lobbyName}`;

  // What's still missing before the way in opens up.
  const missing = useMemo(() => {
    const m: string[] = [];
    if (door.rules.length && !agree) m.push("accept the rules");
    if (door.age18 && !adult) m.push("confirm you're 18 or older");
    const unanswered = door.questions.filter((q) => q.required && !(answers[q.id] || "").trim());
    if (unanswered.length)
      m.push(unanswered.length === 1 ? "answer the question" : "answer the questions");
    if (mode === "PASSWORD" && !password.trim()) m.push("enter the password");
    return m;
  }, [door, agree, adult, answers, mode, password]);

  useEffect(() => {
    if (!canClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canClose]);

  function close() {
    if (!preview) {
      try {
        sessionStorage.setItem(seenKey(lobbyId), "1");
      } catch {}
    }
    onClose?.();
  }

  async function enter() {
    if (preview || busy || missing.length) return;
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        acceptRules: door.rules.length ? agree : undefined,
        age18: door.age18 ? adult : undefined,
        answers,
      };
      if (mode === "PASSWORD") body.password = password;
      if (mode === "APPROVAL") body.message = note;
      const r = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/join`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) {
        if (j.pending) setSent(true);
        // Reload the lobby either way: in, or holding a pending request.
        onJoined?.();
      } else {
        setError(j?.message || j?.error || "That didn't work. Try again.");
      }
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  const field: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(0,0,0,.35)",
    color: "#fff",
    fontFamily: "inherit",
    fontSize: 14,
    outline: "none",
  };
  const tick = (on: boolean): React.CSSProperties => ({
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: 6,
    display: "grid",
    placeItems: "center",
    fontSize: 13,
    fontWeight: 900,
    color: "#fff",
    border: `1.5px solid ${on ? accent : "rgba(255,255,255,.35)"}`,
    background: on ? accent : "transparent",
  });
  const sectionLabel: React.CSSProperties = {
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: ".12em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,.55)",
    margin: "18px 0 8px",
  };
  const ready = missing.length === 0;
  const cta =
    mode === "APPROVAL"
      ? "Ask to join"
      : door.button || (mode === "PASSWORD" ? "Unlock" : "Come in");

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lobby-door-title"
      className="weered-lobby-door"
      onClick={(e) => {
        if (canClose && e.target === e.currentTarget) close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 12,
        background: door.lock && !preview ? "rgba(6,6,12,.94)" : "rgba(6,6,12,.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(560px, 100%)",
          maxHeight: "calc(100dvh - 24px)",
          overflowY: "auto",
          borderRadius: 20,
          border: `1px solid ${accent}55`,
          background: "linear-gradient(180deg, rgba(22,20,34,.98), rgba(10,10,18,.98))",
          boxShadow: `0 40px 90px -30px ${accent}88, 0 0 0 1px rgba(255,255,255,.04)`,
          color: "#fff",
        }}
      >
        {preview && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              zIndex: 2,
              padding: "3px 9px",
              borderRadius: 999,
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: ".08em",
              background: "rgba(0,0,0,.6)",
              border: "1px solid rgba(255,255,255,.25)",
            }}
          >
            PREVIEW
          </div>
        )}
        {canClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 2,
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.2)",
              background: "rgba(0,0,0,.45)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        )}
        <div
          style={{
            height: image ? 150 : 70,
            borderRadius: "20px 20px 0 0",
            background: image
              ? `linear-gradient(180deg, transparent 30%, rgba(14,13,24,.98)), url("${image.replace(/"/g, "%22")}") center / cover no-repeat`
              : `radial-gradient(120% 140% at 0% 0%, ${accent}66, transparent 60%)`,
          }}
        />
        <div style={{ padding: "0 24px 22px", marginTop: image ? -34 : -18, position: "relative" }}>
          <h2
            id="lobby-door-title"
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: "-.01em",
              lineHeight: 1.15,
            }}
          >
            {title}
          </h2>
          {door.body && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 14,
                lineHeight: 1.55,
                color: "rgba(255,255,255,.78)",
                whiteSpace: "pre-wrap",
              }}
            >
              {door.body}
            </p>
          )}

          {sent ? (
            <div
              style={{
                marginTop: 18,
                padding: "14px 16px",
                borderRadius: 12,
                border: `1px solid ${accent}55`,
                background: `${accent}18`,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <b>Request sent.</b> The lobby&apos;s admins will look at it and let you in.
            </div>
          ) : (
            <>
              {door.rules.length > 0 && (
                <>
                  <div style={sectionLabel}>The rules</div>
                  <ol
                    style={{
                      margin: 0,
                      listStyle: "decimal outside",
                      padding: "12px 14px 12px 34px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,.1)",
                      background: "rgba(255,255,255,.03)",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      color: "rgba(255,255,255,.88)",
                    }}
                  >
                    {door.rules.map((r, i) => (
                      <li key={i} style={{ margin: "2px 0" }}>
                        {r}
                      </li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={agree}
                    onClick={() => setAgree(!agree)}
                    style={checkRow}
                  >
                    <span style={tick(agree)}>{agree ? "✓" : ""}</span>
                    I&apos;ve read the rules and I&apos;ll follow them
                  </button>
                </>
              )}

              {door.age18 && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={adult}
                  onClick={() => setAdult(!adult)}
                  style={{ ...checkRow, marginTop: door.rules.length ? 6 : 18 }}
                >
                  <span style={tick(adult)}>{adult ? "✓" : ""}</span>
                  I&apos;m 18 or older
                </button>
              )}

              {door.questions.length > 0 && (
                <>
                  <div style={sectionLabel}>A few questions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {door.questions.map((q) => {
                      // A label round the option buttons would hand every
                      // click on the question to the first option.
                      const Wrap = q.kind === "choice" ? "div" : "label";
                      return (
                        <Wrap key={q.id} style={{ display: "block" }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 13.5,
                              fontWeight: 700,
                              marginBottom: 6,
                            }}
                          >
                            {q.q}
                            {q.required ? (
                              <span style={{ color: accent }}> *</span>
                            ) : (
                              <span style={{ opacity: 0.5, fontWeight: 500 }}> (optional)</span>
                            )}
                          </span>
                          {q.kind === "choice" ? (
                            <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {q.options.map((o) => {
                                const on = answers[q.id] === o;
                                return (
                                  <button
                                    key={o}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() =>
                                      setAnswers((a) => ({ ...a, [q.id]: on ? "" : o }))
                                    }
                                    style={{
                                      padding: "7px 13px",
                                      borderRadius: 999,
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: "#fff",
                                      border: `1px solid ${on ? accent : "rgba(255,255,255,.18)"}`,
                                      background: on ? `${accent}44` : "rgba(255,255,255,.04)",
                                    }}
                                  >
                                    {o}
                                  </button>
                                );
                              })}
                            </span>
                          ) : (
                            <input
                              value={answers[q.id] || ""}
                              maxLength={500}
                              onChange={(e) =>
                                setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                              }
                              style={field}
                            />
                          )}
                        </Wrap>
                      );
                    })}
                  </div>
                </>
              )}

              {door.minAccountDays > 0 && (
                <div style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                  Accounts newer than {door.minAccountDays} day
                  {door.minAccountDays === 1 ? "" : "s"} can&apos;t join yet.
                </div>
              )}

              {!signedIn && !preview ? (
                <a
                  href={`/login?next=${encodeURIComponent(`/lobby/${lobbyId}`)}`}
                  style={{
                    ...primary(accent, true),
                    display: "block",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Sign in to join
                </a>
              ) : mode === "PAID" ? (
                <>
                  <div style={sectionLabel}>Pick a tier to get in</div>
                  <LobbyTierCards lobbyId={lobbyId} />
                </>
              ) : (
                <>
                  {mode === "PASSWORD" && (
                    <>
                      <div style={sectionLabel}>Password</div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void enter();
                        }}
                        style={field}
                      />
                    </>
                  )}
                  {mode === "APPROVAL" && (
                    <>
                      <div style={sectionLabel}>Anything else? (optional)</div>
                      <textarea
                        value={note}
                        maxLength={500}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        style={{ ...field, resize: "vertical" }}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    disabled={!ready || busy}
                    onClick={() => void enter()}
                    style={primary(accent, ready && !busy)}
                  >
                    {busy ? "One moment…" : cta}
                  </button>
                  {!ready && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: "rgba(255,255,255,.55)",
                        textAlign: "center",
                      }}
                    >
                      To get in: {missing.join(", ")}.
                    </div>
                  )}
                </>
              )}
              {error && (
                <div style={{ marginTop: 10, fontSize: 13, color: "#fca5a5", textAlign: "center" }}>
                  {error}
                </div>
              )}
            </>
          )}

          {!canClose && !preview && (
            <a
              href="/home"
              style={{
                display: "block",
                margin: "14px auto 0",
                textAlign: "center",
                color: "rgba(255,255,255,.6)",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              ← Not now, back to Weered
            </a>
          )}
          {canClose && !preview && (
            <button
              type="button"
              onClick={close}
              style={{
                display: "block",
                margin: "14px auto 0",
                border: 0,
                background: "transparent",
                color: "rgba(255,255,255,.6)",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {sent ? "Close" : "Just looking →"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const checkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  marginTop: 10,
  padding: "8px 2px",
  border: 0,
  background: "transparent",
  color: "#fff",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 700,
  textAlign: "left",
  cursor: "pointer",
};

function primary(accent: string, on: boolean): React.CSSProperties {
  return {
    width: "100%",
    marginTop: 18,
    padding: "13px 16px",
    borderRadius: 12,
    border: 0,
    cursor: on ? "pointer" : "not-allowed",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: ".01em",
    color: "#fff",
    background: on ? accent : "rgba(255,255,255,.1)",
    boxShadow: on ? `0 14px 30px -12px ${accent}` : "none",
    opacity: on ? 1 : 0.7,
  };
}
