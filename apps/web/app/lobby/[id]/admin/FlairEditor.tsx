"use client";
import { S, fmtDate } from "./shared";
import { FlairItem, TournamentRow } from "./ChallengesTab";

export function FlairEditor({
  tournaments,
  flairItems,
  savingId,
  msg,
  currentFlairId,
  setFlair,
}: {
  tournaments: TournamentRow[];
  flairItems: FlairItem[];
  savingId: string | null;
  msg: string;
  currentFlairId: (t: TournamentRow) => string;
  setFlair: (t: TournamentRow, itemId: string) => void;
}) {
  return (
    <div>
      <div style={S.sectionTitle}>Tournaments in this lobby</div>
      <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 14, lineHeight: 1.5 }}>
        Attach a flair reward to a tournament. The first-place entry is granted the item on
        tournament completion. Items shown are from the platform store (BADGE / TITLE / AVATAR
        categories).
      </div>

      {msg && (
        <div
          style={{
            fontSize: 11,
            padding: "6px 10px",
            marginBottom: 12,
            borderRadius: 6,
            background: "rgba(16,185,129,.08)",
            border: "1px solid rgba(16,185,129,.25)",
            color: "rgb(167,243,208)",
          }}
        >
          {msg}
        </div>
      )}

      {tournaments.length === 0 && (
        <div style={{ ...S.card, opacity: 0.5, fontSize: 12 }}>
          No tournaments scoped to this lobby yet. Tournament creation is staff-only — once one
          exists you can attach a flair here.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tournaments.map((t) => {
          const sel = currentFlairId(t);
          const selItem = flairItems.find((f) => f.id === sel);
          return (
            <div key={t.id} style={S.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                    {t.status} · {t._count?.entries || 0} entries · {fmtDate(t.startsAt)} →{" "}
                    {fmtDate(t.endsAt)}
                  </div>
                </div>
                {selItem && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: "rgba(124,58,237,.10)",
                      border: "1px solid rgba(124,58,237,.30)",
                      fontSize: 10,
                      color: "rgb(216,180,254)",
                      fontWeight: 700,
                      letterSpacing: ".4px",
                    }}
                  >
                    🏷️ {selItem.name}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <div style={{ ...S.label, marginBottom: 0, minWidth: 95 }}>Winner flair</div>
                <select
                  value={sel}
                  disabled={savingId === t.id || t.status === "COMPLETED"}
                  onChange={(e) => setFlair(t, e.target.value)}
                  style={{ ...S.input, flex: 1, fontSize: 12 }}
                >
                  <option value="">— None —</option>
                  {flairItems.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.category} · {f.name} ({f.rarity})
                    </option>
                  ))}
                </select>
                {savingId === t.id && <span style={{ fontSize: 11, opacity: 0.5 }}>Saving…</span>}
              </div>
              {t.status === "COMPLETED" && (
                <div style={{ fontSize: 10, opacity: 0.45, marginTop: 6 }}>
                  Tournament has already completed — flair locked.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
