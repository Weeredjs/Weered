import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../components/MarketingHeader";

const TITLE = "Pricing | Weered — free to use, built for you when you want it";
const DESC =
  "Using Weered is free. Running your own lobby is $6 a month. A lobby built for your community — your bots as native features, your branding, your own domain — is priced by community size, never by seat. The first ten builds are on founding terms.";
const URL = "https://weered.ca/pricing";

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
 * The page every other page already linked to and that did not exist.
 *
 * Three rungs, stated the same way they are stated on /alternatives/discord,
 * /alternatives/guilded and /alternativas/discord-brasil, because a site that
 * answers "is it free" differently on different pages teaches a reader to
 * trust none of them:
 *
 *   free   -- to USE: lobbies, rooms, voice, video, presence
 *   $6/mo  -- to RUN your own lobby (Indicted; free accounts cannot create one)
 *   quoted -- to have one BUILT for you, by community size
 *
 * Build tiers carry no dollar figure on purpose. A build is quoted, and the
 * FastFox terms were negotiated per community; publishing a number here would
 * either undercut that or contradict it. The tier bands are the honest public
 * fact.
 *
 * "Founding 10" is real scarcity: the offer FastFox got, generalised to the
 * first ten, and it ends when it ends.
 */
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Weered free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Using Weered is free: lobbies, rooms, voice, video and presence, with no seat limits and no boosts. Running your own lobby is a paid tier at $6 a month. Having a lobby built for your community is quoted by community size.",
      },
    },
    {
      "@type": "Question",
      name: "What does a custom build actually include?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your existing bots rebuilt as native lobby features, your branding, your own domain, rooms and roles matched to how your community is organised, voice and video, co-watch, events and brackets where you run them, and a builder you talk to directly. You describe what each bot does in a sentence; that is the whole specification.",
      },
    },
    {
      "@type": "Question",
      name: "What are the founding terms?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For the first ten communities: the one-time build fee is waived, your monthly rate is locked for at least twelve months and stays at founding pricing as long as you remain, and there is no contract. In return we ask for a short case study with real numbers after ninety days, a testimonial we can publish, and warm introductions to two communities you know.",
      },
    },
    {
      "@type": "Question",
      name: "Why is a build priced by community size rather than per seat?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Because that is what a build costs us. A 200-member league and a 5,000-member network need different infrastructure, and neither should pay per head for members who joined last week. Discord charges a Level 3 server the same whether it holds 200 people or 20,000; we would rather charge for what you are.",
      },
    },
    {
      "@type": "Question",
      name: "Can we leave, and do we keep our data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes to both. Builds are month to month with no contract, and your member data is exportable at any time.",
      },
    },
    {
      "@type": "Question",
      name: "Where is Weered hosted?",
      acceptedAnswer: { "@type": "Answer", text: "Canada." },
    },
  ],
};

const TIERS: [string, string, string][] = [
  ["Crew", "up to 250 members", "A clan, a squad, a weekly."],
  ["League", "up to 1,000 members", "Seasons, divisions, stewards, standings."],
  ["Network", "up to 5,000 members", "Multi-title orgs, leagues of leagues, sponsors on the wall."],
  ["Larger", "custom", "Dedicated infrastructure, quoted."],
];

