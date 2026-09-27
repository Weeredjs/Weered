import sharp from "sharp";
import { log } from "./logger";

/**
 * libheif below 1.23.2 has decoder bugs that the advisory (GHSA-rgj7-g3m4-5g8c)
 * says can lead to code execution. sharp picks its decoder from a file's magic
 * bytes, not its declared type, so an AVIF body labelled image/png still reached
 * the HEIF loader on every upload route (found 2026-09-27; production bundles
 * libheif 1.23.1). Until sharp ships a fixed libheif, that loader is switched
 * off process-wide: the same guard Next.js puts on its image optimizer. AVIF
 * and HEIC uploads are refused meanwhile; PNG, JPEG, WebP and GIF are untouched.
 *
 * Imported once, first thing, by index.ts. The block lifts itself when the
 * bundled libheif is new enough.
 */
export function heifIsSafe(version: string | undefined): boolean {
  const [major, minor, patch] = String(version || "0")
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
  if (major !== 1) return major > 1;
  if (minor !== 23) return minor > 23;
  return patch >= 2;
}

export function hardenSharp(): boolean {
  const heif = (sharp.versions as Record<string, string | undefined>)?.heif;
  if (heif && heifIsSafe(heif)) return false;
  sharp.block({ operation: ["VipsForeignLoadHeif"] });
  log.warn(
    `[sharp] HEIF/AVIF decoding disabled: bundled libheif ${heif || "unknown"} is below 1.23.2`,
  );
  return true;
}

hardenSharp();
