import { describe, expect, it } from "vitest";
import { phoneLabel } from "../lib/phoneLabel";
import { TIMBOS_LOBBY_ID } from "../lib/timbosCopy";

describe("phoneLabel", () => {
  it("is Phone outside the themed lobbies, and in Timbo's in English", () => {
    expect(phoneLabel(null, "en")).toBe("Phone");
    expect(phoneLabel("league-of-legends", "en")).toBe("Phone");
    expect(phoneLabel(TIMBOS_LOBBY_ID, "en")).toBe("Phone");
  });
  it("keeps each themed lobby's own word", () => {
    expect(phoneLabel("windrose", "en")).toBe("Bottle");
    expect(phoneLabel("destiny2", "en")).toBe("Transmat");
    expect(phoneLabel("helldivers2", "en")).toBe("Comms");
    expect(phoneLabel(TIMBOS_LOBBY_ID, "fr")).toBe("Anonyme");
  });
});
