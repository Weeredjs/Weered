"use client";

// The setup's live preview: a miniature of the signed-in app (sidebar on the
// left, Home on the right) repainted on every pick. Nebula colourways come
// from lib/uiPrefs PALETTES, the same values styles/95-nebula.css uses, so
// what this shows is what the real shell turns into. "Classic" draws the
// current look (purple banners, grey plates) so the two can be compared.
import React, { useMemo } from "react";
import { alpha } from "../composer/ui";
import { GameArt } from "../composer/GameGrid";
import type { GameEntry } from "../composer/catalog";
import { PALETTES, type Palette, type RailSection } from "../../lib/uiPrefs";

export type PreviewFav = { id: string; name: string; art: GameEntry };

type Props = {
  name: string;
  avatar: string | null;
  avatarColor: string;
  statusEmoji: string;
  statusText: string;
  tier?: string;
  look: "nebula" | "classic";
  palette: Palette;
  stars: boolean;
  compact: boolean;
  order: RailSection[];
  hidden: RailSection[];
  favs: PreviewFav[];
  pulseKey: number;
};

const CLASSIC = { a: "#7c3aed", b: "#5b21b6", c: "#1e1b2e", hi: "#c4b5fd", bg: "#141416" };

// The same star tiles the real shell drifts behind everything.
const STARS_NEAR =
  "radial-gradient(circle at 23px 41px, rgba(255,255,255,.85) 0 .7px, transparent 1.3px), radial-gradient(circle at 81px 147px, rgba(255,255,255,.7) 0 .6px, transparent 1.2px), radial-gradient(circle at 142px 89px, rgba(255,255,255,.6) 0 .6px, transparent 1.2px), radial-gradient(circle at 181px 173px, rgba(255,255,255,.8) 0 .7px, transparent 1.3px), radial-gradient(circle at 193px 22px, rgba(255,255,255,.55) 0 .6px, transparent 1.2px), radial-gradient(circle at 52px 188px, rgba(255,255,255,.65) 0 .6px, transparent 1.2px)";

function greeting() {
  const h = new Date().getHours();
  return h < 5
    ? "Late night"
    : h < 12
      ? "Good morning"
      : h < 18
        ? "Good afternoon"
        : "Good evening";
}

