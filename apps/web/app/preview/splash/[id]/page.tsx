"use client";

import { useParams } from "next/navigation";
import LobbySplash, {
  WINDROSE_SPLASH_PALETTE,
  DESTINY_SPLASH_PALETTE,
} from "../../../../components/LobbySplash";

const PRESETS: Record<
  string,
  { ogImage: string; ariaLabel: string; palette: any; ctaLabel?: string; liveCount?: any }
> = {
  windrose: {
    ogImage: "/brand/lobbies/windrose-og-v3.png",
    ariaLabel: "Welcome to the Windrose hub",
    palette: WINDROSE_SPLASH_PALETTE,
    liveCount: {
      endpoint: "/windrose/live-players",
      label: "Sailing right now",
      suffix: "pirates · Steam live",
    },
  },
  destiny2: {
    ogImage: "/brand/lobbies/destiny2-og-v1.png",
    ariaLabel: "Welcome to the Destiny 2 hub",
    palette: DESTINY_SPLASH_PALETTE,
    ctaLabel: "Open the Tower →",
    liveCount: {
      endpoint: "/destiny/live-players",
      label: "Guardians on Steam",
      suffix: "live · right now",
    },
  },
};

export default function SplashPreview() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const preset = PRESETS[id];

  return (
    <main style={{ position: "fixed", inset: 0, background: "#03050a" }}>
      {preset ? (
        <LobbySplash
          lobbyId={id}
          ogImage={preset.ogImage}
          ariaLabel={preset.ariaLabel}
          palette={preset.palette}
          ctaLabel={preset.ctaLabel}
          liveCount={preset.liveCount}
          forceOpen
        />
      ) : (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#a89775",
            fontFamily: "Georgia, serif",
            padding: 40,
            textAlign: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                letterSpacing: 3,
                textTransform: "uppercase",
                opacity: 0.55,
                marginBottom: 8,
              }}
            >
              No preset
            </div>
            <div style={{ fontSize: 22, marginBottom: 14 }}>
              Unknown lobby id: <code style={{ color: "#e8c48a" }}>{id}</code>
            </div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              Try{" "}
              <a href="/preview/splash/windrose" style={{ color: "#e8c48a" }}>
                /preview/splash/windrose
              </a>
              {" · "}
              <a href="/preview/splash/destiny2" style={{ color: "#f58220" }}>
                /preview/splash/destiny2
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
