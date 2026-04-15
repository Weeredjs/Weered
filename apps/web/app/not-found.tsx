import React from "react";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist. Head back to the lobby.",
};

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "rgb(10,10,15)", color: "rgba(243,244,246,.88)",
      fontFamily: "inherit", padding: 24, textAlign: "center",
    }}>
      <img
        src="/brand/logo/weered-shieldlogo-512.png"
        alt="Weered logo"
        style={{ width: 80, height: 80, opacity: 0.4, marginBottom: 24 }}
      />
      <h1 style={{ fontSize: 48, fontWeight: 900, margin: 0, letterSpacing: "-1px", color: "rgba(255,255,255,.15)" }}>
        404
      </h1>
      <p style={{ fontSize: 15, fontWeight: 600, marginTop: 8, marginBottom: 4, color: "rgba(243,244,246,.7)" }}>
        Wrong turn, exile.
      </p>
      <p style={{ fontSize: 13, color: "rgba(148,163,184,.45)", maxWidth: 360, marginBottom: 28 }}>
        The page you&apos;re looking for doesn&apos;t exist, got moved, or you don&apos;t have access.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <Link
          href="/home"
          style={{
            padding: "10px 22px", borderRadius: 10,
            background: "rgba(88,0,229,.15)", border: "1px solid rgba(88,0,229,.30)",
            color: "rgba(167,139,250,.9)", fontSize: 13, fontWeight: 700,
            textDecoration: "none", transition: "all .15s",
          }}
        >
          Go Home
        </Link>
        <Link
          href="/lobby"
          style={{
            padding: "10px 22px", borderRadius: 10,
            background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.10)",
            color: "rgba(243,244,246,.7)", fontSize: 13, fontWeight: 600,
            textDecoration: "none", transition: "all .15s",
          }}
        >
          Browse Lobbies
        </Link>
      </div>
    </div>
  );
}
