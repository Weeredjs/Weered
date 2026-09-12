"use client";
import React from "react";
import { useLobbyLang } from "../lib/lobbyLang";

/**
 * The station board: which setup each match is on, and what is next on it.
 *
 * Written to be read from across a room, so the match on a setup is the
 * biggest thing on the card and the on-deck queue sits under it in smaller
 * type. Anyone can watch it without signing in. A lobby manager gets the
 * controls inline: call a set onto a setup, mark it done, drop one back off.
 *
 * Bilingual on its own rather than through a lobby-specific copy file, so any
 * lobby running an event can mount it.
 */

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

const L = {
  title: { en: "Stations", fr: "Bornes" },
  blurb: {
    en: "Where each match is being played, and what is next on that setup.",
    fr: "Où se joue chaque match, et ce qui suit sur cette borne.",
  },
  now: { en: "Now", fr: "En cours" },
  deck: { en: "On deck", fr: "Prochains" },
  open: { en: "Open", fr: "Libre" },
  down: { en: "Down", fr: "Hors service" },
  call: { en: "Call a set", fr: "Appeler un match" },
  done: { en: "Done", fr: "Terminé" },
  remove: { en: "Remove", fr: "Retirer" },
  cancel: { en: "Cancel", fr: "Annuler" },
  noStations: { en: "No setups yet.", fr: "Aucune borne pour l'instant." },
  noStationsTo: {
    en: "Add your setups and the room can see where every match is.",
    fr: "Ajoutez vos bornes et la salle saura où se joue chaque match.",
  },
  nothingCallable: {
    en: "Nothing to call. Every ready set is already on a setup.",
    fr: "Rien à appeler. Tous les matchs prêts sont déjà sur une borne.",
  },
  noBracket: {
    en: "Link a start.gg tournament to call sets from the bracket.",
    fr: "Liez un tournoi start.gg pour appeler les matchs du tableau.",
  },
  loadFailed: { en: "start.gg did not answer.", fr: "start.gg n'a pas répondu." },
  setups: { en: "Setups", fr: "Bornes" },
  edit: { en: "Edit setups", fr: "Modifier les bornes" },
  save: { en: "Save", fr: "Enregistrer" },
  countHint: {
    en: "How many setups the venue has. One line each.",
    fr: "Nombre de bornes dans la salle. Une par ligne.",
  },
} as const;

type Assignment = {
  id: string;
  setId: string;
  identifier: string;
  roundText: string;
  eventName: string;
  players: string[];
  calledAt: number | null;
};
type Station = {
  id: string;
  number: number;
  label: string;
  kind: string;
  state: "OPEN" | "PLAYING" | "DOWN" | string;
  note: string;
  now: Assignment | null;
  deck: Assignment[];
};
type CallableSet = {
  setId: string;
  identifier: string;
  roundText: string;
  eventName: string;
  players: string[];
  state: number;
};

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

/** Cookie for web, bearer for desktop; the fetch-patch strips the header on web. */
async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init.headers || {}), ...authHeaders() },
  });
}

