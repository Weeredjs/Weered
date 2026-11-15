"use client";

// A lobby built for someone, waiting for them to take it (api routes/handover.ts,
// James 2026-11-15: the streamer campaign). Signed in, one button and it's theirs.
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAccent, safeAccent, safeImage } from "../../../lib/brandSafe";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function hasCachedUser(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem("weered_user") || "null")?.id;
  } catch {
    return false;
  }
}

type Shown = {
  id: string;
  name: string;
  description: string;
  accentColor: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
};

export default function HandoverPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token || "");
  const [lobby, setLobby] = useState<Shown | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "taking" | "done" | "gone" | "error">(
    "loading",
  );
  const [msg, setMsg] = useState("");
  const signIn = () => router.push(`/login?next=${encodeURIComponent(`/handover/${token}`)}`);

  useEffect(() => {
    fetch(`${API}/handover/${encodeURIComponent(token)}`)
      .then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }))
      .then(({ status, j }) => {
        if (j?.ok && j.lobby) {
          setLobby(j.lobby);
          setState("ready");
        } else setState(status === 410 || status === 404 ? "gone" : "error");
      })
      .catch(() => setState("error"));
  }, [token]);

  async function take() {
    if (!hasCachedUser()) return signIn();
    setState("taking");
    const r = await fetch(`${API}/handover/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: "{}",
    }).catch(() => null);
    if (r?.status === 401) return signIn();
    const j = r ? await r.json().catch(() => null) : null;
    if (j?.ok && j.lobbyId) {
      setState("done");
      setTimeout(() => router.push(`/lobby/${encodeURIComponent(j.lobbyId)}`), 1400);
      return;
    }
    if (j?.error === "spent" || j?.error === "expired" || r?.status === 404) setState("gone");
    else {
      setMsg(
        j?.error === "account_needed"
          ? "Make a Weered account first (it's free), then open this link again."
          : "That didn't work. Try again in a moment.",
      );
      setState("ready");
    }
  }

  const accent = safeAccent(lobby?.accentColor, "#7c3aed");
  const logo = safeImage(lobby?.logoUrl || "");
  const banner = safeImage(lobby?.bannerUrl || "");
  const page: React.CSSProperties = {
    minHeight: "var(--weered-page-h, 100vh)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--weered-bg, #080810)",
    color: "rgba(243,244,246,.92)",
    fontFamily: "system-ui, sans-serif",
    padding: 24,
  };
  const card: React.CSSProperties = {
    width: "100%",
    maxWidth: 440,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.04)",
    overflow: "hidden",
    boxShadow: "0 24px 80px rgba(0,0,0,.6)",
  };
  const body: React.CSSProperties = {
    padding: "28px 30px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    textAlign: "center",
  };

  if (state === "loading") return <div style={page} />;

  if (state === "gone" || state === "error" || !lobby)
    return (
      <div style={page}>
        <div style={card}>
          <div style={body}>
            <div style={{ fontWeight: 800, fontSize: 19 }}>
              {state === "gone"
                ? "This link has been used or has run out."
                : "Couldn't open this link."}
            </div>
            <div style={{ opacity: 0.6, fontSize: 14, lineHeight: 1.5 }}>
              {state === "gone"
                ? "If the lobby is yours, it's in your Weered already. If not, reply to the email it came in and we'll send a new one."
                : "Check your connection and try again."}
            </div>
            <a href="/" style={{ color: "rgb(216,180,254)", fontWeight: 700, fontSize: 14 }}>
              Go to Weered
            </a>
          </div>
        </div>
      </div>
    );

  return (
    <div style={page}>
      <div style={card}>
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element -- the lobby's own banner
          <img
            src={banner}
            alt=""
            style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ height: 8, background: accent }} />
        )}
        <div style={body}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- the lobby's own mark
            <img
              src={logo}
              alt=""
              style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover" }}
            />
          )}
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              opacity: 0.55,
              letterSpacing: ".7px",
              textTransform: "uppercase",
            }}
          >
            Built for you
          </div>
          <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: "-.3px" }}>{lobby.name}</div>
          {lobby.description && (
            <div style={{ opacity: 0.7, fontSize: 14, lineHeight: 1.5 }}>{lobby.description}</div>
          )}
          <div style={{ opacity: 0.6, fontSize: 13, lineHeight: 1.5 }}>
            Take it and it's yours: the rooms, the look, the address, all of it. Change anything. It
            isn't listed anywhere until you take it.
          </div>
          {state === "done" ? (
            <div style={{ fontWeight: 800, fontSize: 16 }}>It's yours. Opening it now…</div>
          ) : (
            <button
              onClick={() => void take()}
              disabled={state === "taking"}
              style={{
                width: "100%",
                padding: "13px 0",
                borderRadius: 12,
                border: `1px solid ${accent}`,
                background: accent,
                color: onAccent(accent),
                fontWeight: 800,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              {state === "taking"
                ? "One moment…"
                : hasCachedUser()
                  ? "Take it"
                  : "Sign in to take it"}
            </button>
          )}
          {msg && <div style={{ fontSize: 13, color: "rgb(252,165,165)" }}>{msg}</div>}
          <a
            href={`/lobby/${encodeURIComponent(lobby.id)}`}
            style={{ fontSize: 13, color: "rgb(216,180,254)", opacity: 0.8 }}
          >
            Look around first
          </a>
        </div>
      </div>
    </div>
  );
}
