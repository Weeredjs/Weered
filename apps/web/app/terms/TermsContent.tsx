"use client";
import React, { useEffect, useState } from "react";

export default function TermsContent() {
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
          position: relative;
          z-index: 1;
          width: min(720px, 100%);
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .legal-inner.visible { opacity: 1; transform: translateY(0); }
        .legal-title {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 900;
          font-size: clamp(32px, 7vw, 56px);
          letter-spacing: -2px;
          line-height: 1.1;
          background: linear-gradient(135deg, #fff 0%, rgba(167,139,250,0.8) 60%, rgba(124,58,237,0.6) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        }
        .legal-updated {
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(124,58,237,0.5);
          margin-bottom: 48px;
        }
        .legal-section {
          margin-bottom: 40px;
        }
        .legal-heading {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(167,139,250,0.8);
          margin-bottom: 14px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(124,58,237,0.15);
        }
        .legal-text {
          font-size: 13px;
          line-height: 2;
          color: rgba(232,232,240,0.7);
        }
        .legal-text strong {
          color: rgba(243,244,246,0.9);
          font-weight: 500;
        }
        .legal-text ul {
          padding-left: 20px;
          margin: 12px 0;
        }
        .legal-text li {
          margin-bottom: 6px;
        }
        .legal-footer {
          margin-top: 80px;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: rgba(255,255,255,0.15);
        }
        .legal-nav {
          display: flex;
          gap: 24px;
        }
        .legal-nav a {
          color: rgba(167,139,250,0.4);
          text-decoration: none;
          font-size: 11px;
          letter-spacing: 0.1em;
          transition: color 0.2s;
        }
        .legal-nav a:hover {
          color: rgba(167,139,250,0.8);
        }
      `}</style>

      <div className="legal-root">
        <div className={`legal-inner ${visible ? "visible" : ""}`}>
          <div style={{ marginBottom: 20 }}>
            <a href="/" aria-label="Weered home" style={{ display: "inline-block" }}>
              <img src="/brand/logo/weered-logo-512.png" alt="Weered" style={{ width: 64, height: 64, filter: "drop-shadow(0 0 18px rgba(88,0,229,0.3))" }} />
            </a>
          </div>
          <div className="legal-title">Terms of Service</div>
          <div className="legal-updated">Last updated: June 4, 2026</div>

          <div className="legal-section">
            <div className="legal-heading">1. Acceptance of Terms</div>
            <div className="legal-text">
              By accessing or using Weered (<strong>weered.ca</strong>), operated by Weered Technologies ("we", "us", "our"), you agree to be bound by these Terms of Service. If you do not agree, do not use the platform. We may update these terms at any time. Continued use after changes constitutes acceptance.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">2. Eligibility</div>
            <div className="legal-text">
              You must be at least 13 years of age to use Weered. If you are under 18, you represent that your parent or legal guardian has reviewed and agreed to these terms on your behalf. We reserve the right to terminate accounts that we reasonably believe violate this requirement.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">3. Account Responsibilities</div>
            <div className="legal-text">
              You are responsible for maintaining the security of your account credentials. You are responsible for all activity that occurs under your account. You must not share, sell, or transfer your account. We reserve the right to suspend or terminate accounts at our sole discretion for any violation of these terms or our Community Guidelines.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">4. User Content</div>
            <div className="legal-text">
              "User Content" includes any text, images, audio, video, screen shares, or other material you transmit through Weered, including messages, forum posts, voice/video communications, and screen sharing sessions.
              <ul>
                <li>You retain ownership of your User Content.</li>
                <li>By posting or transmitting User Content, you grant Weered a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute that content solely for the purpose of operating and improving the platform.</li>
                <li>You represent that you have the right to share any content you transmit and that it does not infringe on any third party's rights.</li>
                <li>We do not pre-screen User Content but reserve the right to remove any content at our sole discretion.</li>
                <li>You can report objectionable User Content (including lobby logos, banners, and other uploaded images) using the in-app report control, or by emailing <strong>safety@weered.ca</strong>. We review reports and remove content that violates these terms.</li>
                <li>We do not tolerate content that sexually exploits or endangers minors. Such material is removed and reported to the appropriate authorities, including Cybertip.ca in Canada and NCMEC.</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">5. Video Chat & Screen Sharing</div>
            <div className="legal-text">
              Weered offers real-time video chat and screen sharing features within rooms. By using these features:
              <ul>
                <li><strong>You are solely responsible</strong> for any content you share via video or screen share, including but not limited to copyrighted material, personal information, or sensitive content.</li>
                <li>You must not share, stream, or display copyrighted content (films, TV shows, music, software) that you do not have the rights to distribute.</li>
                <li>You must not share content that is illegal, harmful, threatening, abusive, defamatory, obscene, or otherwise objectionable.</li>
                <li>You must not share content depicting minors in any inappropriate context.</li>
                <li>Weered does not record video or screen sharing sessions. However, we cannot prevent other participants from recording their own screens.</li>
                <li>You acknowledge that video and screen sharing occur in real-time and Weered cannot moderate live content before it is seen by other participants.</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">6. Prohibited Conduct</div>
            <div className="legal-text">
              You agree not to:
              <ul>
                <li>Use the platform for any illegal purpose or to violate any laws</li>
                <li>Harass, threaten, impersonate, or intimidate other users</li>
                <li>Share content that exploits or harms minors in any way</li>
                <li>Distribute spam, malware, phishing links, or deceptive content</li>
                <li>Attempt to gain unauthorized access to other users' accounts or platform infrastructure</li>
                <li>Circumvent or interfere with security features of the platform</li>
                <li>Use automated tools, bots, or scrapers without express permission</li>
                <li>Infringe on intellectual property rights of Weered or third parties</li>
                <li>Share or stream copyrighted content you do not have rights to distribute</li>
                <li>Use video chat or screen sharing to expose others to illegal, obscene, or harmful content</li>
              </ul>
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">7. Third-Party Integrations</div>
            <div className="legal-text">
              Weered integrates with third-party services including but not limited to Bungie (Destiny 2), Riot Games (League of Legends), Twitch, and various sports data providers. These integrations are subject to the respective third party's terms of service and privacy policies. We are not responsible for the availability, accuracy, or content provided by third-party APIs. Your use of linked third-party accounts (e.g., Bungie OAuth, Riot Sign-On) is subject to those platforms' terms.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">8. Subscriptions & Payments</div>
            <div className="legal-text">
              Weered may offer paid subscription tiers with additional features. Payments are processed through Stripe. Subscription terms, pricing, and cancellation policies will be presented at the time of purchase. All fees are in Canadian Dollars (CAD) unless otherwise stated. We reserve the right to modify pricing with reasonable notice.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">9. DMCA & Copyright Claims</div>
            <div className="legal-text">
              We respect intellectual property rights. If you believe content on Weered infringes your copyright, please contact us at <strong>legal@weered.ca</strong> with:
              <ul>
                <li>A description of the copyrighted work you claim has been infringed</li>
                <li>The location of the infringing material on Weered</li>
                <li>Your contact information</li>
                <li>A statement that you have a good-faith belief the use is not authorized</li>
                <li>A statement, under penalty of perjury, that the information is accurate and you are authorized to act on behalf of the copyright owner</li>
              </ul>
              We will respond to valid takedown requests and may terminate accounts of repeat infringers.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">10. Disclaimers</div>
            <div className="legal-text">
              Weered is provided <strong>"as is"</strong> and <strong>"as available"</strong> without warranties of any kind, express or implied. We do not warrant that the platform will be uninterrupted, error-free, or free of harmful components. We do not endorse, verify, or take responsibility for any User Content, including content shared via video chat or screen sharing. Use of the platform is at your own risk.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">11. Limitation of Liability</div>
            <div className="legal-text">
              To the maximum extent permitted by law, Weered Technologies, its founders, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your use of the platform, User Content shared by others (including via video or screen sharing), or third-party integrations. Our total liability shall not exceed the amount you paid us in the twelve (12) months preceding the claim, or $100 CAD, whichever is greater.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">12. Indemnification</div>
            <div className="legal-text">
              You agree to indemnify, defend, and hold harmless Weered Technologies and its founders, employees, and affiliates from any claims, liabilities, damages, losses, or expenses arising from your use of the platform, your User Content, your violation of these terms, or your violation of any third party's rights.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">13. Termination</div>
            <div className="legal-text">
              We may suspend or terminate your account at any time, with or without cause, with or without notice. Upon termination, your right to use the platform ceases immediately. Provisions that by their nature should survive termination (including ownership, disclaimers, indemnification, and limitations of liability) will survive.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">14. Governing Law</div>
            <div className="legal-text">
              These terms are governed by the laws of the Province of Nova Scotia, Canada, without regard to conflict of law principles. Any disputes arising from these terms or your use of Weered shall be resolved in the courts of Nova Scotia, Canada.
            </div>
          </div>

          <div className="legal-section">
            <div className="legal-heading">15. Contact</div>
            <div className="legal-text">
              Questions about these terms? Reach us at <strong>legal@weered.ca</strong> or through our <a href="/contact" style={{ color: "rgba(167,139,250,0.8)" }}>contact page</a>.
            </div>
          </div>

          <div className="legal-footer">
            <span>&copy; 2026 Weered</span>
            <div className="legal-nav">
              <a href="/about">About</a>
              <a href="/privacy">Privacy</a>
              <a href="/guidelines">Guidelines</a>
              <a href="/contact">Contact</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
