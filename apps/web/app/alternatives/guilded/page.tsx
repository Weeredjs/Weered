import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../../components/MarketingHeader";

const TITLE = "Guilded Alternative for Gaming Communities (2026) | Weered";
const DESC =
  "Guilded shut down December 19, 2025. Weered is the structured gaming community platform that replaces it: calendars, tournaments, voice, your bots as built-in features, on your own domain.";
const URL = "https://weered.ca/alternatives/guilded";

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

/**
 * The pricing answer here has to agree with /alternatives/discord, which says
 * plainly that Weered is free to use. Both are true, and the distinction IS the
 * business: using Weered is free, and what a community pays for is a lobby
 * BUILT for it. Answering "no, we cost money" would contradict the sibling page
 * and describe a company this is not.
 *
 * The FAQ renders from this same object rather than repeating the copy in JSX,
 * so the structured data and the visible page can never drift apart. A FAQPage
 * block that disagrees with the page under it is worse than none at all.
 */
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Weered free like Guilded was?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Using Weered is free: lobbies, rooms, voice, video and presence. What is paid is having a lobby built for you, with your bots rebuilt as native features, your branding and your own domain. Guilded was free because Roblox was paying for it, and then Roblox stopped. We would rather charge for the build and still be here next year.",
      },
    },
    {
      "@type": "Question",
      name: "Do my members need a Roblox or Discord account to use Weered?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. A Weered account works in every Weered lobby. There is no parent platform to sign up for, and no landlord who can change the terms later.",
      },
    },
    {
      "@type": "Question",
      name: "Can you rebuild the bots we used on Guilded or Discord?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Describe what each bot did in a sentence. We build it into your lobby as a native feature, or connect to the source directly where the game or service has an API.",
      },
    },
    {
      "@type": "Question",
      name: "Can we use our own domain?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. A subdomain such as lobby.yourdomain.com points at your Weered lobby, so your brand is on the address bar rather than ours.",
      },
    },
    {
      "@type": "Question",
      name: "Can I still export my Guilded data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The export tool went away with the service on December 19, 2025. If the history was not saved before then it cannot be recovered, and anyone telling you otherwise is guessing. What carries across is the way a community works, not its message history.",
      },
    },
    {
      "@type": "Question",
      name: "Where is Weered hosted?",
      acceptedAnswer: { "@type": "Answer", text: "Canada." },
    },
    {
      "@type": "Question",
      name: "Can we leave?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Any time. Member data is exportable and there are no contracts. Builds are month to month.",
      },
    },
  ],
};

/** Left column deliberately set in the muted body colour, right column in full
 *  ink (see .mkt-table). The argument is legible before a word is read. */
const LOST: [string, string][] = [
  ["Server calendars and event scheduling", "Built-in events and scheduling in your lobby"],
  ["Tournament brackets", "Tournament and league modules, built for how your community runs them"],
  ["Forums and threads", "Persistent channels and threads"],
  ["Free voice and video", "Voice and video rooms, in every lobby, unmetered"],
  ["Roles, groups, team management", "Roles, gated rooms, team and squad structure"],
  [
    "Bots, from a limited ecosystem",
    "Your existing bots rebuilt as native features. Tell us what they do, we build them in",
  ],
  [
    "Free, until it wasn't",
    "Free to use. Paid only when we build one for you, priced by community size, never by seat",
  ],
  ["A Roblox account requirement", "No landlord. Your community, your rules, your domain"],
];

