import React from "react";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist. Head back to the lobby.",
};

export default function NotFound() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        .nf-root {
          min-height: 100vh;
          background: #080810;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow: hidden;
        }
        .nf-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 10% 0%, rgba(124,58,237,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 90% 100%, rgba(217,70,239,0.10) 0%, transparent 55%);
          pointer-events: none;
          z-index: 0;
        }
        .nf-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
        }
        .nf-card {
          position: relative;
          z-index: 1;
          width: min(480px, 100%);
          background: rgba(12,12,20,0.92);
          border: 1px solid rgba(124,58,237,0.25);
          border-radius: 20px;
          padding: 44px 32px 32px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 24px 80px rgba(0,0,0,0.6),
            0 0 60px rgba(124,58,237,0.08);
          backdrop-filter: blur(20px);
          text-align: center;
          animation: nfFadeIn 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes nfFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nf-shield {
          width: 68px;
          height: 68px;
          opacity: 0.42;
          margin: 0 auto 20px;
          display: block;
          animation: nfDrift 6s ease-in-out infinite;
        }
        @keyframes nfDrift {
          0%, 100% { transform: translateY(0); opacity: 0.42; }
          50%      { transform: translateY(-4px); opacity: 0.55; }
        }
        .nf-404 {
          font-family: var(--font-barlow), 'Barlow Condensed', 'DM Mono', monospace;
          font-size: 64px;
          font-weight: 800;
          letter-spacing: -0.04em;
          margin: 0;
          line-height: 1;
          background: linear-gradient(135deg, rgba(196,181,253,0.85) 0%, rgba(217,70,239,0.55) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .nf-title {
          font-family: var(--font-barlow), 'Barlow Condensed', 'DM Mono', monospace;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: rgba(243,244,246,0.92);
          margin: 14px 0 6px;
        }
        .nf-sub {
          font-size: 12px;
          color: rgba(148,163,184,0.62);
          max-width: 340px;
          margin: 0 auto 26px;
          line-height: 1.55;
          font-family: 'DM Mono', monospace;
        }
        .nf-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .nf-btn {
          padding: 10px 22px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-decoration: none;
          font-family: 'DM Mono', monospace;
          transition: all 0.18s cubic-bezier(0.22, 1, 0.36, 1);
          border: 1px solid transparent;
          cursor: pointer;
        }
        .nf-btn-primary {
          background: rgba(124,58,237,0.18);
          border-color: rgba(124,58,237,0.42);
          color: rgba(196,181,253,0.95);
          box-shadow: 0 2px 8px rgba(124,58,237,0.18), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .nf-btn-primary:hover {
          background: rgba(124,58,237,0.28);
          border-color: rgba(124,58,237,0.60);
          box-shadow: 0 4px 18px rgba(124,58,237,0.32), inset 0 1px 0 rgba(255,255,255,0.1);
          transform: translateY(-1px);
        }
        .nf-btn-secondary {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.10);
          color: rgba(243,244,246,0.72);
        }
        .nf-btn-secondary:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.18);
          color: rgba(243,244,246,0.92);
          transform: translateY(-1px);
        }
        .nf-stamp {
          margin-top: 22px;
          font-size: 10px;
          color: rgba(148,163,184,0.35);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
        }
      `}</style>

      <div className="nf-root">
        <div className="nf-card">
          <img src="/brand/logo/weered-shieldlogo-512.png" alt="Weered" className="nf-shield" />
          <div className="nf-404">404</div>
          <div className="nf-title">Wrong turn, exile.</div>
          <p className="nf-sub">
            This corner isn&apos;t on the map. Could&apos;ve moved, could&apos;ve been locked, could&apos;ve never existed.
          </p>
          <div className="nf-actions">
            <Link href="/home" className="nf-btn nf-btn-primary">
              back_to_home()
            </Link>
            <Link href="/lobby" className="nf-btn nf-btn-secondary">
              browse_lobbies()
            </Link>
          </div>
          <div className="nf-stamp">signal lost · ch.404</div>
        </div>
      </div>
    </>
  );
}
