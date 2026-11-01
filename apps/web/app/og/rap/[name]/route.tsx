import { ImageResponse } from "next/og";
import { onFileSince, previewAvatar, STATUS, type RapSheet } from "../../../../lib/rapSheet";

// The picture a shared rap sheet link unfolds into on Discord, X and Reddit
// (2026-11-01): the card's essentials at 1200x630. app/rap/[name]/page.tsx names
// it, by its full address, in the page's link-preview tags.
//
// Drawn by next/og, which reads PNG and JPEG only (a player's webp upload is
// asked for as PNG, lib/rapSheet.ts previewAvatar), has no ★ in its font (the
// stars are drawn), and no repeating gradients (the mugshot's lines are divs).
const API_INTERNAL = process.env.WEERED_API_INTERNAL || "http://127.0.0.1:4000";
const ACCENT = "#ff4d9d";
const W = 1200;
const H = 630;

async function fetchSheet(name: string): Promise<RapSheet | null> {
  try {
    const r = await fetch(`${API_INTERNAL}/rapsheet/${encodeURIComponent(name)}`, {
      cache: "no-store",
    });
    const j = r.ok ? await r.json() : null;
    return j?.ok ? (j.sheet as RapSheet) : null;
  } catch {
    return null;
  }
}

function Star({ on, accent }: { on: boolean; accent: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" style={{ marginRight: 4 }}>
      <polygon
        points="12 2.5 14.9 8.5 21.5 9.3 16.7 13.9 17.8 20.5 12 17.3 6.2 20.5 7.3 13.9 2.5 9.3 9.1 8.5 12 2.5"
        fill={on ? accent : "rgba(255,255,255,.18)"}
      />
    </svg>
  );
}

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const s = await fetchSheet(name);
  const accent = /^#[0-9a-f]{6}$/i.test(s?.crew?.accentColor || "")
    ? s!.crew!.accentColor!
    : ACCENT;
  const avatar = previewAvatar(s?.avatar ?? null);
  const line = (label: string, value: string) => (
    <div style={{ display: "flex", marginTop: 16, alignItems: "baseline" }}>
      <div
        style={{
          display: "flex",
          width: 200,
          color: "rgba(255,255,255,.45)",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 4,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flex: 1, fontSize: 30, fontWeight: 700 }}>{value}</div>
    </div>
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0e0b13",
        backgroundImage: "linear-gradient(160deg, #19141f 0%, #0b0910 100%)",
        color: "#ece8f3",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          padding: "34px 48px 22px",
          borderBottom: `4px solid ${accent}`,
        }}
      >
        <div style={{ display: "flex", fontSize: 54, fontWeight: 900, letterSpacing: 14 }}>
          RAP SHEET
        </div>
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, opacity: 0.7 }}>
          {s ? `CASE No. ${s.caseNo}` : "WEERED"}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, padding: "34px 48px 0" }}>
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 300,
            height: 330,
            borderRadius: 16,
            alignItems: "flex-end",
            justifyContent: "center",
            backgroundColor: "#1d1827",
            overflow: "hidden",
          }}
        >
          {Array.from({ length: 11 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 18 + i * 30,
                height: 2,
                backgroundColor: "rgba(255,255,255,.08)",
              }}
            />
          ))}
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- drawn by the preview renderer
            <img
              src={avatar}
              width={240}
              height={240}
              style={{ borderRadius: "16px 16px 0 0", objectFit: "cover" }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 240,
                height: 240,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "16px 16px 0 0",
                backgroundColor: "#4c1d95",
                fontSize: 120,
                fontWeight: 900,
              }}
            >
              {(s?.name || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 48 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 900, lineHeight: 1.05 }}>
            {(s?.name || "Nobody on file").slice(0, 22)}
          </div>
          {s && (
            <div style={{ display: "flex", fontSize: 34, marginTop: 12, alignItems: "center" }}>
              <div style={{ display: "flex", marginRight: 18 }}>{s.rank.title}</div>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} on={i < s.rank.stars} accent={accent} />
              ))}
            </div>
          )}
          {s?.crew &&
            line("CREW", `${s.crew.tag ? `[${s.crew.tag}] ` : ""}${s.crew.name}`.slice(0, 32))}
          {s &&
            (s.handles.psn || s.handles.xbox) &&
            line(
              "HANDLES",
              [
                s.handles.psn ? `PSN ${s.handles.psn}` : "",
                s.handles.xbox ? `Xbox ${s.handles.xbox}` : "",
              ]
                .filter(Boolean)
                .join("   "),
            )}
          {s && s.playstyles.length > 0 && line("M.O.", s.playstyles.slice(0, 3).join(", "))}
          {s && line("STATUS", STATUS[s.tier] || "Innocent")}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 48px 30px",
        }}
      >
        <div style={{ display: "flex" }}>
          {(s?.priors || []).slice(0, 4).map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                marginRight: 18,
                padding: "8px 16px",
                border: `3px solid ${accent}`,
                borderRadius: 8,
                color: accent,
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              {p.label}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 26, opacity: 0.6 }}>
          {s ? `weered.ca/rap/${s.username}` : "weered.ca"}
        </div>
      </div>
      {s && (
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 48,
            bottom: 8,
            fontSize: 16,
            opacity: 0.35,
          }}
        >
          {`On file since ${onFileSince(s.onFileSince)}`}
        </div>
      )}
    </div>,
    { width: W, height: H, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
