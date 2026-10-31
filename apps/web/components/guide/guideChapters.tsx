"use client";

// The guide's chapters (components/guide/WeeredGuide.tsx). Lists come from
// the catalogs the features use: colourways and type (lib/uiPrefs.ts),
// layouts and blocks (lib/shellLayout.ts), lobby blocks and the front door's
// limits (lib/lobbyLayout.ts), lobby themes (lib/lobbyThemePresets.ts),
// templates, tools and starter rooms (components/composer/catalog.ts) and
// voice effects (lib/voiceFx.ts). Keep the words honest when a feature
// changes, the same as the catalogs' own blurbs.
import React from "react";
import { NEBULA_FONTS, NEBULA_FONT_IDS, PALETTES, PALETTE_IDS } from "../../lib/uiPrefs";
import { SHELL_BLOCKS, SHELL_MAX_BLOCKS, SHELL_PRESETS } from "../../lib/shellLayout";
import { BLOCK_CATALOG, DOOR_MAX } from "../../lib/lobbyLayout";
import { EFFECT_LABEL, FONT_LABEL, THEME_PRESETS } from "../../lib/lobbyThemePresets";
import { FEATURES, GAMES, ROOM_PRESETS, type GameEntry } from "../composer/catalog";
import { GameArt } from "../composer/GameGrid";
import { FX_LABEL } from "../shell/ShellLookControls";
import { VOICE_FX } from "../../lib/voiceFx";

export type ChapterId =
  | "start"
  | "yours"
  | "lobbies"
  | "door"
  | "office"
  | "rooms"
  | "games"
  | "play"
  | "people"
  | "next";

export type GuideActions = {
  /** Design mode; absent where it isn't offered (signed out, the office desk). */
  design?: () => void;
  /** Settings → Appearance. */
  look: () => void;
  /** The lobby builder. */
  build: () => void;
  /** Anywhere else on Weered. */
  href: (path: string) => void;
};

type Chapter = {
  id: ChapterId;
  name: string;
  icon: string;
  color: string;
  blurb: string;
  /** Shipped in the last few weeks. */
  fresh?: boolean;
};

const GAME_LOBBIES = GAMES.filter((g) => g.group === "games");

export const CHAPTERS: Chapter[] = [
  {
    id: "start",
    name: "Start here",
    icon: "✦",
    color: "#a78bfa",
    blurb: "What Weered is.",
  },
  {
    id: "yours",
    name: "Change your drip",
    icon: "🎨",
    color: "#c084fc",
    blurb: "Move every section, add blocks, pick a colourway, corners and effects.",
    fresh: true,
  },
  {
    id: "lobbies",
    name: "Build a lobby",
    icon: "🏰",
    color: "#f5b700",
    blurb: "A lobby for your game, crew, club or business, up in a minute.",
    fresh: true,
  },
  {
    id: "door",
    name: "Front door",
    icon: "🚪",
    color: "#fb923c",
    blurb: "A welcome, rules, questions and gates before anyone joins.",
    fresh: true,
  },
  {
    id: "office",
    name: "Digital office",
    icon: "🛎",
    color: "#38bdf8",
    blurb: "Reception, offices, a boardroom, and a desk bell for your staff.",
    fresh: true,
  },
  {
    id: "rooms",
    name: "Rooms & voice",
    icon: "🎙",
    color: "#22c55e",
    blurb: "Voice, video, screen share, watch parties and voice effects.",
    fresh: true,
  },
  {
    id: "games",
    name: "Games",
    icon: "🎮",
    color: "#60a5fa",
    blurb: `${GAME_LOBBIES.length} games with their own lobby, live data, LFG and squad finders.`,
  },
  {
    id: "play",
    name: "Play & Paper",
    icon: "💸",
    color: "#fbbf24",
    blurb: "Notoriety, Paper, FakeOut trading and poker.",
  },
  {
    id: "people",
    name: "People",
    icon: "🤝",
    color: "#ec4899",
    blurb: "Friends, crews, messages, the forum, and Weered as an app.",
  },
  {
    id: "next",
    name: "What's next",
    icon: "🚀",
    color: "#94a3b8",
    blurb: "What's coming, and how to ask for more.",
  },
];

