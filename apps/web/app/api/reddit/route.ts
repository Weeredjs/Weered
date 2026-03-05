export const runtime = "nodejs";

// Parses Reddit RSS feed — no OAuth, no API key, works from datacenter IPs
// Returns JSON shaped to match what SubredditBrowser expects

function xmlText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function xmlAttr(xml: string, tag: string, attr: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i"));
  return m ? m[1].trim() : "";
}

function parseItems(feed: string): any[] {
  const items: any[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(feed)) !== null) {
    const block = m[1];

    const title    = xmlText(block, "title");
    const link     = xmlText(block, "link") || xmlAttr(block, "link", "href");
    const pubDate  = xmlText(block, "pubDate");
    const author   = xmlText(block, "dc:creator") || xmlText(block, "author");
    const content  = xmlText(block, "content:encoded") || xmlText(block, "description") || "";

    // permalink from link: https://www.reddit.com/r/sub/comments/id/slug/
    let permalink = "";
    let id = "";
    let subreddit = "";
    try {
      const u = new URL(link);
      permalink = u.pathname;
      const parts = u.pathname.split("/").filter(Boolean);
      // ['r', 'sub', 'comments', 'id', 'slug']
      subreddit = parts[1] || "";
      id = parts[3] || String(Date.now());
    } catch {
      id = String(Math.random());
    }

    // Extract score from content HTML: "&#32; submitted by &#32;" pattern
    // RSS doesn't have score — default 0
    const score = 0;

    // Extract comment count from content
    let num_comments = 0;
    const commMatch = content.match(/(\d+)\s+comments?/i);
    if (commMatch) num_comments = parseInt(commMatch[1], 10);

    // created_utc from pubDate
    let created_utc = 0;
    try { created_utc = Math.floor(new Date(pubDate).getTime() / 1000); } catch {}

    // selftext: strip HTML from content, take first paragraph
    const selftext = content
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);

    // external URL: if link doesn't go to reddit comments, it's an external link
    const url = link;

    items.push({
      id,
      title,
      author,
      score,
      num_comments,
      created_utc,
      permalink,
      selftext,
      url,
      subreddit,
    });
  }

  return items;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const subRaw  = (u.searchParams.get("sub")  || "").trim();
  const sortRaw = (u.searchParams.get("sort") || "hot").trim().toLowerCase();

  const sub = subRaw.replace(/^r\//i, "");
  if (!sub || !/^[A-Za-z0-9_+]{2,40}$/.test(sub)) {
    return new Response(JSON.stringify({ ok: false, error: "bad_sub" }), { status: 400 });
  }

  const sort = ["hot", "new", "top", "rising"].includes(sortRaw) ? sortRaw : "hot";

  // RSS still works from DC IPs — Reddit only blocks the JSON API
  const feedUrl = `https://www.reddit.com/r/${sub}/${sort}.rss?limit=25`;

  let feed: string;
  try {
    const r = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WeeredBot/1.0; +https://weered.ca)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      cache: "no-store",
    });

    if (!r.ok) {
      return new Response(
        JSON.stringify({ ok: false, status: r.status, error: `Reddit returned ${r.status}` }),
        { status: 502 }
      );
    }

    feed = await r.text();
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || "fetch failed") }),
      { status: 502 }
    );
  }

  const items = parseItems(feed);

  // Shape response to match what SubredditBrowser expects:
  // { data: { children: [{ data: post }] } }
  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        children: items.map((p) => ({ data: p })),
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=180",
      },
    }
  );
}
