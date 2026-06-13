import { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "../../../components/MarketingHeader";

const TITLE = "FakeOut: paper trading with your crew, free, $100K fake money | Weered";
const DESC = "Live Binance crypto + TradingView charts + $100,000 in fake money. Compete on leaderboards, run trading competitions, talk shop in voice. The paper-trading platform that's a place, not a tab.";
const URL = "https://weered.ca/play/fakeout";

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
    { "@type": "Question", name: "Is FakeOut real money?", acceptedAnswer: { "@type": "Answer", text: "No. FakeOut is a paper-trading platform. You trade with $100,000 in virtual money against live Binance market data. Nothing you do affects real markets and nothing you win is convertible to real currency. It's a learning and competition platform, not an exchange." }},
    { "@type": "Question", name: "What markets does it support?", acceptedAnswer: { "@type": "Answer", text: "Spot crypto via Binance's live WebSocket feed: BTC, ETH, SOL, and the top spot pairs. Forex pairs are stubbed today and the live wiring to a twelvedata FX feed is on the roadmap. Equities aren't planned for the near term." }},
    { "@type": "Question", name: "Are the charts real TradingView?", acceptedAnswer: { "@type": "Answer", text: "Yes. The chart on every trade view is the actual TradingView embed with full indicator support. The order book, depth chart, and trade feed are live from Binance. Only the wallet and orders are virtual." }},
    { "@type": "Question", name: "Can I run a trading competition with my crew?", acceptedAnswer: { "@type": "Answer", text: "Yes. The FakeOut lobby supports tournaments: define a window (e.g. 'best PnL over 7 days, starting Monday'), invite your crew, leaderboard updates live as positions change. Notoriety and Paper rewards on the platform." }},
  ],
};

export default function PlayFakeOutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <MarketingHeader ctaHref="/lobby/fakeout" ctaLabel="Open FakeOut" />

      <main className="mkt">
        <section className="mkt-hero">
          <div className="mkt-wrap">
            <span className="mkt-eyebrow">FakeOut: Paper Trading</span>
            <h1 className="mkt-h1">
              Trade $100,000 in fake money <span className="accent">against real markets</span>.
            </h1>
            <p className="mkt-sub">
              Live Binance spot prices. TradingView charts. Real order book, real depth, real trade feed. Just a fake wallet. Compete with your crew, run trading tournaments, talk shop in voice while you stare at the same chart.
            </p>
            <div className="mkt-cta-row">
              <Link href="/lobby/fakeout" className="mkt-cta-primary">Open FakeOut</Link>
              <Link href="/lobby/fakeout#leaderboard" className="mkt-cta-secondary">See the leaderboard</Link>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">Real market data, fake money</h2>
            <p className="mkt-p">
              FakeOut sits on top of Binance's live WebSocket feed. Order book, depth, recent trades, candle data: all the same data the actual Binance terminal shows. What's different is that you start with a $100,000 virtual wallet, and every trade you place is paper.
            </p>
            <p className="mkt-p">
              The charts are TradingView, embedded with the full indicator suite. You're not looking at a stylised wrapper. It's the same chart you'd use on TradingView itself, with all the drawing tools and overlays you expect.
            </p>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What it's good for</h2>
            <div className="mkt-grid-3">
              <div className="mkt-card">
                <h3>Learning</h3>
                <p>Build the muscle memory of placing orders, watching the book, managing risk, without losing the rent. Make every dumb mistake possible for free.</p>
              </div>
              <div className="mkt-card">
                <h3>Strategy testing</h3>
                <p>Try a new indicator. Try a martingale. Try DCAing into a thesis. See how it plays out against real prices, in real time, with no actual exposure.</p>
              </div>
              <div className="mkt-card">
                <h3>Crew competitions</h3>
                <p>Best PnL of the week. Best Sharpe ratio of the month. Highest realised gain on a single trade. Bragging rights, no buy-in, leaderboards live.</p>
              </div>
              <div className="mkt-card">
                <h3>Live co-watching</h3>
                <p>Drop the FakeOut chart on the room stage, your crew sees the same setup you're looking at. Talk through the entry in voice while everyone watches the same price action.</p>
              </div>
              <div className="mkt-card">
                <h3>Notoriety + Paper rewards</h3>
                <p>Tournament wins pay out in platform Notoriety and Paper. Spendable across Weered: store items, tournament buy-ins on other games, crew goods.</p>
              </div>
              <div className="mkt-card">
                <h3>No fees, no slippage tax</h3>
                <p>Real markets eat you alive with spread and fees. FakeOut lets you see what your strategy looks like on the pure price action, a clean signal to compare against.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">What FakeOut isn't</h2>
            <p className="mkt-p">
              FakeOut is not an exchange. You can't withdraw your fake wallet. You can't deposit real money. Nothing here is investment advice; nothing here is regulated as financial activity. It's a paper-trading game that happens to use live data.
            </p>
            <div className="mkt-callout">
              FakeOut is a learning + competition platform. It is NOT investment advice, NOT regulated financial activity, and the fake wallet has no real-world value. Treat it like a video game with very accurate prices.
            </div>
          </div>
        </section>

        <section className="mkt-section">
          <div className="mkt-wrap">
            <h2 className="mkt-h2">How a trading competition runs</h2>
            <ul className="mkt-bullet-list">
              <li><strong>Open FakeOut.</strong> Wallet auto-funded with $100,000 virtual.</li>
              <li><strong>Click "Create Tournament" in the FakeOut lobby.</strong> Pick window (24h / 7d / 30d), scoring metric (PnL, Sharpe, max gain), buy-in (free or paid in platform Paper).</li>
              <li><strong>Share the link with your crew.</strong> They open FakeOut, join, get their own $100K starting wallet.</li>
              <li><strong>Trade.</strong> Each participant trades the live Binance pairs. Positions tracked, leaderboard updates as prices move.</li>
              <li><strong>Window closes, winner takes the pot.</strong> Notoriety + Paper rewards drop into the winner's account, history posted publicly.</li>
            </ul>
          </div>
        </section>

        <section className="mkt-wrap">
          <div className="mkt-final-cta">
            <h2>Stare at the chart together.</h2>
            <p>Free, live markets, fake money, real bragging rights.</p>
            <Link href="/lobby/fakeout" className="mkt-cta-primary">Open FakeOut →</Link>
          </div>
        </section>
      </main>
    </>
  );
}
