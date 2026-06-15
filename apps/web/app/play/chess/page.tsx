import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../../components/MarketingHeader";

const TITLE = "Play chess with your crew: Lichess + Chess.com integration on Weered";
const DESC =
  "Real Lichess and Chess.com ratings, co-watch live games on the room stage, run blitz tournaments verified from the API. Your hard-earned 2200 stays where you earned it.";
const URL = "https://weered.ca/play/chess";

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
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do I have to play chess inside Weered?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Weered is built around your real Lichess and Chess.com accounts. You play on those platforms, and Weered ingests your rated games to credit challenges and surface them in your crew's lobby. The Lichess board embeds into the room canvas so your friends can watch along, but the actual chess is happening on Lichess.",
      },
    },
    {
      "@type": "Question",
      name: "Does Weered have its own chess ELO?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No, and that's intentional. Chess players take ratings seriously. A 2200 blitz rating took years to earn, and we're not going to ask you to start over inside an app. Your real Lichess/Chess.com rating is what shows up on Weered's leaderboard.",
      },
    },
    {
      "@type": "Question",
      name: "How do challenges credit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Once you link your Lichess and/or Chess.com username, Weered polls the public API every 5 minutes and parses your recent rated games. Wins, streaks, opening matches (Sicilian, French, etc. by ECO code), and rating climbs all credit automatically. No manual claims.",
      },
    },
    {
      "@type": "Question",
      name: "Can I play chess directly on Weered with someone?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, by routing it through Lichess. The chess room module supports Lichess TV (live featured game), Daily Puzzle co-op, and paste-in of any Lichess game / study / broadcast URL to embed on the room stage. For two-player play, the Lichess challenge link goes in chat; both players accept, the live board embeds on the room stage for spectators.",
      },
    },
  ],
};

export default function PlayChessPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <MarketingHeader ctaHref="/lobby/chess" ctaLabel="Open the Chess Lobby" />

      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">Chess on Weered</span>
            <h1 className="mkt-h1">
              Your <span className="accent">real chess rating</span>. A room to play it from.
            </h1>
            <p className="mkt-sub">
              Weered isn't trying to replace Lichess or Chess.com. It's the lobby you sit in while
              you climb them. Link your accounts, ingest your real rated games, run tournaments
              verified from the API, and co-watch live games with your crew.
            </p>
            <div className="mkt-cta-row">
              <Link href="/lobby/chess" className="mkt-cta-primary">
                Open the Chess Lobby
              </Link>
              <Link href="/lobby/chess#challenges" className="mkt-cta-secondary">
                See active challenges
              </Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">We don't reset your wheel</h2>
            <p className="mkt-p">
              Chess identity lives on Lichess and Chess.com. Your rating, your game history, your
              titles, your opening repertoire: that's where you earned it, and that's where it
              stays. Weered's job is the layer on top: the room you're in while you play, the crew
              you brag to when you climb, the tournament that picks up your wins automatically.
            </p>
            <p className="mkt-p">
              A Weered-native chess board with Weered-native ELO would feel like a toy next to a
              2200 blitz rating someone spent two years earning. So we didn't build one. We built
              integration instead.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What's actually in the chess lobby</h2>
            <div className="mkt-grid-3">
              <div className="mkt-card">
                <h3>Live Streams</h3>
                <p>
                  The Twitch chess directory pulled in fresh. See who's streaming Hikaru, Magnus,
                  Gotham, the open Sunday tournaments, all in one tab.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Challenges</h3>
                <p>
                  Bullet sprints, blitz five-streaks, Sicilian specialist runs, rating-climb
                  objectives. Wins credit automatically from your Lichess and Chess.com games.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Tournaments</h3>
                <p>
                  Bullet Bash, Blitz Weekend Cup, Weekly Rating Climb, Opening-Themed Cups. Sign up
                  with your linked accounts; results credit from the API. Notoriety and Paper
                  rewards.
                </p>
              </div>
              <div className="mkt-card">
                <h3>My Chess</h3>
                <p>
                  Your linked accounts, current ratings (bullet / blitz / rapid / classical /
                  puzzle), recent games, and challenge progress. Updated every 5 minutes.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Game Audit</h3>
                <p>
                  Every rated game Weered has ingested for you: provider, time control, colour,
                  result, opening, ECO, rating change. Receipts so you can verify what credited.
                </p>
              </div>
              <div className="mkt-card">
                <h3>The room stage</h3>
                <p>
                  Drop Lichess TV, daily puzzle, a specific game URL, a study, or a broadcast on the
                  room stage. Everyone in voice watches the same board. Co-analyse aloud.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Challenges that credit themselves</h2>
            <p className="mkt-p">The current chess challenge set in the lobby right now:</p>
            <ul className="mkt-bullet-list">
              <li>
                <strong>Bullet Sprint.</strong> 10 bullet wins on Lichess or Chess.com. Time is the
                enemy.
              </li>
              <li>
                <strong>Blitz Five-Streak.</strong> 5 blitz wins in a row. Streak resets on a loss
                or draw.
              </li>
              <li>
                <strong>Rating Climb (Blitz).</strong> Gain 50 net rating points in blitz on
                Lichess. Climb the ladder.
              </li>
              <li>
                <strong>Sicilian Specialist.</strong> 5 wins playing the Sicilian Defense (any
                line). ECO codes B20-B99.
              </li>
              <li>
                <strong>Cross-Platform Player.</strong> Win 3 games on Lichess AND 3 games on
                Chess.com. Prove the link works both ways.
              </li>
            </ul>
            <div className="mkt-callout">
              Win one on either platform, Weered sees it within 5 minutes, the challenge ticks. No
              screenshots, no claims, no honour system.
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">How linking works</h2>
            <ul className="mkt-bullet-list">
              <li>
                <strong>Open Settings → Linked Accounts.</strong> Paste your Lichess username, paste
                your Chess.com username. That's it.
              </li>
              <li>
                <strong>Validation is live.</strong> Weered hits the Lichess and Chess.com public
                APIs to confirm the username exists.
              </li>
              <li>
                <strong>Polling starts immediately.</strong> Lichess via the NDJSON game stream,
                Chess.com via monthly archive, every 5 minutes.
              </li>
              <li>
                <strong>Ingest is one-way and read-only.</strong> Weered never sees your password,
                never posts on your behalf, never changes your rating. Public game data only.
              </li>
            </ul>
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>Sit in the room while you climb.</h2>
            <p>Status stays on Lichess. Your wins show up in the lobby.</p>
            <Link href="/lobby/chess" className="mkt-cta-primary">
              Open the Chess Lobby →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
