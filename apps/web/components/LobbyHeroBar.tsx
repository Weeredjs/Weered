"use client";

import React from "react";

interface Props {
  lobbyId: string;
  lobbyName: string;
  description?: string;
  verified?: boolean;
  accentColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  roomCount?: number;
  memberCount?: number;
}

export default function LobbyHeroBar({
  lobbyId,
  lobbyName,
  description,
  verified = false,
  accentColor,
  logoUrl,
  bannerUrl,
  roomCount,
  memberCount,
}: Props) {
  const accent  = accentColor || "#7C3AED";
  const initial = (lobbyName || lobbyId || "L").charAt(0).toUpperCase();
  const hasStats = typeof roomCount === "number" || typeof memberCount === "number";

  return (
    <div style={{ position: "relative", flexShrink: 0, overflow: "hidden" }}>

      {/* Background layer — banner image or gradient */}
      {bannerUrl ? (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${bannerUrl})`,
          backgroundSize: "cover", backgroundPosition: "center top",
          opacity: 0.12, filter: "blur(3px) saturate(1.2)",
        }} />
      ) : (
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(135deg, ${accent}18 0%, transparent 55%, ${accent}08 100%)`,
        }} />
      )}

      {/* Bottom edge fade to content area */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${accent}33, transparent)`,
      }} />

      {/* Content row */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 18px 14px 16px",
      }}>

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: logoUrl ? "rgba(0,0,0,0.3)" : `${accent}28`,
          border: `1.5px solid ${accent}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          boxShadow: `0 0 18px ${accent}30, 0 2px 8px rgba(0,0,0,0.4)`,
        }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={lobbyName}
              style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
            />
          ) : (
            <span style={{ fontSize: 20, fontWeight: 900, color: accent, letterSpacing: "-1px" }}>
              {initial}
            </span>
          )}
        </div>

        {/* ── Name + description ───────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: description ? 3 : 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 800, lineHeight: 1.2,
              color: "rgba(243,244,246,0.97)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {lobbyName}
            </div>
            {verified && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
                fontSize: 9, fontWeight: 700, letterSpacing: "0.07em",
                padding: "2px 7px", borderRadius: 999,
                background: `${accent}20`, border: `1px solid ${accent}50`,
                color: accent,
              }}>
                ✓ VERIFIED
              </span>
            )}
          </div>
          {description && (
            <div style={{
              fontSize: 11.5, color: "rgba(148,163,184,0.72)", lineHeight: 1.35,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {description}
            </div>
          )}
        </div>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        {hasStats && (
          <div style={{
            display: "flex", gap: 16, flexShrink: 0,
            padding: "6px 12px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            {typeof roomCount === "number" && (
              <StatPill label="Rooms" value={roomCount} accent={accent} />
            )}
            {typeof memberCount === "number" && (
              <StatPill label="Members" value={memberCount} accent={accent} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "rgba(243,244,246,0.93)", lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div style={{
        fontSize: 9, marginTop: 2, opacity: 0.45,
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        {label}
      </div>
    </div>
  );
}
