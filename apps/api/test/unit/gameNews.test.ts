import { describe, it, expect } from "vitest";
import { namesGame, parsePress, steamItem } from "../../src/lib/gameNews";

// A lobby's news stage (James 2026-11-04: "a full article with image and
// video of actual game news from IGN or something that cycles"): what the
// feeds give us, read the way the stage needs it.
describe("game news", () => {
  it("reads an RSS story's picture, date and words", () => {
    const xml = `<rss><channel><item>
      <title><![CDATA[The Division 2 gets a new season]]></title>
      <link>https://www.ign.com/articles/division-2-season</link>
      <pubDate>Tue, 03 Nov 2026 18:00:00 +0000</pubDate>
      <description><![CDATA[<p>Agents head back to <b>New York</b>.</p>]]></description>
      <media:content url="https://assets.ign.com/x.jpg?width=1280&amp;q=80" medium="image"/>
    </item></channel></rss>`;
    const [s] = parsePress(xml, "IGN");
    expect(s).toMatchObject({
      title: "The Division 2 gets a new season",
      url: "https://www.ign.com/articles/division-2-season",
      source: "IGN",
      snippet: "Agents head back to New York.",
      image: "https://assets.ign.com/x.jpg?width=1280&q=80",
      date: "2026-11-03T18:00:00.000Z",
    });
  });

  it("reads a YouTube entry as a video", () => {
    const xml = `<feed><entry><yt:videoId>dQw4w9WgXcQ</yt:videoId>
      <title>Destiny 2 - Official Trailer</title>
      <link rel="alternate" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"/>
      <published>2026-11-02T10:00:00+00:00</published>
      <media:thumbnail url="https://i1.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" width="480" height="360"/>
    </entry></feed>`;
    const [v] = parsePress(xml, "IGN video");
    expect(v.video).toBe("dQw4w9WgXcQ");
    expect(v.image).toBe("https://i1.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("drops a story with no https link, title or date", () => {
    const xml = `<rss><item><title>x</title><link>http://insecure.example/a</link>
      <pubDate>Tue, 03 Nov 2026 18:00:00 +0000</pubDate></item></rss>`;
    expect(parsePress(xml, "IGN")).toEqual([]);
  });

  it("takes a Steam announcement's picture and trailer, and keeps only its words", () => {
    const s = steamItem(
      {
        title: "Fractured Skies In Focus",
        url: "https://steamstore-a.akamaihd.net/news/externalpost/x",
        date: 1730700000,
        contents:
          "{STEAM_CLAN_IMAGE}/3952729/5b8d8d.jpg [previewyoutube=abcDEF12345;full][/previewyoutube] [b]New[/b] skies over https://eveonline.com now.",
      },
      8500,
    );
    expect(s).toMatchObject({
      image: "https://clan.akamai.steamstatic.com/images/3952729/5b8d8d.jpg",
      video: "abcDEF12345",
      snippet: "New skies over now.",
      official: true,
    });
  });

  it("falls back to the game's capsule art when a post has no picture", () => {
    const s = steamItem(
      { title: "Patch", url: "https://store.steampowered.com/news/1", date: 1, contents: "Fixes." },
      2221490,
    );
    expect(s?.image).toBe(
      "https://cdn.akamai.steamstatic.com/steam/apps/2221490/capsule_616x353.jpg",
    );
  });

  it("matches the game by whole words", () => {
    const item = (title: string) => ({
      title,
      url: "https://x",
      date: "",
      source: "",
      snippet: "",
    });
    expect(namesGame(item("Hell Let Loose: Vietnam dated"), ["Hell Let Loose"])).toBe(true);
    expect(namesGame(item("CS2 major results"), ["CS2"])).toBe(true);
    expect(namesGame(item("Blueprints for CS20 printers"), ["CS2"])).toBe(false);
  });
});
