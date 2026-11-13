import { ModuleType } from "@prisma/client";
import { isOfficeRoom } from "./officeRooms";

// What a lobby's address and words may be: one set of limits for the route
// that makes a lobby and the routes that edit one.
//
// Two bugs came from keeping this in two places (hardening pass 2026-11-13):
//
// - POST /lobbies checked nothing. The builder and the phone app shape an
//   address before they send it, but a direct call could use any text of any
//   length as the address, the name or the description. It could also take
//   "create", the builder's own address, and make a lobby nobody could open.
// - The edit routes cut text to length without saying so, and the Branding tab
//   sends the description with every save. Staff-written descriptions run to
//   1,800 characters, so saving a colour on one of those cut it to 500
//   mid-sentence and answered "Saved." Five live lobbies were found cut.
//
// So the limits are sized to what real lobbies hold, and text over a limit is
// refused with the reason. Nothing here shortens what it is given.

/** Addresses the web app keeps for itself under /lobby/. A lobby called one of
 *  these could never be opened: /lobby/create is the builder. The web holds
 *  the same list (apps/web/lib/lobbyPath.ts); test/unit/lobbyFields.test.ts
 *  keeps the two in step. */
export const LOBBY_ROUTE_NAMES: readonly string[] = ["create", "admin", "settings"];

export const LOBBY_LIMITS = {
  address: 40,
  /** Staff seed addresses that predate the rule, such as "r/technology". */
  staffAddress: 64,
  name: 100,
  description: 2000,
  link: 500,
  keywords: 30,
  keyword: 40,
} as const;

// Lowercase letters, digits and hyphens, with a letter or digit at each end:
// what the builder's own slug rule produces. Only ever run on 40 characters.
const ADDRESS = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** A refusal: `error` for the client's code, `message` for the person. */
export type FieldProblem = { error: string; message: string };

const count = (n: number) => n.toLocaleString("en-CA");
const tooLong = (what: string, max: number, got: number) =>
  `${what} can be ${count(max)} characters at most. This one is ${count(got)}.`;

/** What's wrong with this as a new lobby's address, if anything. */
export function lobbyAddressProblem(id: unknown, staff = false): FieldProblem | null {
  if (typeof id !== "string" || !id.trim())
    return { error: "bad_address", message: "A lobby needs an address." };
  // Staff too: nobody can open a lobby that sits under the builder's address.
  if (LOBBY_ROUTE_NAMES.includes(id.trim().toLowerCase()))
    return { error: "name_reserved", message: "Weered uses that address itself. Try another." };
  // The office's rooms are never a lobby: a lobby by that name could make
  // guest links that open the office (fan-out audit, 2026-11-13).
  if (isOfficeRoom(id.trim().toLowerCase()))
    return { error: "name_reserved", message: "Weered uses that address itself. Try another." };
  if (staff) {
    return id.length > LOBBY_LIMITS.staffAddress
      ? {
          error: "bad_address",
          message: tooLong("An address", LOBBY_LIMITS.staffAddress, id.length),
        }
      : null;
  }
  if (id.length < 2 || id.length > LOBBY_LIMITS.address || !ADDRESS.test(id))
    return {
      error: "bad_address",
      message: `An address is 2 to ${LOBBY_LIMITS.address} lowercase letters, numbers and hyphens, and starts and ends with a letter or number.`,
    };
  return null;
}

/** What's wrong with a lobby's words, if anything. Only the fields that were
 *  sent are checked, so an edit can send one of them. */
export function lobbyWordsProblem(b: {
  name?: unknown;
  description?: unknown;
  keywords?: unknown;
  logoUrl?: unknown;
  bannerUrl?: unknown;
  websiteUrl?: unknown;
}): FieldProblem | null {
  const bad = (message: string): FieldProblem => ({ error: "bad_text", message });
  if (b.name != null) {
    if (typeof b.name !== "string" || !b.name.trim()) return bad("A lobby needs a name.");
    if (b.name.length > LOBBY_LIMITS.name)
      return bad(tooLong("A name", LOBBY_LIMITS.name, b.name.length));
  }
  if (b.description != null) {
    if (typeof b.description !== "string") return bad("A description is text.");
    if (b.description.length > LOBBY_LIMITS.description)
      return bad(tooLong("A description", LOBBY_LIMITS.description, b.description.length));
  }
  if (b.keywords != null) {
    const k = b.keywords;
    // The count first: a list of half a million is never walked.
    if (!Array.isArray(k) || k.length > LOBBY_LIMITS.keywords)
      return bad(`A lobby can have ${LOBBY_LIMITS.keywords} keywords at most.`);
    if (!k.every((x) => typeof x === "string" && x.length <= LOBBY_LIMITS.keyword))
      return bad(`A keyword is text, ${LOBBY_LIMITS.keyword} characters at most.`);
  }
  for (const key of ["logoUrl", "bannerUrl", "websiteUrl"] as const) {
    const v = b[key];
    if (typeof v === "string" && v.length > LOBBY_LIMITS.link)
      return bad(tooLong("A link", LOBBY_LIMITS.link, v.length));
  }
  return null;
}

/** Is this one of the kinds a lobby can be? An unknown kind used to reach the
 *  database and come back as a server error. */
export const isLobbyKind = (v: unknown): v is ModuleType =>
  typeof v === "string" && (Object.values(ModuleType) as string[]).includes(v);
