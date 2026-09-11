"use client";
import React, { useCallback, useEffect, useState } from "react";
import { API, authHeaders } from "./hllv/shared";
import { useLobbyLang, pick } from "../lib/lobbyLang";
import { TIMBOS_UI } from "../lib/timbosCopy";

/**
 * A Melee lobby's Slippi ranked board.
 *
 * Reads /slippi/:lobbyId/board, which is served from our own table of last
 * good reads, never from Slippi on the request path. So the board paints at
 * once, and when Slippi is down it says so and keeps showing what it last
 * knew, dated. Members add their own connect code; whoever added a code, or a
 * moderator, can take it off.
 */

type Row = {
  code: string;
  displayName: string;
  rating: number | null;
  tier: string;
  placement: boolean;
  wins: number;
  losses: number;
  globalPlacement: number | null;
  characters: { character: string; gameCount: number }[];
  fetchedAt: string | null;
  error: string | null;
  addedById: string | null;
};

type Board = {
  rows: Row[];
  newestRead: string | null;
  stale: boolean;
  failing: number;
  me: { id: string; member: boolean; canManage: boolean } | null;
};

const ERR_KEY: Record<string, string> = {
  bad_code: "slippiErrBad",
  unknown_code: "slippiErrUnknown",
  members_only: "slippiErrMembers",
  too_many_codes: "slippiErrLimit",
  slippi_unreachable: "slippiErrDown",
  auth_required: "slippiSignIn",
};

/** "FOX" → "Fox", "ICE_CLIMBERS" → "Ice Climbers", "GAME_AND_WATCH" → "Game & Watch". */
export function prettyCharacter(c: string): string {
  const s = String(c || "")
    .toLowerCase()
    .replace(/_and_/g, " & ")
    .replace(/_/g, " ");
  return s.replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

function ago(iso: string | null, lang: "en" | "fr"): string {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 2) return lang === "fr" ? "à l'instant" : "just now";
  if (m < 60) return lang === "fr" ? `il y a ${m} min` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return lang === "fr" ? `il y a ${h} h` : `${h} h ago`;
  return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA");
}

const th: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  opacity: 0.5,
  borderBottom: "1px solid rgba(255,255,255,.09)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "7px 10px",
  borderBottom: "1px solid rgba(255,255,255,.04)",
  whiteSpace: "nowrap",
  color: "rgba(243,244,246,.85)",
  fontWeight: 500,
};

