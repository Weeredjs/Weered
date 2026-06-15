import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../../components/MarketingHeader";

const TITLE = "Host a Destiny 2 tournament with API-verified scoring | Weered";
const DESC =
  "Run Pantheon 2.0 races, Trials brackets, raid speedruns, and Custom Ops challenges with results pulled straight from the Bungie API. No screenshots, no manual scoring. Free to host.";
const URL = "https://weered.ca/tournaments/destiny-2";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: URL,
    type: "website",
    siteName: "Weered",
    images: [
      { url: "https://weered.ca/brand/lobbies/destiny2-og-v1.png", width: 1200, height: 630 },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["https://weered.ca/brand/lobbies/destiny2-og-v1.png"],
  },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do I need a Bungie API key to host?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The tournament host doesn't need anything. Weered already holds the Bungie OAuth integration. Players link their Bungie account once and their fireteam results flow into the tournament automatically.",
      },
    },
    {
      "@type": "Question",
      name: "Which Destiny 2 formats does Weered support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Single-run races (fastest clear), bracket-style elimination, challenge-race (first team to complete a set of objectives), and Custom Ops with mandatory modifier sets. Pantheon 2.0 races, Trials weekend brackets, raid speedruns, GM strike challenges, and dungeon races all fit one of those formats.",
      },
    },
    {
      "@type": "Question",
      name: "How does Weered verify a raid clear actually happened?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When a fireteam finishes an activity, Bungie publishes the Post-Game Carnage Report (PGCR). Weered's worker polls each linked player's recent activity history, parses the PGCRs, matches them against the tournament's activity-hash filter and modifier requirements (including the Skull modifier system for Custom Ops), and credits the result. End-to-end verification, no manual claims.",
      },
    },
    {
      "@type": "Question",
      name: "Is it free to host?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Hosting a tournament in the Destiny 2 lobby on Weered is free. Premium cosmetic flair grants and custom branding are paid extras for serious community organisers, but the tournament engine itself costs nothing.",
      },
    },
  ],
};

export default function TournamentsDestiny2Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <MarketingHeader ctaHref="/lobby/destiny2" ctaLabel="Open Destiny 2 Lobby" />

      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">Destiny 2 Tournaments</span>
            <h1 className="mkt-h1">
              Tournaments that <span className="accent">verify themselves</span> from the Bungie
              API.
            </h1>
            <p className="mkt-sub">
              Run Pantheon 2.0 races, Trials brackets, raid speedruns, and Custom Ops challenges.
              Results flow in from PGCRs the moment your fireteam clears the activity. No
              screenshots, no manual scoring, no honour system.
            </p>
            <div className="mkt-cta-row">
              <Link href="/lobby/destiny2" className="mkt-cta-primary">
                Open the Destiny 2 lobby
              </Link>
              <Link href="/lobby/destiny2#tournaments" className="mkt-cta-secondary">
                See live tournaments
              </Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Built for the way Destiny 2 actually works</h2>
            <p className="mkt-p">
              Every Bungie-API-supported activity is recognised: raids, dungeons, Nightfalls,
              Trials, Crucible, Onslaught, Pantheon, and the new Custom Ops with player-selected
              Skull modifiers. The tournament you create can be activity-locked (a specific
              encounter, like K1 Logistics on Master), modifier-locked (Match Game + Arc Surge
              required), or wide-open (any GM strike clear counts).
            </p>
            <p className="mkt-p">
              <strong>The challenge engine handles the hard cases.</strong> Skull modifier
              identifier hashes are tracked separately from legacy Activity Modifier hashes, so
              Custom Ops challenges credit correctly. The 51-marker tier fallback solves Bungie's
              inconsistent difficulty-tier integer. Activity-hash filters collapse all variant
              Master / Ultimate forms of a strike into one selectable option. The system that runs
              Weered's Impossible Tournament is the same one you'd use for your event.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Formats supported</h2>
            <div className="mkt-grid-3">
              <div className="mkt-card">
                <h3>Speed run</h3>
                <p>
                  Fastest fireteam clear of a target activity wins. PGCR completion-time is the
                  source of truth.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Bracket elimination</h3>
                <p>
                  Single-elimination or double-elimination, seeded by sign-up order or rating. Match
                  results auto-confirm from PGCR.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Challenge race</h3>
                <p>
                  First team to complete a list of objectives (clear X, with Y modifier, on Z
                  difficulty) wins the round.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Custom Ops league</h3>
                <p>
                  Player-chosen Skull modifier combos. Higher difficulty = more Notoriety.
                  Leaderboard updates as PGCRs land.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Trials weekend cup</h3>
                <p>
                  Card-based scoring. 7-0 flawless = top prize. Auto-reads from Bungie's Crucible
                  API.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Pantheon ladder</h3>
                <p>
                  Encounter-by-encounter time tracking. Compare your fireteam against the global
                  ladder, in your lobby.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Rewards your community will actually care about</h2>
            <ul className="mkt-bullet-list">
              <li>
                <strong>Flair.</strong> Custom champion flair that persists on a player's name
                across the platform. Earned, not bought.
              </li>
              <li>
                <strong>Notoriety.</strong> Platform-wide XP. Stacks toward platform tiers and
                visibility.
              </li>
              <li>
                <strong>Paper.</strong> In-platform currency, spendable on store items, tournament
                buy-ins, and crew goods.
              </li>
              <li>
                <strong>Hall of Fame entries.</strong> Your fireteam's PGCR-verified clear sits on
                the public leaderboard with the receipt attached.
              </li>
              <li>
                <strong>Custom flair contests.</strong> The community designs the prize. Voting is
                public. Winners get their art applied as the real flair grant.
              </li>
            </ul>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Hosting is fast</h2>
            <ul className="mkt-bullet-list">
              <li>
                <strong>Open the Destiny 2 lobby.</strong> No setup required, no Bungie API key to
                register.
              </li>
              <li>
                <strong>Click "Create Tournament" in the Tournaments tab.</strong> Pick format,
                activity filter, modifier requirements, sign-up window, prize.
              </li>
              <li>
                <strong>Share the link.</strong> Anyone with a linked Bungie account can sign up.
                Cross-platform: Steam, PSN, Xbox, Epic all covered by one Bungie OAuth.
              </li>
              <li>
                <strong>Play the activity.</strong> Weered detects the PGCR within ~5 minutes of
                completion and credits the team automatically.
              </li>
              <li>
                <strong>Watch the bracket settle itself.</strong> Match-by-match auto-confirmation,
                dispute flow built in if there's a reporting conflict.
              </li>
            </ul>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What's coming with Shadow & Order (June 9, 2026)</h2>
            <p className="mkt-p">
              Weered is hosting community races into the Shadow & Order content drop. Pantheon 2.0
              day-one races, Tier 5 exotic acquisition challenges, and the first wave of Custom Ops
              league seasons all land the week of launch.
            </p>
            <p className="mkt-p">
              Link your Bungie account now and your stats start tracking immediately. When launch
              hits, you're already in.
            </p>
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>Stop scoring by screenshot.</h2>
            <p>Run your D2 tournament in a lobby that reads the Bungie API for you.</p>
            <Link href="/lobby/destiny2" className="mkt-cta-primary">
              Open the Destiny 2 lobby →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
