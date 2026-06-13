import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../components/MarketingHeader";

const TITLE = "What Weered does — a real lobby for every game";
const DESC = "Weered gives every game its own lobby wired to the game itself: live PoE economy and skill tree, Bungie-verified Destiny tournaments, EVE killboards, voice rooms, crews, an earned reputation economy, and cross-platform presence. Web, desktop, and mobile.";
const URL = "https://weered.ca/features";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: "website", siteName: "Weered" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

const appLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Weered",
  applicationCategory: "SocialNetworkingApplication",
  operatingSystem: "Web, Windows, macOS, iOS, Android",
  description: "A lobby-first gaming community platform. Each game gets a lobby wired to its own live data, with self-verifying tournaments, voice rooms, crews, and an earned reputation economy.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function FeaturesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appLd) }} />
      <MarketingHeader ctaHref="/lobby" ctaLabel="Open Weered" />

      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">What Weered is</span>
            <h1 className="mkt-h1">
              Every game gets a <span className="accent">real lobby</span>, wired to the game itself.
            </h1>
            <p className="mkt-sub">
              Most community apps hand you a text channel with a game&apos;s logo slapped on it. Weered gives each game a lobby that actually talks to the game. Your clears, your loot prices, your killboard, live in the room. That&apos;s the whole point, and it&apos;s the part a chat app can&apos;t fake.
            </p>
            <div className="mkt-cta-row">
              <Link href="/explore" className="mkt-cta-primary">Browse the lobbies</Link>
              <Link href="/why-not-discord" className="mkt-cta-secondary">Why not just Discord?</Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">It&apos;s wired into the games, not just named after them</h2>
            <p className="mkt-p">
              The <Link href="/play/path-of-exile">Path of Exile</Link> lobby pulls the live currency exchange and renders your actual passive tree from the official API. The <Link href="/lobby/destiny2">Destiny 2</Link> lobby reads your fireteam&apos;s clears straight from Bungie. <Link href="/lobby/eve">EVE</Link> shows your killboard and sovereignty timers. The same idea runs across more than thirty game lobbies, from Helldivers war maps to a paper-trading floor. A logo on a chat channel can&apos;t do any of that.
            </p>
            <p className="mkt-p">
              <Link href="/explore">Browse what&apos;s live</Link> and you&apos;ll find the game you play already has a home.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Tournaments that score themselves</h2>
            <p className="mkt-p">
              Run a speed race, a bracket, or a challenge ladder, and the results come straight from the game&apos;s API. No screenshots, no honour system, no organiser stuck doing manual scoring at midnight. The <Link href="/tournaments/destiny-2">Destiny 2 tournament engine</Link> reads Bungie&apos;s Post-Game Carnage Reports and credits the clear on its own. Hosting is free.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Rooms for actually playing together</h2>
            <p className="mkt-p">
              Drop into a room with voice that runs open, queued, or listen-only depending on the vibe. Share your screen, watch a Twitch stream or a YouTube video in sync with everyone, or open a browser the whole room can drive. The room is where the group hangs, not just where it types.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Crews that stick around</h2>
            <p className="mkt-p">
              Build a crew and your tag rides your name across the whole platform. Crews get their own space, their own chat, and their own identity. It&apos;s the difference between a group of friends and a thing with a name people recognise.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Standing you earn, not a badge you buy</h2>
            <p className="mkt-p">
              Notoriety is platform-wide reputation you build by sticking around and playing straight. It unlocks what you can do: posting media, hosting your own lobbies, running moderation. Paper is the in-platform currency, spendable on store items, tournament buy-ins, and crew goods. Both are earned, and earning them is half the fun.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">It already knows what you&apos;re playing</h2>
            <p className="mkt-p">
              Weered reads cross-platform presence from Steam, Xbox, PlayStation, and Twitch. Your rails show who&apos;s in a game, who&apos;s streaming, and who&apos;s lying low, without anyone typing a status. Walk in and the place already knows what your crew is up to.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Friends, DMs, and media that can&apos;t ambush you</h2>
            <p className="mkt-p">
              Add friends, send DMs and group messages, invite people to your room, and decide exactly who&apos;s allowed to join you or invite you anywhere. Every image is screened before it ever shows on your screen. The full story is on the <Link href="/safety">safety page</Link>.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Web, desktop, and your phone</h2>
            <p className="mkt-p">
              Weered runs in any browser, as a native <Link href="/desktop">desktop app</Link>, and on mobile. Your lobbies, crews, and friends follow you across all three.
            </p>
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>Pick a game. There&apos;s probably already a lobby.</h2>
            <p>More than thirty game communities are live right now, each wired to the thing you actually play.</p>
            <Link href="/explore" className="mkt-cta-primary">Browse the lobbies →</Link>
          </div>
        </section>
      </main>
    </>
  );
}
