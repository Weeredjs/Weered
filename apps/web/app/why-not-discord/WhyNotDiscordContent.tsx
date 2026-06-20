"use client";
import { useEffect, useState } from "react";

export default function WhyNotDiscordContent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        .manifesto-root {
          height: 100%;
          overflow-y: auto;
          background: #050810;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 60px 24px;
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow-x: hidden;
        }
        .manifesto-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 15% 10%, rgba(124,58,237,0.15) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 85% 90%, rgba(217,70,239,0.08) 0%, transparent 55%);
          pointer-events: none;
        }
        .manifesto-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
          background-size: 52px 52px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 20%, transparent 100%);
        }
        .manifesto-inner {
          position: relative;
          z-index: 1;
          width: min(680px, 100%);
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .manifesto-inner.visible { opacity: 1; transform: translateY(0); }
        .manifesto-headline {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 900;
          font-size: clamp(40px, 8vw, 72px);
          letter-spacing: -2px;
          line-height: 1.05;
          background: linear-gradient(135deg, #fff 0%, rgba(167,139,250,0.8) 60%, rgba(124,58,237,0.6) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 12px;
          text-transform: uppercase;
        }
        .manifesto-tagline {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(167,139,250,0.95);
          margin-bottom: 64px;
        }
        .manifesto-divider {
          width: 40px;
          height: 1px;
          background: linear-gradient(90deg, rgba(124,58,237,0.6), transparent);
          margin: 40px 0;
        }
        .manifesto-block { margin-bottom: 48px; }
        .manifesto-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(196,181,253,0.95);
          margin-bottom: 18px;
        }
        .manifesto-text {
          font-size: 15px;
          line-height: 1.9;
          color: rgba(232,232,240,0.75);
          font-family: 'DM Mono', monospace;
        }
        .manifesto-text em {
          font-style: normal;
          color: rgba(167,139,250,0.9);
        }
        .manifesto-footer {
          margin-top: 80px;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: rgba(255,255,255,0.15);
        }
        .manifesto-nav { display: flex; gap: 24px; }
        .manifesto-nav a {
          color: rgba(167,139,250,0.4);
          text-decoration: none;
          font-size: 11px;
          letter-spacing: 0.1em;
          transition: color 0.2s;
        }
        .manifesto-nav a:hover { color: rgba(167,139,250,0.8); }
      `}</style>

      <div className="manifesto-root">
        <div className={`manifesto-inner${visible ? " visible" : ""}`}>
          <div style={{ marginBottom: 20 }}>
            <a href="/" aria-label="Weered home" style={{ display: "inline-block" }}>
              <img
                src="/brand/logo/weered-logo-512.png"
                alt="Weered"
                style={{
                  width: 88,
                  height: 88,
                  filter: "drop-shadow(0 0 24px rgba(88,0,229,0.35))",
                }}
              />
            </a>
          </div>
          <div className="manifesto-headline">
            why weered
            <br />
            isn&apos;t discord
          </div>
          <div className="manifesto-tagline">a manifesto · 2026</div>

          <div className="manifesto-block">
            <div className="manifesto-label">origin</div>
            <div className="manifesto-text">
              I grew up on MPlayer. Late 90s, dial-up, dedicated lobbies for specific games. You
              walked into a room and everyone there was playing the same thing you were. The chat
              happened around the game. The community formed around shared activity.
              <br />
              <br />
              When a game died, the lobby died with it and people moved to the next one. That was
              fine. It was honest.
              <br />
              <br />
              <em>Then Discord won.</em>
            </div>
          </div>

          <div className="manifesto-divider" />

          <div className="manifesto-block">
            <div className="manifesto-label">what we lost</div>
            <div className="manifesto-text">
              Discord is incredible at being the everything-app for chat. I use it. I&apos;m not
              pretending it&apos;s bad software. But somewhere around 2018 the gaming community
              started using Discord as the only place we organize, and that&apos;s where it broke.
              <br />
              <br />
              Clan tools died. Forums died. LFG tools died. WoW guild sites turned into Discord
              servers. Destiny clans turned into Discord servers. Forums that ran games like Zelda
              Classic for twenty years watched their communities drain into Discord servers where
              the conversation scrolls past in two days and nobody can find anything ever again.
              <br />
              <br />
              The tools clans actually need? Discord doesn&apos;t build them. Discord builds general
              chat with channels. Clans need rosters, raid signups, character sheets, loot ledgers,
              attendance tracking, integrated voice that ties to game state, screenshare that
              handles more than 50 viewers when a streamer is showing a strat.
              <br />
              <br />
              Every one of those is a third-party bot duct-taped to a Discord server, fighting rate
              limits, breaking when Discord changes an API.
              <br />
              <br />
              The problem isn&apos;t that Discord is bad. The problem is that Discord is built for
              everyone, which means it&apos;s built for nobody specifically. Clans, crews, raid
              teams, trading rooms, fireteams, guilds, fighting game tournaments, day-trading
              communities. None of these get a tool designed for them. They get a generic chat
              surface they have to bend.
            </div>
          </div>

          <div className="manifesto-divider" />

          <div className="manifesto-block">
            <div className="manifesto-label">what weered does differently</div>
            <div className="manifesto-text">
              <em>Weered is lobby-first, not server-first.</em>
              <br />
              <br />
              A Weered lobby is a room built around a specific activity. Watching a stream together.
              Running a raid. Day trading the open. Studying a Destiny encounter. Gigging on a
              track.
              <br />
              <br />
              The lobby has the tools that activity needs. Game state on the left rail, location on
              the right, presence that knows you&apos;re in Diablo 4 because we&apos;re polling
              Steam, not because you remembered to update your Discord status.
              <br />
              <br />
              <em>Crews</em> are persistent groups that run their own lobbies, post their own
              bounties, build their own dojos. Not a Discord server with 47 channels nobody reads. A
              real crew home with the tools you actually use.
              <br />
              <br />
              We&apos;re not trying to host every conversation in your life. We&apos;re trying to be
              the place where your crew shows up to do the thing.
            </div>
          </div>

          <div className="manifesto-divider" />

          <div className="manifesto-block">
            <div className="manifesto-label">the trading angle, because someone asked</div>
            <div className="manifesto-text">
              I run an autonomous ML forex scalper called <em>Stirling FOREX</em> on the side. So I
              sit in trading Discords: FX desks, crypto rooms, the whole spread.
              <br />
              <br />
              Day traders have been screaming about Discord&apos;s 50-viewer screenshare cap for
              years. A trader running a live charting session for a paid room hits the cap by
              9:32am. The room fragments. Half the audience is staring at a frozen embed. The host
              can&apos;t actually share what they&apos;re seeing.
              <br />
              <br />
              This isn&apos;t a roadmap announcement. But the <em>Fakeout</em> module already has
              live Binance feeds, TradingView charts, paper portfolios, leaderboards. Lobbies built
              for trading rooms are not a stretch from where we already are. If you run a trading
              community and you&apos;re tired of fighting Discord, talk to me.
            </div>
          </div>

          <div className="manifesto-divider" />

          <div className="manifesto-block">
            <div className="manifesto-label">the honest part</div>
            <div className="manifesto-text">
              Weered is not trying to be a billion-user platform. We&apos;re not a Discord
              competitor in the &quot;let&apos;s eat their lunch&quot; sense. We don&apos;t want to
              host the world&apos;s chat.
              <br />
              <br />
              We want to be the right tool for crews who organize around specific shared activities,
              and we&apos;re sized for that.
              <em>Salary model, not VC bonfire.</em>
              We&apos;re not going to enshittify because we&apos;re not chasing the metric that
              forces it.
              <br />
              <br />
              If you&apos;ve ever watched your community drain into a Discord server and felt
              something break, you&apos;re who I built this for. If you run a clan, a guild, a
              fireteam, a trading room, a fighting game scene, a streaming crew. If you remember
              when forums were where the lore lived. If you&apos;ve tried four different Discord
              bots to do what should be one tool.
            </div>
          </div>

          <div className="manifesto-divider" />

          <div className="manifesto-block">
            <div className="manifesto-label">come look</div>
            <div className="manifesto-text">
              Tell me what&apos;s missing. I&apos;m building this in public and the early users
              shape what it becomes.
              <br />
              <br />
              The next version of community tooling isn&apos;t going to be Discord with more bots.
              It&apos;s going to be platforms that pick a lane and build for it.
              <br />
              <br />
              <em>That&apos;s the lane Weered is picking.</em>
              <br />
              <br />
              jim
            </div>
          </div>

          <div className="manifesto-footer">
            <span>&copy; weered.ca</span>
            <nav className="manifesto-nav">
              <a href="/about">about</a>
              <a href="/login">enter</a>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
