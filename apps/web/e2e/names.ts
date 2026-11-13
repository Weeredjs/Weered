import { randomInt } from "node:crypto";

// Names nobody else in the run has. From the system's random source rather
// than Math.random: these are only test names, but the code scanner flags
// Math.random wherever a name is made, and four standing alerts about test
// files buried the ones that mattered (hardening pass 2026-11-12).

/** The time and six random digits. */
export const stamp = (): string => `${Date.now()}${String(randomInt(1_000_000)).padStart(6, "0")}`;

/** A six-digit number, for a name people will read. */
export const sixDigits = (): number => randomInt(100_000, 1_000_000);
