"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  CSSProperties,
} from "react";
import { avatarBg } from "../lib/avatarColor";

// ─── Config ──────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
function getToken() {
  try {
    return localStorage.getItem("weered_token") || "";
  } catch {
    return "";
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Card {
  rank: string;
  suit: string;
}

interface Seat {
  seatIndex: number;
  userId: string;
  name: string;
  chips: number;
  cards: Card[] | null;
  folded: boolean;
  allIn: boolean;
  bet: number;
}

interface Winner {
  seatIndex: number;
  name: string;
  handName: string;
  winnings: number;
}

interface TableState {
  tableId: string;
  seats: (Seat | null)[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  dealerIndex: number;
  turnIndex: number;
  phase:
    | "waiting"
    | "preflop"
    | "flop"
    | "turn"
    | "river"
    | "showdown";
  blinds: { small: number; big: number };
  minBuyin: number;
  maxBuyin: number;
  winners?: Winner[];
  lastAction?: { userId: string; action: string; amount?: number };
}

interface Props {
  roomId: string;
  myId: string;
  myName: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const COLORS = {
  felt: "#0a5c36",
  feltLight: "#0e7a4a",
  border: "#1a3a2a",
  cardFace: "#f5f5f0",
  cardBack: "#1a1a3a",
  red: "#dc2626",
  black: "#1a1a2a",
  gold: "#D4A017",
  purple: "#5800E5",
  text: "rgba(243,244,246,.95)",
  textDim: "rgba(243,244,246,.55)",
  bg: "#0d0d12",
  panelBg: "rgba(10,10,18,.92)",
  overlay: "rgba(0,0,0,.7)",
};

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
  s: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: COLORS.red,
  diamonds: COLORS.red,
  clubs: COLORS.black,
  spades: COLORS.black,
  h: COLORS.red,
  d: COLORS.red,
  c: COLORS.black,
  s: COLORS.black,
};

// 6 seats: TL, TR, ML, MR, BL, BR
const SEAT_POSITIONS: {
  top: string;
  left: string;
  bottom?: string;
  right?: string;
  transform?: string;
}[] = [
  { top: "4%", left: "25%", transform: "translateX(-50%)" },       // 0: top-left
  { top: "4%", left: "75%", transform: "translateX(-50%)" },       // 1: top-right
  { top: "42%", left: "2%", transform: "translateY(-50%)" },       // 2: mid-left
  { top: "42%", left: "88%", transform: "translateY(-50%)" },      // 3: mid-right
  { top: "78%", left: "25%", transform: "translateX(-50%)" },      // 4: bottom-left
  { top: "78%", left: "75%", transform: "translateX(-50%)" },      // 5: bottom-right
];

// Where the bet chip appears relative to each seat (closer to table center)
const BET_POSITIONS: { top: string; left: string }[] = [
  { top: "22%", left: "28%" },
  { top: "22%", left: "68%" },
  { top: "42%", left: "16%" },
  { top: "42%", left: "80%" },
  { top: "64%", left: "28%" },
  { top: "64%", left: "68%" },
];

const PHASE_LABELS: Record<string, string> = {
  waiting: "Waiting",
  preflop: "Pre-Flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function wsSend(msg: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent("weered:ws:send", { detail: msg })
  );
}

function chipStr(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function nameInitial(name: string): string {
  return (name || "?").charAt(0).toUpperCase();
}

// ─── Keyframes (injected once) ───────────────────────────────────────────────
let styleInjected = false;
function injectKeyframes() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pokerGlow {
      0%, 100% { box-shadow: 0 0 8px 2px rgba(88,0,229,.6), 0 0 20px 4px rgba(88,0,229,.3); }
      50% { box-shadow: 0 0 16px 6px rgba(88,0,229,.8), 0 0 32px 8px rgba(88,0,229,.4); }
    }
    @keyframes pokerAllIn {
      0%, 100% { box-shadow: 0 0 8px 2px rgba(212,160,23,.6); }
      50% { box-shadow: 0 0 20px 8px rgba(212,160,23,.9); }
    }
    @keyframes pokerFlipIn {
      0% { transform: scaleX(0); }
      100% { transform: scaleX(1); }
    }
    @keyframes pokerFadeToast {
      0% { opacity: 1; transform: translateY(0); }
      70% { opacity: 1; }
      100% { opacity: 0; transform: translateY(-20px); }
    }
    @keyframes pokerWinnerPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.03); }
    }
    @keyframes pokerSlideUp {
      0% { opacity: 0; transform: translateY(30px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes pokerChipDrop {
      0% { opacity: 0; transform: translateY(-10px) scale(.8); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes pokerDealerSpin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// ─── CardView ────────────────────────────────────────────────────────────────
function CardView({
  card,
  faceDown,
  large,
  flipping,
}: {
  card?: Card;
  faceDown?: boolean;
  large?: boolean;
  flipping?: boolean;
}) {
  const w = large ? 62 : 48;
  const h = large ? 88 : 68;
  const fontSize = large ? 16 : 13;

  const base: CSSProperties = {
    width: w,
    height: h,
    borderRadius: 7,
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Georgia', serif",
    fontWeight: 700,
    margin: "0 2px",
    position: "relative",
    flexShrink: 0,
    transition: "transform .3s ease",
  };

  if (faceDown || !card) {
    return (
      <div
        style={{
          ...base,
          background: `linear-gradient(135deg, ${COLORS.cardBack} 0%, #2a2a5a 50%, ${COLORS.cardBack} 100%)`,
          border: "2px solid #333366",
          boxShadow: "0 2px 8px rgba(0,0,0,.5)",
          overflow: "hidden",
        }}
      >
        {/* Subtle cross-hatch pattern */}
        <div
          style={{
            position: "absolute",
            inset: 3,
            borderRadius: 4,
            border: "1px solid rgba(100,100,180,.3)",
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(100,100,180,.08) 4px, rgba(100,100,180,.08) 5px), repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(100,100,180,.08) 4px, rgba(100,100,180,.08) 5px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: 3,
            border: "1px solid rgba(100,100,180,.15)",
          }}
        />
      </div>
    );
  }

  const suitKey = card.suit.toLowerCase();
  const symbol = SUIT_SYMBOLS[suitKey] || card.suit;
  const color = SUIT_COLORS[suitKey] || COLORS.black;

  return (
    <div
      style={{
        ...base,
        background: `linear-gradient(160deg, ${COLORS.cardFace} 0%, #e8e8e0 100%)`,
        border: "1.5px solid #ccc",
        boxShadow: "0 3px 10px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.6)",
        color,
        fontSize,
        animation: flipping ? "pokerFlipIn .35s ease-out" : undefined,
      }}
    >
      {/* Top-left rank/suit */}
      <div
        style={{
          position: "absolute",
          top: 3,
          left: 5,
          lineHeight: 1,
          fontSize: fontSize - 1,
        }}
      >
        <div>{card.rank}</div>
        <div style={{ fontSize: fontSize + 2, marginTop: -2 }}>{symbol}</div>
      </div>
      {/* Center suit */}
      <div style={{ fontSize: large ? 28 : 22, lineHeight: 1 }}>{symbol}</div>
      {/* Bottom-right rank/suit (inverted) */}
      <div
        style={{
          position: "absolute",
          bottom: 3,
          right: 5,
          lineHeight: 1,
          fontSize: fontSize - 1,
          transform: "rotate(180deg)",
        }}
      >
        <div>{card.rank}</div>
        <div style={{ fontSize: fontSize + 2, marginTop: -2 }}>{symbol}</div>
      </div>
    </div>
  );
}

// ─── Dealer Button ───────────────────────────────────────────────────────────
function DealerButton() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #fef3c7, #f59e0b)",
        border: "2px solid #b45309",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        fontSize: 11,
        color: "#78350f",
        boxShadow: "0 2px 6px rgba(0,0,0,.4)",
        position: "absolute",
        top: -8,
        right: -8,
        zIndex: 5,
      }}
    >
      D
    </div>
  );
}