export function ChapterBody({
  id,
  go,
  actions,
}: {
  id: ChapterId;
  go: (id: ChapterId) => void;
  actions: GuideActions;
}) {
  switch (id) {
    case "start":
      return <Start go={go} actions={actions} />;
    case "yours":
      return <Yours actions={actions} />;
    case "lobbies":
      return <Lobbies go={go} actions={actions} />;
    case "door":
      return <Door actions={actions} />;
    case "office":
      return <Office actions={actions} />;
    case "rooms":
      return <Rooms />;
    case "games":
      return <Games actions={actions} />;
    case "play":
      return <Play actions={actions} />;
    case "people":
      return <People actions={actions} />;
    case "next":
      return <Next actions={actions} />;
  }
}

// ── Pieces ──────────────────────────────────────────────────────────────

function Head({ id, title, intro }: { id: ChapterId; title: string; intro: string }) {
  const c = CHAPTERS.find((x) => x.id === id)!;
  return (
    <header className="wg-head" style={{ ["--wg-c" as string]: c.color }}>
      <div className="wg-kicker">
        <span aria-hidden>{c.icon}</span> {c.name}
      </div>
      <h2 id="wg-title" className="wg-title">
        {title}
      </h2>
      <p className="wg-intro">{intro}</p>
    </header>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="wg-sec">
      <h3 className="wg-sec-title">{title}</h3>
      {note && <p className="wg-note">{note}</p>}
      {children}
    </section>
  );
}

/** Lines that start with what it is, in bold, then what it does. */
function Facts({ items }: { items: [string, string][] }) {
  return (
    <ul className="wg-facts">
      {items.map(([lead, rest]) => (
        <li key={lead}>
          <b>{lead}</b> {rest}
        </li>
      ))}
    </ul>
  );
}

