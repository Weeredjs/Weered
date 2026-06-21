"use client";
import { useEffect, useState } from "react";

export default function GuidelinesContent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  return (
    <>
      <style>{`
        .legal-root {
          min-height: 100vh;
          background: #050810;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 24px;
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow-x: hidden;
        }
        .legal-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 15% 10%, rgba(124,58,237,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 85% 90%, rgba(217,70,239,0.06) 0%, transparent 55%);
          pointer-events: none;
        }
        .legal-root::after {
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
        .legal-inner {
          position: relative; z-index: 1; width: min(720px, 100%);
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .legal-inner.visible { opacity: 1; transform: translateY(0); }
        .legal-title {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif; font-weight: 900;
          font-size: clamp(32px, 7vw, 56px); letter-spacing: -2px; line-height: 1.1;
          background: linear-gradient(135deg, #fff 0%, rgba(167,139,250,0.8) 60%, rgba(124,58,237,0.6) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          margin-bottom: 8px;
        }
        .legal-updated { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(124,58,237,0.5); margin-bottom: 16px; }
        .legal-intro { font-size: 14px; line-height: 1.8; color: rgba(232,232,240,0.6); margin-bottom: 48px; }
        .legal-section { margin-bottom: 40px; }
        .legal-heading { font-size: 13px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(167,139,250,0.8); margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid rgba(124,58,237,0.15); }
        .legal-text { font-size: 13px; line-height: 2; color: rgba(232,232,240,0.7); }
        .legal-text strong { color: rgba(243,244,246,0.9); font-weight: 500; }
        .legal-text ul { padding-left: 20px; margin: 12px 0; }
        .legal-text li { margin-bottom: 6px; }
        .legal-text a { color: rgba(167,139,250,0.8); }
        .legal-do { color: rgba(110,231,183,0.85); }
        .legal-dont { color: rgba(252,165,165,0.85); }
        .legal-footer { margin-top: 80px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.15); }
        .legal-nav { display: flex; gap: 24px; }
        .legal-nav a { color: rgba(167,139,250,0.4); text-decoration: none; font-size: 11px; letter-spacing: 0.1em; transition: color 0.2s; }
        .legal-nav a:hover { color: rgba(167,139,250,0.8); }
      `}</style>

      <div className="legal-root">
        <div className={`legal-inner ${visible ? "visible" : ""}`}>
          <div style={{ marginBottom: 20 }}>
            <a href="/" aria-label="Weered home" style={{ display: "inline-block" }}>
              <img
                src="/brand/logo/weered-logo-512.png"
                alt="Weered"
                style={{
                  width: 64,
                  height: 64,
                  filter: "drop-shadow(0 0 18px rgba(88,0,229,0.3))",
                }}
              />
            </a>
          </div>
          <div className="legal-title">Community Guidelines</div>
          <div className="legal-updated">Last updated: April 8, 2026</div>
          <div className="legal-intro">
            Weered is built for people who want to hang out around things they care about. These
            guidelines exist to keep it that way. They apply everywhere on the platform: chat,
            forums, video rooms, screen shares, and profiles.
          </div>

          <div className="legal-section">
            <div className="legal-heading">The Short Version</div>
            <div className="legal-text">
              <ul>
                <li>
                  <span className="legal-do">Do:</span> Be a real person. Talk about what you like.
                  Help people out. Have fun.
                </li>
                <li>
                  <span className="legal-dont">Don't:</span> Harass people. Share illegal content.
                  Spam. Be a creep on video. Ruin it for everyone.
                </li>
              </ul>
              If you would not do it in front of a stranger at a bar, don't do it here.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">Respect Other People</div>
            <div className="legal-text">
              <ul>
                <li>
                  <strong>No harassment.</strong> Targeted insults, threats, doxing, stalking, or
                  persistent unwanted contact will result in an immediate ban.
                </li>
                <li>
                  <strong>No hate speech.</strong> Slurs, bigotry, or content that attacks people
                  based on race, ethnicity, religion, gender, sexual orientation, disability, or
                  national origin are not tolerated.
                </li>
                <li>
                  <strong>No impersonation.</strong> Don't pretend to be someone else, including
                  other users, public figures, or Weered staff.
                </li>
                <li>
                  <strong>Trash talk is fine.</strong> This is a gaming platform. Competitive banter
                  is expected. There's a line between trash talk and abuse. You know where it is.
                </li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">Video Chat & Screen Sharing</div>
            <div className="legal-text">
              Video rooms and screen sharing are real-time features. What you share is seen by
              everyone in the room, live. There is no undo.
              <ul>
                <li>
                  <strong>No NSFW content.</strong> Do not share nudity, sexual content, or graphic
                  violence on camera or via screen share.
                </li>
                <li>
                  <strong>No copyrighted streams.</strong> Do not screen share movies, TV shows, PPV
                  events, or other copyrighted content you don't have rights to distribute. Watching
                  a YouTube video together is fine. Streaming a Netflix movie is not.
                </li>
                <li>
                  <strong>No illegal content.</strong> This should go without saying. Content
                  depicting child exploitation, terrorism, or illegal activities will result in an
                  immediate permanent ban and may be reported to law enforcement.
                </li>
                <li>
                  <strong>Consent matters.</strong> Don't record other people's video or screen
                  shares without their knowledge. Don't share someone else's personal information
                  revealed on camera.
                </li>
                <li>
                  <strong>Room owners set the tone.</strong> Lobby owners and room moderators can
                  set additional rules for their spaces. Respect them.
                </li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">Chat & Forums</div>
            <div className="legal-text">
              <ul>
                <li>
                  <strong>No spam.</strong> Don't flood chat, post repetitive content, or promote
                  products/services without permission.
                </li>
                <li>
                  <strong>No phishing or malware.</strong> Don't share deceptive links, scam
                  attempts, or malicious downloads.
                </li>
                <li>
                  <strong>Stay on topic.</strong> Each lobby has a community and culture. Respect
                  it. The Destiny lobby is for Destiny. The NHL lobby is for hockey. General chat
                  goes in The Lobby.
                </li>
                <li>
                  <strong>Forum moderation is local.</strong> Lobby owners and moderators manage
                  their own forums. Their rules apply in addition to these guidelines.
                </li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">Content That Gets You Banned</div>
            <div className="legal-text">
              The following will result in immediate account termination, no warnings:
              <ul>
                <li>Child sexual abuse material (CSAM) or any content sexualizing minors</li>
                <li>Credible threats of violence</li>
                <li>Doxing (sharing someone's personal information without consent)</li>
                <li>Terrorism or violent extremism content</li>
                <li>Content that facilitates human trafficking or exploitation</li>
                <li>Distributing malware or attempting to compromise the platform</li>
              </ul>
              We will report such content to the appropriate authorities.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">Intellectual Property</div>
            <div className="legal-text">
              <ul>
                <li>Don't upload or share content you don't have the right to use.</li>
                <li>
                  Game screenshots, clips, and discussion are fine. That's what the lobbies are for.
                </li>
                <li>
                  Full copyrighted works (films, albums, books, software) shared without
                  authorization will be removed.
                </li>
                <li>
                  If your content is infringed, contact us at <strong>legal@weered.ca</strong> (see
                  our <a href="/terms">Terms of Service</a> for the full DMCA process).
                </li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">Enforcement</div>
            <div className="legal-text">
              We enforce these guidelines through a combination of staff moderation, lobby owner/mod
              tools, and user reports. Depending on severity:
              <ul>
                <li>
                  <strong>Warning</strong>: for minor or first-time violations
                </li>
                <li>
                  <strong>Mute / Timeout</strong>: temporary restriction from chat or features
                </li>
                <li>
                  <strong>Room/Lobby Ban</strong>: removed from a specific space
                </li>
                <li>
                  <strong>Account Suspension</strong>: temporary platform-wide ban
                </li>
                <li>
                  <strong>Permanent Ban</strong>: account terminated, no appeal for zero-tolerance
                  violations
                </li>
              </ul>
              Lobby owners and moderators can enforce additional rules within their lobbies. If you
              believe moderation was unfair, contact us at <strong>support@weered.ca</strong>.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">Reporting</div>
            <div className="legal-text">
              If you see something that violates these guidelines, report it. You can report users,
              messages, and rooms through the platform. For urgent issues involving illegal content
              or safety threats, email <strong>safety@weered.ca</strong> immediately.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">Final Word</div>
            <div className="legal-text">
              Weered is a place to hang out with people who like the same things you do. We built it
              because we wanted it to exist. Help us keep it worth using.
            </div>
          </div>

          <div className="legal-footer">
            <span>&copy; 2026 Weered</span>
            <div className="legal-nav">
              <a href="/about">About</a>
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
              <a href="/contact">Contact</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
