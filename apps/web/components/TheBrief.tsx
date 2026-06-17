"use client";
import React, { useEffect, useState } from "react";

const STORAGE_KEY = "weered:fakeout:brief:seen";
const ACCENT = "#F5C518";
const GREEN = "#22c55e";
const RED = "#ef4444";

type PanelDef = {
  label: string;
  title: string;
  body: React.ReactNode;
  visual: React.ReactNode;
};

function VisualWordmark() {
  return (
    <div
      style={{
        height: 140,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 10,
        background: "linear-gradient(135deg, rgba(245,197,24,0.06), rgba(124,58,237,0.06))",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
          fontSize: 56,
          fontWeight: 900,
          letterSpacing: "-2px",
          background: `linear-gradient(135deg, #fff, ${ACCENT})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textTransform: "uppercase",
        }}
      >
        FakeOut
      </div>
      <div
        style={{
          fontSize: 11,
          color: "rgba(243,244,246,.5)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Real prices · Fake money · Real witnesses
      </div>
    </div>
  );
}

function VisualModes() {
  const Pill = ({ label, sub, active }: { label: string; sub: string; active?: boolean }) => (
    <div
      style={{
        flex: 1,
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${active ? `${ACCENT}55` : "rgba(255,255,255,0.08)"}`,
        background: active ? `linear-gradient(135deg, ${ACCENT}1a, ${RED}10)` : "transparent",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "1px",
          textTransform: "uppercase",
          color: active ? "#fff" : "rgba(243,244,246,.55)",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 10, color: "rgba(243,244,246,.4)", marginTop: 3 }}>{sub}</div>
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: 6,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
      }}
    >
      <Pill label="Casual" sub="$100K · for fun · base Paper" />
      <Pill label="Ranked" sub="$1K · 10× Paper · Notoriety" active />
    </div>
  );
}

function VisualChart() {
  const points = "0,40 12,32 24,38 36,22 48,28 60,16 72,20 84,8 96,12 108,4";
  return (
    <div
      style={{
        height: 140,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 4, fontSize: 9, letterSpacing: "0.5px" }}>
        {["1m", "5m", "15m", "1h", "4h", "1D", "1W"].map((t, i) => (
          <span
            key={t}
            style={{
              padding: "2px 7px",
              borderRadius: 4,
              background: i === 0 ? `${ACCENT}20` : "rgba(255,255,255,0.04)",
              color: i === 0 ? ACCENT : "rgba(243,244,246,0.4)",
              fontWeight: 700,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 110 50" style={{ flex: 1 }} preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={GREEN} strokeWidth="1.5" />
        <polygon points={`${points} 108,50 0,50`} fill={`${GREEN}15`} />
      </svg>
      <div style={{ fontSize: 10, color: "rgba(243,244,246,0.45)", fontFamily: "monospace" }}>
        BTCUSDT · $67,234.12 <span style={{ color: GREEN }}>+2.4%</span>
      </div>
    </div>
  );
}

function VisualOrderEntry() {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: 10,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            fontSize: 10,
            color: "rgba(243,244,246,0.4)",
            letterSpacing: "0.4px",
            textTransform: "uppercase",
          }}
        >
          USD amount
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            color: "rgba(243,244,246,0.85)",
            padding: "6px 8px",
            borderRadius: 6,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          $1,000
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <div
            style={{
              flex: 1,
              padding: "5px 8px",
              borderRadius: 6,
              background: `${GREEN}1a`,
              border: `1px solid ${GREEN}55`,
              color: GREEN,
              fontSize: 11,
              fontWeight: 800,
              textAlign: "center",
              letterSpacing: "0.5px",
            }}
          >
            BUY · LONG
          </div>
          <div
            style={{
              flex: 1,
              padding: "5px 8px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(243,244,246,0.45)",
              fontSize: 11,
              fontWeight: 600,
              textAlign: "center",
              letterSpacing: "0.5px",
            }}
          >
            SELL · SHORT
          </div>
        </div>
      </div>
      <div style={{ width: 1, background: "rgba(255,255,255,0.05)" }} />
      <div
        style={{
          flex: 1.2,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: "rgba(243,244,246,0.35)",
            letterSpacing: "0.6px",
            textTransform: "uppercase",
          }}
        >
          Then in chat:
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 8px",
            borderRadius: 4,
            borderLeft: `2px solid ${GREEN}99`,
            background: `${GREEN}08`,
            fontFamily: "monospace",
            fontSize: 10,
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 800, opacity: 0.5 }}>FAKEOUT</span>
          <span style={{ color: "rgba(243,244,246,0.85)", fontWeight: 700 }}>you</span>
          <span
            style={{
              background: `${GREEN}26`,
              color: GREEN,
              padding: "0 4px",
              borderRadius: 2,
              fontSize: 8,
              fontWeight: 800,
            }}
          >
            LONG
          </span>
          <span style={{ color: "rgba(243,244,246,0.55)" }}>BTC</span>
          <span style={{ marginLeft: "auto", color: "rgba(243,244,246,0.5)" }}>$1,000</span>
        </div>
      </div>
    </div>
  );
}

