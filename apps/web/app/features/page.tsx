import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../components/MarketingHeader";
import { safeJsonLd } from "@/lib/jsonLd";

// Rewritten 2026-11-14 to the premise (James: the town is "the entire premise
// of the platform"; "Update accordingly"). It used to stop at the games: every
// fact here is checked against what the site does today.
const TITLE = "What Weered does: every lobby in one town";
const DESC =
  "Describe a place in a sentence and Weered builds it. Every lobby sits in one town: Downtown lists them all, the Town Square is where everyone talks, and one link brings your people in from any phone. Voice, video, games wired to live data. Free in your browser.";
const URL = "https://weered.ca/features";
// Create account, headed for the builder (the same door as /alternatives/discord).
const BUILD = "/login?mode=register&next=%2Flobby%2Fcreate";

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
  operatingSystem: "Web, Windows, Linux",
  description:
    "A town of communities. Describe a place and Weered builds the lobby; every lobby sits in one town with a shared Town Square, voice and video rooms, crews, and game lobbies wired to live data.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
};

export default function FeaturesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(appLd) }} />
      <MarketingHeader ctaHref="/lobby" ctaLabel="Open Weered" />

      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">What Weered is</span>
            <h1 className="mkt-h1">
              Every lobby sits in <span className="accent">one town</span>.
            </h1>
            <p className="mkt-sub">
              Other apps hand you an empty server on an island. On Weered your place is a building
              on a street people already walk down: describe it, it&apos;s built in seconds, and
              everyone you bring walks into the same town.
            </p>
            <div className="mkt-cta-row">
              <Link href={BUILD} className="mkt-cta-primary">
                Describe your place
              </Link>
              <Link href="/explore" className="mkt-cta-secondary">
                Walk around Downtown
              </Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">One town, not a pile of islands</h2>
            <p className="mkt-p">
              <Link href="/explore">Downtown</Link> lists every public lobby side by side. The Town
              Square is where everyone on Weered talks, and each name there carries a tag for the
              lobby that person comes from. The tag is a door: click it and you&apos;re standing in
              their place. One account, one friends list, and you walk from one community into the
              next without hunting for an invite.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Don&apos;t set it up. Describe it.</h2>
            <p className="mkt-p">
              Type what you want in a sentence (a speakeasy for your poker night, a study hall, a
              bridge club, a shop&apos;s front counter) and Weered builds the lobby: the rooms, the
              look, the welcome page. Then change anything by hand. Three lobbies of your own are
              free. If you want something it can&apos;t build yet,{" "}
              <Link href="/contact">tell us</Link> and we&apos;ll put it together.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">One link brings your people</h2>
            <p className="mkt-p">
              When the build finishes, Weered hands you the link. Send it by WhatsApp, Facebook,
              email or text. A guest link opens on any phone or computer, in the browser, with no
              download and no account, so a friend is in the room talking before they&apos;ve
              decided to sign up. When they like it, they make an account and they&apos;re a member.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">For anything, and the games are wired in</h2>
            <p className="mkt-p">
              Clubs, study groups, crews and businesses all build here. The games go further than a
              logo on a chat channel: the <Link href="/play/path-of-exile">Path of Exile</Link>{" "}
              lobby pulls the live currency exchange and your actual passive tree,{" "}
              <Link href="/lobby/destiny2">Destiny 2</Link> reads your fireteam&apos;s clears
              straight from Bungie, and <Link href="/lobby/eve">EVE</Link> shows your killboard.
              More than thirty game lobbies work this way, from Helldivers war maps to a
              paper-trading floor.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Everything else it does</h2>
            <p className="mkt-p">
              The town is the point, but the table stakes are all here too. The short version:
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "22px 32px",
                marginTop: 24,
              }}
            >
              {[
                {
                  h: "Talk and hang",
                  items: [
                    "Voice rooms: open, queued, or listen-only",
                    "Camera video and screen sharing",
                    "Synced stream co-watch and a shared browser",
                  ],
                },
                {
                  h: "Message",
                  items: [
                    "Lobby, room, crew, and direct messages",
                    "Group DMs, reactions, mentions, and flair",
                    "Image and file attachments, plus GIFs",
                  ],
                },
                {
                  h: "Moderate",
                  items: [
                    "Per-lobby roles and moderator tiers",
                    "Automod, member reports, a ban-appeal court",
                    "Full audit logs; trust earned before you post",
                  ],
                },
                {
                  h: "Play together",
                  items: [
                    "Thirty-plus game lobbies wired to live data",
                    "A built-in tabletop: tokens, fog of war, NPCs",
                    "Live poker and a paper-trading floor",
                  ],
                },
                {
                  h: "Stay in the loop",
                  items: [
                    "Steam, Xbox, PlayStation, and Twitch presence",
                    "In-app notifications and web push",
                    "Forums, events, and self-scoring tournaments",
                  ],
                },
                {
                  h: "Yours, everywhere",
                  items: [
                    "Web, phone browser, and a desktop app that updates itself",
                    "Notoriety reputation and Paper currency, earned",
                    "Bounties, tips, poker and tournament buy-ins",
                  ],
                },
              ].map((col) => (
                <div key={col.h}>
                  <h3
                    className="accent"
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 10,
                    }}
                  >
                    {col.h}
                  </h3>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {col.items.map((it) => (
                      <li
                        key={it}
                        style={{ display: "flex", gap: 8, marginBottom: 7, lineHeight: 1.5 }}
                      >
                        <span className="accent" aria-hidden="true">
                          ✓
                        </span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Tournaments that score themselves</h2>
            <p className="mkt-p">
              Run a speed race, a bracket, or a challenge ladder, and the results come straight from
              the game&apos;s API. No screenshots, no honour system, no organiser stuck doing manual
              scoring at midnight. The{" "}
              <Link href="/tournaments/destiny-2">Destiny 2 tournament engine</Link> reads
              Bungie&apos;s Post-Game Carnage Reports and credits the clear on its own. Hosting is
              free.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Rooms for actually playing together</h2>
            <p className="mkt-p">
              Drop into a room with voice that runs open, queued, or listen-only depending on the
              vibe. Share your screen, watch a Twitch stream or a YouTube video in sync with
              everyone, or open a browser the whole room can drive. The room is where the group
              hangs, not just where it types.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Crews that stick around</h2>
            <p className="mkt-p">
              Build a crew and your tag rides your name across the whole platform. Crews get their
              own space, their own chat, and their own identity.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Standing you earn, not a badge you buy</h2>
            <p className="mkt-p">
              Notoriety is platform-wide reputation you build by sticking around and playing
              straight. It unlocks what you can do: posting media, hosting your own lobbies, running
              moderation. Paper is the in-platform currency, for poker, tournament buy-ins, tips and
              bounties. Both are earned.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">It already knows what you&apos;re playing</h2>
            <p className="mkt-p">
              Weered reads cross-platform presence from Steam, Xbox, PlayStation, and Twitch. Your
              rails show who&apos;s in a game, who&apos;s streaming, and who&apos;s lying low,
              without anyone typing a status.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Friends, DMs, and pictures that can&apos;t ambush you</h2>
            <p className="mkt-p">
              Add friends, send DMs and group messages, invite people to your room, and decide
              exactly who&apos;s allowed to join you or invite you anywhere. Every picture is
              screened before it shows on your screen, including ones linked from other sites: those
              are copied onto Weered and checked first, so the other site never sees who looked. The
              full story is on the <Link href="/safety">safety page</Link>.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Web, desktop, and your phone</h2>
            <p className="mkt-p">
              Weered runs in any browser, on a phone as well as a computer, and as a{" "}
              <Link href="/desktop">desktop app</Link> that keeps itself up to date. Your lobbies,
              crews and friends follow you everywhere.
            </p>
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>Describe your place. Bring your people.</h2>
            <p>
              It&apos;s built in seconds, it&apos;s free, and it sits on the same street as every
              other community on Weered.
            </p>
            <Link href={BUILD} className="mkt-cta-primary">
              Describe your place →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
