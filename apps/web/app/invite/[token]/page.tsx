"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAccent, safeAccent, safeImage } from "../../../lib/brandSafe";
import { GUEST_LOBBY_KEY } from "../../../lib/guestSession";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

// Signed-in test: the cached user the login page writes. The session itself is
// an httpOnly cookie, and the layout boot script deletes weered_token on every
// load, so the token's presence can no longer mean "signed in".
function hasCachedUser(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem("weered_user") || "null")?.id;
  } catch {
    return false;
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
  GUEST: "Guest",
};

const TYPE_ICON: Record<string, string> = {
  PLATFORM: "🔑",
  ROOM: "🚪",
  LOBBY: "🏛️",
  CREW: "⚔️",
  GUEST: "👋",
};

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token || "");

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  // The lobby a run-out link was for (the API says, on 410).
  const [spentLobby, setSpentLobby] = useState<{ id: string; name: string } | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "accepting" | "done" | "error" | "expired" | "exhausted"
  >("loading");
  const [errMsg, setErrMsg] = useState("");
  const [_redirect, setRedirect] = useState("/lobby");
  // An invite into a lobby wears that lobby's name, mark and colour, and its
  // sign-in does too (app/login ?lobby=). James 2026-11-01.
  const [brand, setBrand] = useState<{
    id: string;
    name: string;
    logo: string;
    accent: string;
  } | null>(null);
  const signIn = () =>
    router.push(
      `/login?next=${encodeURIComponent(`/invite/${token}`)}${brand ? `&lobby=${encodeURIComponent(brand.id)}` : ""}`,
    );
  // A lobby's guest link (api routes/guestJoin.ts): no account, just a name.
  const [guestName, setGuestName] = useState("");
  const [guestErr, setGuestErr] = useState("");

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
          // The ECEB office's guest links open its foyer, not this page.
          if (
            j.invite?.type === "GUEST" &&
            /^mtg-eceb(-|$)/.test(String(j.invite.targetId || ""))
          ) {
            router.replace(`/foyer?invite=${encodeURIComponent(token)}`);
            return;
          }
          setInvite(j.invite);
          setState("ready");
          if ((j.invite?.type === "LOBBY" || j.invite?.type === "GUEST") && j.invite.targetId)
            fetch(`${API}/lobbies/${encodeURIComponent(j.invite.targetId)}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((x) => {
                const l = x?.lobby;
                if (l?.id)
                  setBrand({
                    id: String(l.id),
                    name: String(l.name || "").slice(0, 60),
                    logo: safeImage(l.logoUrl),
                    accent: safeAccent(l.accentColor, "#7c3aed"),
                  });
              })
              .catch(() => {});
        } else if (j.error === "expired" || j.error === "exhausted") {
          // The lobby is still there: point at it, not at a dead end.
          if (j.lobbyId)
            setSpentLobby({ id: String(j.lobbyId), name: String(j.lobbyName || j.lobbyId) });
          setState(j.error);
        } else {
          setState("error");
          setErrMsg(j.error || "Invalid invite.");
        }
      })
      .catch(() => {
        setState("error");
        setErrMsg("Could not load invite.");
      });
  }, [token, router]);

  async function accept() {
    setState("accepting");
    if (!hasCachedUser()) {
      signIn();
      return;
    }
    // Signed in already: a guest link just opens the lobby, as yourself.
    if (invite?.type === "GUEST" && invite.targetId) {
      router.push(`/lobby/${encodeURIComponent(invite.targetId)}`);
      return;
    }
    const r = await fetch(`${API}/invites/${token}/accept`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({}),
    });
    // A stale cached user with an expired cookie session: send them to sign in.
    if (r.status === 401) {
      signIn();
      return;
    }
    const j = await r.json();
    // A lobby with a front door: its door takes the invite from here.
    if (j.error === "door_required" && j.redirect) {
      router.push(j.redirect);
      return;
    }
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
            : j.message || j.error || "Failed.",
      );
    }
  }

  async function joinAsGuest() {
    if (guestName.trim().length < 2 || state === "accepting") return;
    setState("accepting");
    setGuestErr("");
    const r = await fetch(`${API}/auth/guest-lobby`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteToken: token, name: guestName.trim() }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (j?.ok && j.lobbyId) {
      try {
        localStorage.setItem("weered_user", JSON.stringify(j.user));
        localStorage.setItem(GUEST_LOBBY_KEY, String(j.lobbyId));
      } catch {
        // A private window: the session cookie still carries them in.
      }
      router.replace(`/lobby/${encodeURIComponent(j.lobbyId)}`);
      return;
    }
    if (j?.error === "expired") {
      setState("expired");
      return;
    }
    if (j?.error === "exhausted") {
      setState("exhausted");
      return;
    }
    setState("ready");
    setGuestErr(j?.message || "That didn't work. Try again in a moment.");
  }

  const containerStyle: React.CSSProperties = {
    minHeight: "var(--weered-page-h, 100vh)",
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

  const Logo = () =>
    brand ? (
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        {brand.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the lobby's own mark
          <img
            src={brand.logo}
            alt=""
            onError={(e) => (e.currentTarget.style.display = "none")}
            style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: brand.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 900,
              color: "#fff",
            }}
          >
            {brand.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-.5px" }}>{brand.name}</span>
      </div>
    ) : (
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

  if (state === "expired" || state === "exhausted") {
    const to =
      spentLobby ||
      ((invite?.type === "LOBBY" || invite?.type === "GUEST") && invite.targetId
        ? { id: String(invite.targetId), name: String(invite.targetName || invite.targetId) }
        : null);
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <Logo />
          <div style={{ fontSize: 36 }}>{state === "expired" ? "⏰" : "🔒"}</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {state === "expired" ? "This link has run out" : "This link is used up"}
          </div>
          <div style={{ opacity: 0.6, fontSize: 14, textAlign: "center", lineHeight: 1.5 }}>
            {to
              ? `${to.name} is still there. Have a look, and join from inside.`
              : state === "expired"
                ? "It was only good for a while. Ask whoever sent it for a new one."
                : "It has been used as many times as it allows. Ask whoever sent it for a new one."}
          </div>
          <a
            href={to ? `/lobby/${encodeURIComponent(to.id)}` : "/"}
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
            {to ? `Open ${to.name}` : "Go to Weered"}
          </a>
        </div>
      </div>
    );
  }

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
  // No account yet and a guest link: a name is all it takes.
  const asGuest = invite.type === "GUEST" && !hasCachedUser();
  const place = brand?.name || invite.targetName || "the lobby";
  const joinBtn: React.CSSProperties = {
    width: "100%",
    padding: "13px 0",
    borderRadius: 12,
    border: brand ? `1px solid ${brand.accent}` : "1px solid rgba(124,58,237,.40)",
    background: brand ? brand.accent : "rgba(124,58,237,.18)",
    color: brand ? onAccent(brand.accent) : "rgb(216,180,254)",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
    transition: "background .15s",
    letterSpacing: "-.2px",
  };

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
              : brand?.name || invite.targetName || invite.targetId || "Unknown"}
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

        {asGuest ? (
          <>
            <input
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                setGuestErr("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void joinAsGuest();
              }}
              placeholder="Your name"
              aria-label="Your name"
              maxLength={32}
              autoComplete="name"
              autoFocus
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.16)",
                background: "rgba(0,0,0,.25)",
                color: "inherit",
                fontSize: 15,
                outline: "none",
              }}
            />
            <button
              onClick={joinAsGuest}
              disabled={state === "accepting" || guestName.trim().length < 2}
              style={{
                ...joinBtn,
                opacity: guestName.trim().length < 2 ? 0.55 : 1,
                cursor: guestName.trim().length < 2 ? "default" : "pointer",
              }}
            >
              {state === "accepting" ? "Joining…" : "Join as a guest"}
            </button>
            {guestErr && (
              <div role="alert" style={{ fontSize: 13, color: "#fca5a5", textAlign: "center" }}>
                {guestErr}
              </div>
            )}
            <div style={{ fontSize: 11, opacity: 0.4, textAlign: "center", lineHeight: 1.5 }}>
              No account needed. You&apos;re a guest of {place} while this link lasts, up to 12
              hours.
            </div>
            <button
              onClick={() =>
                router.push(
                  `/login?lobby=${encodeURIComponent(invite.targetId || "")}&next=${encodeURIComponent(`/lobby/${invite.targetId || ""}`)}`,
                )
              }
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                opacity: 0.65,
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Have a Weered account? Sign in
            </button>
          </>
        ) : (
          <>
            <button onClick={accept} disabled={state === "accepting"} style={joinBtn}>
              {state === "accepting"
                ? "Joining…"
                : invite.type === "PLATFORM"
                  ? "Join Weered"
                  : brand
                    ? `Join ${brand.name}`
                    : invite.type === "GUEST"
                      ? `Join ${place}`
                      : `Join ${TYPE_LABEL[invite.type] || ""}`}
            </button>

            <div style={{ fontSize: 11, opacity: 0.3 }}>
              {invite.type === "PLATFORM"
                ? "You'll be asked to create an account if you don't have one."
                : invite.type === "GUEST"
                  ? "You're signed in, so you go in as yourself."
                  : brand
                    ? "With a free Weered account. You land right in."
                    : "You'll need to be logged in to accept."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