export default function PricingPage() {
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
            <span className="mkt-eyebrow">Pricing</span>
            <h1 className="mkt-h1">
              Free to use. <span className="accent">Built for you</span> when you want it.
            </h1>
            <p className="mkt-sub">
              Three honest rungs. Using Weered costs nothing. Running your own lobby is six dollars
              a month. Having one built around your community — your bots, your brand, your domain —
              is priced by what your community is, never by seat and never by boost.
            </p>
            <div className="mkt-cta-row">
              <Link href="/contact" className="mkt-cta-primary">
                Talk to the builder
              </Link>
              <Link href="/lobby" className="mkt-cta-secondary">
                Just use it, free
              </Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">The three rungs</h2>
            <div className="mkt-grid-3">
              <div className="mkt-card">
                <h3>Use it — free</h3>
                <p>
                  Every lobby, room, voice channel, video call and presence signal on the platform.
                  No seat limits. No boosts. Nothing behind a paywall that a community needs to
                  function.
                </p>
              </div>
              <div className="mkt-card">
                <h3>Run your own — $6 / month</h3>
                <p>
                  Free accounts can join any lobby but cannot create one. Six dollars a month lets
                  you stand one up yourself: your rooms, your roles and role icons, your name,
                  banner and accent, forum moderation.{" "}
                  <Link href="/premium">The tiers, in full.</Link>
                </p>
              </div>
              <div className="mkt-card">
                <h3>Have it built — quoted</h3>
                <p>
                  We build the lobby around how your community actually works. Your existing bots
                  become native features. Your branding, your rules, your own domain on the address
                  bar. You approve the final look; we run it long term.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Build tiers, by community size</h2>
            <p className="mkt-p">
              A 200-member weekly and a 5,000-member network need different infrastructure, and
              neither should pay per head for the people who joined last week. So a build is priced
              by what your community is.
            </p>
            <div className="mkt-table-wrap">
              <table className="mkt-table">
                <thead>
                  <tr>
                    <th scope="col">Tier</th>
                    <th scope="col">Size</th>
                    <th scope="col">Built for</th>
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map(([tier, size, who]) => (
                    <tr key={tier}>
                      <td>
                        <strong>{tier}</strong>
                      </td>
                      <td>{size}</td>
                      <td>{who}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mkt-p">
              Every build includes voice and video (unmetered), co-watch, events and brackets where
              you run them, roles matched to your structure, and a builder you talk to directly
              rather than a ticket queue. Month to month. No contract. Your member data is
              exportable whenever you want it.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Founding terms — the first ten builds</h2>
            <p className="mkt-p">
              Weered is new, and the first communities to build here are doing us a favour as much
              as we are doing them one. So the first ten get the terms our first community got.
            </p>
            <ul className="mkt-bullet-list">
              <li>
                <strong>Build fee waived.</strong> The one-time build cost is zero.
              </li>
              <li>
                <strong>Rate locked.</strong> Your monthly rate does not rise for at least twelve
                months — and as long as you stay, you keep founding pricing.
              </li>
              <li>
                <strong>No contract.</strong> Month to month from day one.
              </li>
            </ul>
            <p className="mkt-p">
              Founding pricing is a trade, not a discount. In return we ask for:
            </p>
            <ul className="mkt-bullet-list">
              <li>A short written case study with real numbers after ninety days.</li>
              <li>A testimonial we can publish.</li>
              <li>Warm introductions to two other communities you know.</li>
            </ul>
            <div className="mkt-callout">
              <strong>Ten, then it ends.</strong> Not a countdown timer, not a marketing calendar —
              a number we can build well in the time we have. When the tenth is live, the page
              changes.
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">How a build starts</h2>
            <ul className="mkt-bullet-list">
              <li>
                <strong>Tell us what your bots do.</strong> One sentence each. That is the whole
                specification — no technical brief needed from you.
              </li>
              <li>
                <strong>Send your branding.</strong> Logo, colours, the feel of the thing.
              </li>
              <li>
                <strong>Approve and invite.</strong> A demo lobby within the week, at no cost,
                before any commercial conversation. Your admins test it. Then you decide.
              </li>
            </ul>
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
            <h2>Describe your community. We build the lobby around it.</h2>
            <p>A demo lobby this week, free, before anyone talks about money.</p>
            <div className="mkt-cta-row">
              <Link href="/contact" className="mkt-cta-primary">
                Talk to the builder
              </Link>
              <Link href="/alternatives/discord" className="mkt-cta-secondary">
                Why not just Discord?
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
