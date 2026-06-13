"use client";
import React, { useEffect, useState } from "react";

export default function PrivacyContent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
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
        .legal-updated { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(124,58,237,0.5); margin-bottom: 48px; }
        .legal-section { margin-bottom: 40px; }
        .legal-heading { font-size: 13px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(167,139,250,0.8); margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid rgba(124,58,237,0.15); }
        .legal-text { font-size: 13px; line-height: 2; color: rgba(232,232,240,0.7); }
        .legal-text strong { color: rgba(243,244,246,0.9); font-weight: 500; }
        .legal-text ul { padding-left: 20px; margin: 12px 0; }
        .legal-text li { margin-bottom: 6px; }
        .legal-text a { color: rgba(167,139,250,0.8); }
        .legal-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
        .legal-table th { text-align: left; padding: 8px 10px; border-bottom: 1px solid rgba(124,58,237,0.2); color: rgba(167,139,250,0.7); font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; font-size: 10px; }
        .legal-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(232,232,240,0.65); }
        .legal-footer { margin-top: 80px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.15); }
        .legal-nav { display: flex; gap: 24px; }
        .legal-nav a { color: rgba(167,139,250,0.4); text-decoration: none; font-size: 11px; letter-spacing: 0.1em; transition: color 0.2s; }
        .legal-nav a:hover { color: rgba(167,139,250,0.8); }
      `}</style>

      <div className="legal-root">
        <div className={`legal-inner ${visible ? "visible" : ""}`}>
          <div style={{ marginBottom: 20 }}>
            <a href="/" aria-label="Weered home" style={{ display: "inline-block" }}>
              <img src="/brand/logo/weered-logo-512.png" alt="Weered" style={{ width: 64, height: 64, filter: "drop-shadow(0 0 18px rgba(88,0,229,0.3))" }} />
            </a>
          </div>
          <div className="legal-title">Privacy Policy</div>
          <div className="legal-updated">Last updated: April 8, 2026</div>

          <div className="legal-section">
            <div className="legal-heading">1. Who We Are</div>
            <div className="legal-text">
              Weered (<strong>weered.ca</strong>) is operated by Weered Technologies, based in Nova Scotia, Canada. This policy explains how we collect, use, disclose, and safeguard your information when you use our platform. We comply with the <strong>Personal Information Protection and Electronic Documents Act (PIPEDA)</strong> and applicable Canadian privacy legislation.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">2. Information We Collect</div>
            <div className="legal-text">
              <table className="legal-table">
                <thead>
                  <tr><th>Data Type</th><th>What</th><th>Why</th></tr>
                </thead>
                <tbody>
                  <tr><td><strong>Account Data</strong></td><td>Email address, username, password (hashed)</td><td>Account creation and authentication</td></tr>
                  <tr><td><strong>Profile Data</strong></td><td>Display name, avatar selection, bio</td><td>Community identity and personalization</td></tr>
                  <tr><td><strong>Usage Data</strong></td><td>Lobbies visited, rooms joined, feature interactions</td><td>Platform improvement and analytics</td></tr>
                  <tr><td><strong>Chat Messages</strong></td><td>Text messages sent in rooms and lobby chat</td><td>Delivery of the messaging service</td></tr>
                  <tr><td><strong>Linked Accounts</strong></td><td>Bungie, Riot Games, or other third-party OAuth tokens</td><td>Game integrations (guardian lookup, summoner stats, etc.)</td></tr>
                  <tr><td><strong>Payment Data</strong></td><td>Processed by Stripe; we do not store card numbers</td><td>Subscription billing</td></tr>
                  <tr><td><strong>Device Data</strong></td><td>Browser type, OS, IP address</td><td>Security, fraud prevention, and analytics</td></tr>
                  <tr><td><strong>Push Tokens</strong></td><td>Web push subscription endpoints</td><td>Notification delivery</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">3. What We Do Not Collect</div>
            <div className="legal-text">
              <ul>
                <li><strong>We do not record video or audio</strong> from video chat or voice rooms. Video and audio streams are transmitted in real-time via WebRTC and are not stored on our servers.</li>
                <li><strong>We do not record screen shares.</strong> Screen sharing sessions are peer-to-peer and are not captured or retained.</li>
                <li>We do not sell, rent, or trade your personal information to third parties for their marketing purposes.</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">4. How We Use Your Information</div>
            <div className="legal-text">
              <ul>
                <li>To operate, maintain, and improve the Weered platform</li>
                <li>To authenticate your account and manage sessions</li>
                <li>To deliver game integrations through linked third-party accounts</li>
                <li>To process payments for premium subscriptions</li>
                <li>To send notifications you have opted into (push notifications, DM alerts)</li>
                <li>To enforce our Terms of Service and Community Guidelines</li>
                <li>To detect, prevent, and respond to security threats or abuse</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">5. Third-Party Services</div>
            <div className="legal-text">
              We integrate with the following third-party services, each governed by their own privacy policies:
              <ul>
                <li><strong>Bungie / Destiny 2</strong>: OAuth account linking for guardian stats, inventory, and Xur data</li>
                <li><strong>Riot Games</strong>: Riot Sign-On for League of Legends summoner data</li>
                <li><strong>Twitch</strong>: Stream data and embedded players</li>
                <li><strong>Stripe</strong>: Payment processing (PCI-DSS compliant; we never see your full card number)</li>
                <li><strong>LiveKit</strong>: Real-time video, voice, and screen sharing infrastructure</li>
                <li><strong>Web Push (VAPID)</strong>: Browser push notification delivery</li>
              </ul>
              When you link a third-party account, we store only the OAuth tokens necessary to provide the integration. You can unlink these accounts at any time.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">6. Data Storage & Security</div>
            <div className="legal-text">
              Your data is stored on servers located in North America. We use industry-standard security measures including:
              <ul>
                <li>Encrypted connections (HTTPS/TLS) for all data in transit</li>
                <li>Hashed passwords (bcrypt)</li>
                <li>JWT-based authentication with secure token handling</li>
                <li>Role-based access controls for administrative functions</li>
              </ul>
              No system is 100% secure. While we take reasonable measures to protect your data, we cannot guarantee absolute security.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">7. Data Retention</div>
            <div className="legal-text">
              We retain your account data for as long as your account is active. Chat messages are retained for the operational life of the room or lobby. If you delete your account, we will delete your personal data within 30 days, except where we are required to retain it by law or for legitimate business purposes (e.g., fraud prevention records).
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">8. Cookies & Local Storage</div>
            <div className="legal-text">
              Weered uses <strong>localStorage</strong> to store your authentication token and user preferences. We do not use third-party tracking cookies. We do not run third-party advertising scripts. We may use minimal analytics to understand platform usage in aggregate.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">9. Public Game Data & Mod Catalog</div>
            <div className="legal-text">
              Weered surfaces publicly-available metadata from third-party game services to power features like the mod catalog, live server browser, stream listings, and live player counts. We:
              <ul>
                <li><strong>Cache metadata only.</strong> For mods, we cache the name, author, summary, thumbnail URL, endorsement count, and download count, sourced from the public Nexus Mods API. We do <strong>not</strong> rehost mod files. Every install link points to the mod's original Nexus page; downloads happen there, not here.</li>
                <li><strong>Do not collect Nexus credentials.</strong> Reading the public catalog never requires a Nexus account or API key. We do not ask users for, store, or proxy any third-party API keys.</li>
                <li><strong>Honour author opt-out.</strong> If you are a mod author and prefer your work not appear in our catalog, email <strong>support@weered.ca</strong> with the mod name. We will hide it from the catalog within one business day. The hide is persistent: even if our poller re-fetches the public Nexus listing, the exclusion stays in effect.</li>
                <li><strong>Other public game data sources we cache the same way:</strong> Steam (live player counts, public server browser), Twitch (live streams for a given game), Bungie (Destiny 2 public profiles, opt-in linked), Riot (League of Legends summoner stats, opt-in linked), and similar first-party public APIs. None of these require us to store credentials beyond what the user explicitly links.</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">10. Your Rights (PIPEDA)</div>
            <div className="legal-text">
              Under Canadian privacy law, you have the right to:
              <ul>
                <li><strong>Access</strong> the personal information we hold about you</li>
                <li><strong>Correct</strong> inaccurate or incomplete information</li>
                <li><strong>Delete</strong> your account and associated data</li>
                <li><strong>Withdraw consent</strong> for data processing (this may limit your ability to use the platform)</li>
                <li><strong>Unlink</strong> third-party accounts at any time</li>
              </ul>
              To exercise these rights, contact us at <strong>privacy@weered.ca</strong>.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">11. Children's Privacy</div>
            <div className="legal-text">
              Weered is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we learn we have collected such information, we will delete it promptly. If you believe a child under 13 has provided us with personal information, please contact us at <strong>privacy@weered.ca</strong>.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">12. Changes to This Policy</div>
            <div className="legal-text">
              We may update this privacy policy from time to time. We will notify users of material changes through the platform or by email. Your continued use of Weered after changes constitutes acceptance.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">13. Contact</div>
            <div className="legal-text">
              Privacy questions or data requests: <strong>privacy@weered.ca</strong><br />
              General inquiries: <a href="/contact">weered.ca/contact</a>
            </div>
          </div>

          <div className="legal-footer">
            <span>&copy; 2026 Weered</span>
            <div className="legal-nav">
              <a href="/about">About</a>
              <a href="/terms">Terms</a>
              <a href="/guidelines">Guidelines</a>
              <a href="/contact">Contact</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