export default function SetupPreview(p: Props) {
  const neb = p.look === "nebula";
  const C = neb ? PALETTES[p.palette] : CLASSIC;
  const display = p.name || "you";
  const gap = p.compact ? 7 : 10;
  const rowPad = p.compact ? "5px 9px" : "7px 10px";

  const stage: React.CSSProperties = neb
    ? {
        background: `radial-gradient(120% 70% at 0% -10%, ${alpha(C.b, 0.5)}, transparent 60%), radial-gradient(90% 70% at 110% 10%, ${alpha(C.c, 0.75)}, transparent 62%), radial-gradient(100% 80% at 60% 120%, ${alpha(C.c, 0.5)}, transparent 60%), ${C.bg}`,
      }
    : { background: "#141416" };

  const card = (extra?: React.CSSProperties): React.CSSProperties =>
    neb
      ? {
          position: "relative",
          borderRadius: 13,
          border: `1px solid ${alpha(C.a, 0.22)}`,
          background: `linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.012)), rgba(13,11,28,.62)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,.05), 0 10px 26px -18px ${alpha(C.b, 0.8)}`,
          overflow: "hidden",
          transition: "border-color .35s, box-shadow .35s, background .35s",
          ...extra,
        }
      : { position: "relative", background: "#0e1014", overflow: "hidden", ...extra };

  const title = (label: string) =>
    neb ? (
      <div
        style={{
          padding: p.compact ? "8px 10px 3px" : "10px 11px 4px",
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: ".16em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,.5)",
        }}
      >
        {label}
      </div>
    ) : (
      <div
        style={{
          height: 20,
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          marginRight: 6,
          background: "#3b0764",
          clipPath: "polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)",
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "#fff",
        }}
      >
        <span style={{ color: "#d9a942", marginRight: 5 }}>/</span>
        {label}
      </div>
    );

  const navRow = (icon: string, label: string, active = false) => (
    <div
      key={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: neb ? "1px 6px" : "2px 6px",
        padding: rowPad,
        borderRadius: neb ? 9 : 0,
        fontSize: neb ? 12 : 11,
        fontWeight: 700,
        letterSpacing: neb ? ".01em" : ".08em",
        textTransform: neb ? "none" : "uppercase",
        color: active ? "#fff" : "rgba(255,255,255,.72)",
        border: `1px solid ${active && neb ? alpha(C.a, 0.5) : "transparent"}`,
        background: active
          ? neb
            ? `linear-gradient(90deg, ${alpha(C.a, 0.34)}, ${alpha(C.a, 0.07)})`
            : "rgba(91,33,182,.22)"
          : "transparent",
        boxShadow: active && neb ? `0 0 18px -5px ${alpha(C.a, 0.8)}` : "none",
        transition: "background .35s, border-color .35s, box-shadow .35s",
      }}
    >
      <span style={{ fontSize: 11 }}>{icon}</span>
      {label}
    </div>
  );

  const avatarEl = (size: number) => (
    <div
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontWeight: 900,
        fontSize: size * 0.42,
        color: "#fff",
        background: p.avatar ? `url("${p.avatar}") center/cover` : p.avatarColor,
        boxShadow: neb
          ? `0 0 0 2px rgba(13,11,28,.9), 0 0 0 3.5px ${alpha(C.a, 0.6)}, 0 6px 18px ${alpha(C.a, 0.45)}`
          : "0 0 0 2px #0e1014",
        transition: "box-shadow .35s",
      }}
    >
      {p.avatar ? null : display.slice(0, 1).toUpperCase()}
    </div>
  );

  const sections: Record<RailSection, React.ReactNode> = {
    card: (
      <div
        key="card"
        style={card(
          neb
            ? {
                borderRadius: 15,
                border: `1px solid ${alpha(C.a, 0.34)}`,
                background: `radial-gradient(120% 90% at 0% 0%, ${alpha(C.b, 0.6)}, transparent 60%), radial-gradient(90% 90% at 100% 100%, ${alpha(C.c, 0.6)}, transparent 65%), rgba(13,11,28,.7)`,
                boxShadow: `0 14px 34px -18px ${alpha(C.b, 0.9)}, inset 0 1px 0 rgba(255,255,255,.1)`,
              }
            : {},
        )}
      >
        {!neb && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: "0 0 auto 0",
              height: "34%",
              background: "#3b0764",
              clipPath: "polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%)",
            }}
          />
        )}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: p.compact ? "10px 10px" : "13px 12px",
          }}
        >
          {avatarEl(p.compact ? 34 : 40)}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 900,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textTransform: neb ? "none" : "uppercase",
                letterSpacing: neb ? "-.2px" : ".04em",
              }}
            >
              {display}
            </div>
            {p.tier && (
              <div
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  color: neb ? C.hi : "#d9a942",
                  marginTop: 1,
                }}
              >
                {p.tier}
              </div>
            )}
            <div
              style={{
                fontSize: 10,
                marginTop: 2,
                color:
                  p.statusText || p.statusEmoji ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.4)",
                fontStyle: p.statusText || p.statusEmoji ? "normal" : "italic",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {p.statusEmoji ? `${p.statusEmoji} ` : ""}
              {p.statusText || (p.statusEmoji ? "" : "Set a status…")}
            </div>
          </div>
        </div>
      </div>
    ),
    nav: (
      <div key="nav" style={card({ paddingBottom: 6 })}>
        {title("Communities")}
        {navRow("🏠", "Lobby")}
        {navRow("📡", "Home", true)}
        {navRow("💬", "Forum")}
        {navRow("💵", "Paper")}
      </div>
    ),
    presence: (
      <div key="presence" style={card({ paddingBottom: 6 })}>
        {title("Presence")}
        <div
          style={{
            margin: "2px 8px 4px",
            padding: "5px 8px",
            borderRadius: neb ? 8 : 0,
            fontSize: 9.5,
            color: "rgba(255,255,255,.35)",
            background: neb ? "rgba(0,0,0,.32)" : "transparent",
            border: neb ? "1px solid rgba(255,255,255,.08)" : "none",
            borderBottom: neb ? undefined : "1px solid rgba(255,255,255,.08)",
          }}
        >
          Search users…
        </div>
        {[
          { n: display, s: p.statusText || "online", c: p.avatarColor, me: true },
          { n: "timbo_demo", s: "lying low", c: "#14b8a6" },
          { n: "The Operator", s: "AI · @operator", c: "#eab308" },
        ].map((u) => (
          <div
            key={u.n + (u.me ? "-me" : "")}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px" }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: u.me && p.avatar ? `url("${p.avatar}") center/cover` : u.c,
                display: "grid",
                placeItems: "center",
                fontSize: 8,
                fontWeight: 900,
                color: "#fff",
                position: "relative",
              }}
            >
              {u.me && p.avatar ? null : u.n.slice(0, 1).toUpperCase()}
              <span
                style={{
                  position: "absolute",
                  right: -1,
                  bottom: -1,
                  width: 6,
                  height: 6,
                  borderRadius: 9,
                  background: "#22c55e",
                  boxShadow: "0 0 0 1.5px #0b0a14",
                }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "#fff" }}>{u.n}</div>
              <div
                style={{
                  fontSize: 8.5,
                  color: neb ? alpha(C.hi, 0.7) : "#d9a942",
                  fontStyle: "italic",
                }}
              >
                {u.s}
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
    favs: (
      <div key="favs" style={card({ paddingBottom: 6 })}>
        {title(`Favorites${p.favs.length ? ` · ${p.favs.length}` : ""}`)}
        {p.favs.length === 0 ? (
          <div style={{ padding: "4px 11px 6px", fontSize: 9.5, color: "rgba(255,255,255,.4)" }}>
            Star places below to pin them here.
          </div>
        ) : (
          p.favs.slice(0, 4).map((f) => (
            <div
              key={f.id}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px" }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  overflow: "hidden",
                  flex: "0 0 18px",
                }}
              >
                <GameArt game={f.art} height={18} radius={5} />
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "rgba(255,255,255,.88)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {f.name}
              </div>
              <span style={{ fontSize: 9, color: neb ? C.hi : "#d9a942" }}>★</span>
            </div>
          ))
        )}
      </div>
    ),
    recent: (
      <div key="recent" style={card({ paddingBottom: 6 })}>
        {title("Recent")}
        {["Home Lobby", "Dev Chat"].map((r) => (
          <div key={r} style={{ padding: "4px 11px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.8)" }}>
              {r}
            </div>
            <div style={{ fontSize: 8.5, color: "rgba(255,255,255,.3)" }}>
              {r.toLowerCase().replace(/\s+/g, "-")}
            </div>
          </div>
        ))}
      </div>
    ),
  };

  const featured = p.favs[0];
  const tiles = useMemo(() => {
    const picked = p.favs
      .slice(1, 5)
      .map((f) => ({ id: f.id, name: f.name, art: f.art as GameEntry | null }));
    const fill = ["The Lobby", "Co-Work", "Chess", "Study Hall"]
      .filter((n) => !picked.some((x) => x.name === n))
      .map((n) => ({ id: n, name: n, art: null as GameEntry | null }));
    return [...picked, ...fill].slice(0, 4);
  }, [p.favs]);

  return (
    <div
      style={{
        borderRadius: 18,
        overflow: "hidden",
        border: `1px solid ${alpha(C.a, 0.35)}`,
        boxShadow: `0 30px 80px -20px ${alpha(C.a, 0.45)}, 0 0 0 1px rgba(0,0,0,.4)`,
        background: "#05050a",
        transition: "box-shadow .4s, border-color .4s",
      }}
    >
      {/* Window chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 12px",
          background: "rgba(255,255,255,.04)",
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <span aria-hidden style={{ display: "flex", gap: 5 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span
              key={c}
              style={{ width: 9, height: 9, borderRadius: 99, background: c, opacity: 0.8 }}
            />
          ))}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11,
            color: "rgba(226,232,240,.6)",
            background: "rgba(0,0,0,.35)",
            borderRadius: 7,
            padding: "4px 10px",
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          weered.ca/<span style={{ color: C.hi }}>home</span>
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 9.5,
            fontWeight: 900,
            letterSpacing: "1px",
            color: "rgba(255,255,255,.7)",
          }}
        >
          <span
            className="cz-anim"
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: "#ef4444",
              animation: "cz-pulse 1.4s infinite",
            }}
          />
          PREVIEW
        </span>
      </div>

      {/* Stage */}
      <div
        style={{
          position: "relative",
          minHeight: 540,
          overflow: "hidden",
          transition: "background .5s",
          ...stage,
        }}
      >
        {neb && p.stars && (
          <div
            aria-hidden
            className="cz-anim su-stars"
            style={{
              position: "absolute",
              inset: "-220px",
              backgroundImage: STARS_NEAR,
              backgroundSize: "220px 220px",
              opacity: 0.8,
              pointerEvents: "none",
            }}
          />
        )}
        {/* A soft flash whenever a pick changes, so the eye finds the change. */}
        <div
          key={p.pulseKey}
          aria-hidden
          className="cz-anim"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(60% 50% at 30% 30%, ${alpha(C.a, 0.25)}, transparent 70%)`,
            animation: p.pulseKey ? "su-flash .9s ease-out both" : undefined,
            opacity: 0,
          }}
        />
        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "minmax(0, 44%) minmax(0, 1fr)",
            gap,
            padding: gap + 2,
          }}
        >
          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap }}>
            {p.order.filter((s) => !p.hidden.includes(s) || s === "nav").map((s) => sections[s])}
          </div>

          {/* Home */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: gap + 2 }}>
            <div style={{ paddingTop: 4 }}>
              <div
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: ".16em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,.45)",
                }}
              >
                {greeting()}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#fff",
                  marginTop: 2,
                  letterSpacing: "-.3px",
                }}
              >
                Hey,{" "}
                <span
                  style={{
                    color: neb ? C.hi : "#5800e5",
                    textShadow: neb ? `0 0 20px ${alpha(C.a, 0.6)}` : "none",
                    transition: "color .35s",
                  }}
                >
                  {display}
                </span>
              </div>
            </div>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: neb ? 12 : 3,
                fontSize: 10.5,
                color: "rgba(255,255,255,.4)",
                background: neb ? "rgba(10,8,22,.62)" : alpha("#7c3aed", 0.08),
                border: `1px solid ${neb ? alpha(C.a, 0.36) : alpha("#7c3aed", 0.4)}`,
                boxShadow: neb ? `0 0 0 3px ${alpha(C.a, 0.07)}` : "none",
                transition: "border-color .35s, box-shadow .35s",
              }}
            >
              🔍 Search lobbies, people, rooms…
            </div>

            {/* Featured */}
            <div
              style={{
                position: "relative",
                borderRadius: neb ? 16 : 2,
                overflow: "hidden",
                border: `1px solid ${neb ? alpha(C.a, 0.34) : "rgba(124,58,237,.5)"}`,
                boxShadow: neb ? `0 22px 50px -26px ${alpha(C.b, 0.9)}` : "none",
                minHeight: 128,
                transition: "border-color .35s, box-shadow .35s",
              }}
            >
              {featured ? (
                <GameArt game={featured.art} height={128} radius={0} />
              ) : (
                <div
                  style={{
                    height: 128,
                    background: `radial-gradient(90% 120% at 10% 0%, ${alpha(C.a, 0.55)}, transparent 60%), radial-gradient(80% 90% at 100% 100%, ${alpha(C.c, 0.8)}, transparent 60%), #0b0b14`,
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  background: "linear-gradient(180deg, transparent 20%, rgba(0,0,0,.72))",
                }}
              >
                <span
                  style={{
                    alignSelf: "flex-start",
                    fontSize: 7.5,
                    fontWeight: 900,
                    letterSpacing: ".14em",
                    padding: "3px 7px",
                    borderRadius: neb ? 99 : 0,
                    color: "#fff",
                    background: neb ? alpha(C.a, 0.35) : "#b91c1c",
                    border: neb ? `1px solid ${alpha(C.a, 0.6)}` : "none",
                  }}
                >
                  {featured ? "★ PINNED" : "FEATURED"}
                </span>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginTop: 6 }}>
                  {featured ? featured.name : "Your next hangout"}
                </div>
                <span
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 7,
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: "5px 11px",
                    borderRadius: neb ? 99 : 0,
                    color: "#fff",
                    background: neb ? `linear-gradient(135deg, ${C.a}, ${C.b})` : "#e8452f",
                    boxShadow: neb ? `0 6px 18px ${alpha(C.a, 0.5)}` : "none",
                  }}
                >
                  Join lobby
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: gap - 2,
              }}
            >
              {tiles.map((t) => (
                <div
                  key={t.id}
                  style={{
                    borderRadius: neb ? 12 : 2,
                    overflow: "hidden",
                    border: `1px solid ${neb ? "rgba(255,255,255,.08)" : "rgba(217,169,66,.35)"}`,
                    background: neb
                      ? "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.012)), rgba(13,11,28,.62)"
                      : "#1b1b1f",
                  }}
                >
                  {t.art ? (
                    <GameArt game={t.art} height={34} radius={0} />
                  ) : (
                    <div
                      style={{
                        height: 34,
                        background: `linear-gradient(120deg, ${alpha(C.a, 0.4)}, ${alpha(C.c, 0.5)})`,
                      }}
                    />
                  )}
                  <div
                    style={{
                      padding: "5px 8px 7px",
                      fontSize: 10,
                      fontWeight: 800,
                      color: "#fff",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textTransform: neb ? "none" : "uppercase",
                    }}
                  >
                    {t.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
