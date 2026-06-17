"use client";
import React, { useEffect, useState } from "react";
import { onActivate } from "@/lib/a11y";

const STORAGE_KEY = "weered:dnd:session-zero:seen";
const ACCENT = "#C4A55A";
const FIRE = "#D4602A";
const FOREST = "#7A853B";
const ARCANE = "#7B469B";

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
        background: "linear-gradient(135deg, rgba(196,165,90,0.06), rgba(212,96,42,0.06))",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
          fontSize: 48,
          fontWeight: 900,
          letterSpacing: "-1px",
          background: `linear-gradient(135deg, #fff, ${ACCENT})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textTransform: "uppercase",
        }}
      >
        The Tavern
      </div>
      <div
        style={{
          fontSize: 11,
          color: "rgba(243,244,246,.5)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Adventurers · DMs · Bards · Lurkers
      </div>
    </div>
  );
}

function VisualRooms() {
  const HouseRoom = ({ name, icon }: { name: string; icon: string }) => (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: `1px solid ${ACCENT}55`,
        background: `${ACCENT}10`,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        color: ACCENT,
      }}
    >
      <span>{icon}</span>
      <span>{name}</span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: 8,
          opacity: 0.55,
          letterSpacing: "0.6px",
          textTransform: "uppercase",
        }}
      >
        Pinned
      </span>
    </div>
  );
  const UserRoom = ({ name }: { name: string }) => (
    <div
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        marginLeft: 14,
        border: "1px dashed rgba(123,70,155,0.4)",
        background: "rgba(123,70,155,0.06)",
        fontSize: 10,
        color: "rgba(216,180,254,0.85)",
        fontFamily: "monospace",
      }}
    >
      ↳ {name}
    </div>
  );
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <HouseRoom name="The Tavern" icon="🍺" />
      <HouseRoom name="Campaign Table" icon="🎲" />
      <HouseRoom name="DM's Workshop" icon="📜" />
      <HouseRoom name="Character Forge" icon="⚔" />
      <UserRoom name="Wednesday Night — Vault of Shadows" />
      <UserRoom name="+ your campaign here" />
    </div>
  );
}

function VisualBoard() {
  const Quest = ({ title, sub, color }: { title: string; sub: string; color: string }) => (
    <div
      style={{
        padding: "6px 9px",
        borderRadius: 6,
        border: `1px solid ${color}55`,
        background: `${color}0d`,
        transform: "rotate(-0.4deg)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(243,244,246,0.88)" }}>{title}</div>
      <div style={{ fontSize: 9, color: `${color}cc`, letterSpacing: "0.3px", marginTop: 2 }}>
        {sub}
      </div>
    </div>
  );
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${FIRE}40`,
        background: `repeating-linear-gradient(45deg, rgba(212,96,42,0.04) 0 6px, rgba(0,0,0,0.20) 6px 12px)`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: FIRE,
          marginBottom: 2,
        }}
      >
        📌 Tavern Board
      </div>
      <Quest
        title="LFP — Vault of Shadows · Friday 8pm EST"
        sub="2 spots · level 5 · sandbox"
        color={ACCENT}
      />
      <Quest
        title="Need a paladin · Sunday afternoon"
        sub="ongoing campaign · 6 sessions in"
        color={FOREST}
      />
      <Quest
        title="One-shot · Heist of the Bone Lord"
        sub="this Saturday · table of 4"
        color={FIRE}
      />
    </div>
  );
}

function VisualCompendium() {
  const Tab = ({ label, active }: { label: string; active?: boolean }) => (
    <span
      style={{
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        background: active ? `${ACCENT}25` : "rgba(255,255,255,0.04)",
        color: active ? ACCENT : "rgba(243,244,246,0.4)",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 4 }}>
        <Tab label="✨ Spells" active />
        <Tab label="🐉 Bestiary" />
        <Tab label="⚔ Classes" />
        <Tab label="💎 Items" />
        <Tab label="⚡ Conditions" />
      </div>
      <div
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, fontFamily: "monospace" }}>
          Fireball
        </div>
        <div
          style={{ fontSize: 10, color: "rgba(243,244,246,0.55)", marginTop: 2, lineHeight: 1.4 }}
        >
          3rd · Evocation · 150ft · 8d6 fire damage in a 20ft radius
        </div>
      </div>
    </div>
  );
}

