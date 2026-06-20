"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

type BanRow = { id: string; name: string; banReason: string | null; bannedAt: string | null };

export default function BanCourtPage() {
  const [rows, setRows] = useState<BanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAppeal, setShowAppeal] = useState(false);

  useEffect(() => {
    fetch(`${API}/bans/public`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setRows(j.rows || []);
          setTotal(Number(j.total || 0));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c0b0a",
        color: "#e8e8f0",
        fontFamily: "monospace",
        padding: "60px 20px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.5, margin: 0 }}>
            BAN COURT
          </h1>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#f5b700", letterSpacing: 2 }}>
            WEERED
          </span>
        </div>
        <p
          style={{
            fontSize: 13,
            color: "rgba(203,213,225,0.6)",
            lineHeight: 1.6,
            marginBottom: 32,
            maxWidth: 620,
          }}
        >
          Public record of accounts currently banned from Weered. If you've been banned and think it
          was wrong, file an appeal. It goes to a human queue.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 12, color: "rgba(148,163,184,0.7)" }}>
            <span style={{ color: "#fca5a5", fontWeight: 700 }}>{total}</span> banned · showing{" "}
            {rows.length}
          </div>
          <button
            onClick={() => setShowAppeal((v) => !v)}
            style={{
              background: showAppeal
                ? "rgba(239,68,68,0.15)"
                : "linear-gradient(135deg, rgba(124,58,237,0.85), rgba(217,70,239,0.75))",
              border: showAppeal
                ? "1px solid rgba(239,68,68,0.4)"
                : "1px solid rgba(124,58,237,0.45)",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: 10,
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {showAppeal ? "Close" : "File an appeal"}
          </button>
        </div>

        {showAppeal && <AppealForm onClose={() => setShowAppeal(false)} />}

        <div
          style={{
            background: "rgba(20,18,28,0.7)",
            border: "1px solid rgba(124,58,237,0.18)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {loading && (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "rgba(148,163,184,0.5)",
                fontSize: 13,
              }}
            >
              Loading…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "rgba(148,163,184,0.5)",
                fontSize: 13,
              }}
            >
              No active bans. Behave yourselves.
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr 140px",
                gap: 14,
                padding: "12px 18px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.name}
              </div>
              <div style={{ fontSize: 12, color: "rgba(203,213,225,0.7)", lineHeight: 1.5 }}>
                {r.banReason || (
                  <span style={{ opacity: 0.4, fontStyle: "italic" }}>no reason given</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", textAlign: "right" }}>
                {r.bannedAt ? new Date(r.bannedAt).toLocaleDateString() : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppealForm({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    setErr("");
    if (!username.trim() || !password.trim()) return setErr("Username and password required.");
    if (reason.trim().length < 20) return setErr("Tell us at least 20 characters of context.");
    setBusy(true);
    try {
      const r = await fetch(`${API}/bans/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password,
          reason: reason.trim(),
        }),
      });
      const j = await r.json().catch(() => ({}) as any);
      if (!r.ok) throw new Error(j?.message || j?.error || "Submission failed.");
      setDone(true);
    } catch (e: any) {
      setErr(String(e?.message || "Network error."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: "rgba(20,18,28,0.85)",
        border: "1px solid rgba(239,68,68,0.25)",
        borderRadius: 12,
        padding: 22,
        marginBottom: 22,
      }}
    >
      {done ? (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div style={{ fontSize: 16, color: "#34d399", marginBottom: 8 }}>Appeal submitted.</div>
          <div style={{ fontSize: 12, color: "rgba(148,163,184,0.6)", lineHeight: 1.7 }}>
            A human will review it. You'll see the result the next time you try to sign in.
          </div>
          <button
            onClick={onClose}
            style={{
              marginTop: 16,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(167,139,250,0.6)",
              padding: "8px 18px",
              borderRadius: 8,
              fontSize: 11,
              fontFamily: "inherit",
              textTransform: "uppercase",
              letterSpacing: 1,
              cursor: "pointer",
            }}
          >
            close
          </button>
        </div>
      ) : (
        <>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}
          >
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                padding: "11px 13px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#f3f4f6",
                fontFamily: "inherit",
                fontSize: 13,
                outline: "none",
              }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              type="password"
              style={{
                padding: "11px 13px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#f3f4f6",
                fontFamily: "inherit",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why should this ban be lifted? Include context, what changed, what you'll do differently."
            rows={5}
            maxLength={2000}
            style={{
              width: "100%",
              padding: "11px 13px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#f3f4f6",
              fontFamily: "inherit",
              fontSize: 13,
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
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
            <span style={{ fontSize: 10, color: "rgba(148,163,184,0.4)" }}>
              {reason.length} / 2000
            </span>
            <span style={{ fontSize: 10, color: "rgba(148,163,184,0.4)" }}>
              One pending appeal at a time.
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
              marginTop: 16,
              width: "100%",
              padding: 13,
              background: "linear-gradient(135deg, rgba(124,58,237,0.85), rgba(217,70,239,0.75))",
              border: "1px solid rgba(124,58,237,0.45)",
              borderRadius: 10,
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? "submitting…" : "submit appeal"}
          </button>
        </>
      )}
    </div>
  );
}
