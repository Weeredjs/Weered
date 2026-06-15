"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function normalizeCode(s: string): string {
  return s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function ConnectMinecraftInner() {
  const params = useSearchParams();
  const initialCode = normalizeCode(params?.get("code") || "");

  const [code, setCode] = useState(initialCode);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setLoggedIn(!!localStorage.getItem("weered_user"));
    } catch {
      setLoggedIn(false);
    }
  }, []);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`${API}/mc/pair/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ code: normalizeCode(code) }),
      });
      const j = await r.json();
      if (j?.ok) {
        setDone(true);
      } else {
        setError(j?.error || "Failed to confirm. Try a fresh code from the mod.");
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "var(--weered-bg, #080810)",
        color: "rgba(243,244,246,.92)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          padding: 28,
          borderRadius: 14,
          background: "rgba(255,255,255,.03)",
          border: "1px solid rgba(124,58,237,.25)",
        }}
      >
        <div style={{ fontSize: 30, textAlign: "center", marginBottom: 8 }}>⛏️</div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            textAlign: "center",
            margin: "0 0 6px",
            color: "rgb(216,180,254)",
          }}
        >
          Link Minecraft to Weered
        </h1>
        <p
          style={{
            fontSize: 12,
            opacity: 0.6,
            textAlign: "center",
            margin: "0 0 22px",
            lineHeight: 1.5,
          }}
        >
          Confirm the code shown in-game by the Weered Connect mod. Pairing this code links your
          Minecraft account to your Weered account on this device.
        </p>

        {loggedIn === false && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: "rgba(245,158,11,.10)",
              border: "1px solid rgba(245,158,11,.30)",
              color: "rgb(253,230,138)",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            You need to be signed in to Weered to pair.
            <div style={{ marginTop: 8 }}>
              <a
                href={`/login?next=${encodeURIComponent(`/connect/minecraft?code=${code}`)}`}
                style={{ color: "rgb(253,230,138)", fontWeight: 700, textDecoration: "underline" }}
              >
                Sign in to continue
              </a>
            </div>
          </div>
        )}

        {!done && (
          <>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                opacity: 0.5,
                letterSpacing: ".7px",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Pairing code
            </label>
            <input
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="ABCD1234"
              maxLength={8}
              spellCheck={false}
              autoCapitalize="characters"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.10)",
                background: "rgba(0,0,0,.30)",
                fontSize: 22,
                letterSpacing: 4,
                fontWeight: 700,
                textAlign: "center",
                color: "rgb(216,180,254)",
                outline: "none",
                fontFamily: "monospace",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={confirm}
              disabled={submitting || code.length !== 8 || loggedIn === false}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid rgba(124,58,237,.45)",
                background:
                  submitting || code.length !== 8 ? "rgba(124,58,237,.05)" : "rgba(124,58,237,.18)",
                color: "rgb(216,180,254)",
                fontWeight: 700,
                fontSize: 14,
                cursor:
                  submitting || code.length !== 8 || loggedIn === false ? "not-allowed" : "pointer",
                opacity: submitting || code.length !== 8 || loggedIn === false ? 0.5 : 1,
                fontFamily: "inherit",
                letterSpacing: ".3px",
              }}
            >
              {submitting ? "Linking..." : "Confirm pairing"}
            </button>
            {error && (
              <div
                style={{
                  marginTop: 14,
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(239,68,68,.08)",
                  border: "1px solid rgba(239,68,68,.25)",
                  color: "rgb(252,165,165)",
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}
          </>
        )}

        {done && (
          <div
            style={{
              padding: 18,
              borderRadius: 10,
              background: "rgba(16,185,129,.08)",
              border: "1px solid rgba(16,185,129,.30)",
              color: "rgb(167,243,208)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>✓</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Linked.</div>
            <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>
              Return to Minecraft. The mod should pick up the link within a few seconds.
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,.06)",
            fontSize: 11,
            opacity: 0.5,
            lineHeight: 1.6,
          }}
        >
          The Weered Connect mod sends your Minecraft username, UUID, and the address of the server
          you join to api.weered.ca. It does NOT send chat, location, inventory, or any in-game
          data. You can unlink anytime from your Weered settings.
        </div>
      </div>
    </div>
  );
}

export default function ConnectMinecraftPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#080810",
            color: "rgba(243,244,246,.4)",
          }}
        >
          Loading...
        </div>
      }
    >
      <ConnectMinecraftInner />
    </Suspense>
  );
}
