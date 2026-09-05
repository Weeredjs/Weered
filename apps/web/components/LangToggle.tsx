"use client";
import React from "react";
import { useLobbyLang, setLobbyLang, type LobbyLang } from "../lib/lobbyLang";

/**
 * EN / FR switch for bilingual lobbies.
 *
 * Rendered as two real buttons rather than a single toggle so the inactive
 * language is always readable — a member who has landed in the wrong language
 * should be able to SEE the word for the one they want, not have to guess what
 * a toggle will do. Both labels are shown in their own language, which is the
 * one convention every bilingual Canadian interface follows.
 */
export default function LangToggle({ className = "" }: { className?: string }) {
  const lang = useLobbyLang();

  const opt = (value: LobbyLang, label: string) => {
    const active = lang === value;
    return (
      <button
        key={value}
        type="button"
        className="weered-lang-opt"
        data-active={active ? "1" : undefined}
        aria-pressed={active}
        // aria-label carries the destination language in that language, so a
        // screen reader announces "Français" rather than "F R".
        aria-label={label}
        onClick={() => setLobbyLang(value)}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className={`weered-lang-toggle ${className}`.trim()}
      role="group"
      aria-label="Language / Langue"
    >
      {opt("en", "EN")}
      <span className="weered-lang-sep" aria-hidden="true" />
      {opt("fr", "FR")}
    </div>
  );
}
