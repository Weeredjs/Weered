"use client";

import React, { useState, useRef, useEffect } from "react";
import HomeFeed from "./HomeFeed";

const FEED_DOMAINS = new Set([
  "ign.com",
  "espn.com",
  "techcrunch.com",
  "bbc.com",
  "nba.com",
  "nfl.com",
  "kotaku.com",
  "theverge.com",
  "wired.com",
  "reuters.com",
  "theguardian.com",
  "spotify.com",
  "mmamania.com",
  "youtube.com",
  "joe.fm",
  "podcasts.apple.com",
]);

const LOBBY_FEED_CATEGORY: Record<string, string> = {
  lobby: "all",
  "r/all": "all",
  "r/gaming": "gaming",
  "r/technology": "tech",
  "r/worldnews": "news",
  "weered.ca": "all",
  destiny2: "gaming",
};

const IFRAME_BLOCKED = new Set([
  "google.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "linkedin.com",
  "reddit.com",
]);

interface Props {
  lobbyId: string;
  initialUrl?: string;
}

export default function LobbyContent({ lobbyId, initialUrl }: Props) {
  const hasFeed = FEED_DOMAINS.has(lobbyId);
  const lobbyCategory = LOBBY_FEED_CATEGORY[lobbyId];
  const showFeed = hasFeed || lobbyCategory !== undefined;
  const isBlocked = IFRAME_BLOCKED.has(lobbyId);
  const siteUrl = initialUrl || `https://${lobbyId}`;

  const [iframeUrl, setIframeUrl] = useState(siteUrl);
  const [inputVal, setInputVal] = useState(siteUrl);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(isBlocked);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (initialUrl) {
      setIframeUrl(initialUrl);
      setInputVal(initialUrl);
    }
  }, [initialUrl]);

  function navigate(url: string) {
    let full = url.trim();
    if (!full.startsWith("http")) full = `https://${full}`;
    setIframeUrl(full);
    setInputVal(full);
    setLoading(true);
    setBlocked(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") navigate(inputVal);
  }

  if (showFeed && !initialUrl) {
    return <HomeFeed domain={hasFeed ? lobbyId : undefined} defaultCategory={lobbyCategory} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "rgba(0,0,0,0.3)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => iframeRef.current?.contentWindow?.history.back()}
          style={navBtnStyle}
          title="Back"
        >
          ←
        </button>
        <button
          onClick={() => iframeRef.current?.contentWindow?.history.forward()}
          style={navBtnStyle}
          title="Forward"
        >
          →
        </button>
        <button
          onClick={() => {
            setLoading(true);
            iframeRef.current?.contentWindow?.location.reload();
          }}
          style={navBtnStyle}
          title="Reload"
        >
          {loading ? "⟳" : "↺"}
        </button>

        <div style={{ flex: 1, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 11,
              color: "rgba(100,116,139,0.4)",
              pointerEvents: "none",
            }}
          >
            🔒
          </div>
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKey}
            style={{
              width: "100%",
              padding: "6px 10px 6px 28px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              color: "rgba(203,213,225,0.8)",
              fontSize: 12,
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "monospace",
            }}
          />
        </div>

        <button
          onClick={() => window.open(iframeUrl, "_blank")}
          style={{ ...navBtnStyle, fontSize: 14 }}
          title="Open in new tab"
        >
          ↗
        </button>

        <div
          style={{
            padding: "3px 8px",
            borderRadius: 6,
            background: "rgba(124,58,237,0.15)",
            border: "1px solid rgba(124,58,237,0.25)",
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(167,139,250,0.7)",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
          }}
        >
          WEERED BROWSER
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {blocked ? (
          <BlockedState
            domain={lobbyId}
            url={iframeUrl}
            onOpenExternal={() => window.open(iframeUrl, "_blank")}
          />
        ) : (
          <>
            {loading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(8,8,16,0.8)",
                  backdropFilter: "blur(4px)",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{ fontSize: 13, color: "rgba(148,163,184,0.4)", letterSpacing: "0.06em" }}
                >
                  Loading {lobbyId}...
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={iframeUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
                colorScheme: "normal",
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setBlocked(true);
              }}
              title={lobbyId}
            />
          </>
        )}
      </div>
    </div>
  );
}

function BlockedState({
  domain,
  url,
  onOpenExternal,
}: {
  domain: string;
  url: string;
  onOpenExternal: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 16,
        padding: 40,
      }}
    >
      <div style={{ fontSize: 36 }}>🚫</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(243,244,246,0.8)" }}>
        {domain} blocks embedding
      </div>
      <div
        style={{
          fontSize: 12,
          color: "rgba(148,163,184,0.4)",
          textAlign: "center",
          maxWidth: 320,
          lineHeight: 1.7,
        }}
      >
        This site uses security headers that prevent it from being displayed inside Weered. You can
        still open it in a new tab.
      </div>
      <button
        onClick={onOpenExternal}
        style={{
          padding: "10px 20px",
          borderRadius: 10,
          background: "rgba(124,58,237,0.2)",
          border: "1px solid rgba(124,58,237,0.4)",
          color: "rgba(167,139,250,0.9)",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Open {domain} in new tab ↗
      </button>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  flexShrink: 0,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(148,163,184,0.6)",
  fontSize: 13,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.12s",
};
