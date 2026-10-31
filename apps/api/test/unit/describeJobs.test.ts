import { describe, it, expect } from "vitest";
import { eventJob, roomJob, rolesJob, rulesJob } from "../../src/lib/build/jobs/lobbyTools";
import {
  cleanHost,
  cleanOverlay,
  cleanPost,
  crewJob,
  feedJob,
  OVERLAY_DEFAULT,
} from "../../src/lib/build/jobs/people";
import { cleanCode } from "../../src/lib/build/jobs/code";
import { keepGivenLinks, pageJob } from "../../src/lib/build/jobs/pages";
import { nextRunOf, parseFeed, zonedToUtc } from "../../src/lib/lobbyAutomations";
import { cleanFeed } from "../../src/routes/lobbyExtras";
import { DESCRIBE_JOBS } from "../../src/lib/build/jobs";
import { hasLink } from "../../src/sockets/messaging";
import { CODE_MAX } from "../../src/lib/build/jobs/code";

// Describe-it (routes/aiDescribe.ts): every job's answer is a proposal a person
// sees before anything is saved, and nothing the model says is trusted. These
// are the checks between the model and that proposal, plus the clocks and
// parsers the lobby's automations run on (lib/lobbyAutomations.ts).

const ctx = (over: Record<string, any> = {}) =>
  ({
    user: { id: "u1", name: "Raven" },
    body: {},
    prompt: "",
    lobby: { id: "destiny2", name: "Destiny 2" },
    level: 5,
    given: "",
    ...over,
  }) as any;

describe("the job list", () => {
  it("has every job once, each with a tool and a cleaner", () => {
    const ids = DESCRIBE_JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const want of [
      "event",
      "room",
      "roles",
      "rules",
      "door",
      "crew",
      "overlay",
      "host",
      "post",
      "alert",
      "feed",
      "block",
      "game",
      "page",
    ])
      expect(ids).toContain(want);
    for (const j of DESCRIBE_JOBS) {
      expect(j.tool.name).toMatch(/^[a-z_]+$/);
      expect(typeof j.clean).toBe("function");
      expect(j.system).toMatch(/exactly once/);
    }
  });
});

describe("events", () => {
  it("keeps a real time, drops an end before the start, clamps repeats", () => {
    const start = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const p = eventJob.clean(
      {
        title: "Raid night",
        startsAt: start,
        endsAt: new Date(Date.now()).toISOString(),
        repeatWeeks: 40,
      },
      ctx(),
    ) as any;
    expect(p.startsAt).toBe(start);
    expect(p.endsAt).toBeNull();
    expect(p.repeatWeeks).toBe(8);
  });
  it("puts a time from years away back to tomorrow", () => {
    const p = eventJob.clean({ title: "x", startsAt: "2099-01-01T20:00:00Z" }, ctx()) as any;
    expect(Date.parse(p.startsAt)).toBeLessThan(Date.now() + 2 * 86_400_000);
    expect(p.repeatWeeks).toBe(1);
  });
});

describe("rooms", () => {
  it("maps who to a level and keeps a known opener", () => {
    const r = roomJob.clean(
      { name: "Movie Night", opens: "youtube", who: "members" },
      ctx(),
    ) as any;
    expect(r).toEqual({ name: "Movie Night", opens: "youtube", who: "members", minLevel: 1 });
  });
  it("makes a member's place text only, and refuses unknown openers", () => {
    expect(
      (
        roomJob.clean(
          { name: "x", opens: "voice", who: "anyone" },
          ctx({ lobby: { id: "u-raven" } }),
        ) as any
      ).opens,
    ).toBe("text");
    expect(roomJob.clean({ name: "x", opens: "nukes", who: "nobody" }, ctx()) as any).toMatchObject(
      {
        opens: "voice",
        who: "anyone",
        minLevel: 0,
      },
    );
  });
});

describe("roles", () => {
  it("keeps the current names it wasn't given and clips the rest", () => {
    const r = rolesJob.clean(
      {
        names: { "5": "Commander", "1": "x".repeat(40) },
        icons: { "5": "🎖️🎖️🎖️🎖️🎖️" },
        perks: ["", "Raids every Friday"],
      },
      ctx({ lobby: { roleNames: { "4": "Drill Sergeant" } } }),
    ) as any;
    expect(r.names["5"]).toBe("Commander");
    expect(r.names["4"]).toBe("Drill Sergeant");
    expect(r.names["3"]).toBe("Moderator");
    expect(r.names["1"]).toHaveLength(24);
    expect(Array.from(r.icons["5"]).length).toBeLessThanOrEqual(4);
    expect(r.perks).toEqual(["Raids every Friday"]);
  });
});

