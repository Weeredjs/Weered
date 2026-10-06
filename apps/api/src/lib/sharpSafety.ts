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

/**
 * Uploads reach sharp only as PNG, JPEG, GIF or WebP, judged by their leading
 * bytes. sharp picks a decoder from those bytes whatever the declared type, so
 * an SVG labelled image/png reached librsvg (GHSA-wq5f-xc86-pv6w in the bundled
 * 2.62.90) on every upload route (review 2026-10-06). Checking the signature
 * closes that and any other loader at once. Do not block the SVG loader
 * process-wide instead: the Windrose watermark composites an SVG we build.
 */
export function isAllowedRaster(buf: Buffer): boolean {
  if (!buf || buf.length < 12) return false;
  const png = buf[0] === 0x89 && buf.toString("latin1", 1, 4) === "PNG";
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const gif = buf.toString("latin1", 0, 4) === "GIF8";
  const webp = buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP";
  return png || jpeg || gif || webp;
}
