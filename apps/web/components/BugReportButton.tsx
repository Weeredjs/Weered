"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { onActivate } from "@/lib/a11y";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

const HIDE_ON_PREFIXES = ["/staff", "/room/", "/lobby/", "/overlay/"];

function authHeader(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

type Category = "BUG" | "LOBBY_MODULE_REQUEST" | "FEEDBACK";

const CATEGORY_LABELS: Record<Category, { label: string; placeholder: string }> = {
  BUG: {
    label: "Bug",
    placeholder: "What broke? Steps to reproduce help. Include the URL if you can.",
  },
  LOBBY_MODULE_REQUEST: {
    label: "Request a module",
    placeholder: "Which lobby? What kind of module? What should it do?",
  },
  FEEDBACK: { label: "Feedback / suggestion", placeholder: "What should we change or add?" },
};

export default function BugReportButton() {
  const pathname = usePathname() || "";
  const hidden = HIDE_ON_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("BUG");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  if (hidden) return null;

  async function submit() {
    setErr("");
    if (body.trim().length < 10) return setErr("Tell us at least 10 characters of context.");
    setBusy(true);
    try {
      const res = await fetch(`${API}/bugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          body: body.trim(),
          category,
          page: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      });
      const j = await res.json().catch(() => ({}) as any);
      if (!res.ok) throw new Error(j?.message || j?.error || "Failed.");
      setDone(true);
      setBody("");
      setTimeout(() => {
        setOpen(false);
        setDone(false);
      }, 2000);
    } catch (e: any) {
      setErr(String(e?.message || "Network error."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setErr("");
          setDone(false);
        }}
        title="Report a bug"
        style={{
          position: "fixed",
          bottom: 36,
          right: 12,
          zIndex: 9998,
          background: "rgba(20,18,28,0.85)",
          border: "1px solid rgba(124,58,237,0.35)",
          color: "rgba(216,180,254,0.85)",
          padding: "5px 11px",
          borderRadius: 999,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        }}
      >
        🐛 feedback
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          onKeyDown={onActivate(() => setOpen(false))}
          tabIndex={0}
          role="button"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 9999,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            role="button"
            tabIndex={0}
            style={{
              width: "min(520px, 100%)",
              background: "rgba(20,18,28,0.96)",
              border: "1px solid rgba(124,58,237,0.30)",
              borderRadius: 14,
              padding: 22,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              color: "#e8e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800 }}>Send feedback</div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(148,163,184,0.6)",
                  fontSize: 18,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            {done ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "#34d399", marginBottom: 6 }}>
                  Thanks. Sent to the queue.
                </div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)" }}>We'll get to it.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      style={{
                        flex: 1,
                        padding: "8px 6px",
                        borderRadius: 8,
                        border: `1px solid ${category === c ? "rgba(124,58,237,0.45)" : "rgba(255,255,255,0.08)"}`,
                        background:
                          category === c ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                        color: category === c ? "rgba(216,180,254,0.95)" : "rgba(148,163,184,0.7)",
                        fontFamily: "inherit",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        letterSpacing: 0.4,
                      }}
                    >
                      {CATEGORY_LABELS[c].label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={CATEGORY_LABELS[category].placeholder}
                  rows={6}
                  maxLength={4000}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "11px 13px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 8,
                    color: "#f3f4f6",
                    fontFamily: "inherit",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                    lineHeight: 1.5,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 8,
                  }}
                >
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,0.5)" }}>
                    {body.length} / 4000 · page + browser captured automatically
                  </span>
                </div>
                {err && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 14px",
                      background: "rgba(239,68,68,0.10)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      borderRadius: 8,
                      color: "rgba(254,202,202,0.95)",
                      fontSize: 12,
                    }}
                  >
                    {err}
                  </div>
                )}
                <button
                  onClick={submit}
                  disabled={busy}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    padding: 12,
                    background:
                      "linear-gradient(135deg, rgba(124,58,237,0.85), rgba(217,70,239,0.75))",
                    border: "1px solid rgba(124,58,237,0.45)",
                    borderRadius: 10,
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  {busy ? "submitting…" : "submit"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
