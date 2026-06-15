import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../../components/MarketingHeader";

const TITLE = "Path of Exile community hub: ladders, builds, crew tools | Weered";
const DESC =
  "The unofficial PoE lobby with the poe.ninja economy live, ladder leaderboards, build inspector, and a room to actually hang out in while you map. Free.";
const URL = "https://weered.ca/play/path-of-exile";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: "website", siteName: "Weered" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Weered affiliated with GGG?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Weered is an unofficial community hub for Path of Exile. We are not affiliated with or endorsed by Grinding Gear Games. PoE, Path of Exile, and related trademarks are property of Grinding Gear Games.",
      },
    },
    {
      "@type": "Question",
      name: "What does the PoE lobby actually do?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Live economy data via poe.ninja for the current league, ladder leaderboards by class, Twitch chess-style stream directory for PoE streamers, build inspector (pending GGG OAuth approval), crew finder for grouping, and rooms for voice/chat/screen-share while you map together. Free to use.",
      },
    },
    {
      "@type": "Question",
      name: "When does the build inspector go live?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Build inspector requires GGG's official OAuth access, which Weered applied for on April 16, 2026. GGG's OAuth process can take weeks to months. The live economy, ladder, and streams pages already work today via public data sources (poe.ninja, GGG public ladder API).",
      },
    },
    {
      "@type": "Question",
      name: "Is it free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The PoE lobby, voice rooms, ladder, economy, and crew tools are all free. Premium tiers exist for cosmetics across the platform starting at $4 / month but the PoE-specific tools are free.",
      },
    },
  ],
};

export default function PlayPathOfExilePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <MarketingHeader ctaHref="/lobby/path-of-exile" ctaLabel="Open the PoE Lobby" />

      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">Path of Exile: Unofficial Community Hub</span>
            <h1 className="mkt-h1">
              Everything Path of Exile, in <span className="accent">one lobby</span>.
            </h1>
            <p className="mkt-sub">
              Live poe.ninja economy, ladder leaderboards, Twitch streamer directory, crew finder,
              and rooms to hang out in while you map.
            </p>
            <div className="mkt-cta-row">
              <Link href="/lobby/path-of-exile" className="mkt-cta-primary">
                Open the PoE Lobby
              </Link>
              <Link href="/lobby/path-of-exile#ladder" className="mkt-cta-secondary">
                View the ladder
              </Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What's already live</h2>
            <div className="mkt-grid-3">
              <div className="mkt-card">
                <h3>Live economy via poe.ninja</h3>
                <p>
                  Current league currency, divine rates, fragments, scarabs, unique gear. Every
                  price, in-lobby, refreshed against the canonical community data source.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Ladder leaderboards</h3>
                <p>
                  Top of the current league ladder, filterable by class. Pulled from GGG's public
                  ladder API. Updated continuously.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Twitch stream directory</h3>
                <p>
                  Who's streaming PoE right now. ZiggyD, Mathil, Empyrian, Imexile, Pohx,
                  Tytykiller, all sortable by viewer count. Click to embed the stream on the room
                  canvas.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Crew finder</h3>
                <p>
                  Looking for a juicing party? Need a 6-stack for delirium farming? Post a flag,
                  find your group, hop in voice.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Room voice + chat</h3>
                <p>
                  Drop into a room with your crew. Voice, chat, screen-share for build review,
                  paste-in trade window. Real shared workspace while you map.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Path of Building paste links</h3>
                <p>
                  Share your PoB import code in chat, the lobby renders a preview card. Crew can
                  crit your build without leaving voice.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What's coming when GGG approves OAuth</h2>
            <ul className="mkt-bullet-list">
              <li>
                <strong>Build inspector.</strong> Link your PoE account, anyone in your crew can
                pull up your character's gear, passives, gems, and ascendancy (read-only) for build
                review.
              </li>
              <li>
                <strong>Character-linked challenges.</strong> "Reach level 95 in standard," "Clear
                T17 on a melee build," "Hit 80 challenges this league." Auto-credited from your
                account data.
              </li>
              <li>
                <strong>League-bracket leaderboards.</strong> Lobby-internal ladders, scoped to your
                crew or league. Show off without leaving Weered.
              </li>
              <li>
                <strong>Atlas + map completion tracking.</strong> Visualised, sharable, comparable
                across your crew.
              </li>
            </ul>
            <div className="mkt-callout">
              <strong>OAuth status:</strong> applied 2026-04-16 with james@weered.ca. GGG replied
              2026-05-05 asking for the account name; account name (Weeeered#8275) was returned same
              day. Waiting on credentials. Multi-month waits are normal in GGG's process.
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Why this lobby exists</h2>
            <p className="mkt-p">
              PoE has the deepest community-tools ecosystem in any ARPG: poe.ninja, Path of
              Building, awakened-poe-trade, FilterBlade, the wiki, sub-leagues, race events. But the
              place where the community actually <em>talks</em> is fragmented across Discord
              servers, Reddit, and a sprawl of build-guide spreadsheets. Weered's PoE lobby is one
              room where all of it lives next to each other: live economy, live ladder, live
              streams, live voice, live crew.
            </p>
            <p className="mkt-p">
              The point isn't to replace any of those tools. It's to be the room you sit in while
              you use them.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Built by someone who plays</h2>
            <p className="mkt-p">
              Weered's founder is an actual Path of Exile player, hundreds of hours and multiple
              leagues deep. The PoE lobby exists because the founder wanted somewhere to play with
              friends that wasn't another Discord with 18 dead channels. The tools in the lobby are
              the tools the founder kept opening in browser tabs while grinding maps.
            </p>
            <p className="mkt-p">
              <em>Not affiliated with or endorsed by Grinding Gear Games.</em> Path of Exile and
              related trademarks are property of GGG.
            </p>
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>Walk in. Map together.</h2>
            <p>The PoE lobby is open. Free, no setup, no Discord-server invite needed.</p>
            <Link href="/lobby/path-of-exile" className="mkt-cta-primary">
              Open the PoE Lobby →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
