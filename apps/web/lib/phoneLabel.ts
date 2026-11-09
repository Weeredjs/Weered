"use client";
import { useEffect, useState } from "react";
import { useLobbyLang } from "./lobbyLang";
import { TIMBOS_LOBBY_ID } from "./timbosCopy";

// What the messages, friends and crew drawer is called: "Phone" (James
// 2026-11-09: it was "Burner", the burner phone of the GTA-style tiers, which
// a newcomer can't read as "your messages"; "burner" stays as the small print).
// A themed lobby keeps its own word. The profile-card button and the drawer's
// title share this, so they no longer disagree (the button said Transmat in
// Destiny 2 while the drawer said Burner).
export function phoneLabel(lobbyTheme: string | null, lang: string): string {
  if (lobbyTheme === "windrose") return "Bottle";
  if (lobbyTheme === "destiny2") return "Transmat";
  if (lobbyTheme === "helldivers2") return "Comms";
  if (lobbyTheme === TIMBOS_LOBBY_ID && lang === "fr") return "Anonyme";
  return "Phone";
}

export function usePhoneLabel(): string {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute("data-weered-lobby"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-weered-lobby"],
    });
    return () => obs.disconnect();
  }, []);
  return phoneLabel(theme, useLobbyLang());
}