// ─── ChipStack (bet display) ─────────────────────────────────────────────────
function ChipStack({ amount }: { amount: number }) {
  if (!amount) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        animation: "pokerChipDrop .3s ease-out",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.gold}, #b8860b)`,
          border: "2px solid #8B6914",
          boxShadow: "0 1px 4px rgba(0,0,0,.4)",
        }}
      />
      <span
        style={{
          color: COLORS.gold,
          fontWeight: 700,
          fontSize: 13,
          textShadow: "0 1px 3px rgba(0,0,0,.6)",
        }}
      >
        {chipStr(amount)}
      </span>
    </div>
  );
}

// ─── SeatView ────────────────────────────────────────────────────────────────
function SeatView({
  seat,
  seatIndex,
  isMe,
  isDealer,
  isTurn,
  isShowdown,
  onSitDown,
}: {
  seat: Seat | null;
  seatIndex: number;
  isMe: boolean;
  isDealer: boolean;
  isTurn: boolean;
  isShowdown: boolean;
  onSitDown: (seatIndex: number) => void;
}) {
  const pos = SEAT_POSITIONS[seatIndex];

  const container: CSSProperties = {
    position: "absolute",
    top: pos.top,
    left: pos.left,
    transform: pos.transform,
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  };

  // Empty seat
  if (!seat) {
    return (
      <div style={container}>
        <button
          onClick={() => onSitDown(seatIndex)}
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(255,255,255,.06)",
            border: "2px dashed rgba(255,255,255,.2)",
            color: COLORS.textDim,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            transition: "all .2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(88,0,229,.2)";
            e.currentTarget.style.borderColor = COLORS.purple;
            e.currentTarget.style.color = COLORS.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,.06)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,.2)";
            e.currentTarget.style.color = COLORS.textDim;
          }}
        >
          <span style={{ fontSize: 20 }}>+</span>
          <span>Sit</span>
        </button>
      </div>
    );
  }

  // Occupied seat
  const bg = avatarBg(seat.name, isMe);
  const folded = seat.folded;
  const allIn = seat.allIn;

  let borderStyle = "3px solid transparent";
  let animName: string | undefined;
  if (isTurn && !folded) {
    borderStyle = `3px solid ${COLORS.purple}`;
    animName = "pokerGlow";
  } else if (allIn) {
    borderStyle = `3px solid ${COLORS.gold}`;
    animName = "pokerAllIn";
  }

  const seatStyle: CSSProperties = {
    ...container,
    opacity: folded ? 0.45 : 1,
    transition: "opacity .3s",
  };

  const avatarStyle: CSSProperties = {
    width: isMe ? 72 : 64,
    height: isMe ? 72 : 64,
    borderRadius: "50%",
    background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: isMe ? 28 : 24,
    fontWeight: 800,
    color: "#fff",
    textShadow: "0 2px 4px rgba(0,0,0,.3)",
    border: borderStyle,
    animation: animName ? `${animName} 1.5s ease-in-out infinite` : undefined,
    position: "relative" as const,
    boxShadow: "0 4px 12px rgba(0,0,0,.4)",
  };

  const showCards = isMe || isShowdown;
  const cards = seat.cards;

  return (
    <div style={seatStyle}>
      {/* Cards behind avatar */}
      {cards && cards.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 2,
            marginBottom: -8,
            position: "relative",
            zIndex: 1,
          }}
        >
          {cards.map((c, i) => (
            <CardView
              key={i}
              card={showCards ? c : undefined}
              faceDown={!showCards}
              large={isMe}
              flipping={isShowdown && !isMe}
            />
          ))}
        </div>
      )}

      {/* Avatar circle */}
      <div style={{ position: "relative" }}>
        <div style={avatarStyle}>{nameInitial(seat.name)}</div>
        {isDealer && <DealerButton />}
      </div>

      {/* Name */}
      <div
        style={{
          color: COLORS.text,
          fontSize: 12,
          fontWeight: 600,
          maxWidth: 100,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
          textShadow: "0 1px 3px rgba(0,0,0,.6)",
        }}
      >
        {seat.name}
      </div>

      {/* Chip count */}
      <div
        style={{
          color: COLORS.gold,
          fontSize: 12,
          fontWeight: 700,
          textShadow: "0 1px 3px rgba(0,0,0,.6)",
        }}
      >
        {chipStr(seat.chips)}
      </div>

      {/* Status badges */}
      {folded && (
        <div
          style={{
            fontSize: 10,
            color: COLORS.red,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Folded
        </div>
      )}
      {allIn && !folded && (
        <div
          style={{
            fontSize: 10,
            color: COLORS.gold,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            textShadow: `0 0 8px ${COLORS.gold}`,
          }}
        >
          All-In
        </div>
      )}
    </div>
  );
}

