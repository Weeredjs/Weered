"use client";

import { useEffect, useState, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as any).standalone) return;

    const dismissed = localStorage.getItem("weered:install:dismissed");
    if (dismissed && Date.now() - Number.parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) return;

    const installed = localStorage.getItem("weered:install:done");
    if (installed) return;

    const ua = navigator.userAgent;
    const isiOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isiOS) {
      const timer = setTimeout(() => {
        setIsIOS(true);
        setShow(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setShow(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    function onInstalled() {
      setShow(false);
      localStorage.setItem("weered:install:done", "1");
      deferredPrompt.current = null;
    }
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function handleInstall() {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      deferredPrompt.current.userChoice.then((choice) => {
        if (choice.outcome === "accepted") {
          localStorage.setItem("weered:install:done", "1");
        }
        setShow(false);
        deferredPrompt.current = null;
      });
    }
  }

  function handleDismiss() {
    setShow(false);
    localStorage.setItem("weered:install:dismissed", String(Date.now()));
  }

  if (!show) return null;

  return (
    <>
      <style>{`
        .install-banner {
          position: fixed;
          bottom: 36px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: rgba(15, 10, 30, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(124, 58, 237, 0.35);
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.1);
          animation: installSlideUp 0.4s cubic-bezier(0.22,1,0.36,1);
          max-width: calc(100vw - 24px);
        }
        @keyframes installSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .install-banner-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          flex-shrink: 0;
        }
        .install-banner-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .install-banner-title {
          font-size: 13px;
          font-weight: 700;
          color: rgba(243,244,246,0.92);
          white-space: nowrap;
        }
        .install-banner-sub {
          font-size: 10px;
          color: rgba(148,163,184,0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .install-banner-btn {
          padding: 7px 16px;
          border-radius: 8px;
          border: none;
          font-size: 12px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .install-banner-btn-primary {
          background: linear-gradient(135deg, #7C3AED, #5B21B6);
          color: #fff;
          box-shadow: 0 2px 8px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
          animation: installBreath 2.8s ease-in-out infinite;
        }
        .install-banner-btn-primary:hover {
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          box-shadow: 0 4px 16px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.25);
          animation: none;
          transform: translateY(-1px);
        }
        .install-banner-btn-primary:active {
          transform: translateY(0);
          box-shadow: 0 1px 4px rgba(124,58,237,0.3), inset 0 1px 2px rgba(0,0,0,0.2);
        }
        @keyframes installBreath {
          0%, 100% { box-shadow: 0 2px 8px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.15); }
          50%      { box-shadow: 0 2px 16px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.25); }
        }
        .install-banner-close {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: rgba(148,163,184,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .install-banner-close:hover {
          background: rgba(255,255,255,0.08);
          color: rgba(243,244,246,0.8);
        }
        @media (max-width: 767px) {
          .install-banner {
            bottom: 68px;
          }
        }
      `}</style>

      <div className="install-banner">
        <img src="/brand/logo/weered-logo-128.png" alt="Weered" className="install-banner-icon" />
        <div className="install-banner-text">
          <div className="install-banner-title">Keep Weered close.</div>
          <div className="install-banner-sub">
            {isIOS
              ? "Tap Share \u2192 Add to Home Screen."
              : "Pin it to your home screen. Opens faster, stays out of the browser."}
          </div>
        </div>
        {!isIOS && (
          <button className="install-banner-btn install-banner-btn-primary" onClick={handleInstall}>
            Pin it
          </button>
        )}
        <button className="install-banner-close" onClick={handleDismiss} aria-label="Dismiss">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </>
  );
}