describe("chat rules", () => {
  it("cleans sites down to their host and drops what isn't one", () => {
    const r = rulesJob.clean(
      {
        blockedWords: ["Spam", "spam", " buy gold "],
        blockedDomains: [
          "https://www.Discord.gg/abc",
          "bit.ly",
          "not a site",
          "javascript:alert(1)",
        ],
        newAccountChatHours: 9999,
        newAccountLinkHours: 72,
      },
      ctx(),
    ) as any;
    expect(r.blockedWords).toEqual(["spam", "buy gold"]);
    expect(r.blockedDomains).toEqual(["discord.gg", "bit.ly"]);
    expect(r.newAccountChatHours).toBe(720);
    expect(r.newAccountLinkHours).toBe(72);
  });

  it("knows a link when it sees one (the new-account link wait)", () => {
    for (const yes of [
      "https://x.com/a",
      "join discord.gg/abc",
      "www.example.org",
      "see bit.ly/xyz",
    ])
      expect(hasLink(yes), yes).toBe(true);
    for (const no of ["gg everyone", "it's 3.5 hours", "e.g. this", "lol ok", "node.js rocks"])
      expect(hasLink(no), no).toBe(false);
  });
});

describe("the crew's look", () => {
  it("makes the tag a short uppercase badge and the colour a real one", () => {
    const c = crewJob.clean(
      { name: "Hell Riders", tag: "[hell]!!", tagShape: "blob", accentColor: "red" },
      ctx(),
    ) as any;
    expect(c.tag).toBe("HELL");
    expect(c.tagShape).toBe("rounded");
    expect(c.accentColor).toBe("#7c3aed");
  });
});

describe("the overlay", () => {
  it("starts from the defaults, with the squad and chat off", () => {
    expect(cleanOverlay(null)).toEqual(OVERLAY_DEFAULT);
    expect(OVERLAY_DEFAULT.show.people).toBe(false);
    expect(OVERLAY_DEFAULT.show.chat).toBe(false);
  });
  it("keeps what's valid and drops the rest", () => {
    const o = cleanOverlay({
      position: "bottom-right",
      style: "laser",
      accent: "#00FF00",
      show: { chat: true, tier: "yes" },
    });
    expect(o.position).toBe("bottom-right");
    expect(o.style).toBe("glass");
    expect(o.accent).toBe("#00ff00");
    expect(o.show.chat).toBe(true);
    expect(o.show.tier).toBe(true);
  });
});

describe("the host", () => {
  it("is off without a name and keeps only greetings with {name}", () => {
    expect(cleanHost({ on: true, name: "", persona: "x" }).on).toBe(false);
    const h = cleanHost({
      name: "Sarge",
      persona: "You are Sarge.",
      welcomeLines: ["Welcome, {name}.", "Hello there."],
    });
    expect(h.on).toBe(true);
    expect(h.welcomeLines).toEqual(["Welcome, {name}."]);
  });
});