export default function AlternativesGuildedPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <MarketingHeader ctaHref="/lobby" ctaLabel="Open Weered" />

      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">Guilded Alternative</span>
            <h1 className="mkt-h1">
              The Guilded alternative built for{" "}
              <span className="accent">structured gaming communities</span>.
            </h1>
            <p className="mkt-sub">
              Guilded is gone. Roblox shut it down on December 19, 2025 and pointed everyone at
              Roblox Communities. Most people went back to Discord instead. If your community chose
              Guilded because you wanted calendars, tournaments and organisation without running a
              bot farm, Weered is where that idea kept going.
            </p>
            <div className="mkt-cta-row">
              <Link href="/lobby" className="mkt-cta-primary">
                Build your lobby
              </Link>
              <Link href="/foyer" className="mkt-cta-secondary">
                See a live community
              </Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What you lost, and what replaces it</h2>
            <div className="mkt-table-wrap">
              <table className="mkt-table">
                <thead>
                  <tr>
                    <th scope="col">You had on Guilded</th>
                    <th scope="col">You get on Weered</th>
                  </tr>
                </thead>
                <tbody>
                  {LOST.map(([had, got]) => (
                    <tr key={had}>
                      <td>{had}</td>
                      <td>{got}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Three things Guilded never had</h2>
            <div className="mkt-grid-3">
              <div className="mkt-card">
                <h3>Your own domain</h3>
                <p>
                  lobby.yourcommunity.gg, with your brand on the address bar rather than ours. Your
                  rankings, your brackets and your recruitment page rank under your name.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Watch together, natively</h3>
                <p>
                  Co-watch rooms sync a stream or a video for everyone in the lobby. Race replays,
                  VOD reviews, tournament broadcasts. One room, everyone in sync, no screen-share
                  lag.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Admin in plain language</h3>
                <p>
                  Open sign-ups for round two, pin the bracket, lock the results channel. The admin
                  layer takes instructions like a staff member, not a settings menu.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Moving from Guilded, or from the Discord you fell back to</h2>
            <p className="mkt-p">
              The export tool went away with the service. If you did not save your history before
              December you cannot now, and we are not going to pretend otherwise. What you{" "}
              <strong>can</strong> bring across is the way your community actually works.
            </p>
            <ul className="mkt-bullet-list">
              <li>
                <strong>Tell us what your bots did.</strong> One sentence each. That is the whole
                specification.
              </li>
              <li>
                <strong>Send your branding.</strong> Logo, colours, the feel of the thing. We build
                the lobby around it.
              </li>
              <li>
                <strong>Approve and invite.</strong> Your lobby is live in days, not quarters.
              </li>
            </ul>
            <p className="mkt-p">
              No export files, no migration wizard. A description of your community, and a builder
              who reads it.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Who this is for</h2>
            <ul className="mkt-bullet-list">
              <li>Esports teams and clans that ran on Guilded for the structure</li>
              <li>Leagues with seasons, schedules, stewards and standings</li>
              <li>Communities that outgrew the answer of installing another bot</li>
              <li>Anyone who wants a home with their own name on it</li>
            </ul>
            <div className="mkt-callout">
              <strong>Who it is not for.</strong> If you want to self-host and pay nothing, Revolt
              is a better fit and we would rather say so. Weered is hosted, built for you, and
              priced like software someone answers the phone for.
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Using Weered is free. Having one built is not.</h2>
            <p className="mkt-p">
              Lobbies, rooms, voice, video and presence cost nothing to use, and that is not going
              to change. What a community pays for is a lobby <strong>built for it</strong>: your
              bots rebuilt as native features, your branding, your rules, your domain.
            </p>
            <p className="mkt-p">
              Discord charges a Level 3 server the same whether it holds 200 members or 20,000. A
              build is priced by what your community actually is.
            </p>
            <ul className="mkt-bullet-list">
              <li>
                <strong>Crew</strong> &mdash; up to 250 members
              </li>
              <li>
                <strong>League</strong> &mdash; up to 1,000 members
              </li>
              <li>
                <strong>Network</strong> &mdash; up to 5,000 members
              </li>
              <li>Larger than that, a custom quote with dedicated infrastructure</li>
            </ul>
            <p className="mkt-p">
              Voice is unmetered. Month to month, no contracts, and your member data is exportable
              whenever you want it.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Common questions</h2>
            {faqLd.mainEntity.map((q) => (
              <div key={q.name}>
                <h3 className="mkt-h3">{q.name}</h3>
                <p className="mkt-p">{q.acceptedAnswer.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>Your community still exists. It just needs somewhere to be.</h2>
            <p>
              Tell us what your bots did and what your community looks like. We build the lobby
              around it.
            </p>
            <div className="mkt-cta-row">
              <Link href="/lobby" className="mkt-cta-primary">
                Build your lobby
              </Link>
              <Link href="/contact" className="mkt-cta-secondary">
                Talk to the builder
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