// ─── BuyInDialog ─────────────────────────────────────────────────────────────
function BuyInDialog({
  min,
  max,
  seatIndex,
  onConfirm,
  onCancel,
}: {
  min: number;
  max: number;
  seatIndex: number;
  onConfirm: (seatIndex: number, amount: number) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(Math.min(max, Math.max(min, Math.floor((min + max) / 2))));

  const dlg: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: COLORS.overlay,
    animation: "pokerSlideUp .25s ease-out",
  };

  const panel: CSSProperties = {
    background: "linear-gradient(160deg, #141420 0%, #0d0d18 100%)",
    border: `1px solid rgba(88,0,229,.4)`,
    borderRadius: 16,
    padding: "32px 36px",
    minWidth: 320,
    color: COLORS.text,
    boxShadow: "0 20px 60px rgba(0,0,0,.7)",
  };

  return (
    <div style={dlg} onClick={onCancel}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 20,
            fontWeight: 800,
            color: COLORS.gold,
          }}
        >
          Buy In — Seat {seatIndex + 1}
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: COLORS.textDim }}>
          Min: {chipStr(min)} — Max: {chipStr(max)}
        </p>

        <input
          type="range"
          min={min}
          max={max}
          step={Math.max(1, Math.floor(min / 10))}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          style={{ width: "100%", accentColor: COLORS.purple, marginBottom: 12 }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <input
            type="number"
            min={min}
            max={max}
            value={amount}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v)) setAmount(Math.min(max, Math.max(min, v)));
            }}
            style={{
              flex: 1,
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.15)",
              borderRadius: 8,
              padding: "10px 14px",
              color: COLORS.text,
              fontSize: 18,
              fontWeight: 700,
              textAlign: "center",
              outline: "none",
            }}
          />
          <span style={{ color: COLORS.gold, fontWeight: 700, fontSize: 15 }}>chips</span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.15)",
              background: "transparent",
              color: COLORS.textDim,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(seatIndex, amount)}
            style={{
              flex: 2,
              padding: "12px 0",
              borderRadius: 10,
              border: "none",
              background: `linear-gradient(135deg, ${COLORS.purple}, #7b2ff2)`,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: `0 4px 16px rgba(88,0,229,.4)`,
            }}
          >
            Sit Down — {chipStr(amount)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WinnerOverlay ───────────────────────────────────────────────────────────
function WinnerOverlay({ winners }: { winners: Winner[] }) {
  if (!winners || winners.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,.55)",
        borderRadius: "50%",
        animation: "pokerSlideUp .4s ease-out",
      }}
    >
      <div
        style={{
          background: "linear-gradient(160deg, #1a1a30 0%, #0d0d18 100%)",
          border: `2px solid ${COLORS.gold}`,
          borderRadius: 16,
          padding: "24px 36px",
          textAlign: "center",
          boxShadow: `0 0 40px rgba(212,160,23,.3)`,
          animation: "pokerWinnerPulse 2s ease-in-out infinite",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: COLORS.gold,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          Winner{winners.length > 1 ? "s" : ""}
        </div>
        {winners.map((w, i) => (
          <div key={i} style={{ marginBottom: i < winners.length - 1 ? 12 : 0 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: COLORS.text,
                textShadow: `0 0 12px ${COLORS.gold}`,
              }}
            >
              {w.name}
            </div>
            <div
              style={{
                fontSize: 14,
                color: COLORS.purple,
                fontWeight: 600,
                margin: "4px 0",
              }}
            >
              {w.handName}
            </div>
            <div
              style={{
                fontSize: 18,
                color: COLORS.gold,
                fontWeight: 800,
              }}
            >
              +{chipStr(w.winnings)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ActionBar ───────────────────────────────────────────────────────────────
function ActionBar({
  state,
  mySeat,
}: {
  state: TableState;
  mySeat: Seat;
}) {
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaiseInput, setShowRaiseInput] = useState(false);

  const callAmount = Math.max(0, state.currentBet - mySeat.bet);
  const minRaise = Math.max(state.currentBet * 2, state.blinds.big);
  const maxRaise = mySeat.chips + mySeat.bet; // total they can put in

  useEffect(() => {
    setRaiseAmount(Math.min(minRaise, maxRaise));
  }, [minRaise, maxRaise]);

  const canCheck = state.currentBet === 0 || mySeat.bet >= state.currentBet;

  const send = useCallback(
    (action: string, amount?: number) => {
      wsSend({
        type: "poker:action",
        tableId: state.tableId,
        action,
        ...(amount !== undefined && { amount }),
      });
      setShowRaiseInput(false);
    },
    [state.tableId]
  );

  const bar: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 16px",
    background: "linear-gradient(180deg, rgba(10,10,18,.95), rgba(10,10,18,.99))",
    borderTop: "1px solid rgba(255,255,255,.08)",
    animation: "pokerSlideUp .25s ease-out",
    flexWrap: "wrap",
  };

  const btnStyle = (
    color: string,
    bg: string,
    disabled?: boolean
  ): CSSProperties => ({
    padding: "10px 20px",
    borderRadius: 10,
    border: "none",
    background: disabled ? "rgba(255,255,255,.06)" : bg,
    color: disabled ? "rgba(255,255,255,.25)" : color,
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all .15s",
    boxShadow: disabled ? "none" : `0 3px 12px rgba(0,0,0,.3)`,
    minWidth: 80,
  });

  return (
    <div style={bar}>
      {/* Fold */}
      <button
        style={btnStyle("#fff", `linear-gradient(135deg, ${COLORS.red}, #b91c1c)`)}
        onClick={() => send("fold")}
      >
        Fold
      </button>

      {/* Check / Call */}
      {canCheck ? (
        <button
          style={btnStyle("#fff", "linear-gradient(135deg, #4b5563, #374151)")}
          onClick={() => send("check")}
        >
          Check
        </button>
      ) : (
        <button
          style={btnStyle("#fff", "linear-gradient(135deg, #2563eb, #1d4ed8)", callAmount > mySeat.chips)}
          onClick={() => send("call")}
          disabled={callAmount > mySeat.chips}
        >
          Call {chipStr(callAmount)}
        </button>
      )}

      {/* Raise */}
      {showRaiseInput ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="range"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            style={{ width: 120, accentColor: COLORS.purple }}
          />
          <input
            type="number"
            min={minRaise}
            max={maxRaise}
            value={raiseAmount}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v)) setRaiseAmount(Math.min(maxRaise, Math.max(minRaise, v)));
            }}
            style={{
              width: 72,
              background: "rgba(255,255,255,.08)",
              border: `1px solid ${COLORS.purple}`,
              borderRadius: 6,
              padding: "6px 8px",
              color: COLORS.text,
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
              outline: "none",
            }}
          />
          <button
            style={btnStyle("#fff", `linear-gradient(135deg, ${COLORS.purple}, #7b2ff2)`)}
            onClick={() => send("raise", raiseAmount)}
          >
            Raise
          </button>
          <button
            onClick={() => setShowRaiseInput(false)}
            style={{
              background: "none",
              border: "none",
              color: COLORS.textDim,
              cursor: "pointer",
              fontSize: 16,
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          style={btnStyle("#fff", `linear-gradient(135deg, ${COLORS.purple}, #7b2ff2)`, mySeat.chips <= callAmount)}
          onClick={() => setShowRaiseInput(true)}
          disabled={mySeat.chips <= callAmount}
        >
          Raise
        </button>
      )}

      {/* All-In */}
      <button
        style={btnStyle("#000", `linear-gradient(135deg, ${COLORS.gold}, #b8860b)`)}
        onClick={() => send("allIn")}
      >
        All-In
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function PokerTable({ roomId, myId, myName }: Props) {
  const [state, setState] = useState<TableState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [buyInSeat, setBuyInSeat] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActionRef = useRef<string>("");

  // Inject keyframes
  useEffect(() => {
    injectKeyframes();
  }, []);

  // Fetch initial state
  useEffect(() => {
    const token = getToken();
    fetch(`${API}/poker/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data?.table) setState(data.table);
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); });
  }, [roomId]);

  // Listen for WS state updates
  useEffect(() => {
    function handleState(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail && (detail.tableId === roomId || !state)) {
        setState(detail);
      }
    }
    window.addEventListener("weered:poker:state", handleState);
    return () => window.removeEventListener("weered:poker:state", handleState);
  }, [roomId, state]);

  // Toast for last action
  useEffect(() => {
    if (!state?.lastAction) return;
    const la = ts.lastAction;
    const key = `${la.userId}-${la.action}-${la.amount ?? ""}`;
    if (key === lastActionRef.current) return;
    lastActionRef.current = key;

    // Find the player name
    const seat = ts.seats?.find((s) => s && s.userId === la.userId);
    const name = seat?.name || "Player";
    let msg = `${name} ${la.action}`;
    if (la.amount !== undefined) msg += ` ${chipStr(la.amount)}`;

    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, [state?.lastAction, state?.seats]);

  // Default empty table state when no server state exists — ensures table always renders
  const ts: TableState = useMemo(() => state || {
    tableId: roomId,
    seats: [null, null, null, null, null, null],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    dealerIndex: 0,
    turnIndex: -1,
    phase: "waiting" as const,
    blinds: { small: 5, big: 10 },
    minBuyin: 200,
    maxBuyin: 2000,
  }, [state, roomId]);

  // Derived state
  const mySeat = useMemo(() => {
    return ts.seats?.find((s) => s && s.userId === myId) || null;
  }, [ts, myId]);

  const mySeatIndex = mySeat?.seatIndex ?? -1;
  const isMyTurn =
    mySeat && ts.turnIndex === mySeatIndex && !mySeat.folded;
  const isShowdown = ts.phase === "showdown";
  const isSeated = !!mySeat;

  // Actions
  const handleSitDown = useCallback((seatIndex: number) => {
    setBuyInSeat(seatIndex);
  }, []);

  const handleBuyInConfirm = useCallback(
    (seatIndex: number, amount: number) => {
      wsSend({
        type: "poker:join",
        tableId: state?.tableId || roomId,
        seatIndex,
        buyin: amount,
      });
      setBuyInSeat(null);
    },
    [state?.tableId, roomId]
  );

  const handleLeave = useCallback(() => {
    wsSend({
      type: "poker:leave",
      tableId: state?.tableId || roomId,
    });
  }, [state?.tableId, roomId]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const tableOuter: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 600,
    background: COLORS.bg,
    display: "flex",
    flexDirection: "column",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    overflow: "hidden",
    userSelect: "none",
  };

  // The green felt table (oval)
  const tableArea: CSSProperties = {
    position: "relative",
    flex: 1,
    margin: "16px 24px",
  };

  const feltOuter: CSSProperties = {
    position: "absolute",
    top: "12%",
    left: "10%",
    width: "80%",
    height: "72%",
    borderRadius: "50%",
    background: `linear-gradient(180deg, ${COLORS.border} 0%, #0f2e1e 100%)`,
    padding: 6,
    boxShadow:
      "0 8px 32px rgba(0,0,0,.6), 0 0 0 3px rgba(212,160,23,.15), inset 0 2px 8px rgba(0,0,0,.3)",
  };

  const feltInner: CSSProperties = {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    background: `radial-gradient(ellipse at 50% 45%, ${COLORS.feltLight} 0%, ${COLORS.felt} 55%, #064a2b 100%)`,
    position: "relative",
    overflow: "hidden",
    boxShadow: "inset 0 2px 16px rgba(0,0,0,.3)",
  };

  // Felt texture overlay
  const feltTexture: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background:
      "repeating-linear-gradient(90deg, transparent 0px, transparent 2px, rgba(0,0,0,.02) 2px, rgba(0,0,0,.02) 4px)",
    pointerEvents: "none",
  };

  // Rail stitching
  const feltStitch: CSSProperties = {
    position: "absolute",
    inset: 8,
    borderRadius: "50%",
    border: "1px dashed rgba(212,160,23,.12)",
    pointerEvents: "none",
  };

  return (
    <div style={tableOuter}>
      {/* Top bar: phase + leave */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px 0",
          position: "relative",
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Phase badge */}
          <div
            style={{
              padding: "4px 14px",
              borderRadius: 20,
              background: "rgba(88,0,229,.2)",
              border: `1px solid rgba(88,0,229,.35)`,
              color: COLORS.text,
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            {PHASE_LABELS[ts.phase] || ts.phase}
          </div>

          {/* Blinds */}
          <div
            style={{
              fontSize: 11,
              color: COLORS.textDim,
              fontWeight: 600,
            }}
          >
            Blinds {chipStr(ts.blinds.small)} / {chipStr(ts.blinds.big)}
          </div>

          {/* Spectator label */}
          {!isSeated && (
            <div
              style={{
                padding: "3px 10px",
                borderRadius: 12,
                background: "rgba(255,255,255,.06)",
                color: COLORS.textDim,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Spectating
            </div>
          )}
        </div>

        {/* Leave button */}
        {isSeated && (
          <button
            onClick={handleLeave}
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              border: `1px solid rgba(220,38,38,.4)`,
              background: "rgba(220,38,38,.12)",
              color: COLORS.red,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(220,38,38,.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(220,38,38,.12)";
            }}
          >
            Leave Table
          </button>
        )}
      </div>

      {/* Table area */}
      <div style={tableArea}>
        {/* Felt table */}
        <div style={feltOuter}>
          <div style={feltInner}>
            <div style={feltTexture} />
            <div style={feltStitch} />

            {/* Pot */}
            {ts.pot > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "22%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  zIndex: 5,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(212,160,23,.7)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1.5,
                  }}
                >
                  Pot
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: COLORS.gold,
                    textShadow: `0 0 16px rgba(212,160,23,.4), 0 2px 4px rgba(0,0,0,.5)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${COLORS.gold}, #8B6914)`,
                      border: "2px solid #D4A017",
                      boxShadow: "0 2px 6px rgba(0,0,0,.4)",
                      flexShrink: 0,
                    }}
                  />
                  {chipStr(ts.pot)}
                </div>
              </div>
            )}

            {/* Community cards */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                gap: 6,
                zIndex: 5,
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => {
                const card = ts.communityCards[i];
                if (card) {
                  return (
                    <CardView
                      key={i}
                      card={card}
                      large
                      flipping={
                        (ts.phase === "flop" && i < 3) ||
                        (ts.phase === "turn" && i === 3) ||
                        (ts.phase === "river" && i === 4)
                      }
                    />
                  );
                }
                // Empty card slot
                return (
                  <div
                    key={i}
                    style={{
                      width: 62,
                      height: 88,
                      borderRadius: 7,
                      border: "2px dashed rgba(255,255,255,.1)",
                      background: "rgba(0,0,0,.15)",
                    }}
                  />
                );
              })}
            </div>

            {/* Winner overlay */}
            {isShowdown && ts.winners && ts.winners.length > 0 && (
              <WinnerOverlay winners={ts.winners} />
            )}
          </div>
        </div>

        {/* Seats */}
        {ts.seats.map((seat, i) => (
          <SeatView
            key={i}
            seat={seat}
            seatIndex={i}
            isMe={seat?.userId === myId}
            isDealer={ts.dealerIndex === i}
            isTurn={ts.turnIndex === i}
            isShowdown={isShowdown}
            onSitDown={handleSitDown}
          />
        ))}

        {/* Bet chips in front of seats */}
        {ts.seats.map((seat, i) => {
          if (!seat || !seat.bet) return null;
          const pos = BET_POSITIONS[i];
          return (
            <div
              key={`bet-${i}`}
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                zIndex: 15,
                transform: "translate(-50%, -50%)",
              }}
            >
              <ChipStack amount={seat.bet} />
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 20px",
            borderRadius: 10,
            background: "rgba(10,10,18,.9)",
            border: "1px solid rgba(255,255,255,.1)",
            color: COLORS.text,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 50,
            animation: "pokerFadeToast 2.5s ease-out forwards",
            boxShadow: "0 4px 16px rgba(0,0,0,.5)",
          }}
        >
          {toast}
        </div>
      )}

      {/* Action bar */}
      {isSeated && mySeat && ts.phase !== "waiting" && ts.phase !== "showdown" && (
        <ActionBar state={ts} mySeat={mySeat} />
      )}

      {/* Buy-in dialog */}
      {buyInSeat !== null && (
        <BuyInDialog
          min={ts.minBuyin}
          max={ts.maxBuyin}
          seatIndex={buyInSeat}
          onConfirm={handleBuyInConfirm}
          onCancel={() => setBuyInSeat(null)}
        />
      )}
    </div>
  );
}