function VisualTicker() {
  const Row = ({
    rank,
    name,
    pnl,
    pct,
    up,
  }: {
    rank: string;
    name: string;
    pnl: string;
    pct: string;
    up: boolean;
  }) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 11,
        fontFamily: "monospace",
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 800, color: ACCENT, opacity: 0.7 }}>{rank}</span>
      <span style={{ fontWeight: 700, color: "rgba(243,244,246,.85)" }}>{name}</span>
      <span style={{ color: up ? GREEN : RED, fontWeight: 700 }}>{pnl}</span>
      <span style={{ color: up ? GREEN : RED, opacity: 0.7 }}>({pct})</span>
    </span>
  );
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
        background: `linear-gradient(90deg, ${ACCENT}05 0%, ${ACCENT}10 50%, ${ACCENT}05 100%)`,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", gap: 24, whiteSpace: "nowrap" }}>
        <Row rank="1ST" name="stirling" pnl="+$12,420" pct="+12.4%" up />
        <Row rank="2ND" name="donkey" pnl="+$8,221" pct="+8.2%" up />
        <Row rank="3RD" name="freigh" pnl="-$1,043" pct="-1.0%" up={false} />
      </div>
    </div>
  );
}

function VisualOperator() {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: "50%",
          background: "rgba(212,160,23,0.12)",
          border: "1px solid rgba(212,160,23,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        🤖
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 10,
            color: "rgb(212,160,23)",
            fontWeight: 800,
            letterSpacing: "0.4px",
            textTransform: "uppercase",
          }}
        >
          The Operator
        </div>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(212,160,23,0.06)",
            border: "1px solid rgba(212,160,23,0.18)",
            fontSize: 12,
            color: "rgba(243,244,246,0.85)",
            lineHeight: 1.4,
            fontStyle: "italic",
          }}
        >
          stirling just averaged down on a -8% short. bold strategy.
        </div>
      </div>
    </div>
  );
}

function VisualReset() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: RED, fontFamily: "monospace" }}>
          $0.42
        </div>
        <div style={{ fontSize: 18, color: "rgba(243,244,246,0.3)" }}>→</div>
        <button
          type="button"
          disabled
          style={{
            padding: "5px 14px",
            borderRadius: 7,
            border: `1px solid ${ACCENT}40`,
            background: `${ACCENT}15`,
            color: ACCENT,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          Reset
        </button>
        <div style={{ fontSize: 18, color: "rgba(243,244,246,0.3)" }}>→</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: GREEN, fontFamily: "monospace" }}>
          $1K
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "rgba(243,244,246,0.4)",
          letterSpacing: "0.4px",
          textTransform: "uppercase",
        }}
      >
        blank slate. no record kept.
      </div>
    </div>
  );
}

function VisualLobbyVsRoom() {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: `1px dashed ${ACCENT}55`,
          background: `${ACCENT}06`,
          fontSize: 11,
          fontWeight: 800,
          color: ACCENT,
          letterSpacing: "1px",
          textTransform: "uppercase",
        }}
      >
        FakeOut Lobby — everyone trading
      </div>
      <div
        style={{ paddingLeft: 16, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}
      >
        {[
          "Stirling's room · live signals",
          "Wall Street Crew · ranked",
          "Forex Desk · EUR/USD focus",
        ].map((name) => (
          <div
            key={name}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid rgba(124,58,237,0.25)",
              background: "rgba(124,58,237,0.06)",
              fontSize: 10,
              color: "rgba(216,180,254,0.85)",
              fontFamily: "monospace",
            }}
          >
            ↳ {name}
          </div>
        ))}
      </div>
    </div>
  );
}

