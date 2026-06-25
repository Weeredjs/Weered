"use client";
import { useState, useEffect } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { PAL, S, WR_FONT_DISPLAY, WR_FONT_MONO, WR_FONT_SERIF, apiFetch } from "./WrShared";

export function LogTab() {
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [recap, setRecap] = useState<{
    summary: string;
    period: string;
    generatedAt: string;
    stats: any;
  } | null>(null);
  const [recapLoading, setRecapLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch("/windrose/news").then((j) => {
      if (j?.ok && Array.isArray(j.news)) setItems(j.news);
      else setItems([]);
      setLoading(false);
    });
    setRecapLoading(true);
    apiFetch("/windrose/captains-log")
      .then((j) => {
        if (j?.ok && j.summary)
          setRecap({
            summary: j.summary,
            period: j.period,
            generatedAt: j.generatedAt,
            stats: j.stats,
          });
        setRecapLoading(false);
      })
      .catch(() => setRecapLoading(false));
  }, []);

  const nothingAtAll = !loading && !recapLoading && (!items || items.length === 0) && !recap;
  if (nothingAtAll) {
    return (
      <EmptyState
        icon="📜"
        title="The log is empty"
        hint="No dispatches yet. Check back after the storm passes."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <OperatorRecap recap={recap} loading={recapLoading} />

      {loading ? (
        <LoadingState label="Loading dispatches..." />
      ) : !items || items.length === 0 ? null : (
        items.map((n, i) => (
          <article key={n.id || i} style={{ ...S.card, padding: "18px 22px" }}>
            <span
              style={{
                position: "absolute",
                top: -6,
                left: 18,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, ${PAL.blood}ee, #5b1919)`,
                boxShadow: `inset 0 -1px 2px #300, 0 2px 4px ${PAL.ink}`,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <div style={{ ...S.label, fontSize: 9 }}>
                {n.feedlabel || "Kraken Express"}
                {" · "}
                {n.date
                  ? new Date(n.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : ""}
              </div>
              <div
                style={{
                  fontFamily: WR_FONT_MONO,
                  fontSize: 10,
                  color: PAL.parchDim,
                  opacity: 0.6,
                }}
              >
                {String(i + 1).padStart(3, "0")}
              </div>
            </div>
            <h3
              style={{
                fontFamily: WR_FONT_DISPLAY,
                fontSize: 22,
                color: PAL.brassHi,
                margin: "2px 0 8px",
                lineHeight: 1.2,
                letterSpacing: "0.3px",
              }}
            >
              {n.title || "Untitled dispatch"}
            </h3>
            <p
              style={{
                fontSize: 14,
                color: PAL.parchment,
                lineHeight: 1.65,
                margin: 0,
                fontStyle: "italic",
                opacity: 0.85,
              }}
            >
              {stripBB(n.contents || "").slice(0, 340)}
              {(n.contents || "").length > 340 ? "…" : ""}
            </p>
            {n.url && (
              <div style={{ marginTop: 12 }}>
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...S.btn, textDecoration: "none", display: "inline-block" }}
                >
                  Read dispatch →
                </a>
              </div>
            )}
          </article>
        ))
      )}
    </div>
  );
}

export function OperatorRecap({
  recap,
  loading,
}: {
  recap: { summary: string; period: string; generatedAt: string; stats: any } | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div
        style={{
          ...S.card,
          padding: "22px 26px",
          background: `radial-gradient(ellipse 80% 60% at 30% 0%, rgba(212,160,23,0.12) 0%, transparent 60%), linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
          borderColor: "rgba(212,160,23,0.45)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #e8c48a, #8a6b3e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid rgba(212,160,23,0.6)",
            fontSize: 18,
          }}
        >
          🤖
        </div>
        <div>
          <div style={{ ...S.label, fontSize: 9, color: "rgba(212,160,23,0.9)" }}>
            The Operator is writing
          </div>
          <div style={{ fontSize: 13, color: PAL.parchDim, fontStyle: "italic", marginTop: 3 }}>
            Compiling the week's dispatches…
          </div>
        </div>
      </div>
    );
  }
  if (!recap) return null;

  const when = (() => {
    try {
      const d = new Date(recap.generatedAt);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  })();

  return (
    <div
      style={{
        ...S.card,
        padding: "22px 26px",
        background: `radial-gradient(ellipse 90% 70% at 20% 0%, rgba(212,160,23,0.14) 0%, transparent 60%), linear-gradient(180deg, ${PAL.stormMid} 0%, ${PAL.stormDeep} 100%)`,
        borderColor: "rgba(212,160,23,0.45)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #e8c48a, #8a6b3e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid rgba(212,160,23,0.6)",
            boxShadow: "0 0 18px rgba(212,160,23,0.25), inset 0 -2px 4px rgba(0,0,0,0.3)",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          🤖
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: WR_FONT_DISPLAY,
                fontSize: 18,
                color: "rgba(212,160,23,0.95)",
                letterSpacing: "0.5px",
              }}
            >
              The Operator
            </span>
            <span
              style={{
                fontSize: 9,
                fontFamily: WR_FONT_MONO,
                color: PAL.parchDim,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                padding: "2px 7px",
                background: "rgba(212,160,23,0.08)",
                border: "1px solid rgba(212,160,23,0.3)",
              }}
            >
              AI · Weekly Recap
            </span>
          </div>
          <div style={{ fontSize: 11, color: PAL.parchDim, marginTop: 3, fontStyle: "italic" }}>
            {recap.period}
            {when ? ` · compiled ${when}` : ""}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          color: PAL.parchment,
          lineHeight: 1.7,
          fontFamily: WR_FONT_SERIF,
          whiteSpace: "pre-wrap",
          borderLeft: "2px solid rgba(212,160,23,0.4)",
          paddingLeft: 14,
          marginLeft: 4,
        }}
      >
        {recap.summary}
      </div>

      {recap.stats && (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 16,
            paddingTop: 14,
            borderTop: `1px solid ${PAL.brass}20`,
          }}
        >
          <RecapStat label="Bounties posted" value={recap.stats.bountiesPosted} />
          <RecapStat label="Bounties settled" value={recap.stats.bountiesSettled} />
          <RecapStat label="Crews active" value={recap.stats.crewsActive} />
          <RecapStat label="New servers" value={recap.stats.serversNew} />
          <RecapStat label="Flags raised" value={recap.stats.lfgPosts} />
        </div>
      )}
    </div>
  );
}

export function RecapStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          fontFamily: WR_FONT_DISPLAY,
          fontSize: 20,
          color: PAL.brassHi,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Number(value || 0).toLocaleString()}
      </div>
      <div style={{ ...S.label, fontSize: 9 }}>{label}</div>
    </div>
  );
}

export function stripBB(s: string): string {
  return s
    .replaceAll(/\[[^\]]+\]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export type LfgPost = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  mode?: string | null;
  region?: string | null;
  tags?: string[] | null;
  note?: string | null;
  slotsWanted?: number | null;
  createdAt: string;
};
