"use client";
import { useState, useEffect, useCallback } from "react";
import TournamentsPanel from "../../../../components/TournamentsPanel";
import { apiFetch } from "./shared";
import { FlairItem, TournamentRow } from "./ChallengesTab";
import { FlairEditor } from "./FlairEditor";

export function TournamentsTab({ lobbyId }: { lobbyId: string }) {
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [flairItems, setFlairItems] = useState<FlairItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    const t = await apiFetch(`/tournaments?lobbyId=${encodeURIComponent(lobbyId)}&status=all`);
    if (t.ok && Array.isArray(t.tournaments)) setTournaments(t.tournaments);
    const cats = ["BADGE", "TITLE", "AVATAR"];
    const results = await Promise.all(cats.map((c) => apiFetch(`/store?category=${c}`)));
    const items: FlairItem[] = [];
    for (const r of results) {
      if (r?.ok && Array.isArray(r.items)) {
        for (const i of r.items)
          items.push({
            id: i.id,
            name: i.name,
            category: i.category,
            rarity: i.rarity,
            imageUrl: i.imageUrl,
          });
      }
    }
    setFlairItems(items);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function currentFlairId(t: TournamentRow): string {
    const arr = Array.isArray(t.rewards) ? t.rewards : [];
    const flair = arr.find((r: any) => r?.kind === "FLAIR" && r?.rank === 1);
    return flair?.itemId || "";
  }

  async function setFlair(t: TournamentRow, itemId: string) {
    setSavingId(t.id);
    setMsg("");
    const rewards = itemId ? [{ kind: "FLAIR", itemId, rank: 1 }] : [];
    const j = await apiFetch(`/tournaments/${encodeURIComponent(t.id)}/rewards`, {
      method: "POST",
      body: JSON.stringify({ rewards }),
    });
    setSavingId(null);
    if (j.ok) {
      setMsg(`Updated "${t.title}".`);
      setTimeout(() => setMsg(""), 2500);
      loadAll();
    } else {
      setMsg(j.error || "Failed.");
    }
  }

  if (loading)
    return <div style={{ padding: 20, opacity: 0.4, fontSize: 12 }}>Loading tournaments...</div>;

  if (loading)
    return <div style={{ padding: 20, opacity: 0.4, fontSize: 12 }}>Loading tournaments...</div>;

  return (
    <>
      <TournamentsPanel lobbyId={lobbyId} isStaff={true} />

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            opacity: 0.5,
            letterSpacing: ".7px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Winner Flair (per tournament)
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(148,163,184,.55)",
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          Attach a flair reward to each tournament. The first-place entry is granted the item on
          tournament completion. Items shown are from the platform store (BADGE / TITLE / AVATAR
          categories).
        </div>
      </div>
      {(() => null)()}
      <FlairEditor
        tournaments={tournaments}
        flairItems={flairItems}
        savingId={savingId}
        msg={msg}
        currentFlairId={currentFlairId}
        setFlair={setFlair}
      />
    </>
  );
}
