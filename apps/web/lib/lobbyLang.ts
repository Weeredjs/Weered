"use client";
import { useEffect, useState } from "react";

/**
 * Per-lobby interface language.
 *
 * Weered's existing lobby reskins swap vocabulary by THEME (Windrose says
 * "Doubloons", Destiny says "Glimmer"). Timbo's is the first lobby whose
 * community is bilingual, so vocabulary has to swap on a second axis:
 * language. A Quebec community running a bilingual event cannot put a
 * single-language room in front of its members, and Discord cannot give a
 * server a bilingual interface at all — which is precisely why this exists.
 *
 * Mechanism mirrors the theme layer deliberately: an attribute on <html>
 * (`data-weered-lang`) that CSS can key off and components observe. That keeps
 * one source of truth, lets stylesheets vary copy-driven layout (French runs
 * ~20% longer than English and overflows fixed-width chrome), and means a
 * future third language is a map entry, not a refactor.
 *
 * Scope is deliberately narrow: this drives LOBBY CHROME vocabulary only. It is
 * not an i18n framework and must not be used to translate user content, which
 * belongs to whoever wrote it.
 */

export type LobbyLang = "en" | "fr";

const ATTR = "data-weered-lang";
const KEY = "weered:lobbylang:v0";
const EVENT = "weered:lobbylang";

export function isLobbyLang(v: unknown): v is LobbyLang {
  return v === "en" || v === "fr";
}

/** Read the current language. SSR-safe: renders English on the server, which
 *  is also the correct default for a first-time visitor. */
export function getLobbyLang(): LobbyLang {
  if (typeof document === "undefined") return "en";
  const live = document.documentElement.getAttribute(ATTR);
  if (isLobbyLang(live)) return live;
  try {
    const saved = localStorage.getItem(KEY);
    if (isLobbyLang(saved)) return saved;
  } catch {
    /* private window / blocked storage — English is a fine fallback */
  }
  return "en";
}

/** Set the language, persist it, and tell every listener in this tab.
 *  The MutationObserver in useLobbyLang also fires, so the custom event is
 *  belt-and-braces for anything that would rather subscribe than observe. */
export function setLobbyLang(lang: LobbyLang): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(ATTR, lang);
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* not fatal: the attribute still governs this page view */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: lang }));
  } catch {
    /* ignore */
  }
}

/** Apply the saved language to <html>. Called by the lobby page on entry so a
 *  returning member gets the language they last chose, before first paint of
 *  the rail vocabulary. */
export function hydrateLobbyLang(): LobbyLang {
  const l = getLobbyLang();
  if (typeof document !== "undefined") document.documentElement.setAttribute(ATTR, l);
  return l;
}

/** Remove the attribute when leaving a bilingual lobby, so the rest of the app
 *  is never left in a language a non-bilingual surface has no copy for. */
export function clearLobbyLang(): void {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute(ATTR);
}

/**
 * Subscribe to the current language.
 *
 * Observes the <html> attribute rather than holding React state as the source
 * of truth, matching how LeftRail/UserCorner already track `data-weered-lobby`.
 * That means a component mounted at any point in the tree sees the same value
 * without prop-drilling or a provider.
 */
export function useLobbyLang(): LobbyLang {
  const [lang, setLang] = useState<LobbyLang>("en");
  useEffect(() => {
    const read = () => setLang(getLobbyLang());
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: [ATTR] });
    window.addEventListener(EVENT, read);
    return () => {
      obs.disconnect();
      window.removeEventListener(EVENT, read);
    };
  }, []);
  return lang;
}

/** A bilingual string pair. */
export type Bi = { en: string; fr: string };

/** Pick the right half of a pair. Falls back to English rather than rendering
 *  an empty label if a French entry is ever missed. */
export function pick(pair: Bi | string, lang: LobbyLang): string {
  if (typeof pair === "string") return pair;
  return (lang === "fr" ? pair.fr : pair.en) || pair.en;
}
