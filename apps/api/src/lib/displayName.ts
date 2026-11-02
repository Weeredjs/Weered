import { isNameReserved } from "./lobbyAuth";

/**
 * A display name nobody chose through the username rules: a lobby guest's typed
 * name, or the name on a new account's Google or Discord profile (hardening
 * 2026-11-02). Invisible and direction-flipping characters come out (they
 * dress one name as another), spaces collapse, 32 at most. Null when it would
 * pass for Weered: a reserved name, the Operator, or anything with Weered in
 * it, the same rule usernames and weered.ca addresses follow.
 */
export async function cleanDisplayName(raw: unknown): Promise<string | null> {
  const name = String(raw ?? "")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32)
    .trim();
  const plain = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (plain === "operator" || plain.includes("weered")) return null;
  if (await isNameReserved(name, "USERNAME")) return null;
  return name;
}
