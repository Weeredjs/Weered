"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const HIDE_ON = ["/login", "/register", "/staff"];

export default function SiteFooter() {
  const pathname = usePathname() || "";
  const hidden = HIDE_ON.some((r) => pathname === r || pathname.startsWith(r + "/"));
  if (hidden) return null;

  return (
    <>
      <style>{`
        .site-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          background: rgba(5,8,16,0.96);
          border-top: 1px solid rgba(255,255,255,0.05);
          font-family: var(--font-rajdhani), var(--font-barlow), sans-serif;
        }
        .site-footer-left {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          color: rgba(255,255,255,0.18);
          letter-spacing: 0.04em;
        }
        .site-footer-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(124,58,237,0.5);
        }
        .site-footer-nav {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .site-footer-nav a {
          font-size: 10px;
          color: rgba(255,255,255,0.22);
          text-decoration: none;
          letter-spacing: 0.06em;
          text-transform: lowercase;
          transition: color 0.15s;
        }
        .site-footer-nav a:hover {
          color: rgba(167,139,250,0.75);
        }
        .site-footer-divider {
          width: 1px;
          height: 10px;
          background: rgba(255,255,255,0.08);
        }
      `}</style>

      <footer className="site-footer">
        <div className="site-footer-left">
          <div className="site-footer-dot" />
          <span>© weered.ca</span>
        </div>
        <nav className="site-footer-nav">
          <Link href="/explore">explore</Link>
          <div className="site-footer-divider" />
          <Link href="/about">about</Link>
          <div className="site-footer-divider" />
          <Link href="/desktop">desktop app</Link>
          <div className="site-footer-divider" />
          <Link href="/premium">premium</Link>
          <div className="site-footer-divider" />
          <Link href="/terms">terms</Link>
          <div className="site-footer-divider" />
          <Link href="/privacy">privacy</Link>
          <div className="site-footer-divider" />
          <Link href="/guidelines">guidelines</Link>
          <div className="site-footer-divider" />
          <Link href="/contact">contact</Link>
          <div className="site-footer-divider" />
          <Link href="/apply">apply to mod</Link>
        </nav>
      </footer>
    </>
  );
}