describe("scheduled posts", () => {
  it("fills a weekly post's days and checks its time and zone", () => {
    const p = cleanPost(
      { cadence: "weekly", days: ["Tuesday", "xyz"], time: "25:00", message: "Reset!" },
      "Mars/Base",
    );
    expect(p.days).toEqual(["tue"]);
    expect(p.time).toBe("19:00");
    expect(p.tz).toBe("UTC");
    const q = cleanPost(
      { cadence: "weekly", days: [], time: "08:30", message: "x", tz: "America/Halifax" },
      "UTC",
    );
    expect(q.days).toEqual(["mon"]);
    expect(q.tz).toBe("America/Halifax");
  });

  it("runs at the wall-clock time in its own zone, across daylight saving", () => {
    // 2026-11-01 is the end of daylight time in Halifax (UTC-3 → UTC-4).
    const spec = cleanPost(
      { cadence: "weekly", days: ["tue"], time: "13:00", message: "x", tz: "America/Halifax" },
      "UTC",
    );
    const before = Date.parse("2026-10-26T12:00:00Z"); // a Monday
    expect(nextRunOf(spec, before)?.toISOString()).toBe("2026-10-27T16:00:00.000Z"); // 13:00 ADT
    const after = Date.parse("2026-10-28T12:00:00Z");
    expect(nextRunOf(spec, after)?.toISOString()).toBe("2026-11-03T17:00:00.000Z"); // 13:00 AST
  });

  it("runs a one-off once, and not at all in the past", () => {
    const once = cleanPost(
      { cadence: "once", date: "2026-11-07", time: "20:00", message: "x", tz: "UTC" },
      "UTC",
    );
    expect(nextRunOf(once, Date.parse("2026-11-01T00:00:00Z"))?.toISOString()).toBe(
      "2026-11-07T20:00:00.000Z",
    );
    expect(nextRunOf(once, Date.parse("2026-11-08T00:00:00Z"))).toBeNull();
  });

  it("converts a zone's wall clock to the instant", () => {
    expect(new Date(zonedToUtc("Asia/Tokyo", 2026, 1, 1, 9, 0)).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });
});

describe("feeds", () => {
  it("only hooks up a channel or feed the person gave", () => {
    const given = "post when twitch.tv/RavenPlays goes live";
    expect(
      feedJob.clean({ source: "twitch", target: "ravenplays", message: "" }, ctx({ given })),
    ).toMatchObject({
      source: "twitch",
      target: "ravenplays",
    });
    expect(feedJob.clean({ source: "twitch", target: "someoneelse" }, ctx({ given }))).toBeNull();
    expect(
      feedJob.clean(
        { source: "rss", target: "https://example.com/feed.xml" },
        ctx({ given: "our feed is example.com/feed.xml" }),
      ),
    ).toMatchObject({ target: "https://example.com/feed.xml" });
    expect(
      feedJob.clean(
        { source: "rss", target: "https://evil.example/feed" },
        ctx({ given: "no link here" }),
      ),
    ).toBeNull();
  });

  it("checks what the Automations tab saves", () => {
    expect(
      cleanFeed({ source: "twitch", target: "https://www.twitch.tv/Raven_Plays/videos" })?.target,
    ).toBe("raven_plays");
    expect(cleanFeed({ source: "youtube", target: "@ourclan" })?.target).toBe("@ourclan");
    expect(cleanFeed({ source: "youtube", target: "https://example.com/x" })).toBeNull();
    expect(cleanFeed({ source: "rss", target: "ftp://example.com/feed" })).toBeNull();
    expect(cleanFeed({ source: "rss", target: "https://example.com/feed" })?.message).toContain(
      "{link}",
    );
  });

  it("reads RSS items and Atom entries", () => {
    const rss = `<rss><channel><title>Clan News</title>
      <item><title><![CDATA[Patch &amp; notes]]></title><link>https://example.com/a</link><guid>a1</guid></item>
      <item><title>Second</title><link>https://example.com/b</link></item>
    </channel></rss>`;
    const items = parseFeed(rss);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "a1",
      title: "Patch & notes",
      link: "https://example.com/a",
      name: "Clan News",
    });
    expect(items[1].id).toBe("https://example.com/b");
    const atom = `<feed><title>Raven</title><entry><id>yt:video:x1</id><title>New vid</title>
      <link rel="alternate" href="https://www.youtube.com/watch?v=x1"/><author><name>Raven</name></author></entry></feed>`;
    expect(parseFeed(atom)[0]).toMatchObject({
      id: "yt:video:x1",
      link: "https://www.youtube.com/watch?v=x1",
      name: "Raven",
    });
    expect(parseFeed(`<item><title>x</title><link>javascript:alert(1)</link></item>`)).toHaveLength(
      0,
    );
  });
});

describe("custom blocks and games", () => {
  it("refuses code that reaches out, stores things or asks for a password", () => {
    const ok = cleanCode(
      {
        title: "Poll",
        height: "m",
        code: "<div id=p></div><script>weered.list('mine:vote')</script>",
      },
      "m",
    );
    expect(ok.ok).toBe(true);
    for (const bad of [
      "<input type=password>",
      "<form action=x></form>",
      "<script>fetch('https://x')</script>",
      "<script src='https://x/a.js'></script>",
      "<script>localStorage.x=1</script>",
      "<iframe src=x></iframe>",
      "<script>top.location='https://x'</script>",
    ]) {
      const r = cleanCode({ title: "x", code: `<div>padding padding</div>${bad}` }, "m");
      expect(r.ok, bad).toBe(false);
    }
    expect(cleanCode({ code: "" }, "m").ok).toBe(false);
  });
  it("refuses code too big for the box instead of cutting it", () => {
    const big = cleanCode({ title: "x", code: "<div>" + "a".repeat(CODE_MAX) + "</div>" }, "m");
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.reason).toMatch(/too big/);
  });
});

describe("pages", () => {
  it("keeps only the links the person gave", () => {
    const md =
      "See [our store](https://shop.example.com/clan) and [docs](https://made.up/x). ![logo](https://cdn.fake/x.png) Or https://bit.ly/zzz.";
    const out = keepGivenLinks(md, "our store is shop.example.com/clan");
    expect(out).toContain("[our store](https://shop.example.com/clan)");
    expect(out).toContain("docs");
    expect(out).not.toContain("made.up");
    expect(out).not.toContain("cdn.fake");
    expect(out).not.toContain("bit.ly");
  });
  it("titles a page, keeps its markdown, and drops a repeated title heading", () => {
    const p = pageJob.clean(
      { title: "", body: "# Build guide\n\n## Gear\n- Step one" },
      ctx({ given: "" }),
    ) as any;
    expect(p.title).toBe("New page");
    expect(p.body).toBe("## Gear\n- Step one");
    const q = pageJob.clean({ title: "x", body: "## Gear\n- one" }, ctx({ given: "" })) as any;
    expect(q.body).toBe("## Gear\n- one");
  });
});
