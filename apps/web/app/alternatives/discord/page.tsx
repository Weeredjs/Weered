import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../../components/MarketingHeader";
import { safeJsonLd } from "@/lib/jsonLd";

// Rewritten 2026-11-12 to the premise (James: "we are keeping the mall angle.
// That is the entire premise of the platform"). AI assistants read this page
// when someone asks for a Discord alternative (/llms.txt points here). The old
// one said Weered wasn't for book clubs or study groups and that you couldn't
// make your own lobby; both stopped being true. The FAQ below is the visible
// questions, word for word.

const TITLE = "A Discord alternative where servers aren't islands | Weered";
const DESC =
  "Describe your server in a sentence and Weered builds it. Every lobby sits in one town: one account, one Town Square, and Downtown, where you walk from one community into the next. Free, in your browser.";
const URL = "https://weered.ca/alternatives/discord";
// Create account, headed for the builder. /lobby/create itself greets a signed-out
// visitor with "Welcome back, sign in" (found in the 2026-11-12 review); someone
// already signed in is passed straight through to the builder.
const BUILD = "/login?mode=register&next=%2Flobby%2Fcreate";

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

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is Weered free like Discord?",
    a: "Yes. Voice, video, screen share, chat and up to three lobbies of your own are free. Paid plans start at $6 a month and add your own address and more AI builds.",
  },
  {
    q: "How is Weered different from Discord?",
    a: "Discord servers are islands: you need an invite, and nothing connects one server to the next. Every Weered lobby sits in one town. Downtown lists them all, the Town Square is where everyone on Weered talks, and you walk from one community into the next. You also don't set a lobby up by hand. You describe it and it builds.",
  },
  {
    q: "Do I have to set up a server?",
    a: "No. Describe what you want in a sentence and Weered builds the lobby: the rooms, the look, the welcome page. Or walk into one that already exists.",
  },
  {
    q: "Can I bring my Discord community?",
    a: "Describe your server: its channels, its events, its look. Weered builds the lobby to match, and your people can sign in with Discord. If something can't be built yet, tell us and we'll put it together.",
  },
  {
    q: "Does Weered have voice chat?",
    a: "Yes. Voice, cams and screen share in every room, in the browser. No download needed.",
  },
];

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function AlternativesDiscordPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }} />
      <MarketingHeader ctaHref="/lobby" ctaLabel="Open Weered" />

      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">Discord Alternative</span>
            <h1 className="mkt-h1">
              Make your Discord into anything you want.{" "}
              <span className="accent">It just isn&apos;t an island.</span>
            </h1>
            <p className="mkt-sub">
              Describe it in a sentence and the lobby builds itself: the rooms, the look, the
              welcome page. Then it sits in a town with every other lobby on Weered. One account.
              One friends list. One Town Square.
            </p>
            <div className="mkt-cta-row">
              <Link href={BUILD} className="mkt-cta-primary">
                Build yours, free
              </Link>
              <Link href="/" className="mkt-cta-secondary">
                See it first
              </Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">The shape of the thing</h2>
            <p className="mkt-p">
              Discord gives every community its own server, and every server is an island. You get
              in by invite. You never see the server next door. Weered is a town. Every lobby is a
              place on the same streets: <strong>Downtown</strong> lists them all, the{" "}
              <strong>Town Square</strong> is where everyone on Weered talks, and the tag beside
              each name in the square is the lobby that person is from. Click it and you&apos;re
              there.
            </p>
            <p className="mkt-p">
              A lobby is rooms. Each room has voice, cams, screen share and chat, and a stage for a
              YouTube video, a Twitch stream or a chess board that everyone in the room watches
              together.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What you get that Discord doesn&apos;t have</h2>
            <div className="mkt-grid-3">
              <div className="mkt-card">
                <h3>Describe it. It builds.</h3>
                <p>
                  Type one sentence. Weered builds the lobby: its rooms, its look, its welcome page
                  and its blocks. Describe it again to change it. Free accounts get 10 builds a day.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Not an island</h3>
                <p>
                  Every lobby sits in Downtown, one click from the next. A free lobby lists there
                  once three people have joined.
                </p>
              </div>
              <div className="mkt-card">
                <h3>One Town Square</h3>
                <p>
                  Everyone on Weered talks in one place, each name tagged with the lobby
                  they&apos;re from. Meet someone, walk into their lobby.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Game data, built in</h3>
                <p>
                  Bungie&apos;s API for Destiny 2, live Steam player counts, the Path of Exile
                  ladder, Lichess and Chess.com for chess. Real data, no bots to set up.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Watch together</h3>
                <p>
                  Put a YouTube video, a Twitch stream or your screen on a room&apos;s stage.
                  Everyone in the room sees it at the same moment.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Your own address</h3>
                <p>
                  Paid plans give your place or your lobby its own address: yourname.weered.ca,
                  yourlobby.weered.ca, or a domain of your own.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What&apos;s the same as Discord</h2>
            <ul className="mkt-bullet-list">
              <li>
                <strong>Free to use.</strong> Voice, video, chat and screen share.
              </li>
              <li>
                <strong>DMs and group chats.</strong> Private messages work the way you&apos;d
                expect.
              </li>
              <li>
                <strong>Moderation.</strong> Moderators, bans, mutes, slow mode and locked doors.
              </li>
              <li>
                <strong>Web, desktop and phones.</strong> weered.ca in any browser, phones included,
                plus a <Link href="/desktop">desktop app</Link>.
              </li>
              <li>
                <strong>Sign in with Discord.</strong> Your people don&apos;t need a new password.
              </li>
            </ul>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Who Weered is for</h2>
            <p className="mkt-p">
              Anyone who gathers people. Game crews and clans, clubs, classes and study groups,
              hobby communities, small teams. If people meet around it, it can be a lobby. And every
              lobby gets the town around it: people walking past who would never have found an
              invite link.
            </p>
            <div className="mkt-callout">
              If it can&apos;t build something you need yet, <Link href="/contact">tell us</Link>{" "}
              and we&apos;ll put it together.
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Common questions</h2>
            {FAQ.map((f) => (
              <div key={f.q}>
                <h3 className="mkt-h3">{f.q}</h3>
                <p className="mkt-p">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">If you got here for a more specific reason</h2>
            <ul className="mkt-bullet-list">
              <li>
                <strong>
                  <Link href="/alternatives/guilded">You came from Guilded.</Link>
                </strong>{" "}
                Roblox shut it down on December 19, 2025. What replaced each thing you had.
              </li>
              <li>
                <strong>
                  <Link href="/alternativas/discord-brasil" hrefLang="pt-BR">
                    Você está no Brasil e o vídeo do Discord parou.
                  </Link>
                </strong>{" "}
                Câmera, tela e Go Live estão suspensos desde 17 de agosto de 2026 por determinação
                da ANPD. O que foi bloqueado e o que fazer.
              </li>
            </ul>
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>Try it.</h2>
            <p>Describe a lobby in one sentence. It&apos;s free and it runs in your browser.</p>
            <Link href={BUILD} className="mkt-cta-primary">
              Build yours →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
