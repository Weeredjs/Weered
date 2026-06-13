import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../../components/MarketingHeader";

const TITLE = "A real Discord alternative for gaming communities | Weered";
const DESC = "Lobbies instead of servers, rooms instead of channels, presence instead of status dots. Built for game communities that want a place, not a tool. Free to use.";
const URL = "https://weered.ca/alternatives/discord";

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
    images: [{ url: "https://weered.ca/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["https://weered.ca/og"],
  },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Weered free like Discord?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Weered is free to use. Premium tiers exist for extras like custom flair and storage, starting at $4/month, but the core platform (lobbies, rooms, voice, presence, integrations) is free.",
      },
    },
    {
      "@type": "Question",
      name: "How is Weered different from Discord?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Discord is a server-and-channel chat app. Weered is built around lobbies (per-game spaces) and rooms (lightweight live gatherings inside them). Game integrations are first-class: Destiny 2, League, Fortnite, CS2, Dota 2, Path of Exile, Lichess, and more all have purpose-built modules. Discord treats every community the same; Weered treats each game community as its own room with its own tools.",
      },
    },
    {
      "@type": "Question",
      name: "Do I have to host a server?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Weered's lobbies already exist for the major games and topics. You walk in, you're there. No admin, no server-setup, no role configuration to start. You can create your own crew with its own private rooms when you want one.",
      },
    },
    {
      "@type": "Question",
      name: "Does Weered have voice chat?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Every room supports group voice via LiveKit. Push-to-talk, voice activity, queueing, and listen-only modes all supported. No external client required.",
      },
    },
  ],
};

export default function AlternativesDiscordPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <MarketingHeader ctaHref="/lobby" ctaLabel="Open Weered" />

      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">Discord Alternative</span>
            <h1 className="mkt-h1">
              What if your community lived <span className="accent">somewhere built for it</span>?
            </h1>
            <p className="mkt-sub">
              Discord was made for everyone. Weered was made for game communities. Lobbies instead of servers, rooms instead of channels, presence instead of status dots. And real integrations with the games you actually play.
            </p>
            <div className="mkt-cta-row">
              <Link href="/lobby" className="mkt-cta-primary">Open the lobbies</Link>
              <Link href="/why-not-discord" className="mkt-cta-secondary">The longer answer</Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">The shape of the thing</h2>
            <p className="mkt-p">
              Discord puts you in a list of servers, each with a list of channels. You scroll a feed of messages and hope someone is around. Weered is a place. You walk into the <strong>Destiny 2 lobby</strong> and there are rooms with names like <em>Fireteam Find: Ultimate Ops</em> and <em>Trials Carry-talk</em>. Each room has a live voice channel, a live chat, and a stage that anyone can put a Twitch stream, a YouTube clip, a browser tab, or a Lichess board on. Other Guardians are visible, not as a status dot but as actual presence in the room.
            </p>
            <p className="mkt-p">
              It feels closer to walking into a clubhouse than opening an app. That difference is the whole pitch.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What you get that Discord doesn't have</h2>
            <div className="mkt-grid-3">
              <div className="mkt-card">
                <h3>Game-API integrations, not just bots</h3>
                <p>Bungie API for Destiny 2 PGCRs. Riot API for League stats. Lichess + Chess.com pull-through for chess. Steam Rich Presence. Path of Exile ladder. Real data, real verification, no third-party bot setup.</p>
              </div>
              <div className="mkt-card">
                <h3>Tournaments verified by API</h3>
                <p>Submit a Destiny 2 raid time, Weered reads the PGCR and confirms. Run a Lichess blitz tournament, Weered pulls the games. No screenshots, no honour system, no manual scoring.</p>
              </div>
              <div className="mkt-card">
                <h3>Cross-platform presence</h3>
                <p>The left rail shows where you are <em>everywhere</em>: Steam, Xbox, PSN, Twitch, Spotify. Your crew sees you're on Hollow Knight before you have to type "anyone want to play."</p>
              </div>
              <div className="mkt-card">
                <h3>Shared media on the room canvas</h3>
                <p>Drop a YouTube clip, a Twitch stream, a Lichess board, a screen share, or just a browser tab onto the room stage. Everyone in voice watches the same thing in sync. No bot, no plugin.</p>
              </div>
              <div className="mkt-card">
                <h3>A real challenge / contest layer</h3>
                <p>Lobby-wide challenges with Notoriety + Paper rewards. Flair design contests with public voting. A platform-wide currency you can actually spend.</p>
              </div>
              <div className="mkt-card">
                <h3>No server admin tax</h3>
                <p>Lobbies already exist. You don't pick categories, set up roles, write a #welcome channel, or moderate from scratch. You arrive, you're in. Build a crew when you want one.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What's the same as Discord</h2>
            <ul className="mkt-bullet-list">
              <li><strong>Free to use.</strong> Voice, video, chat, screen share, presence: all free.</li>
              <li><strong>Voice chat.</strong> Group voice in every room via LiveKit. Push-to-talk, voice activity, listen-only modes.</li>
              <li><strong>DMs and group chats.</strong> Private messaging works exactly the way you'd expect.</li>
              <li><strong>Desktop + web + mobile.</strong> Tauri desktop app, web at weered.ca, mobile in the works.</li>
              <li><strong>Custom servers when you want them.</strong> Crews are your private space, same role flexibility, just less mandatory.</li>
            </ul>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Who Weered is for</h2>
            <p className="mkt-p">
              Game communities that want to <em>be somewhere</em> together, not just talk in a feed. Crews that play the same handful of games regularly. Streamers who want their audience in a room with them, not a wall of follow-pings. Tournament organisers who are tired of Discord-spreadsheet-screenshot stitch-jobs. Anyone who remembers MPlayer in the 90s and has been missing that "lobby" feeling ever since.
            </p>
            <div className="mkt-callout">
              <strong>Who Weered isn't for:</strong> generic communities that don't care about games: book clubs, study groups, work teams. Discord is genuinely fine for those. Use the right tool.
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Common questions</h2>
            <h3 className="mkt-h3">Is Weered free like Discord?</h3>
            <p className="mkt-p">Yes. Premium tiers exist for cosmetics + storage starting at $4 / month, but the core platform (lobbies, rooms, voice, presence, game integrations) is free.</p>
            <h3 className="mkt-h3">Do I have to host a server?</h3>
            <p className="mkt-p">No. Game lobbies already exist. You walk in, you're there. No admin setup required to start.</p>
            <h3 className="mkt-h3">Can I import my Discord community?</h3>
            <p className="mkt-p">Not directly. Weered's shape is different enough that 1-to-1 import would feel wrong. The right move is to point your crew at the game lobby they care about, and create a private crew space alongside it.</p>
            <h3 className="mkt-h3">Does Weered have voice chat?</h3>
            <p className="mkt-p">Yes. Group voice in every room. Push-to-talk, voice activity, listen-only modes, ducking, the works.</p>
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>Try it.</h2>
            <p>Walk into the lobby for your game. It's free and you don't have to set anything up.</p>
            <Link href="/lobby" className="mkt-cta-primary">Open the lobbies →</Link>
          </div>
        </section>
      </main>
    </>
  );
}