function VisualDice() {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            background: `linear-gradient(135deg, rgba(34,197,94,0.20), ${ACCENT}10)`,
            border: `2px solid #22C55Eaa`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
            fontSize: 30,
            fontWeight: 900,
            color: "#22C55E",
            transform: "rotate(-6deg)",
            boxShadow: `0 0 20px rgba(34,197,94,0.35), inset 0 0 10px rgba(34,197,94,0.12)`,
          }}
        >
          20
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(243,244,246,0.6)",
            lineHeight: 1.4,
            fontStyle: "italic",
          }}
        >
          stirling rolled <strong style={{ color: "#22C55E" }}>1d20+5</strong> for attack
        </div>
      </div>
      <div
        style={{
          padding: "5px 9px",
          borderRadius: 4,
          borderLeft: `2px solid #22C55Eaa`,
          background: "rgba(34,197,94,0.06)",
          fontFamily: "monospace",
          fontSize: 10,
          color: "rgba(243,244,246,0.85)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 8, fontWeight: 800, opacity: 0.5 }}>DICE TOWER</span>
        <span style={{ fontWeight: 700 }}>stirling</span>
        <span
          style={{
            background: "rgba(34,197,94,0.22)",
            color: "#22C55E",
            padding: "0 4px",
            borderRadius: 2,
            fontSize: 8,
            fontWeight: 800,
          }}
        >
          NAT 20
        </span>
        <span style={{ color: "rgba(243,244,246,0.55)" }}>1d20+5</span>
        <span style={{ color: "rgba(243,244,246,0.55)" }}>[20]+5</span>
        <span style={{ marginLeft: "auto", color: "#22C55E", fontWeight: 800 }}>25</span>
      </div>
    </div>
  );
}

