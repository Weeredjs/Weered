"use client";
import React from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export default function BungieLinkPill({ size = "sm" }: { size?: "sm" | "xs" }) {
  const [state, setState] = React.useState<"loading" | "linked" | "unlinked" | "no-auth">(
    "loading",
  );

  React.useEffect(() => {
    const loggedIn = typeof window !== "undefined" && !!localStorage.getItem("weered_user");
    if (!loggedIn) {
      setState("no-auth");
      return;
    }
    let cancelled = false;
    fetch(`${API}/bungie/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        if (j && j.ok && Array.isArray(j.characters)) setState("linked");
        else setState("unlinked");
      })
      .catch(() => {
        if (!cancelled) setState("unlinked");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state !== "unlinked") return null;

  const onClick = () => {
    window.location.href = `${API}/auth/bungie`;
  };

  const padding = size === "xs" ? "3px 8px" : "5px 10px";
  const fontSize = size === "xs" ? 10 : 11;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Connect your Bungie.net account so Weered can verify your Destiny 2 activity for tournaments and challenges. Covers PSN, Steam, Xbox, and Epic players — one link does all platforms."
      className="inline-flex items-center gap-1.5 rounded-full border transition-colors"
      style={{
        padding,
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.04em",
        borderColor: "rgba(245,158,11,0.45)",
        background: "rgba(245,158,11,0.10)",
        color: "#fcd34d",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: fontSize + 2, lineHeight: 1 }}>🔗</span>
      Link Bungie
    </button>
  );
}
