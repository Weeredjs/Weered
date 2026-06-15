import type { Metadata } from "next";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export const metadata: Metadata = {
  title: "Windrose mods catalog · Weered",
  description:
    "Public catalog of Windrose mods, sourced live from Nexus. View what Weered surfaces about each mod (name, author, summary, endorsements, downloads), no account required.",
  alternates: { canonical: "https://weered.ca/mods/windrose" },
};

interface ModRow {
  id: string;
  name: string;
  author: string | null;
  summary: string | null;
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  source: string;
  endorsements: number;
  downloads: number;
  sourceUpdatedAt: string | null;
}

async function fetchMods(): Promise<ModRow[]> {
  try {
    const r = await fetch(`${API}/mods?gameSlug=windrose&sort=endorsed&limit=200`, {
      next: { revalidate: 300 },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j?.mods) ? j.mods : [];
  } catch {
    return [];
  }
}

export default async function WindroseModsPublicPage() {
  const mods = await fetchMods();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a14",
        color: "rgba(243,244,246,.95)",
        fontFamily: "var(--font-barlow), 'Barlow Condensed', system-ui, sans-serif",
      }}
    >
      <header
        style={{
          padding: "32px 24px 24px",
          borderBottom: "1px solid rgba(255,255,255,.08)",
          background: "linear-gradient(180deg, rgba(124,58,237,.10) 0%, transparent 100%)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <img
                src="/brand/logo/weered-logo-32.png"
                alt="Weered"
                style={{ width: 28, height: 28, borderRadius: 6 }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "rgba(167,139,250,.80)",
                }}
              >
                Weered.ca
              </span>
            </Link>
          </div>

          <h1
            style={{
              fontSize: "clamp(32px, 6vw, 52px)",
              fontWeight: 900,
              letterSpacing: "-1.5px",
              lineHeight: 1.05,
              margin: "0 0 12px",
              background: "linear-gradient(135deg, #fff 0%, #d8caff 60%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Windrose mods catalog
          </h1>

          <p
            style={{
              maxWidth: 720,
              fontSize: 15,
              lineHeight: 1.6,
              color: "rgba(232,232,240,.75)",
              margin: 0,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Public read-only view of the Windrose mods Weered surfaces. Sourced live from the Nexus
            public API. Metadata only. Every install click-through goes to the mod's Nexus page. We
            don't host or redistribute mod files.
          </p>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              color: "rgba(167,139,250,.85)",
              letterSpacing: "0.04em",
            }}
          >
            <span>
              {mods.length} mod{mods.length === 1 ? "" : "s"} indexed
            </span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>refresh ~5 min</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>sorted by endorsements</span>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(124,58,237,.10)",
              border: "1px solid rgba(124,58,237,.25)",
              fontSize: 13,
              lineHeight: 1.55,
              color: "rgba(232,232,240,.85)",
              fontFamily: "system-ui, -apple-system, sans-serif",
              maxWidth: 720,
            }}
          >
            <strong style={{ color: "#d8caff" }}>Mod authors:</strong> if your work shows up wrong,
            or you'd prefer it not appear in our catalog, email{" "}
            <a
              href="mailto:support@weered.ca"
              style={{ color: "#d8caff", textDecoration: "underline" }}
            >
              support@weered.ca
            </a>{" "}
            with the mod name and we'll fix or exclude it same-day.
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 80px" }}>
        {mods.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "rgba(255,255,255,.45)",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Catalog is loading or empty. Check back in a few minutes.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {mods.map((m) => (
              <a
                key={m.id}
                href={m.sourceUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.08)",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "border-color .15s, transform .15s",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    background: m.thumbnailUrl
                      ? `url(${m.thumbnailUrl}) center/cover`
                      : "linear-gradient(135deg, #1a0a25, #0a0a14)",
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      left: 6,
                      padding: "2px 7px",
                      background: "rgba(212,160,23,.20)",
                      border: "1px solid rgba(212,160,23,.55)",
                      color: "#fde68a",
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "1px",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {m.source.toUpperCase()}
                  </span>
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#fde68a",
                      letterSpacing: "0.2px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name}
                  </div>
                  {m.author && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(232,232,240,.55)",
                        fontStyle: "italic",
                      }}
                    >
                      by {m.author}
                    </div>
                  )}
                  {m.summary && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(232,232,240,.78)",
                        lineHeight: 1.45,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {m.summary}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      marginTop: "auto",
                      paddingTop: 6,
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 10,
                      color: "rgba(232,232,240,.55)",
                    }}
                  >
                    <span title="Endorsements">👍 {m.endorsements.toLocaleString()}</span>
                    <span title="Downloads">⬇ {m.downloads.toLocaleString()}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      <footer
        style={{
          padding: "24px",
          borderTop: "1px solid rgba(255,255,255,.06)",
          fontSize: 11,
          color: "rgba(232,232,240,.45)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        Weered · Unofficial Windrose community hub · Not affiliated with Kraken Express ·{" "}
        <Link href="/privacy" style={{ color: "inherit" }}>
          privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" style={{ color: "inherit" }}>
          terms
        </Link>
      </footer>
    </div>
  );
}
