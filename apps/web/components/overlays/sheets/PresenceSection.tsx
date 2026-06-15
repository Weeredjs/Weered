"use client";

import React from "react";
import { Section, btnStyle } from "./SettingsSheet";

export default function PresenceSection() {
  const [steamId, setSteamId] = React.useState("");
  const [twitchLogin, setTwitchLogin] = React.useState("");
  const [xboxGamertag, setXboxGamertag] = React.useState("");
  const [psnAccountId, setPsnAccountId] = React.useState("");
  const [lichessUsername, setLichessUsername] = React.useState("");
  const [chessComUsername, setChessComUsername] = React.useState("");
  const [saving, setSaving] = React.useState<
    "" | "steam" | "twitch" | "xbox" | "psn" | "lichess" | "chesscom" | "overlay"
  >("");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [linkedSteam, setLinkedSteam] = React.useState<string | null>(null);
  const [linkedTwitch, setLinkedTwitch] = React.useState<string | null>(null);
  const [linkedXbox, setLinkedXbox] = React.useState<string | null>(null);
  const [linkedPsn, setLinkedPsn] = React.useState<string | null>(null);
  const [linkedLichess, setLinkedLichess] = React.useState<string | null>(null);
  const [linkedChessCom, setLinkedChessCom] = React.useState<string | null>(null);
  const [overlayToken, setOverlayToken] = React.useState<string | null>(null);
  const [overlayCopied, setOverlayCopied] = React.useState(false);
  const [livePresence, setLivePresence] = React.useState<any>(null);
  const [presenceCheckedAt, setPresenceCheckedAt] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  function token() {
    try {
      return localStorage.getItem("weered_token") || "";
    } catch {
      return "";
    }
  }

  const loadPresence = React.useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/profile/me/presence`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (j?.ok) {
        setLinkedSteam(j.steamId ?? null);
        setLinkedTwitch(j.twitchLogin ?? null);
        setLinkedXbox(j.xboxGamertag ?? null);
        setLinkedPsn(j.psnAccountId ?? null);
        setLinkedLichess(j.lichessUsername ?? null);
        setLinkedChessCom(j.chessComUsername ?? null);
        setLivePresence(j.livePresence ?? null);
        setPresenceCheckedAt(j.presenceCheckedAt ?? null);
        if (j.steamId) setSteamId((v) => v || String(j.steamId));
        if (j.twitchLogin) setTwitchLogin((v) => v || String(j.twitchLogin));
        if (j.xboxGamertag) setXboxGamertag((v) => v || String(j.xboxGamertag));
        if (j.psnAccountId) setPsnAccountId((v) => v || String(j.psnAccountId));
        if (j.lichessUsername) setLichessUsername((v) => v || String(j.lichessUsername));
        if (j.chessComUsername) setChessComUsername((v) => v || String(j.chessComUsername));
      }
    } catch {}
  }, [apiBase]);

  React.useEffect(() => {
    loadPresence();
  }, [loadPresence]);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${apiBase}/me/overlay`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const j = await r.json();
        if (j?.ok) setOverlayToken(j.token ?? null);
      } catch {}
    })();
  }, [apiBase]);

  async function generateOverlayToken() {
    setSaving("overlay");
    setMsg(null);
    try {
      const r = await fetch(`${apiBase}/me/overlay/token/rotate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed.");
      const wasActive = !!overlayToken;
      setOverlayToken(j.token);
      setMsg({
        ok: true,
        text: wasActive ? "Overlay URL rotated — old link revoked." : "Overlay URL generated.",
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Failed to generate overlay URL." });
    } finally {
      setSaving("");
    }
  }

  async function disableOverlay() {
    setSaving("overlay");
    setMsg(null);
    try {
      const r = await fetch(`${apiBase}/me/overlay/token`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed.");
      setOverlayToken(null);
      setMsg({ ok: true, text: "Overlay disabled. URL no longer works." });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Failed to disable overlay." });
    } finally {
      setSaving("");
    }
  }

  async function copyOverlayUrl() {
    if (!overlayToken) return;
    const url = `${window.location.origin}/overlay/${overlayToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setOverlayCopied(true);
      setTimeout(() => setOverlayCopied(false), 1500);
    } catch {
      setMsg({ ok: false, text: "Copy failed — select the URL and copy manually." });
    }
  }

  async function refreshNow() {
    setRefreshing(true);
    try {
      const r = await fetch(`${apiBase}/profile/me/presence/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const j = await r.json();
      if (j?.ok) {
        setLivePresence(j.livePresence ?? null);
        setPresenceCheckedAt(j.presenceCheckedAt ?? null);
      }
    } catch {}
    setRefreshing(false);
  }

  async function saveSteam(clear?: boolean) {
    setSaving("steam");
    setMsg(null);
    try {
      const r = await fetch(`${apiBase}/profile/me/steam-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ steamId: clear ? "" : steamId.trim() }),
      });
      const j = await r.json();
      if (j?.ok) {
        const resolvedNote = j?.resolvedFrom
          ? ` (resolved "${j.resolvedFrom}" → ${j.steamId})`
          : "";
        setMsg({
          ok: true,
          text: clear
            ? "Steam disconnected."
            : `Steam linked${resolvedNote}. Polling your activity now…`,
        });
        if (clear) setSteamId("");
        await loadPresence();
        if (!clear) {
          void refreshNow();
        }
      } else setMsg({ ok: false, text: j?.message || j?.error || "Failed." });
    } catch {
      setMsg({ ok: false, text: "Network error." });
    }
    setSaving("");
  }

  async function saveTwitch(clear?: boolean) {
    setSaving("twitch");
    setMsg(null);
    try {
      const r = await fetch(`${apiBase}/profile/me/twitch-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ twitchLogin: clear ? "" : twitchLogin.trim().toLowerCase() }),
      });
      const j = await r.json();
      if (j?.ok) {
        setMsg({
          ok: true,
          text: clear
            ? "Twitch disconnected."
            : "Twitch linked. You'll show as streaming when live.",
        });
        if (clear) setTwitchLogin("");
        await loadPresence();
        if (!clear) {
          void refreshNow();
        }
      } else setMsg({ ok: false, text: j?.message || j?.error || "Failed." });
    } catch {
      setMsg({ ok: false, text: "Network error." });
    }
    setSaving("");
  }

  async function savePsn(clear?: boolean) {
    setSaving("psn");
    setMsg(null);
    try {
      const r = await fetch(`${apiBase}/profile/me/psn-account-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ psnAccountId: clear ? "" : psnAccountId.trim() }),
      });
      const j = await r.json();
      if (j?.ok) {
        setMsg({ ok: true, text: clear ? "PSN unlinked." : `PSN linked as ${j.psnAccountId}.` });
        if (clear) setPsnAccountId("");
        await loadPresence();
      } else setMsg({ ok: false, text: j?.message || j?.error || "Failed." });
    } catch {
      setMsg({ ok: false, text: "Network error." });
    }
    setSaving("");
  }

  async function saveLichess(clear?: boolean) {
    setSaving("lichess");
    setMsg(null);
    try {
      const r = await fetch(`${apiBase}/profile/me/lichess`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ username: clear ? "" : lichessUsername.trim() }),
      });
      const j = await r.json();
      if (j?.ok) {
        setMsg({
          ok: true,
          text: clear
            ? "Lichess unlinked."
            : `Lichess linked as ${j.lichessUsername}. Polling your games now.`,
        });
        if (clear) setLichessUsername("");
        await loadPresence();
      } else setMsg({ ok: false, text: j?.message || j?.error || "Failed." });
    } catch {
      setMsg({ ok: false, text: "Network error." });
    }
    setSaving("");
  }

  async function saveChessCom(clear?: boolean) {
    setSaving("chesscom");
    setMsg(null);
    try {
      const r = await fetch(`${apiBase}/profile/me/chess-com`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ username: clear ? "" : chessComUsername.trim() }),
      });
      const j = await r.json();
      if (j?.ok) {
        setMsg({
          ok: true,
          text: clear
            ? "Chess.com unlinked."
            : `Chess.com linked as ${j.chessComUsername}. Polling your games now.`,
        });
        if (clear) setChessComUsername("");
        await loadPresence();
      } else setMsg({ ok: false, text: j?.message || j?.error || "Failed." });
    } catch {
      setMsg({ ok: false, text: "Network error." });
    }
    setSaving("");
  }

  async function saveXbox(clear?: boolean) {
    setSaving("xbox");
    setMsg(null);
    try {
      const r = await fetch(`${apiBase}/profile/me/xbox-gamertag`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ gamertag: clear ? "" : xboxGamertag.trim() }),
      });
      const j = await r.json();
      if (j?.ok) {
        setMsg({
          ok: true,
          text: clear
            ? "Xbox disconnected."
            : `Xbox linked as ${j.xboxGamertag}. Polling your activity now…`,
        });
        if (clear) setXboxGamertag("");
        await loadPresence();
        if (!clear) {
          void refreshNow();
        }
      } else setMsg({ ok: false, text: j?.message || j?.error || "Failed." });
    } catch {
      setMsg({ ok: false, text: "Network error." });
    }
    setSaving("");
  }

  const inputStyle: React.CSSProperties = {
    width: 220,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
    background: "var(--weered-panel2, rgba(0,0,0,.3))",
    color: "var(--weered-text, rgba(243,244,246,.95))",
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
    outline: "none",
  };

  const stackedInputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
    background: "var(--weered-panel2, rgba(0,0,0,.3))",
    color: "var(--weered-text, rgba(243,244,246,.95))",
    fontFamily: "ui-monospace, monospace",
    fontSize: 13,
    outline: "none",
  };

  return (
    <Section title="Rich Presence">
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--weered-text, rgba(243,244,246,.95))",
            }}
          >
            Steam ID
          </span>
          {linkedSteam && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(34,197,94,.12)",
                border: "1px solid rgba(34,197,94,.3)",
                color: "rgba(134,239,172,.95)",
                letterSpacing: ".04em",
                fontWeight: 700,
              }}
            >
              LINKED
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            lineHeight: 1.4,
          }}
        >
          Paste your 17-digit SteamID64, your Steam vanity URL name, or your full profile URL.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            type="text"
            value={steamId}
            onChange={(e) => setSteamId(e.target.value.replace(/\s/g, ""))}
            placeholder={linkedSteam || "weeredjs  or  76561198000000000"}
            style={stackedInputStyle}
          />
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }}
            onClick={() => saveSteam(false)}
            disabled={saving === "steam" || steamId.trim().length < 2}
          >
            {saving === "steam" ? "Saving…" : "Link"}
          </button>
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 12px", fontSize: 12, opacity: 0.7 }}
            onClick={() => saveSteam(true)}
            disabled={saving === "steam"}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--weered-text, rgba(243,244,246,.95))",
            }}
          >
            Twitch login
          </span>
          {linkedTwitch && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(139,92,246,.14)",
                border: "1px solid rgba(139,92,246,.32)",
                color: "rgba(196,181,253,.95)",
                letterSpacing: ".04em",
                fontWeight: 700,
              }}
            >
              LINKED
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            lineHeight: 1.4,
          }}
        >
          Your Twitch username — friends see a live stream badge when you&apos;re on air.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            type="text"
            value={twitchLogin}
            onChange={(e) =>
              setTwitchLogin(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
            }
            placeholder={linkedTwitch || "your_twitch_login"}
            style={stackedInputStyle}
          />
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }}
            onClick={() => saveTwitch(false)}
            disabled={saving === "twitch" || !/^[a-z0-9_]{3,25}$/.test(twitchLogin.trim())}
          >
            {saving === "twitch" ? "Saving…" : "Link"}
          </button>
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 12px", fontSize: 12, opacity: 0.7 }}
            onClick={() => saveTwitch(true)}
            disabled={saving === "twitch"}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--weered-text, rgba(243,244,246,.95))",
            }}
          >
            Xbox gamertag
          </span>
          {linkedXbox && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(16,124,16,.14)",
                border: "1px solid rgba(16,124,16,.36)",
                color: "rgba(134,239,172,.95)",
                letterSpacing: ".04em",
                fontWeight: 700,
              }}
            >
              LINKED
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            lineHeight: 1.4,
          }}
        >
          Your Xbox gamertag — friends see what you&apos;re playing on Xbox. Resolved via OpenXBL.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            type="text"
            value={xboxGamertag}
            onChange={(e) => setXboxGamertag(e.target.value.slice(0, 20))}
            placeholder={linkedXbox || "YourGamertag"}
            style={stackedInputStyle}
          />
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }}
            onClick={() => saveXbox(false)}
            disabled={saving === "xbox" || xboxGamertag.trim().length < 3}
          >
            {saving === "xbox" ? "Saving…" : "Link"}
          </button>
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 12px", fontSize: 12, opacity: 0.7 }}
            onClick={() => saveXbox(true)}
            disabled={saving === "xbox"}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--weered-text, rgba(243,244,246,.95))",
            }}
          >
            PSN online ID
          </span>
          {linkedPsn && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(0,112,243,.16)",
                border: "1px solid rgba(0,112,243,.40)",
                color: "rgba(147,197,253,.95)",
                letterSpacing: ".04em",
                fontWeight: 700,
              }}
            >
              LINKED
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            lineHeight: 1.4,
          }}
        >
          Your PSN online ID — shown as a chip so friends know to find you on PS5. Identity only —
          Sony has no third-party API for live presence.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            type="text"
            value={psnAccountId}
            onChange={(e) => setPsnAccountId(e.target.value.slice(0, 16))}
            placeholder={linkedPsn || "YourPsnId"}
            style={stackedInputStyle}
          />
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }}
            onClick={() => savePsn(false)}
            disabled={
              saving === "psn" || !/^[A-Za-z][A-Za-z0-9_-]{2,15}$/.test(psnAccountId.trim())
            }
          >
            {saving === "psn" ? "Saving…" : "Link"}
          </button>
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 12px", fontSize: 12, opacity: 0.7 }}
            onClick={() => savePsn(true)}
            disabled={saving === "psn"}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--weered-text, rgba(243,244,246,.95))",
            }}
          >
            Lichess username
          </span>
          {linkedLichess && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(124,58,237,.16)",
                border: "1px solid rgba(124,58,237,.40)",
                color: "rgba(196,181,253,.95)",
                letterSpacing: ".04em",
                fontWeight: 700,
              }}
            >
              LINKED
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            lineHeight: 1.4,
          }}
        >
          Your Lichess username. We poll your recent games and credit Weered chess tournaments.
          Public API, no OAuth, no token. Validated against Lichess on save.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            type="text"
            value={lichessUsername}
            onChange={(e) => setLichessUsername(e.target.value.slice(0, 29))}
            placeholder={linkedLichess || "yourname"}
            style={stackedInputStyle}
          />
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }}
            onClick={() => saveLichess(false)}
            disabled={saving === "lichess" || lichessUsername.trim().length < 2}
          >
            {saving === "lichess" ? "Saving…" : "Link"}
          </button>
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 12px", fontSize: 12, opacity: 0.7 }}
            onClick={() => saveLichess(true)}
            disabled={saving === "lichess"}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--weered-text, rgba(243,244,246,.95))",
            }}
          >
            Chess.com username
          </span>
          {linkedChessCom && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(34,197,94,.14)",
                border: "1px solid rgba(34,197,94,.40)",
                color: "rgba(134,239,172,.95)",
                letterSpacing: ".04em",
                fontWeight: 700,
              }}
            >
              LINKED
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            lineHeight: 1.4,
          }}
        >
          Your Chess.com username. Same deal — we poll your recent games for tournament credit.
          Public API. Validated on save.
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            type="text"
            value={chessComUsername}
            onChange={(e) => setChessComUsername(e.target.value.slice(0, 25))}
            placeholder={linkedChessCom || "yourname"}
            style={stackedInputStyle}
          />
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }}
            onClick={() => saveChessCom(false)}
            disabled={saving === "chesscom" || chessComUsername.trim().length < 3}
          >
            {saving === "chesscom" ? "Saving…" : "Link"}
          </button>
          <button
            type="button"
            style={{ ...btnStyle, padding: "8px 12px", fontSize: 12, opacity: 0.7 }}
            onClick={() => saveChessCom(true)}
            disabled={saving === "chesscom"}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "8px 0",
          marginTop: 8,
          borderTop: "1px solid rgba(148,163,184,.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--weered-text, rgba(243,244,246,.95))",
            }}
          >
            Streamer overlay (OBS / Twitch)
          </span>
          {overlayToken && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(217,169,66,.16)",
                border: "1px solid rgba(217,169,66,.40)",
                color: "rgba(252,211,77,.95)",
                letterSpacing: ".04em",
                fontWeight: 700,
              }}
            >
              ACTIVE
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            lineHeight: 1.4,
          }}
        >
          Drop the URL into OBS as a Browser Source (suggested size ~440×180). It renders your live
          Weered lobby + room + people-here count + join link, updating every 5 seconds. Anyone with
          the URL can render it — rotate to revoke if someone shares it around.
        </div>
        {overlayToken ? (
          <>
            <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
              <input
                type="text"
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : "https://weered.ca"}/overlay/${overlayToken}`}
                onFocus={(e) => e.currentTarget.select()}
                style={{
                  ...stackedInputStyle,
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                }}
              />
              <button
                type="button"
                style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }}
                onClick={copyOverlayUrl}
              >
                {overlayCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <a
                href={`/overlay/${overlayToken}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...btnStyle,
                  padding: "8px 14px",
                  fontSize: 12,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Preview
              </a>
              <button
                type="button"
                style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }}
                onClick={generateOverlayToken}
                disabled={saving === "overlay"}
              >
                {saving === "overlay" ? "…" : "Rotate"}
              </button>
              <button
                type="button"
                style={{ ...btnStyle, padding: "8px 12px", fontSize: 12, opacity: 0.7 }}
                onClick={disableOverlay}
                disabled={saving === "overlay"}
              >
                Disable
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button
              type="button"
              style={{ ...btnStyle, padding: "8px 14px", fontSize: 12 }}
              onClick={generateOverlayToken}
              disabled={saving === "overlay"}
            >
              {saving === "overlay" ? "Generating…" : "Generate URL"}
            </button>
          </div>
        )}
      </div>

      {(linkedSteam || linkedTwitch || linkedXbox) && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 8,
            background: "rgba(124,58,237,0.06)",
            border: "1px solid rgba(124,58,237,0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--weered-muted, rgba(148,163,184,.7))",
                }}
              >
                Detected now
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "var(--weered-text, rgba(243,244,246,.95))",
                }}
              >
                {livePresence?.activity ? (
                  <>
                    <span style={{ fontWeight: 700, color: "rgba(196,181,253,.98)" }}>
                      {livePresence.activity}
                    </span>
                    {livePresence.detail && (
                      <span
                        style={{ opacity: 0.75, marginLeft: 6, fontSize: 12, fontStyle: "italic" }}
                      >
                        — {String(livePresence.detail).slice(0, 80)}
                      </span>
                    )}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        opacity: 0.5,
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      via {livePresence.source || "?"}
                    </span>
                  </>
                ) : (
                  <span style={{ opacity: 0.6, fontStyle: "italic" }}>
                    Nothing detected yet. Go live on Twitch or open a Steam game and refresh.
                  </span>
                )}
              </div>
              {presenceCheckedAt && (
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 10,
                    opacity: 0.45,
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  last checked {new Date(presenceCheckedAt).toLocaleTimeString()}
                </div>
              )}
            </div>
            <button
              type="button"
              style={{ ...btnStyle, padding: "6px 12px", fontSize: 11 }}
              onClick={refreshNow}
              disabled={refreshing}
            >
              {refreshing ? "Checking…" : "Refresh"}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: msg.ok ? "rgba(134,239,172,.85)" : "rgba(252,165,165,.85)",
          }}
        >
          {msg.text}
        </div>
      )}
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: "var(--weered-muted, rgba(148,163,184,.55))",
          lineHeight: 1.5,
        }}
      >
        Find your SteamID64 at{" "}
        <a
          href="https://steamdb.info/calculator/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--weered-accent-text, rgba(196,181,253,0.95))",
            textDecoration: "underline",
          }}
        >
          steamdb.info/calculator
        </a>
        . Steam requires your game activity to be public. Twitch uses your login from{" "}
        <a
          href="https://twitch.tv"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--weered-accent-text, rgba(196,181,253,0.95))",
            textDecoration: "underline",
          }}
        >
          twitch.tv
        </a>
        .
      </div>
    </Section>
  );
}
