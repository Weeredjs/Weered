"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

type InviteInfo = {
  token: string;
  type: string;
  targetId: string | null;
  targetName: string;
  creatorName: string;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
  note: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  PLATFORM: "Weered",
  ROOM: "Room",
  LOBBY: "Lobby",
  CREW: "Crew",
};

const TYPE_ICON: Record<string, string> = {
  PLATFORM: "🔑",
  ROOM: "🚪",
  LOBBY: "🏛️",
  CREW: "⚔️",
};

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token || "");

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "accepting" | "done" | "error" | "expired" | "exhausted"
  >("loading");
  const [errMsg, setErrMsg] = useState("");
  const [redirect, setRedirect] = useState("/lobby");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrMsg("Invalid invite link.");
      return;
    }
    fetch(`${API}/invites/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setInvite(j.invite);
          setState("ready");
        } else if (j.error === "expired") setState("expired");
        else if (j.error === "exhausted") setState("exhausted");
        else {
          setState("error");
          setErrMsg(j.error || "Invalid invite.");
        }
      })
      .catch(() => {
        setState("error");
        setErrMsg("Could not load invite.");
      });
  }, [token]);

  async function accept() {
    setState("accepting");
    const tok = localStorage.getItem("weered_token");
    if (!tok) {
      router.push(`/login?next=/invite/${token}`);
      return;
    }
    const r = await fetch(`${API}/invites/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({}),
    });
    const j = await r.json();
    if (j.ok) {
      setRedirect(j.redirect || "/lobby");
      setState("done");
      setTimeout(() => router.push(j.redirect || "/lobby"), 1800);
    } else {
      setState("error");
      setErrMsg(
        j.error === "expired"
          ? "This invite has expired."
          : j.error === "exhausted"
            ? "This invite is full."
            : j.error || "Failed.",
      );
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--weered-bg, #080810)",
    color: "rgba(243,244,246,.92)",
    fontFamily: "system-ui, sans-serif",
    padding: 24,
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.04)",
    padding: "36px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    boxShadow: "0 24px 80px rgba(0,0,0,.6)",
  };

  const Logo = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "rgba(124,58,237,.30)",
          border: "1px solid rgba(124,58,237,.40)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 900,
        }}
      >
        w
      </div>
      <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-.5px" }}>weered</span>
    </div>
  );

  if (state === "loading")
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Logo />
          <div style={{ opacity: 0.4, fontSize: 14 }}>Loading invite…</div>
        </div>
      </div>
    );

  if (state === "expired")
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Logo />
          <div style={{ fontSize: 36 }}>⏰</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Invite Expired</div>
          <div style={{ opacity: 0.5, fontSize: 14, textAlign: "center" }}>
            This invite link has passed its expiry date.
          </div>
          <a
            href="/lobby"
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              background: "rgba(124,58,237,.15)",
              border: "1px solid rgba(124,58,237,.30)",
              color: "rgb(216,180,254)",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Go to Lobby
          </a>
        </div>
      </div>
    );

  if (state === "exhausted")
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Logo />
          <div style={{ fontSize: 36 }}>🔒</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Invite Full</div>
          <div style={{ opacity: 0.5, fontSize: 14, textAlign: "center" }}>
            This invite has reached its maximum number of uses.
          </div>
          <a
            href="/lobby"
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              background: "rgba(124,58,237,.15)",
              border: "1px solid rgba(124,58,237,.30)",
              color: "rgb(216,180,254)",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Go to Lobby
          </a>
        </div>
      </div>
    );

  if (state === "error")
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Logo />
          <div style={{ fontSize: 36 }}>❌</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Invalid Invite</div>
          <div style={{ opacity: 0.5, fontSize: 14, textAlign: "center" }}>{errMsg}</div>
          <a
            href="/lobby"
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              background: "rgba(124,58,237,.15)",
              border: "1px solid rgba(124,58,237,.30)",
              color: "rgb(216,180,254)",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Go to Lobby
          </a>
        </div>
      </div>
    );

  if (state === "done")
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Logo />
          <div style={{ fontSize: 48 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>You're in!</div>
          <div style={{ opacity: 0.5, fontSize: 14 }}>Redirecting you now…</div>
        </div>
      </div>
    );

  if (!invite) return null;

  const usesLeft = invite.maxUses - invite.uses;
  const expiry = invite.expiresAt ? new Date(invite.expiresAt) : null;

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <Logo />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 52 }}>{TYPE_ICON[invite.type] || "🔗"}</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              opacity: 0.5,
              letterSpacing: ".7px",
              textTransform: "uppercase",
            }}
          >
            {TYPE_LABEL[invite.type] || invite.type} Invite
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-.3px", marginBottom: 4 }}>
            {invite.type === "PLATFORM"
              ? "Join Weered"
              : invite.targetName || invite.targetId || "Unknown"}
          </div>
          <div style={{ fontSize: 13, opacity: 0.5 }}>
            Invited by <span style={{ fontWeight: 700, opacity: 0.85 }}>{invite.creatorName}</span>
          </div>
          {invite.note && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.09)",
                fontSize: 13,
                opacity: 0.8,
                fontStyle: "italic",
              }}
            >
              "{invite.note}"
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 12, opacity: 0.45 }}>
          {invite.maxUses > 1 && (
            <span>
              {usesLeft} use{usesLeft !== 1 ? "s" : ""} left
            </span>
          )}
          {expiry && <span>Expires {expiry.toLocaleDateString()}</span>}
        </div>

        <button
          onClick={accept}
          disabled={state === "accepting"}
          style={{
            width: "100%",
            padding: "13px 0",
            borderRadius: 12,
            border: "1px solid rgba(124,58,237,.40)",
            background: "rgba(124,58,237,.18)",
            color: "rgb(216,180,254)",
            fontWeight: 800,
            fontSize: 16,
            cursor: "pointer",
            transition: "background .15s",
            letterSpacing: "-.2px",
          }}
        >
          {state === "accepting"
            ? "Joining…"
            : invite.type === "PLATFORM"
              ? "Join Weered"
              : `Join ${TYPE_LABEL[invite.type] || ""}`}
        </button>

        <div style={{ fontSize: 11, opacity: 0.3 }}>
          {invite.type === "PLATFORM"
            ? "You'll be asked to create an account if you don't have one."
            : "You'll need to be logged in to accept."}
        </div>
      </div>
    </div>
  );
}