export default function SlippiBoard({ lobbyId, accent }: { lobbyId: string; accent: string }) {
  const lang = useLobbyLang();
  const t = (k: string) => (TIMBOS_UI[k] ? pick(TIMBOS_UI[k], lang) : k);
  const [board, setBoard] = useState<Board | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const base = `${API}/slippi/${encodeURIComponent(lobbyId)}`;

  const load = useCallback(async () => {
    try {
      const j = await fetch(`${base}/board`, { headers: authHeaders(), cache: "no-store" }).then(
        (r) => r.json(),
      );
      if (j && Array.isArray(j.rows)) setBoard(j);
    } catch {
      /* keep what we have */
    }
  }, [base]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const call = async (path: string, method: string, body?: unknown) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`${base}${path}`, {
        method,
        headers: { ...authHeaders(), ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(t(ERR_KEY[j?.error] || "slippiErrDown"));
        return false;
      }
      return true;
    } catch {
      setErr(t("slippiErrDown"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!code.trim()) return;
    if (await call("/codes", "POST", { code: code.trim() })) {
      setCode("");
      await load();
    }
  };
  const remove = async (c: string) => {
    if (await call(`/codes/${encodeURIComponent(c)}`, "DELETE")) await load();
  };
  const refresh = async () => {
    if (await call("/refresh", "POST")) await load();
  };

  const me = board?.me;
  const canAdd = !!me?.member;
  const rows = board?.rows ?? [];

  return (
    <div>
      {board?.stale && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            marginBottom: 10,
            fontSize: 11,
            lineHeight: 1.5,
            border: "1px solid rgba(255,180,80,.4)",
            background: "rgba(255,180,80,.08)",
          }}
        >
          {t("slippiStale")}
        </div>
      )}

      {rows.length === 0 && board && (
        <p style={{ fontSize: 12, opacity: 0.65, margin: "4px 0 10px" }}>{t("slippiEmpty")}</p>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>#</th>
                <th style={{ ...th, textAlign: "left" }}>{lang === "fr" ? "Joueur" : "Player"}</th>
                <th style={{ ...th, textAlign: "right" }}>{lang === "fr" ? "Cote" : "Rating"}</th>
                <th style={{ ...th, textAlign: "left" }}>{lang === "fr" ? "Rang" : "Rank"}</th>
                <th style={{ ...th, textAlign: "right" }}>{lang === "fr" ? "V–D" : "W–L"}</th>
                <th style={{ ...th, textAlign: "left" }}>{t("slippiMains")}</th>
                {me && <th style={th} />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const mine = !!me && (r.addedById === me.id || me.canManage);
                return (
                  <tr key={r.code}>
                    <td style={{ ...td, color: accent, fontWeight: 700 }}>{i + 1}</td>
                    <td style={td}>
                      <span style={{ fontWeight: 700, color: "#f3f4f6" }}>
                        {r.displayName || r.code}
                      </span>
                      <span style={{ opacity: 0.5, marginLeft: 6, fontSize: 11 }}>{r.code}</span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{r.rating ?? "—"}</td>
                    <td style={td}>
                      {r.placement ? (lang === "fr" ? "Placement" : "Placement") : r.tier}
                      {r.globalPlacement != null && r.globalPlacement <= 1000 && (
                        <span style={{ opacity: 0.55, marginLeft: 6, fontSize: 10 }}>
                          #{r.globalPlacement}
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {r.wins}–{r.losses}
                    </td>
                    <td style={{ ...td, opacity: 0.8 }}>
                      {r.characters
                        .slice(0, 3)
                        .map((c) => prettyCharacter(c.character))
                        .join(", ") || "—"}
                    </td>
                    {me && (
                      <td style={{ ...td, textAlign: "right" }}>
                        {mine && (
                          <button
                            onClick={() => void remove(r.code)}
                            disabled={busy}
                            title={t("slippiRemove")}
                            style={{
                              background: "transparent",
                              border: "1px solid rgba(255,255,255,.15)",
                              color: "inherit",
                              borderRadius: 6,
                              fontSize: 10,
                              padding: "2px 7px",
                              cursor: "pointer",
                              opacity: 0.7,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
          fontSize: 11,
        }}
      >
        {canAdd ? (
          <>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void add()}
              placeholder={t("slippiCodeHint")}
              maxLength={16}
              spellCheck={false}
              style={{
                flex: "1 1 160px",
                maxWidth: 220,
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${accent}55`,
                background: "rgba(0,0,0,.25)",
                color: "inherit",
                fontSize: 12,
                textTransform: "uppercase",
              }}
            />
            <button
              onClick={() => void add()}
              disabled={busy || !code.trim()}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                background: accent,
                color: "#0b0b0b",
                fontWeight: 800,
                fontSize: 11,
                cursor: "pointer",
                opacity: busy || !code.trim() ? 0.5 : 1,
              }}
            >
              {t("slippiAdd")}
            </button>
          </>
        ) : (
          board && <span style={{ opacity: 0.6 }}>{t("slippiSignIn")}</span>
        )}
        {me?.canManage && rows.length > 0 && (
          <button
            onClick={() => void refresh()}
            disabled={busy}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,.15)",
              color: "inherit",
              borderRadius: 8,
              fontSize: 10,
              padding: "4px 9px",
              cursor: "pointer",
              opacity: 0.7,
            }}
          >
            {t("slippiRefresh")}
          </button>
        )}
        {board?.newestRead && (
          <span style={{ marginLeft: "auto", opacity: 0.5 }}>
            {t("slippiUpdated")} {ago(board.newestRead, lang === "fr" ? "fr" : "en")}
          </span>
        )}
      </div>
      {err && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#ffb4a8" }} role="alert">
          {err}
        </div>
      )}
    </div>
  );
}
