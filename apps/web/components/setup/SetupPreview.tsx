"use client";

// The setup's live preview: a miniature of the signed-in app (the left
// sidebar, Home, and the right panel when the layout uses it) repainted on
// every pick. Nebula colourways come
// from lib/uiPrefs PALETTES, the same values styles/95-nebula.css uses, so
// what this shows is what the real shell turns into. "Classic" draws the
// current look (purple banners, grey plates) so the two can be compared.
import React from "react";
import { alpha } from "../composer/ui";
import { paletteColours, type Palette } from "../../lib/uiPrefs";
import { BLOCK_META, isCore, type ShellItem, type ShellLayout } from "../../lib/shellLayout";

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
  layout: ShellLayout;
  pulseKey: number;
};

const CLASSIC = {
  a: "#7c3aed",
  b: "#5b21b6",
  c: "#1e1b2e",
  hi: "#c4b5fd",
  bg: "#141416",
  ink: "#0d0b1c",
  on: "#ffffff",
};

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
  const C = neb ? paletteColours(p.palette) : CLASSIC;
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
          background: `linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.012)), ${alpha(C.ink, 0.62)}`,
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
          ? `0 0 0 2px ${alpha(C.ink, 0.9)}, 0 0 0 3.5px ${alpha(C.a, 0.6)}, 0 6px 18px ${alpha(C.a, 0.45)}`
          : "0 0 0 2px #0e1014",
        transition: "box-shadow .35s",
      }}
    >
      {p.avatar ? null : display.slice(0, 1).toUpperCase()}
    </div>
  );

  // A friend or crew row, as the real rows read: name, where, Join.
  const person = (n: string, sub: string, color: string, join = false) => (
    <div key={n} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px" }}>
      <div
        style={{
          width: 18,
          height: 18,
          flex: "0 0 18px",
          borderRadius: "50%",
          background: color,
          display: "grid",
          placeItems: "center",
          fontSize: 8,
          fontWeight: 900,
          color: "#fff",
        }}
      >
        {n.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: "#fff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {n}
        </div>
        <div style={{ fontSize: 8.5, color: "rgba(255,255,255,.45)", whiteSpace: "nowrap" }}>
          {sub}
        </div>
      </div>
      {join && (
        <span
          style={{
            fontSize: 8,
            fontWeight: 800,
            padding: "2px 7px",
            borderRadius: neb ? 99 : 0,
            color: neb ? C.on : "#fff",
            background: neb ? `linear-gradient(135deg, ${C.a}, ${C.b})` : "#7c3aed",
          }}
        >
          Join
        </span>
      )}
    </div>
  );
  const line = (w: string, key?: string) => (
    <div
      key={key}
      style={{
        height: 6,
        width: w,
        margin: "5px 10px",
        borderRadius: 4,
        background: "rgba(255,255,255,.14)",
      }}
    />
  );

  // A block, drawn as a hint of what it holds.
  const blockMini = (it: Exclude<ShellItem, string>) => {
    const meta = BLOCK_META[it.type];
    const pr = it.props || {};
    const media =
      it.type === "stream" || it.type === "video" || it.type === "music" || it.type === "web";
    return (
      <div key={it.id} style={card({ paddingBottom: 7 })}>
        {it.type !== "welcome" && title(pr.title || pr.label || meta?.name || it.type)}
        {it.type === "welcome" ? (
          <div style={{ padding: "10px 11px 4px" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>
              {pr.title || "Welcome back"}
            </div>
            {line("70%")}
          </div>
        ) : media ? (
          <div
            style={{
              margin: "2px 9px 0",
              height: it.type === "music" ? 30 : 42,
              borderRadius: neb ? 8 : 0,
              display: "grid",
              placeItems: "center",
              fontSize: 13,
              color: "rgba(255,255,255,.7)",
              background: `linear-gradient(135deg, ${alpha(C.a, 0.35)}, rgba(0,0,0,.6))`,
            }}
          >
            {it.type === "music" ? "♪" : it.type === "web" ? "🌐" : "▶"}
          </div>
        ) : it.type === "countdown" ? (
          <div style={{ padding: "2px 10px", fontSize: 13, fontWeight: 900, color: "#fff" }}>
            08 · 22 · 05
          </div>
        ) : it.type === "links" ? (
          <div style={{ display: "flex", gap: 4, padding: "3px 9px" }}>
            {["38%", "30%"].map((w) => (
              <span
                key={w}
                style={{
                  width: w,
                  height: 12,
                  borderRadius: 99,
                  border: `1px solid ${alpha(C.a, 0.5)}`,
                }}
              />
            ))}
          </div>
        ) : (
          <>
            {line("80%", "a")}
            {line("55%", "b")}
          </>
        )}
      </div>
    );
  };

  const sections: Record<string, React.ReactNode> = {
    card: (
      <div
        key="card"
        style={card(
          neb
            ? {
                borderRadius: 15,
                border: `1px solid ${alpha(C.a, 0.34)}`,
                background: `radial-gradient(120% 90% at 0% 0%, ${alpha(C.b, 0.6)}, transparent 60%), radial-gradient(90% 90% at 100% 100%, ${alpha(C.c, 0.6)}, transparent 65%), ${alpha(C.ink, 0.7)}`,
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
        {title("Favorites")}
        {["The Lobby", "Co-Work"].map((f) => (
          <div
            key={f}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px" }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                flex: "0 0 18px",
                borderRadius: 5,
                background: `linear-gradient(135deg, ${alpha(C.a, 0.6)}, ${alpha(C.c, 0.8)})`,
              }}
            />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 10.5,
                fontWeight: 700,
                color: "rgba(255,255,255,.88)",
              }}
            >
              {f}
            </div>
            <span style={{ fontSize: 9, color: neb ? C.hi : "#d9a942" }}>★</span>
          </div>
        ))}
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
    friends: (
      <div key="friends" style={card({ paddingBottom: 6 })}>
        {title("Friends · 2 online")}
        {person("donkey", "in Destiny 2", "#7c3aed", true)}
        {person("kom", "online", "#16a34a")}
      </div>
    ),
    crew: (
      <div key="crew" style={card({ paddingBottom: 6 })}>
        {title("Crew · 2 online")}
        {person(display, "[8MTR] Home Lobby", p.avatarColor)}
        {person("donkey", "[8MTR] Destiny 2", "#7c3aed", true)}
      </div>
    ),
    rooms: (
      <div key="rooms" style={card({ paddingBottom: 6 })}>
        {title("Rooms")}
        {[
          ["Dev Chat", "3 in"],
          ["Squad Up", "open"],
        ].map(([n, c]) => (
          <div
            key={n}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px" }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 9,
                background: c === "open" ? "rgba(255,255,255,.25)" : "#22c55e",
              }}
            />
            <span style={{ flex: 1, fontSize: 10.5, fontWeight: 700, color: "#fff" }}>{n}</span>
            <span style={{ fontSize: 8.5, color: "rgba(255,255,255,.45)" }}>{c}</span>
          </div>
        ))}
      </div>
    ),
    whoshere: (
      <div key="whoshere" style={card({ paddingBottom: 8 })}>
        {title("Who's here")}
        <div style={{ display: "flex", gap: 4, padding: "2px 10px" }}>
          {["#7c3aed", "#16a34a", "#eab308", "#ec4899", "#14b8a6"].map((c) => (
            <span key={c} style={{ width: 16, height: 16, borderRadius: 99, background: c }} />
          ))}
        </div>
      </div>
    ),
    discover: (
      <div key="discover" style={card({ paddingBottom: 6 })}>
        {title("Discover")}
        {["EVE Online", "Destiny 2"].map((n) => (
          <div
            key={n}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px" }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 5,
                background: alpha(C.a, 0.35),
                display: "grid",
                placeItems: "center",
                fontSize: 8,
                fontWeight: 900,
                color: "#fff",
              }}
            >
              {n[0]}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff" }}>{n}</span>
          </div>
        ))}
      </div>
    ),
  };
  const draw = (it: ShellItem) => (isCore(it) ? (sections[it] ?? null) : blockMini(it));

  const tiles = ["The Lobby", "Co-Work", "Chess", "Study Hall"];
  const right = p.layout.right;

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
            gridTemplateColumns: right.length
              ? "minmax(0, 36%) minmax(0, 1fr) minmax(0, 27%)"
              : "minmax(0, 44%) minmax(0, 1fr)",
            gap,
            padding: gap + 2,
          }}
        >
          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap }}>
            {p.layout.left.map(draw)}
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

            {/* Home's sections, in the layout's order: the ones a miniature can show. */}
            {p.layout.home.map((it) => {
              if (!isCore(it)) return blockMini(it);
              if (it === "hero")
                return (
                  <div
                    key="hero"
                    style={{
                      position: "relative",
                      borderRadius: neb ? 16 : 2,
                      overflow: "hidden",
                      border: `1px solid ${neb ? alpha(C.a, 0.34) : "rgba(124,58,237,.5)"}`,
                      boxShadow: neb ? `0 22px 50px -26px ${alpha(C.b, 0.9)}` : "none",
                      minHeight: 112,
                      transition: "border-color .35s, box-shadow .35s",
                      background: `radial-gradient(90% 120% at 10% 0%, ${alpha(C.a, 0.55)}, transparent 60%), radial-gradient(80% 90% at 100% 100%, ${alpha(C.c, 0.8)}, transparent 60%), ${C.ink}`,
                    }}
                  >
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
                        FEATURED
                      </span>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginTop: 6 }}>
                        Your next hangout
                      </div>
                      <span
                        style={{
                          alignSelf: "flex-start",
                          marginTop: 7,
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: "5px 11px",
                          borderRadius: neb ? 99 : 0,
                          color: neb ? C.on : "#fff",
                          background: neb ? `linear-gradient(135deg, ${C.a}, ${C.b})` : "#e8452f",
                          boxShadow: neb ? `0 6px 18px ${alpha(C.a, 0.5)}` : "none",
                        }}
                      >
                        Join lobby
                      </span>
                    </div>
                  </div>
                );
              if (it === "pulse")
                return (
                  <div key="pulse" style={card({ paddingBottom: 7 })}>
                    {title("Friends & crew · 2 online")}
                    <div style={{ display: "flex", gap: 6, padding: "2px 9px" }}>
                      {[
                        ["donkey", "#7c3aed"],
                        ["kom", "#16a34a"],
                      ].map(([n, c]) => (
                        <span
                          key={n}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "3px 8px 3px 3px",
                            borderRadius: 99,
                            fontSize: 9.5,
                            fontWeight: 800,
                            color: "#fff",
                            background: "rgba(255,255,255,.06)",
                          }}
                        >
                          <span
                            style={{ width: 14, height: 14, borderRadius: 99, background: c }}
                          />
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              if (it === "featured")
                return (
                  <div
                    key="featured"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: gap - 2,
                    }}
                  >
                    {tiles.map((t) => (
                      <div
                        key={t}
                        style={{
                          borderRadius: neb ? 12 : 2,
                          overflow: "hidden",
                          border: `1px solid ${neb ? "rgba(255,255,255,.08)" : "rgba(217,169,66,.35)"}`,
                          background: neb
                            ? `linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.012)), ${alpha(C.ink, 0.62)}`
                            : "#1b1b1f",
                        }}
                      >
                        <div
                          style={{
                            height: 30,
                            background: `linear-gradient(120deg, ${alpha(C.a, 0.4)}, ${alpha(C.c, 0.5)})`,
                          }}
                        />
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
                          {t}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              return null;
            })}
          </div>

          {/* Right panel */}
          {right.length > 0 && (
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap }}>
              {right.map(draw)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