function VisualNpc() {
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
          background: `${ACCENT}12`,
          border: `1px solid ${ACCENT}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        🍺
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 10,
            color: ACCENT,
            fontWeight: 800,
            letterSpacing: "0.4px",
            textTransform: "uppercase",
          }}
        >
          The Tavern Keeper
        </div>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            background: `${ACCENT}06`,
            border: `1px solid ${ACCENT}22`,
            fontSize: 12,
            color: "rgba(243,244,246,0.85)",
            lineHeight: 1.4,
            fontStyle: "italic",
          }}
        >
          Welcome, traveler. The bone lord? Aye, heard of him. Two coppers says you don't last the
          week.
        </div>
      </div>
    </div>
  );
}

function VisualStreams() {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          background: "linear-gradient(135deg, rgba(145,71,255,0.12), rgba(145,71,255,0.04))",
          border: "1px solid rgba(145,71,255,0.30)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#ef4444",
            boxShadow: "0 0 6px #ef4444",
          }}
        />
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: "#ef4444",
            letterSpacing: "0.4px",
            textTransform: "uppercase",
          }}
        >
          Live
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(243,244,246,0.85)" }}>
          Critical Role · Campaign 4 ep 22
        </div>
        <div
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "rgba(243,244,246,0.5)",
            fontFamily: "monospace",
          }}
        >
          34.2K
        </div>
      </div>
      <div
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          fontSize: 10,
          color: "rgba(243,244,246,0.55)",
        }}
      >
        Dimension20 · Fantasy High Junior Year · 18.7K
      </div>
      <div
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          fontSize: 10,
          color: "rgba(243,244,246,0.55)",
        }}
      >
        Dropout TV · Game Changer at the Table · 9.4K
      </div>
    </div>
  );
}

function VisualSheet() {
  const Stat = ({ label, mod, value }: { label: string; mod: string; value: number }) => (
    <div
      style={{
        flex: 1,
        padding: "5px 4px",
        borderRadius: 6,
        border: `1px solid ${ACCENT}33`,
        background: `${ACCENT}06`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: "0.6px",
          color: "rgba(201,168,120,0.7)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: ACCENT,
          lineHeight: 1,
          fontFamily: "monospace",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 9, color: "rgba(243,232,210,0.55)", fontFamily: "monospace" }}>
        {mod}
      </div>
    </div>
  );
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "rgba(243,232,210,0.92)",
              fontFamily: "var(--font-pirata), serif",
              letterSpacing: "0.4px",
            }}
          >
            Vex Halloran
          </div>
          <div style={{ fontSize: 9, color: "rgba(201,168,120,0.65)", fontStyle: "italic" }}>
            Half-Elf Warlock · Level 5
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 7, color: "rgba(243,232,210,0.4)", letterSpacing: "0.4px" }}>
              HP
            </div>
            <div
              style={{ fontSize: 12, fontWeight: 800, color: "#22C55E", fontFamily: "monospace" }}
            >
              34/38
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 7, color: "rgba(243,232,210,0.4)", letterSpacing: "0.4px" }}>
              AC
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, fontFamily: "monospace" }}>
              15
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <Stat label="STR" value={10} mod="+0" />
        <Stat label="DEX" value={14} mod="+2" />
        <Stat label="CON" value={13} mod="+1" />
        <Stat label="INT" value={11} mod="+0" />
        <Stat label="WIS" value={12} mod="+1" />
        <Stat label="CHA" value={17} mod="+3" />
      </div>
      <div
        style={{
          padding: "5px 9px",
          borderRadius: 4,
          border: `1px solid ${FIRE}55`,
          background: `${FIRE}10`,
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          fontFamily: "monospace",
          fontSize: 10,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 800, color: FIRE, letterSpacing: "0.4px" }}>
          ⚔ EBLAST
        </span>
        <span style={{ color: "rgba(243,232,210,0.7)" }}>1d10+3 force</span>
        <span style={{ marginLeft: "auto", color: ACCENT, fontWeight: 700, fontSize: 9 }}>
          click → roll
        </span>
      </div>
    </div>
  );
}

function VisualMap() {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
      }}
    >
      <svg width="100%" height="160" viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="szmap-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(196,165,90,0.18)"
              strokeWidth="0.5"
            />
          </pattern>
          <radialGradient id="szmap-glow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="rgba(232,160,74,0.7)" />
            <stop offset="60%" stopColor="rgba(232,160,74,0.2)" />
            <stop offset="100%" stopColor="rgba(232,160,74,0)" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="320" height="160" fill="rgba(58,28,14,0.4)" />
        <rect x="0" y="0" width="320" height="160" fill="url(#szmap-grid)" />
        <rect x="220" y="0" width="100" height="160" fill="rgba(0,0,0,0.65)" />
        <text
          x="270"
          y="86"
          textAnchor="middle"
          fontSize="9"
          fill="rgba(201,168,120,0.55)"
          fontFamily="monospace"
          letterSpacing="0.5"
        >
          FOG
        </text>
        <circle cx="100" cy="80" r="22" fill="url(#szmap-glow)" />
        <circle cx="100" cy="80" r="11" fill="#3B82F6" stroke="#F5D58A" strokeWidth="2" />
        <text
          x="100"
          y="84"
          textAnchor="middle"
          fontSize="9"
          fill="#fff"
          fontFamily="monospace"
          fontWeight="700"
        >
          V
        </text>
        <circle
          cx="140"
          cy="60"
          r="11"
          fill="#22C55E"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1.5"
        />
        <text
          x="140"
          y="64"
          textAnchor="middle"
          fontSize="9"
          fill="#fff"
          fontFamily="monospace"
          fontWeight="700"
        >
          K
        </text>
        <circle
          cx="60"
          cy="100"
          r="11"
          fill="#A855F7"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1.5"
        />
        <text
          x="60"
          y="104"
          textAnchor="middle"
          fontSize="9"
          fill="#fff"
          fontFamily="monospace"
          fontWeight="700"
        >
          M
        </text>
        <circle
          cx="180"
          cy="80"
          r="13"
          fill="#9B281E"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1.5"
        />
        <text
          x="180"
          y="85"
          textAnchor="middle"
          fontSize="10"
          fill="#fff"
          fontFamily="monospace"
          fontWeight="800"
        >
          B
        </text>
        <line
          x1="100"
          y1="80"
          x2="180"
          y2="80"
          stroke={ACCENT}
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.7"
        />
        <text
          x="140"
          y="76"
          textAnchor="middle"
          fontSize="9"
          fill={ACCENT}
          fontFamily="monospace"
          fontWeight="700"
        >
          20ft
        </text>
        <text
          x="100"
          y="40"
          textAnchor="middle"
          fontSize="8"
          fill={ACCENT}
          fontFamily="monospace"
          fontWeight="800"
          letterSpacing="0.5"
        >
          ▼ VEX'S TURN
        </text>
      </svg>
    </div>
  );
}

function VisualChronicle() {
  const Entry = ({ tag, body, color }: { tag: string; body: string; color: string }) => (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "flex-start",
        paddingLeft: 8,
        borderLeft: `2px solid ${color}55`,
      }}
    >
      <span
        style={{
          fontSize: 8,
          fontWeight: 800,
          color,
          letterSpacing: "0.5px",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {tag}
      </span>
      <span
        style={{
          fontSize: 10,
          color: "rgba(243,232,210,0.78)",
          fontStyle: "italic",
          lineHeight: 1.4,
        }}
      >
        {body}
      </span>
    </div>
  );
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          paddingBottom: 6,
          borderBottom: `1px solid ${ACCENT}22`,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: ACCENT,
            letterSpacing: "1px",
            fontFamily: "var(--font-pirata), serif",
          }}
        >
          📖 VAULT OF SHADOWS
        </span>
        <span style={{ fontSize: 9, color: "rgba(201,168,120,0.55)", fontStyle: "italic" }}>
          session 12 · 4 adventurers
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 9,
            fontWeight: 700,
            color: ACCENT,
            fontFamily: "monospace",
          }}
        >
          1,247 gp
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Entry tag="LOOT" body="Masterwork blade · awarded to Kira" color={ACCENT} />
        <Entry tag="XP" body="+800 to all party (defeated the Bone Lord)" color={FOREST} />
        <Entry tag="NPC" body="The Tavern Keeper · met session 1, alive" color={FIRE} />
        <Entry tag="PLOT" body="Open: who is funding the cult?" color={ARCANE} />
      </div>
    </div>
  );
}

function VisualRoadmap() {
  const Item = ({ done, text }: { done: boolean; text: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          flexShrink: 0,
          border: `1px solid ${done ? `${FOREST}aa` : `${ARCANE}66`}`,
          background: done ? `${FOREST}30` : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: FOREST,
          fontWeight: 900,
        }}
      >
        {done ? "✓" : ""}
      </div>
      <div
        style={{
          fontSize: 11,
          color: done ? "rgba(243,244,246,0.55)" : "rgba(216,180,254,0.85)",
          textDecoration: done ? "line-through" : undefined,
          opacity: done ? 0.7 : 1,
        }}
      >
        {text}
      </div>
    </div>
  );
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,.25)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: ARCANE,
          marginBottom: 4,
        }}
      >
        🪶 The Roadmap
      </div>
      <Item done text="The four house rooms" />
      <Item done text="Compendium · Tavern Board · NPCs · Streams" />
      <Item done text="Witnessed dice rolls in lobby chat" />
      <Item done text="Persistent campaign state (sheets, XP, loot)" />
      <Item done text="Tactical battle map with fog of war + tokens" />
      <Item done={false} text="Multi-DM scheduling overlay" />
      <Item done={false} text="Compendium → Sheet drag-to-equip" />
      <div
        style={{
          fontSize: 9,
          color: "rgba(243,244,246,0.4)",
          marginTop: 6,
          fontStyle: "italic",
          letterSpacing: "0.3px",
        }}
      >
        DMs who show up first shape what's next.
      </div>
    </div>
  );
}

const PANELS: PanelDef[] = [
  {
    label: "what this is",
    title: "Welcome to the Tavern.",
    body: (
      <>
        Doors are open. Travelers from every corner pass through — DMs prepping the next session,
        players hunting a party, lurkers nursing a pint and watching it all go down.
        <br />
        <br />
        Take a moment. Lay of the land matters before you wander off swinging.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>— the Innkeeper</span>
      </>
    ),
    visual: <VisualWordmark />,
  },
  {
    label: "the social layer",
    title: "Four house rooms. The Tavern Board pins the rest.",
    body: (
      <>
        The <strong style={{ color: ACCENT }}>Tavern</strong>, the{" "}
        <strong style={{ color: ACCENT }}>Campaign Table</strong>, the{" "}
        <strong style={{ color: ACCENT }}>DM&apos;s Workshop</strong>, the{" "}
        <strong style={{ color: ACCENT }}>Character Forge</strong> — pinned, permanent, voice and
        chat in each. Spin up your own room for your campaign on top, up to 25.
        <br />
        <br />
        The <strong style={{ color: ACCENT }}>Tavern Board</strong> is where DMs post quests and
        players sign on. Need a paladin? Hosting a one-shot? Pin it. The right party finds itself.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>No lurking required.</span>
      </>
    ),
    visual: <VisualRooms />,
  },
  {
    label: "the compendium",
    title: "The whole 5e SRD. No alt-tab.",
    body: (
      <>
        Spells, Bestiary, Classes, Magic Items, Conditions. Searchable, in-lobby. No more breaking
        flow to dndbeyond mid-session.
        <br />
        <br />
        Lookup is instant. Your players see what you see. Rules disputes resolved in under ten
        seconds.
      </>
    ),
    visual: <VisualCompendium />,
  },
  {
    label: "the dice tower",
    title: "Public rolls. Witnessed.",
    body: (
      <>
        Roll in the lobby&apos;s Dice Tower with{" "}
        <strong style={{ color: "#22C55E" }}>Witnessed</strong> on and the room sees it — name,
        expression, dice, total — as a chip in chat. Server-rolled, so nobody can fake a nat 20.
        <br />
        <br />
        Switch to <strong style={{ color: ACCENT }}>Private</strong> for stat blocks and
        behind-the-screen rolls. Same dice, no broadcast.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>Discord literally cannot do this.</span>
      </>
    ),
    visual: <VisualDice />,
  },
  {
    label: "your character",
    title: "Your character. Live, on the table.",
    body: (
      <>
        Open <strong style={{ color: ACCENT }}>Sheets</strong> in the D&amp;D module — your full 5e
        sheet lives here. Stats, saves, skills, spell slots, inventory, attacks. Click an attack: it
        rolls in chat with a <strong style={{ color: "#f87171" }}>Damage</strong> follow-up button
        waiting if it hit.
        <br />
        <br />
        The character lives on <strong style={{ color: ACCENT }}>your account</strong>, not the
        campaign. Bring the same Vex to your Tuesday game and your Friday one-shot. The DM sees the
        whole party at a glance. Players see their own.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>
          Sheets persist across sessions. No one rebuilds Tuesday.
        </span>
      </>
    ),
    visual: <VisualSheet />,
  },
  {
    label: "the battle map",
    title: "Tokens on a grid. Fog where you want it.",
    body: (
      <>
        The DM uploads an image, drops tokens, paints fog. Players drag their own. Distance measures
        itself.
        <br />
        <br />
        When initiative ticks forward, the matching token glows. Click a token to snap the
        initiative tracker to that combatant. Apply damage from chat — it lands on the token{" "}
        <em>and</em> the tracker in one click.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>Roll20-grade table state, no extra tab.</span>
      </>
    ),
    visual: <VisualMap />,
  },
  {
    label: "the chronicle",
    title: "The campaign remembers everything.",
    body: (
      <>
        Party gold, loot, XP, session log, plot threads, world wiki — all one persistent{" "}
        <strong style={{ color: ACCENT }}>Chronicle</strong> per party.
        <br />
        <br />
        Award XP, every character gets it in one click. The{" "}
        <strong style={{ color: ACCENT }}>Tavern Keeper</strong> and other AI NPCs auto-log to the
        encounter index when the party meets them. The DM never re-types what already happened.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>
          This is the part Discord can't do, Roll20 won't do, and DDB caps at five campaigns.
        </span>
      </>
    ),
    visual: <VisualChronicle />,
  },
  {
    label: "shape what's next",
    title: "If you're a DM, build with me.",
    body: (
      <>
        Honest about what&apos;s mid-build:{" "}
        <strong style={{ color: ARCANE }}>multi-DM scheduling</strong> and{" "}
        <strong style={{ color: ARCANE }}>compendium drag-to-sheet</strong>. Roadmap, not vapor.
        <br />
        <br />
        If you&apos;re a DM with a campaign you want to bring, holler in the{" "}
        <strong style={{ color: ACCENT }}>DM&apos;s Workshop</strong>. The next features get
        prioritized with the first GMs who show up.
        <br />
        <br />
        <span style={{ opacity: 0.55, fontSize: 12 }}>You shape it, you keep it.</span>
      </>
    ),
    visual: <VisualRoadmap />,
  },
];

export default function SessionZero({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      onKeyDown={onActivate(() => {
        dismiss();
      })}
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
        onKeyDown={onActivate((e) => {
          e.stopPropagation();
        })}
        className="weered-session-zero-modal"
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 16,
          border: `1px solid ${ACCENT}55`,
          background:
            "radial-gradient(ellipse 90% 50% at 50% 0%, rgba(212,96,42,0.10), transparent 70%), " +
            "radial-gradient(ellipse 60% 30% at 18% 100%, rgba(232,160,74,0.06), transparent 65%), " +
            "linear-gradient(180deg, rgba(28,18,10,0.98), rgba(14,9,5,0.98))",
          boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px ${ACCENT}15 inset, 0 -2px 36px rgba(212,96,42,0.10) inset`,
          overflow: "hidden",
          fontFamily: "var(--font-barlow), system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/brand/lobbies/dnd/shield-04.webp"
              alt="Dungeons &amp; Dragons"
              width={28}
              height={28}
              style={{ borderRadius: 6, flexShrink: 0, objectFit: "cover" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
                    border: `1px solid ${ACCENT}50`,
                    color: ACCENT,
                  }}
                >
                  Session Zero
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
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(243,244,246,0.45)",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Dungeons &amp; Dragons lobby
              </div>
            </div>
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
              className="sz-heading"
              style={{
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: "0.4px",
                marginBottom: 12,
                color: "#F5D58A",
                textShadow: "0 0 16px rgba(232,160,74,0.30), 0 1px 2px rgba(0,0,0,0.7)",
                lineHeight: 1.15,
              }}
            >
              {panel.title}
            </div>
            <div
              className="sz-serif"
              style={{ fontSize: 16, lineHeight: 1.55, color: "rgba(243,232,210,0.82)" }}
            >
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
                background:
                  i === step ? "linear-gradient(90deg, #D4602A, #E8A04A)" : "rgba(196,165,90,0.20)",
                boxShadow: i === step ? "0 0 8px rgba(232,160,74,0.5)" : "none",
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
            Skip
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
              className={isLast ? "sz-heading" : ""}
              style={{
                padding: isLast ? "8px 22px" : "7px 22px",
                borderRadius: 8,
                border: `1px solid rgba(232,160,74,0.65)`,
                background: isLast
                  ? "linear-gradient(180deg, rgba(212,96,42,0.30), rgba(127,68,34,0.50))"
                  : `${ACCENT}18`,
                color: isLast ? "#F5D58A" : ACCENT,
                fontSize: isLast ? 14 : 12,
                fontWeight: isLast ? 400 : 800,
                letterSpacing: isLast ? "0.6px" : "0.5px",
                cursor: "pointer",
                textTransform: isLast ? "none" : "uppercase",
                textShadow: isLast
                  ? "0 0 8px rgba(232,160,74,0.55), 0 1px 1px rgba(0,0,0,0.6)"
                  : undefined,
                boxShadow: isLast
                  ? "0 0 14px rgba(232,160,74,0.20), inset 0 1px 0 rgba(245,213,138,0.18)"
                  : undefined,
              }}
            >
              {isLast ? "Pull up a chair" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useSessionZero(): { open: boolean; show: () => void; hide: () => void } {
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
