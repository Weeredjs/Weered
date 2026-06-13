import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../components/MarketingHeader";

const TITLE = "Safety on Weered — every image screened, nobody gets ambushed";
const DESC = "How Weered keeps you safe: every image is screened twice before it ever displays, posting is a reputation-gated privilege, media from unproven members shows blurred until you choose, removed content is fingerprint-banned platform-wide, and illegal content is reported under Canadian law.";
const URL = "https://weered.ca/safety";

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
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
  },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "Is Weered safe?", acceptedAnswer: { "@type": "Answer", text: "Yes. Every image is screened twice before it ever displays, once on your own device before it uploads and again on Weered's servers. Posting media is a privilege new accounts have to earn, so throwaway accounts can't post images at all. Media from members who haven't built a track record shows blurred until you choose to view it, and any image can be reported in one tap." } },
    { "@type": "Question", name: "Can someone send me explicit or violent images on Weered?", acceptedAnswer: { "@type": "Answer", text: "No. Pornographic and violent images are caught by an on-device check before they ever upload, and re-checked on the server. Images from members without an established track record display blurred until you tap to view them, so you are never shown content you didn't choose to see." } },
    { "@type": "Question", name: "Is Weered safe for teens?", acceptedAnswer: { "@type": "Answer", text: "Members can't be shown an image they didn't choose to look at, strangers can't force their way into a member's session or inbox without permission, and adult spaces are opt-in and walled off from the main platform. Anything genuinely illegal is reported to the authorities under Canadian law. Reports go to a real person at safety@weered.ca." } },
    { "@type": "Question", name: "How does Weered handle illegal content?", acceptedAnswer: { "@type": "Answer", text: "Weered complies with Canadian law on the mandatory reporting of child sexual abuse material. Reports of anything illegal are escalated immediately rather than queued. Removed content has its digital fingerprint permanently blocked across the whole platform, so it can't be re-uploaded by anyone." } },
  ],
};

export default function SafetyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <MarketingHeader ctaHref="/lobby" ctaLabel="Open Weered" />

      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">Trust &amp; Safety</span>
            <h1 className="mkt-h1">
              You can&apos;t get <span className="accent">ambushed</span> on Weered.
            </h1>
            <p className="mkt-sub">
              No surprise gore in a lobby, no stranger flashing something at you, no throwaway account that dumps garbage and vanishes. We didn&apos;t bolt safety on as an apology. We built it into how the place runs, and this is exactly how.
            </p>
            <div className="mkt-cta-row">
              <Link href="/explore" className="mkt-cta-primary">Look around Weered</Link>
              <Link href="/media-policy" className="mkt-cta-secondary">Read the full media policy</Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Every image is screened before you ever see it</h2>
            <p className="mkt-p">
              Images are where things go wrong fastest, so we check every single one, twice. When you attach a picture, your own device checks it first, before it even uploads. If it&apos;s pornographic or violent, it stops right there and never leaves your machine.
            </p>
            <p className="mkt-p">
              Anything that does upload gets checked again on our servers and re-encoded, which quietly strips out hidden data like the GPS coordinates baked into the photo. Nothing reaches another person unprocessed. Ever.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Posting images is earned, not given</h2>
            <p className="mkt-p">
              New accounts can&apos;t post media at all. You unlock it by actually being part of the community for a while, and once you can, every image you share puts your reputation on the table. Post something that breaks the rules and you lose your standing and your posting rights in one shot. A burner somebody spun up five minutes ago to cause trouble simply can&apos;t post a picture. That kills most of the problem before it starts.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">You decide what shows up</h2>
            <p className="mkt-p">
              Pictures from people who haven&apos;t built a track record yet stay blurred until you tap to see them. Pictures from established members show normally. Either way, one tap reports anything.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Removed stays removed</h2>
            <p className="mkt-p">
              When staff pull an image, we take a fingerprint of it and block that fingerprint across the whole platform, for good. Anyone who tries to re-upload the same thing fails automatically and loses their posting rights for trying. We keep the fingerprint, not the picture.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Some things aren&apos;t a house-rules matter</h2>
            <p className="mkt-p">
              They&apos;re a call-the-authorities matter. Weered follows Canadian law on reporting child sexual abuse material, and reports of anything illegal get escalated immediately, not queued. The report button is in the app, and safety@weered.ca reaches a real person.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">The people keeping order aren&apos;t all faceless staff</h2>
            <p className="mkt-p">
              Reputation is the backbone of the whole thing. The longer you&apos;re around and the straighter you play, the more you can do, and the most trusted members run real moderation in their own lobbies. We&apos;re rolling out regional moderators too, people who actually know the local scene, for location-based communities. Staff sit above all of it for the serious calls.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">You&apos;ve got your own switches</h2>
            <ul className="mkt-bullet-list">
              <li>Block anyone and they&apos;re gone from your world.</li>
              <li>Choose who can drop into your session or invite you somewhere: everyone, friends only, or nobody.</li>
              <li>Mute a loud room without leaving it.</li>
            </ul>
            <p className="mkt-p">
              None of this needs a ticket or a request. It&apos;s sitting in your settings.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Adult spaces are walled off and opt-in</h2>
            <p className="mkt-p">
              They only exist inside subspaces people create on purpose, you have to choose to walk in, and they never bleed into the main experience. Never opt in, never see them.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">For parents</h2>
            <p className="mkt-p">
              If your kid is on here, the one-sentence version: they can&apos;t be shown an image they didn&apos;t choose to look at, and anything genuinely illegal goes straight to the authorities under Canadian law instead of into a backlog. Strangers can&apos;t force their way into your kid&apos;s session or their inbox unless your kid lets them. Adult areas are opt-in and don&apos;t touch the main platform. If something slips through anyway, the report button is one tap and a real person reads it. You can reach us straight at safety@weered.ca.
            </p>
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>Found something? Don&apos;t sit on it.</h2>
            <p>The report button is everywhere there&apos;s content, and safety@weered.ca goes to a person, not a void. We&apos;d rather get a report that turns out fine than miss one that didn&apos;t.</p>
            <Link href="/explore" className="mkt-cta-primary">Look around Weered →</Link>
          </div>
        </section>
      </main>
    </>
  );
}
