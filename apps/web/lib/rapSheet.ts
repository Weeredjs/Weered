// A player's rap sheet, weered.ca/rap/<name> (2026-11-01, the GTA VI launch).
// The API (routes/rapSheet.ts) owns the choices and works out rank and priors;
// this is its shape on the web, and the bits of drawing it shares.

export type RapSheet = {
  filed: boolean;
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  avatarColor: string | null;
  caseNo: string;
  onFileSince: string;
  tier: "INNOCENT" | "INDICTED" | "FELON" | "CONDEMNED" | "KINGPIN" | string;
  rank: { title: string; stars: number; notoriety: number };
  handles: { psn: string | null; xbox: string | null };
  crew: { id: string; name: string; tag: string; accentColor: string | null; boss: boolean } | null;
  playstyles: string[];
  hours: string[];
  timezone: string;
  mic: string;
  lookingFor: string;
  micLabel: string;
  lookingForLabel: string;
  motto: string;
  priors: { id: string; label: string; detail: string }[];
  updatedAt: string | null;
};

export type RapChoices = {
  playstyles: string[];
  playstylesMax: number;
  hours: string[];
  hoursMax: number;
  mic: { id: string; label: string }[];
  lookingFor: { id: string; label: string }[];
  mottoMax: number;
};

/** The paid ranks are the record's status line; free accounts are Innocent. */
export const STATUS: Record<string, string> = {
  INNOCENT: "Innocent",
  INDICTED: "Indicted",
  FELON: "Felon",
  CONDEMNED: "Condemned",
  KINGPIN: "Kingpin",
};

export const rapPath = (s: { username: string }) => `/rap/${encodeURIComponent(s.username)}`;
export const rapLink = (s: { username: string }) => `https://weered.ca${rapPath(s)}`;

/** A crew's address: its tag when it has one (weered.ca/crew/TAG). */
export const crewPath = (c: { id: string; tag: string }) =>
  `/crew/${encodeURIComponent(c.tag || c.id)}`;

/** "Oct 2026" */
export const onFileSince = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
};

/** "America/Halifax" → "Halifax time" */
export const zoneLabel = (tz: string) => {
  const city = tz.split("/").pop()?.replace(/_/g, " ");
  return city ? `${city} time` : "";
};

/** An avatar a link-preview renderer can draw: absolute, and PNG or JPEG. Our
 *  uploads are webp, so they're asked for as PNG (api routes/uploads.ts). */
export function previewAvatar(url: string | null): string | null {
  if (!url) return null;
  if (/\.svg(\?|$)/i.test(url)) return null;
  const abs = url.startsWith("/") ? `https://weered.ca${url}` : url;
  if (/^https:\/\/api\.weered\.ca\/avatars\/[^?]+\.webp$/i.test(abs)) return `${abs}?format=png`;
  return /^https:\/\//i.test(abs) ? abs : null;
}
