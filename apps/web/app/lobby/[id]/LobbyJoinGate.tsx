"use client";

// The gate a non-member sees on a password, approval or paid lobby.
import React, { useState } from "react";
import LobbyTierCards from "../../../components/LobbyTierCards";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export type LobbyInfo = {
  moduleType: string;
  moduleConfig?: { twitchCategory?: string; subreddit?: string; steamAppId?: number } | null;
  accentColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  enabledModules?: string[];
  verified?: boolean;
  name?: string;
  ownerId?: string | null;
  joinMode?: string;
  _count?: { rooms: number; members: number };
  tiers?: {
    id: string;
    name: string;
    priceMonthly: number;
    color: string | null;
    grantLevel: number;
  }[];
  memberPerks?: string[];
  layout?: unknown;
  customDomain?: string | null;
  domainStatus?: string | null;
};

type JoinRequestStatus = { status: string; createdAt: string; denyReason?: string | null } | null;

export default function LobbyJoinGate({
  lobbyId,
  lobbyInfo,
  joinRequest,
  onJoined,
  accent,
}: {
  lobbyId: string;
  lobbyInfo: LobbyInfo;
  joinRequest: JoinRequestStatus;
  onJoined: () => void;
  accent: string;
}) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingState, setPendingState] = useState<"none" | "pending" | "denied">(
    joinRequest?.status === "PENDING"
      ? "pending"
      : joinRequest?.status === "DENIED"
        ? "denied"
        : "none",
  );

  const mode = lobbyInfo.joinMode || "OPEN";

  async function handleJoin() {
    setError("");
    setLoading(true);
    try {
      const body: any = {};
      if (mode === "PASSWORD") body.password = password;
      if (mode === "APPROVAL") body.message = message;

      const res = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const j = await res.json();

      if (j.ok) {
        if (j.pending) {
          setPendingState("pending");
        } else {
          onJoined();
        }
      } else {
        setError(j.message || j.error || "Failed to join");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: 420,
    margin: "0 auto",
    padding: "32px 28px",
    borderRadius: 3,
    border: `1px solid ${accent}33`,
    background: `${accent}08`,
    textAlign: "center",
  };

  if (mode === "PAID") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💎</div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "rgba(243,244,246,0.95)",
              margin: "0 0 8px",
            }}
          >
            Subscription Required
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "rgba(148,163,184,0.6)",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}
          >
            This lobby requires an active subscription to join. Choose a tier below to get access.
          </p>
          <LobbyTierCards lobbyId={lobbyId} />
        </div>
      </div>
    );
  }

  if (pendingState === "pending") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "rgba(243,244,246,0.95)",
              margin: "0 0 8px",
            }}
          >
            Request Pending
          </h3>
          <p style={{ fontSize: 13, color: "rgba(148,163,184,0.6)", margin: 0, lineHeight: 1.5 }}>
            Your join request has been submitted. A lobby admin will review it.
          </p>
        </div>
      </div>
    );
  }

  if (pendingState === "denied") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "rgba(243,244,246,0.95)",
              margin: "0 0 8px",
            }}
          >
            Request Denied
          </h3>
          {joinRequest?.denyReason && (
            <p
              style={{
                fontSize: 12,
                color: "rgba(239,68,68,0.7)",
                margin: "0 0 12px",
                fontStyle: "italic",
              }}
            >
              "{joinRequest.denyReason}"
            </p>
          )}
          <p
            style={{
              fontSize: 13,
              color: "rgba(148,163,184,0.6)",
              margin: "0 0 16px",
              lineHeight: 1.5,
            }}
          >
            Your request was denied. You can submit a new one.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            maxLength={500}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              resize: "vertical",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.3)",
              color: "rgba(243,244,246,0.9)",
              fontSize: 12,
              minHeight: 60,
              boxSizing: "border-box",
              marginBottom: 12,
              outline: "none",
            }}
          />
          {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button
            onClick={handleJoin}
            disabled={loading}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: `1px solid ${accent}55`,
              background: `${accent}22`,
              color: "rgba(243,244,246,0.95)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Submitting..." : "Re-submit Request"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={cardStyle}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>
          {mode === "PASSWORD" ? "🔒" : mode === "APPROVAL" ? "📋" : "👋"}
        </div>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "rgba(243,244,246,0.95)",
            margin: "0 0 8px",
          }}
        >
          {mode === "OPEN"
            ? "Join this Lobby"
            : mode === "PASSWORD"
              ? "Password Required"
              : "Request to Join"}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "rgba(148,163,184,0.6)",
            margin: "0 0 20px",
            lineHeight: 1.5,
          }}
        >
          {mode === "OPEN" && "Become a member to access rooms, chat, and all lobby features."}
          {mode === "PASSWORD" && "This lobby is password protected. Enter the password to join."}
          {mode === "APPROVAL" && "This lobby requires admin approval. Submit a request to join."}
        </p>

        {mode === "PASSWORD" && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Enter lobby password"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.3)",
              color: "rgba(243,244,246,0.9)",
              fontSize: 13,
              boxSizing: "border-box",
              marginBottom: 12,
              outline: "none",
              textAlign: "center",
            }}
          />
        )}

        {mode === "APPROVAL" && (
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Why do you want to join? (optional)"
            maxLength={500}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              resize: "vertical",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.3)",
              color: "rgba(243,244,246,0.9)",
              fontSize: 12,
              minHeight: 60,
              boxSizing: "border-box",
              marginBottom: 12,
              outline: "none",
            }}
          />
        )}

        {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <button
          onClick={handleJoin}
          disabled={loading}
          style={{
            padding: "10px 28px",
            borderRadius: 10,
            border: `1px solid ${accent}55`,
            background: `${accent}22`,
            color: "rgba(243,244,246,0.95)",
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {loading ? "..." : mode === "APPROVAL" ? "Submit Request" : "Join Lobby"}
        </button>
      </div>
    </div>
  );
}