function Btn({
  primary,
  onClick,
  children,
}: {
  primary?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={`wg-btn${primary ? " is-primary" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Tile({
  icon,
  name,
  blurb,
  onClick,
}: {
  icon?: string;
  name: string;
  blurb: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {icon && (
        <span className="wg-tile-icon" aria-hidden>
          {icon}
        </span>
      )}
      <b className="wg-tile-name">{name}</b>
      <span className="wg-tile-blurb">{blurb}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="wg-tile is-link" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="wg-tile">{inner}</div>
  );
}

function Chips({
  items,
}: {
  items: { key: string; icon?: string; name: string; title?: string }[];
}) {
  return (
    <div className="wg-chips">
      {items.map((it) => (
        <span key={it.key} className="wg-chip" title={it.title}>
          {it.icon && <i aria-hidden>{it.icon}</i>}
          {it.name}
        </span>
      ))}
    </div>
  );
}

/** A lobby-builder template, with its art; opens the builder on it. */
function TemplateCard({ g, actions }: { g: GameEntry; actions: GuideActions }) {
  const open = () =>
    actions.href(g.action === "meeting" ? "/requests?meeting=1" : `/lobby/create?start=${g.id}`);
  return (
    <button type="button" className="wg-template" onClick={open}>
      <GameArt game={g} height={72} radius={8} />
      <b>{g.name}</b>
      <span>{g.blurb}</span>
    </button>
  );
}

// ── Chapters ────────────────────────────────────────────────────────────

function Start({ go, actions }: { go: (id: ChapterId) => void; actions: GuideActions }) {
  const steps: { lead: string; rest: string; btn: React.ReactNode }[] = [
    {
      lead: "Pick a look.",
      rest: `${PALETTE_IDS.length} colourways or your own colour, then corners, lines and effects.`,
      btn: <Btn onClick={actions.look}>Pick a look</Btn>,
    },
  ];
  if (actions.design)
    steps.push({
      lead: "Change your drip.",
      rest: "Move sections between your sidebars and Home, and add blocks.",
      btn: <Btn onClick={actions.design}>✦ Open Design</Btn>,
    });
  steps.push({
    lead: "Build a lobby.",
    rest: "For your game, your crew, your club or your business.",
    btn: (
      <Btn primary onClick={actions.build}>
        Build a lobby
      </Btn>
    ),
  });
  return (
    <>
      <Head
        id="start"
        title="A place for anything."
        intro="Game lobbies, crews, clubs and offices. Every lobby is built the way its owner wants it, and your own Weered is yours to arrange too. This guide covers all of it."
      />
      <div className="wg-pillars">
        {CHAPTERS.filter((c) => c.id !== "start").map((c) => (
          <button
            key={c.id}
            type="button"
            className="wg-pillar"
            onClick={() => go(c.id)}
            style={{ ["--wg-c" as string]: c.color }}
          >
            <span className="wg-pillar-icon" aria-hidden>
              {c.icon}
            </span>
            <span className="wg-pillar-name">
              {c.name}
              {c.fresh && <span className="wg-new">New</span>}
            </span>
            <span className="wg-pillar-blurb">{c.blurb}</span>
          </button>
        ))}
      </div>
      <Section title="Try these first">
        <div className="wg-steps">
          {steps.map((s, i) => (
            <div key={s.lead} className="wg-step">
              <span className="wg-step-n">{i + 1}</span>
              <span className="wg-step-text">
                <b>{s.lead}</b> {s.rest}
              </span>
              {s.btn}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

const SHAPES: { name: string; style: React.CSSProperties }[] = [
  { name: "Round", style: { borderRadius: 12 } },
  { name: "Soft", style: { borderRadius: 5 } },
  { name: "Square", style: { borderRadius: 0 } },
  {
    name: "Cut",
    style: {
      borderRadius: 0,
      clipPath:
        "polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)",
    },
  },
];
const LINES: { name: string; style: React.CSSProperties }[] = [
  {
    name: "Soft",
    style: {
      border: "1px solid rgba(196,181,253,.35)",
      boxShadow: "0 0 14px rgba(124,58,237,.45)",
    },
  },
  { name: "Hard", style: { border: "2px solid rgba(255,255,255,.85)", boxShadow: "none" } },
];
const TEXTURES: { name: string; style: React.CSSProperties }[] = [
  {
    name: "Glass",
    style: { background: "linear-gradient(160deg, rgba(167,139,250,.32), rgba(30,20,60,.55))" },
  },
  {
    name: "Grid",
    style: {
      background:
        "repeating-linear-gradient(0deg, rgba(255,255,255,.14) 0 1px, transparent 1px 8px), repeating-linear-gradient(90deg, rgba(255,255,255,.14) 0 1px, transparent 1px 8px), rgba(30,20,60,.6)",
    },
  },
  {
    name: "Lines",
    style: {
      background:
        "repeating-linear-gradient(0deg, rgba(255,255,255,.14) 0 1px, transparent 1px 6px), rgba(30,20,60,.6)",
    },
  },
  {
    name: "Dots",
    style: {
      background:
        "radial-gradient(rgba(255,255,255,.3) 1px, transparent 1.5px) 0 0 / 7px 7px, rgba(30,20,60,.6)",
    },
  },
  { name: "Solid", style: { background: "#1c1530" } },
];
const BACKDROPS: { name: string; style: React.CSSProperties }[] = [
  {
    name: "Sky",
    style: {
      background:
        "radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 45% 80%, #c4b5fd, transparent), radial-gradient(120% 100% at 30% 0%, #3b1d7a, #07060f)",
    },
  },
  {
    name: "Grid",
    style: {
      background:
        "repeating-linear-gradient(0deg, rgba(167,139,250,.22) 0 1px, transparent 1px 9px), repeating-linear-gradient(90deg, rgba(167,139,250,.22) 0 1px, transparent 1px 9px), #0b0816",
    },
  },
  { name: "Plain", style: { background: "#0b0816" } },
];

function Samples({
  label,
  items,
}: {
  label: string;
  items: { name: string; style: React.CSSProperties }[];
}) {
  return (
    <div className="wg-samples">
      <div className="wg-group-label">{label}</div>
      <div className="wg-samples-row">
        {items.map((it) => (
          <div key={it.name} className="wg-sample">
            <span className="wg-sample-box" style={it.style} aria-hidden />
            <small>{it.name}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Yours({ actions }: { actions: GuideActions }) {
  const groups = ["Essentials", "Media", "From a lobby"] as const;
  return (
    <>
      <Head
        id="yours"
        title="Make Weered yours."
        intro="Your sidebars and this Home are built from sections and blocks, the same way a lobby is. Arrange them in Design, then give the whole place a look. It saves to your account, so it follows you to every device."
      />
      <div className="wg-actions">
        {actions.design && (
          <Btn primary onClick={actions.design}>
            ✦ Open Design
          </Btn>
        )}
        <Btn onClick={actions.look}>Settings → Appearance</Btn>
        <Btn onClick={() => actions.href("/setup")}>Run setup again</Btn>
      </div>

      <Section title="Design mode" note="On a computer, in a window at least 1180px wide.">
        <Facts
          items={[
            [
              "Move anything.",
              "Drag a section between the left sidebar, the right panel and Home.",
            ],
            [
              "Friends where you want them.",
              "Friends, Crew, Rooms, Who's here and Discover sit on either side.",
            ],
            ["Switch sections off.", "Anything you don't use goes, and comes back from the list."],
            ["Add blocks.", `Up to ${SHELL_MAX_BLOCKS} across your sidebars and Home.`],
            ["Undo and redo.", "Leave half-way and your draft waits in this browser."],
            ["Hide the panel", "to see the page full width while you work."],
          ]}
        />
      </Section>

      <Section title="Layouts" note="Start from one, then make it your own.">
        <div className="wg-grid wg-grid-4">
          {SHELL_PRESETS.map((p) => (
            <Tile key={p.id} name={p.name} blurb={p.blurb} />
          ))}
        </div>
      </Section>

      <Section
        title="Blocks"
        note="Lobby blocks show a lobby you pick: its live rooms, next events, newest posts or request board. Webpage shows any site that allows it, live, and the rest as a link card."
      >
        {groups.map((g) => (
          <div key={g} className="wg-group">
            <div className="wg-group-label">{g}</div>
            <Chips
              items={SHELL_BLOCKS.filter((b) => b.group === g).map((b) => ({
                key: b.type,
                icon: b.icon,
                name: b.name,
                title: b.blurb,
              }))}
            />
          </div>
        ))}
      </Section>

      <Section
        title="Colourways"
        note="Nebula, Weered's own theme, in these colourways. Or pick any colour and a whole colourway is made from it."
      >
        <div className="wg-swatches">
          {PALETTE_IDS.map((id) => {
            const p = PALETTES[id];
            return (
              <div key={id} className="wg-swatch">
                <span
                  className="wg-swatch-chip"
                  aria-hidden
                  style={{
                    background: `radial-gradient(120% 120% at 25% 15%, ${p.hi}, ${p.a} 30%, ${p.b} 55%, ${p.c} 80%, ${p.bg})`,
                  }}
                />
                <b>{p.name}</b>
                <small>{p.tagline}</small>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Type" note="Titles, labels and buttons, in the font you pick.">
        <div className="wg-fonts">
          {NEBULA_FONT_IDS.map((id) => (
            <div key={id} className="wg-font">
              <span style={{ fontFamily: NEBULA_FONTS[id].stack }}>Aa</span>
              <small>{NEBULA_FONTS[id].name}</small>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Structure" note="The shape of every panel and card.">
        <div className="wg-structure">
          <Samples label="Corners" items={SHAPES} />
          <Samples label="Lines" items={LINES} />
          <Samples label="Texture" items={TEXTURES} />
          <Samples label="Backdrop" items={BACKDROPS} />
        </div>
      </Section>

      <Section
        title="Effects"
        note="Over your whole Weered, behind the glass or in front of everything. The intensity bar runs from a light dusting to a storm."
      >
        <Chips
          items={Object.entries(FX_LABEL)
            .filter(([k]) => k !== "none")
            .map(([k, v]) => ({ key: k, name: v }))}
        />
        <p className="wg-note">
          <b>Your symbol:</b> an emoji or up to three characters, floating across your Weered.
        </p>
      </Section>

      <Section title="Comfort">
        <Facts
          items={[
            [
              "Turn off all animations",
              "in Settings → Display. Your device's reduce-motion setting is always respected too.",
            ],
            ["Density:", "compact or roomy."],
            ["Classic themes", "if you'd rather not use Nebula."],
            ["Your colors", "style your ID card and your row in themed lobbies."],
          ]}
        />
      </Section>
    </>
  );
}

function Lobbies({ go, actions }: { go: (id: ChapterId) => void; actions: GuideActions }) {
  const work = GAMES.filter((g) => g.group === "work");
  const community = GAMES.filter((g) => g.group === "community");
  return (
    <>
      <Head
        id="lobbies"
        title="Your lobby, built in a minute."
        intro="Pick what it's for, name it, choose a look, say what's inside and which rooms it opens with. Then it's live, and Design opens on it. Running your own lobby is $6 a month."
      />
      <div className="wg-actions">
        <Btn primary onClick={actions.build}>
          Build a lobby
        </Btn>
      </div>

      <Section
        title="Start from"
        note="Each one sets up its rooms and its look. Change anything after."
      >
        <div className="wg-group-label">Work</div>
        <div className="wg-grid wg-grid-3">
          {work.map((g) => (
            <TemplateCard key={g.id} g={g} actions={actions} />
          ))}
        </div>
        <div className="wg-group-label">Community</div>
        <div className="wg-grid wg-grid-3">
          {community.map((g) => (
            <TemplateCard key={g.id} g={g} actions={actions} />
          ))}
        </div>
        <p className="wg-note">
          Plus {GAME_LOBBIES.length} games with the game built in.{" "}
          <button type="button" className="wg-inline" onClick={() => go("games")}>
            See Games →
          </button>
        </p>
      </Section>

      <Section
        title="What's inside"
        note="Switch any of these on or off now, or later in Admin → What's inside. Every room follows the switches."
      >
        <div className="wg-grid wg-grid-4">
          {FEATURES.map((f) => (
            <Tile key={f.id} icon={f.icon} name={f.name} blurb={f.blurb} />
          ))}
        </div>
      </Section>

      <Section
        title="Starter rooms"
        note="Pick the rooms it opens with. Add, rename and reorder them any time."
      >
        <Chips
          items={ROOM_PRESETS.map((r) => ({
            key: r.id,
            icon: r.icon,
            name: r.label,
            title: r.hint,
          }))}
        />
      </Section>

      <Section
        title="Lobby Design"
        note="Open ✦ Design in your lobby. Its Home is a canvas of blocks you drag, size and style."
      >
        <div className="wg-group-label">Blocks</div>
        <Chips
          items={BLOCK_CATALOG.map((b) => ({
            key: b.type,
            icon: b.icon,
            name: b.name,
            title: b.blurb,
          }))}
        />
        <div className="wg-group-label">Themes</div>
        <div className="wg-themes">
          {THEME_PRESETS.map((t) => (
            <div key={t.id} className="wg-theme">
              <span className="wg-theme-art" aria-hidden style={{ background: t.art }}>
                <span style={{ background: t.accent }} />
              </span>
              <b>{t.name}</b>
              <small>{t.tagline}</small>
            </div>
          ))}
        </div>
        <div className="wg-group-label">Type</div>
        <Chips items={Object.entries(FONT_LABEL).map(([k, v]) => ({ key: k, name: v }))} />
        <div className="wg-group-label">Effects</div>
        <Chips
          items={Object.entries(EFFECT_LABEL)
            .filter(([k]) => k !== "none")
            .map(([k, v]) => ({ key: k, name: v }))}
        />
        <Facts
          items={[
            [
              "Always on.",
              "Make your effect one visitors can't switch off. A device set to reduce motion still holds it still.",
            ],
            ["Entrances.", "The page can fade, rise or glitch in."],
            ["Intensity", "from a light dusting to a storm."],
          ]}
        />
      </Section>

      <Section title="Running it">
        <Facts
          items={[
            ["Four ways in.", "Open, password, approval, or paid membership tiers."],
            ["A front door.", "A welcome, rules, questions and gates."],
            ["Five role levels,", "each with the title you give it."],
            ["Moderation:", "bans, chat lock and an audit log."],
            ["Your own domain.", "Put the lobby on your own address."],
          ]}
        />
        <div className="wg-actions">
          <Btn onClick={() => go("door")}>🚪 The front door →</Btn>
        </div>
      </Section>
    </>
  );
}

function Door({ actions }: { actions: GuideActions }) {
  return (
    <>
      <Head
        id="door"
        title="Decide who gets in, and how."
        intro="A screen every visitor sees before they join your lobby. Set it up in Admin → Front door, preview it, then switch it on."
      />
      <div className="wg-door" aria-hidden>
        <div className="wg-door-card">
          <div className="wg-door-kicker">Welcome to</div>
          <div className="wg-door-title">The Pilots&apos; Lounge</div>
          <div className="wg-door-body">Wheels up at eight. Read the house rules first.</div>
          <ol className="wg-door-rules">
            <li>Be decent on comms.</li>
            <li>No spoilers outside #spoilers.</li>
          </ol>
          <div className="wg-door-check">
            <span /> I agree to the rules
          </div>
          <div className="wg-door-q">What do you fly?</div>
          <div className="wg-door-opts">
            <span className="is-on">Airbus</span>
            <span>Boeing</span>
            <span>Both</span>
          </div>
          <div className="wg-door-go">Board →</div>
        </div>
      </div>

      <Section title="What you can put on it">
        <Facts
          items={[
            ["Welcome.", "A headline, a message, a picture and your own button text."],
            ["Rules.", `Up to ${DOOR_MAX.rules}. Visitors tick that they agree.`],
            [
              "Questions.",
              `Up to ${DOOR_MAX.questions}: a short answer, or pick one from a list. Required or optional.`,
            ],
            ["18+.", "Visitors confirm their age."],
            ["New accounts wait.", "Accounts younger than the days you set can't join yet."],
            ["Lock.", "No looking around before joining."],
          ]}
        />
      </Section>
      <Section title="How it works">
        <Facts
          items={[
            ["Every join type.", "Open, password, approval and paid lobbies all use it."],
            [
              "Answers come with the request.",
              "Approval lobbies read them before saying yes, and moderators and up see them under Members.",
            ],
            ["Checked by the server.", "Skipping the screen doesn't get anyone in."],
          ]}
        />
      </Section>
      <div className="wg-actions">
        <Btn primary onClick={actions.build}>
          Build a lobby
        </Btn>
      </div>
    </>
  );
}

function Office({ actions }: { actions: GuideActions }) {
  const floor = ["reception", "offices", "boardroom", "kitchen"]
    .map((id) => ROOM_PRESETS.find((r) => r.id === id))
    .filter((r): r is (typeof ROOM_PRESETS)[number] => !!r);
  const otherWork = GAMES.filter((g) => g.group === "work" && g.id !== "OFFICE");
  return (
    <>
      <Head
        id="office"
        title="An office people can walk into."
        intro="Pick Digital office in the lobby builder. You get the rooms, a sign-in at the front door, and a front desk on the lobby's Home."
      />
      <div className="wg-actions">
        <Btn primary onClick={() => actions.href("/lobby/create?start=OFFICE")}>
          🛎 Start a digital office
        </Btn>
      </div>
      <div className="wg-floor">
        {floor.map((r) => (
          <div key={r.id} className="wg-room">
            <span aria-hidden>{r.icon}</span>
            <b>{r.label}</b>
            <small>{r.hint}</small>
          </div>
        ))}
      </div>
      <Section title="The front desk">
        <Facts
          items={[
            [
              "Ring the desk.",
              "A visitor rings, and you and your moderators get a notification that takes you to Reception.",
            ],
            ["One ring a minute", "per visitor, so nobody leans on the bell."],
            [
              "Any lobby can have one.",
              "Add the Front desk block in Design and point it at a room.",
            ],
            [
              "Sign in at the door.",
              "The office's front door asks who they're here to see. Change it in Admin → Front door.",
            ],
          ]}
        />
      </Section>
      <Section title="Other ways to work">
        <div className="wg-grid wg-grid-3">
          {otherWork.map((g) => (
            <TemplateCard key={g.id} g={g} actions={actions} />
          ))}
        </div>
      </Section>
    </>
  );
}

function Rooms() {
  return (
    <>
      <Head
        id="rooms"
        title="Pull up a room."
        intro="Every lobby is made of rooms. Talk, watch, share and play in them, with the chat beside you."
      />
      <Section title="In a room" note="A lobby's owner decides which of these its rooms offer.">
        <div className="wg-grid wg-grid-4">
          <Tile icon="🎙" name="Voice" blurb="Drop in, talk, leave. Low latency." />
          <Tile icon="📹" name="Video" blurb="Cameras on, in a grid." />
          <Tile icon="🖥" name="Screen share" blurb="Show the run, the build, the doc." />
          <Tile icon="▶" name="YouTube" blurb="One video, in sync for the whole room." />
          <Tile icon="📺" name="Twitch" blurb="Watch a channel together." />
          <Tile icon="🌐" name="Browser" blurb="One web page on the room's screen." />
          <Tile icon="📰" name="Article" blurb="Read a story together." />
          <Tile
            icon="🤖"
            name="The Operator"
            blurb="An AI in every room that talks like a character. Type @operator."
          />
        </div>
      </Section>
      <Section
        title="Voice effects"
        note="In voice, open your mic settings and pick one. Everyone in the room hears it. It runs on your device."
      >
        <div className="wg-grid wg-grid-4">
          {VOICE_FX.filter((f) => f.id !== "off").map((f) => (
            <Tile key={f.id} icon="〰" name={f.name} blurb={f.blurb} />
          ))}
        </div>
      </Section>
      <Section
        title="Game rooms"
        note="Rooms in a game lobby add the game's own panel: profiles and stats, LFG, tables and boards."
      />
    </>
  );
}

function Games({ actions }: { actions: GuideActions }) {
  return (
    <>
      <Head
        id="games"
        title="Lobbies that know the game."
        intro={`${GAME_LOBBIES.length} games come with their own lobby: live data from the game, LFG and the right rooms. Join the official lobby, or build your own for your crew.`}
      />
      <div className="wg-grid wg-grid-3">
        {GAME_LOBBIES.map((g) => (
          <TemplateCard key={g.id} g={g} actions={actions} />
        ))}
      </div>
      <Section title="Playing together">
        <Facts
          items={[
            ["LFG with roles.", "Post a session, claim a role, and build a reliability record."],
            ["Squad finders", "by rank, region and playstyle."],
            ["Tournaments", "with start.gg brackets on the lobby."],
            [
              "Server boards,",
              "like Assetto Corsa's: who's on track, which circuit, how long left.",
            ],
          ]}
        />
        <p className="wg-note">
          Want a game that isn&apos;t here? Ask for it in the lobby builder. If it has an API, it
          can be built.
        </p>
        <div className="wg-actions">
          <Btn onClick={() => actions.href("/lfg")}>Find a group</Btn>
          <Btn onClick={actions.build}>Build a game lobby</Btn>
        </div>
      </Section>
    </>
  );
}

function Play({ actions }: { actions: GuideActions }) {
  return (
    <>
      <Head
        id="play"
        title="An economy with stakes."
        intro="Showing up counts. What you do earns Notoriety, and Paper is the currency you win, trade and spend."
      />
      <div className="wg-grid wg-grid-2">
        <Tile
          icon="⭐"
          name="Notoriety"
          blurb="XP for joining rooms, chatting, posting, trading and playing. It shows on your card."
        />
        <Tile
          icon="💵"
          name="Paper"
          blurb="Earned from daily bonuses, FakeOut profits and challenges. Spend it in the store or at the poker table."
        />
        <Tile
          icon="📈"
          name="FakeOut"
          blurb="Paper trading on live crypto charts with $100K of fake money, and a leaderboard."
        />
        <Tile
          icon="♦"
          name="Texas Hold'em"
          blurb="A real poker engine with Paper buy-ins. Up to six at a table."
        />
      </div>
      <div className="wg-actions">
        <Btn onClick={() => actions.href("/lobby/fakeout")}>Open FakeOut</Btn>
        <Btn onClick={() => actions.href("/lobby/poker")}>Find a table</Btn>
        <Btn onClick={() => actions.href("/store")}>The store</Btn>
      </div>
    </>
  );
}

function People({ actions }: { actions: GuideActions }) {
  return (
    <>
      <Head
        id="people"
        title="Your people, wherever they are."
        intro="Weered shows who's on and where they are, so getting together is one click."
      />
      <div className="wg-grid wg-grid-3">
        <Tile icon="🤝" name="Friends" blurb="See where they are and join them in one click." />
        <Tile icon="🛡" name="Crews" blurb="Your squad's own chat, in every room you're in." />
        <Tile icon="💬" name="Messages" blurb="Direct messages, in the dock on the right." />
        <Tile icon="🗣" name="Forum" blurb="The community board." />
        <Tile
          icon="🔔"
          name="Notifications"
          blurb="Mentions, messages, crew activity and front-desk rings."
        />
        <Tile
          icon="🗺"
          name="Locator"
          blurb="An opt-in map of where people are active, in rough 5 km cells."
        />
      </div>
      <Section title="Weered as an app">
        <Facts
          items={[
            ["Desktop app", "for Windows, Mac and Linux."],
            ["On your phone,", "add Weered to your home screen and it opens like an app."],
            ["Always current.", "Left open through an update, Weered offers a one-click reload."],
          ]}
        />
        <div className="wg-actions">
          <Btn onClick={() => actions.href("/desktop")}>Get the desktop app</Btn>
          <Btn onClick={() => actions.href("/forum")}>Open the forum</Btn>
        </div>
      </Section>
    </>
  );
}

const WISHLIST: { label: string; desc: string; status: "Planned" | "Exploring" | "Open" }[] = [
  {
    label: "Fantasy football",
    desc: "Draft rooms with voice, game-day watch parties, start/sit advice.",
    status: "Planned",
  },
  {
    label: "Tournament brackets",
    desc: "Single elimination and round robin, with Paper prize pools.",
    status: "Planned",
  },
  {
    label: "Spotify listen-along",
    desc: "See what the host is playing, with album art and a listen-along link.",
    status: "Exploring",
  },
  {
    label: "Live sports",
    desc: "Scores, play-by-play and watch parties in sync with the game.",
    status: "Exploring",
  },
  {
    label: "Native phone apps",
    desc: "iOS and Android, with push notifications and voice.",
    status: "Planned",
  },
  {
    label: "Your game, your module",
    desc: "Ask for any game integration. If there's an API, it can be built.",
    status: "Open",
  },
];

function Next({ actions }: { actions: GuideActions }) {
  return (
    <>
      <Head
        id="next"
        title="What's next."
        intro="Weered ships every week. This is what's on the way. If you want something else, ask, and watch it ship."
      />
      <div className="wg-grid wg-grid-2">
        {WISHLIST.map((w) => (
          <div key={w.label} className="wg-tile">
            <b className="wg-tile-name">
              {w.label}
              <span className={`wg-status is-${w.status.toLowerCase()}`}>{w.status}</span>
            </b>
            <span className="wg-tile-blurb">{w.desc}</span>
          </div>
        ))}
      </div>
      <Section
        title="Got an idea?"
        note="Post it in the forum, or tell The Operator in any chat. For a build of your own, book a meeting."
      >
        <div className="wg-actions">
          <Btn onClick={() => actions.href("/forum")}>Post in the forum</Btn>
          <Btn onClick={() => actions.href("/requests?meeting=1")}>Book a custom build</Btn>
        </div>
      </Section>
    </>
  );
}