const PANELS: PanelDef[] = [
  {
    label: "what this is",
    title: "Welcome to FakeOut.",
    body: (
      <>
        Real Binance prices. Fake money. Your every move is tracked live and the whole room sees it.
        <br />
        <br />
        Lose everything? Reset. Start over. Nobody&apos;s keeping receipts.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>Probably.</span>
      </>
    ),
    visual: <VisualWordmark />,
  },
  {
    label: "casual or ranked",
    title: "Pick your bank.",
    body: (
      <>
        <strong style={{ color: ACCENT }}>Casual — $100K.</strong> For fun. Tank the account, who
        cares.
        <br />
        <br />
        <strong style={{ color: ACCENT }}>Ranked — $1K.</strong> Counts. Pays 10× the Paper, climbs
        Notoriety XP, sits on a separate leaderboard people actually respect.
        <br />
        <br />
        Pick the pill at the top. Switch anytime — your two accounts are separate.
      </>
    ),
    visual: <VisualModes />,
  },
  {
    label: "read the chart",
    title: "Symbol. Timeframe. Chart.",
    body: (
      <>
        BTC, ETH, SOL — the usual suspects. FX majors rolling out next.
        <br />
        <br />
        Pick a timeframe — 1m for scalping, 1D if you like to look at it like a chart. The chart
        updates live off the Binance feed.
        <br />
        <br />
        Mouse wheel won&apos;t hijack the page. Use the FIT / + / – buttons in the chart corner.
      </>
    ),
    visual: <VisualChart />,
  },
  {
    label: "place a trade",
    title: "Long, short, witnessed.",
    body: (
      <>
        <strong style={{ color: GREEN }}>Long</strong> = you think it goes up.{" "}
        <strong style={{ color: RED }}>Short</strong> = you think it goes down.
        <br />
        <br />
        Type a dollar amount. Hit BUY or SELL. The room sees your trade instantly — name, side,
        size, price — as a chip in chat. No bots. No copy-paste.
        <br />
        <br />
        Discord literally cannot do this.
      </>
    ),
    visual: <VisualOrderEntry />,
  },
  {
    label: "the wall",
    title: "Everyone is watching.",
    body: (
      <>
        That scrolling bar at the top is the live leaderboard — top 8 traders by total PnL,
        refreshed every 5 seconds.
        <br />
        <br />
        Climb it. Or don&apos;t. Your call.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>Hover the bar to pause the scroll.</span>
      </>
    ),
    visual: <VisualTicker />,
  },
  {
    label: "the operator",
    title: "I heckle big trades.",
    body: (
      <>
        Close a position over $500 profit? I might say something.
        <br />
        <br />
        Lose more than $500? Definitely.
        <br />
        <br />
        Open a position bigger than $20K? Yeah, I&apos;m watching.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>
          Nothing personal. Or maybe a little personal.
        </span>
      </>
    ),
    visual: <VisualOperator />,
  },
  {
    label: "blew up?",
    title: "Reset and run it back.",
    body: (
      <>
        One button. Your account starts fresh at the mode&apos;s starting balance — $100K casual,
        $1K ranked.
        <br />
        <br />
        No log of the casualty. No badge of shame. Just a clean slate.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>
          The leaderboard remembers. The leaderboard always remembers.
        </span>
      </>
    ),
    visual: <VisualReset />,
  },
  {
    label: "rooms vs lobby",
    title: "Run your own room.",
    body: (
      <>
        The <strong style={{ color: ACCENT }}>FakeOut lobby</strong> is everyone trading. Big tent.
        <br />
        <br />
        <strong style={{ color: ACCENT }}>Rooms inside it</strong> are your crew, your stream, your
        strategy. Voice, screenshare, charts, paper-trade state — all native.
        <br />
        <br />
        Members trade alongside you. The chat sees the book. No 50-viewer cap.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>
          Discord&apos;s at the door. You&apos;re inside.
        </span>
      </>
    ),
    visual: <VisualLobbyVsRoom />,
  },
];

export default function TheBrief({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep((s) => Math.min(PANELS.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panel = PANELS[step];
  const isLast = step === PANELS.length - 1;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    onClose();
  }

  return (
    <div
      onClick={dismiss}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dismiss();
        }
      }}
      tabIndex={0}
      role="button"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(4,4,8,0.78)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        tabIndex={0}
        role="button"
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 16,
          border: "1px solid rgba(245,197,24,0.20)",
          background: "linear-gradient(180deg, rgba(18,16,8,0.98), rgba(8,8,14,0.98))",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,197,24,0.06) inset",
          overflow: "hidden",
          fontFamily: "var(--font-barlow), system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "1px",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 999,
                background: `${ACCENT}18`,
                border: `1px solid ${ACCENT}40`,
                color: ACCENT,
              }}
            >
              The Brief
            </span>
            <span
              style={{
                fontSize: 10,
                color: "rgba(243,244,246,0.35)",
                letterSpacing: "0.4px",
                textTransform: "uppercase",
              }}
            >
              · {panel.label}
            </span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            style={{
              background: "none",
              border: "none",
              color: "rgba(243,244,246,0.4)",
              fontSize: 18,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        <div
          style={{ padding: "22px 24px 18px", display: "flex", flexDirection: "column", gap: 18 }}
        >
          <div>{panel.visual}</div>
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.4px",
                marginBottom: 10,
                color: "rgba(243,244,246,0.95)",
              }}
            >
              {panel.title}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(243,244,246,0.75)" }}>
              {panel.body}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 5, padding: "0 24px" }}>
          {PANELS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 22 : 6,
                height: 6,
                borderRadius: 999,
                border: "none",
                padding: 0,
                cursor: "pointer",
                background: i === step ? ACCENT : "rgba(255,255,255,0.10)",
                transition: "all 0.2s",
              }}
              aria-label={`Go to ${PANELS[i].label}`}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 18px",
          }}
        >
          <button
            type="button"
            onClick={dismiss}
            style={{
              background: "none",
              border: "none",
              color: "rgba(243,244,246,0.35)",
              fontSize: 11,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Skip the brief
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(243,244,246,0.7)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                isLast ? dismiss() : setStep((s) => Math.min(PANELS.length - 1, s + 1))
              }
              style={{
                padding: "7px 22px",
                borderRadius: 8,
                border: `1px solid ${ACCENT}50`,
                background: `${ACCENT}18`,
                color: ACCENT,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.5px",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {isLast ? "Step onto the floor" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useTheBrief(): { open: boolean; show: () => void; hide: () => void } {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {}
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);
  return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}