function since(ms: number | null): string {
  if (!ms) return "";
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function StationBoard({
  lobbyId,
  accent = "#7b5cff",
}: {
  lobbyId: string;
  accent?: string;
}) {
  const lang = useLobbyLang();
  const t = (k: keyof typeof L) => (lang === "fr" ? L[k].fr : L[k].en);

  const [stations, setStations] = React.useState<Station[] | null>(null);
  const [canManage, setCanManage] = React.useState(false);
  const [hasBracket, setHasBracket] = React.useState(false);
  const [picking, setPicking] = React.useState<string | null>(null);
  const [callable, setCallable] = React.useState<CallableSet[] | null>(null);
  const [callErr, setCallErr] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const r = await api(`/lobbies/${encodeURIComponent(lobbyId)}/stations`);
      const j = await r.json();
      if (!j?.ok) return;
      setStations(j.stations || []);
      setCanManage(!!j.canManage);
      setHasBracket(!!j.startgg);
    } catch {
      /* a poll that misses is not worth a message; the next one is 15s away */
    }
  }, [lobbyId]);

  React.useEffect(() => {
    void load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  async function openPicker(stationId: string) {
    setPicking(stationId);
    setCallable(null);
    setCallErr("");
    try {
      const r = await api(`/lobbies/${encodeURIComponent(lobbyId)}/stations/callable`);
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setCallErr(t("loadFailed"));
        return;
      }
      setCallable(j.sets || []);
    } catch {
      setCallErr(t("loadFailed"));
    }
  }

  async function act(path: string, init: RequestInit = {}) {
    setBusy(true);
    try {
      await api(path, init);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function assign(stationId: string, s: CallableSet) {
    setPicking(null);
    await act(`/lobbies/${encodeURIComponent(lobbyId)}/stations/${stationId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
  }

  async function saveStations() {
    const rows = draft
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line, i) => {
        // "3 | Stream setup | GameCube + CRT"  — number and the rest are optional
        const parts = line.split("|").map((p) => p.trim());
        const lead = Number.parseInt(parts[0], 10);
        const hasNum = Number.isFinite(lead);
        return {
          number: hasNum ? lead : i + 1,
          label: hasNum ? parts[1] || "" : parts[0] || "",
          kind: hasNum ? parts[2] || "" : parts[1] || "",
        };
      });
    setEditing(false);
    await act(`/lobbies/${encodeURIComponent(lobbyId)}/stations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stations: rows }),
    });
  }

  const muted = "rgba(148,163,184,.75)";
  const line = "1px solid rgba(255,255,255,.08)";

  if (stations === null) return null;

  const stateColour = (s: Station) => (s.state === "DOWN" ? "#6b7280" : s.now ? "#22c55e" : accent);

  return (
    <section className="weered-timbos-card">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <h3 className="weered-timbos-h3">{t("title")}</h3>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setDraft(
                stations
                  .map((s) => [s.number, s.label, s.kind].filter(Boolean).join(" | "))
                  .join("\n"),
              );
              setEditing((v) => !v);
            }}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              color: muted,
            }}
          >
            {editing ? t("cancel") : t("edit")}
          </button>
        )}
      </div>
      <p className="weered-timbos-blurb">{t("blurb")}</p>

      {editing && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>{t("countHint")}</div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(4, Math.min(16, draft.split("\n").length + 1))}
            spellCheck={false}
            placeholder={"1 | Stream setup | GameCube + CRT\n2 |  | GameCube + CRT\n3"}
            style={{
              width: "100%",
              background: "rgba(0,0,0,.35)",
              border: line,
              borderRadius: 8,
              color: "rgba(226,232,240,.92)",
              font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
              padding: 10,
              resize: "vertical",
            }}
          />
          <button
            type="button"
            onClick={saveStations}
            disabled={busy}
            style={{
              marginTop: 8,
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: accent,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("save")}
          </button>
        </div>
      )}

      {stations.length === 0 && !editing && (
        <div style={{ fontSize: 12, color: muted }}>
          {t("noStations")} {canManage ? t("noStationsTo") : ""}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
          gap: 10,
        }}
      >
        {stations.map((s) => (
          <div
            key={s.id}
            style={{
              border: line,
              borderLeft: `3px solid ${stateColour(s)}`,
              borderRadius: 10,
              background: "rgba(255,255,255,.03)",
              padding: "10px 12px",
              minHeight: 96,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              opacity: s.state === "DOWN" ? 0.55 : 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "rgba(243,244,246,.95)",
                }}
              >
                {s.number}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: muted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.label || s.kind}
              </span>
            </div>

            {s.now ? (
              <div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 1,
                    color: "#86efac",
                    textTransform: "uppercase",
                  }}
                >
                  {t("now")}
                  {s.now.calledAt ? ` · ${since(s.now.calledAt)}` : ""}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "rgba(243,244,246,.95)",
                    lineHeight: 1.3,
                  }}
                >
                  {s.now.players.join("  vs  ")}
                </div>
                <div style={{ fontSize: 10, color: muted }}>
                  {[s.now.identifier, s.now.roundText, s.now.eventName].filter(Boolean).join(" · ")}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: muted, flex: 1 }}>
                {s.state === "DOWN" ? t("down") : t("open")}
              </div>
            )}

            {s.deck.length > 0 && (
              <div style={{ borderTop: line, paddingTop: 5 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 1,
                    color: muted,
                    textTransform: "uppercase",
                  }}
                >
                  {t("deck")}
                </div>
                {s.deck.map((d) => (
                  <div key={d.id} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(226,232,240,.85)",
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.players.join(" vs ")}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        title={t("remove")}
                        onClick={() =>
                          act(
                            `/lobbies/${encodeURIComponent(lobbyId)}/stations/assignments/${d.id}`,
                            { method: "DELETE" },
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: muted,
                          fontSize: 12,
                        }}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && s.state !== "DOWN" && (
              <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => openPicker(s.id)}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: line,
                    background: "rgba(255,255,255,.06)",
                    color: "rgba(226,232,240,.9)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t("call")}
                </button>
                {s.now && (
                  <button
                    type="button"
                    onClick={() =>
                      act(`/lobbies/${encodeURIComponent(lobbyId)}/stations/${s.id}/advance`, {
                        method: "POST",
                      })
                    }
                    disabled={busy}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: accent,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {t("done")}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {picking && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPicking(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              maxHeight: "70vh",
              overflow: "auto",
              background: "rgba(14,13,20,.98)",
              border: line,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 8,
                color: "rgba(243,244,246,.95)",
              }}
            >
              {t("call")}
            </div>
            {callErr && <div style={{ fontSize: 12, color: "#fca5a5" }}>{callErr}</div>}
            {!callErr && callable === null && <div style={{ fontSize: 12, color: muted }}>…</div>}
            {!callErr && callable?.length === 0 && (
              <div style={{ fontSize: 12, color: muted }}>
                {hasBracket ? t("nothingCallable") : t("noBracket")}
              </div>
            )}
            {(callable || []).map((s) => (
              <button
                key={s.setId}
                type="button"
                onClick={() => assign(picking, s)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  marginBottom: 4,
                  borderRadius: 8,
                  border: line,
                  background: "rgba(255,255,255,.04)",
                  cursor: "pointer",
                  color: "rgba(243,244,246,.92)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.players.join("  vs  ")}</div>
                <div style={{ fontSize: 10, color: muted }}>
                  {[s.identifier, s.roundText, s.eventName].filter(Boolean).join(" · ")}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
