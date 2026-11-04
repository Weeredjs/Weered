import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { steamNewsUrl } from "../../src/lib/steamNews";

// Modules show a game's official announcements. Steam's news feed carries
// syndicated press too (Russian sites on Division 2 and Hell Let Loose), so
// the official-only filter lives in one helper and no route builds its own.
describe("steamNewsUrl", () => {
  it("asks for the developer's own announcements only", () => {
    const url = new URL(steamNewsUrl(2221490, { count: 8, maxlength: 280 }));
    expect(url.searchParams.get("appid")).toBe("2221490");
    expect(url.searchParams.get("feeds")).toBe("steam_community_announcements");
    expect(url.searchParams.get("count")).toBe("8");
  });

  it("is the only place that calls GetNewsForApp", () => {
    const dir = fileURLToPath(new URL("../../src/routes/", import.meta.url));
    const byHand = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => readFileSync(dir + f, "utf8").includes("GetNewsForApp"));
    expect(byHand).toEqual([]);
  });
});
