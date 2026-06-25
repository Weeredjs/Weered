export const runtime = "nodejs";

function xmlText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#32;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseAtomEntries(feed: string): any[] {
  const items: any[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;

  while ((m = entryRe.exec(feed)) !== null) {
    const block = m[1];

    const title = stripHtml(xmlText(block, "title"));
    const content = xmlText(block, "content");

    const authorBlock = block.match(/<author>([\s\S]*?)<\/author>/i)?.[1] || "";
    const author = xmlText(authorBlock, "name").replace(/^\/u\//i, "");

    const linkMatch =
      block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) ||
      block.match(/<link[^>]*href="([^"]+)"/i);
    const link = linkMatch ? linkMatch[1] : "";

    const updated = xmlText(block, "updated") || xmlText(block, "published");
    let created_utc = 0;
    try {
      created_utc = Math.floor(new Date(updated).getTime() / 1000);
    } catch {}

    const catMatch = block.match(/<category[^>]*label="r\/([^"]+)"/i);
    const subreddit = catMatch ? catMatch[1] : "";

    let id = "";
    let permalink = "";
    try {
      const u = new URL(link);
      permalink = u.pathname;
      const parts = u.pathname.split("/").filter(Boolean);
      id = parts[3] || String(Math.random());
    } catch {
      id = String(Math.random());
    }

    let num_comments = 0;
    const commMatch = content.match(/(\d+)\s+comments?/i);
    if (commMatch) num_comments = Number.parseInt(commMatch[1], 10);

    const selftext = stripHtml(content).slice(0, 600);

    let url = link;
    const hrefMatches = [...content.matchAll(/href="([^"]+)"/gi)];
    for (const hm of hrefMatches) {
      const href = hm[1];
      if (!href.includes("reddit.com") && href.startsWith("http")) {
        url = href;
        break;
      }
    }

    items.push({
      id,
      title,
      author,
      score: 0,
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
  const subRaw = (u.searchParams.get("sub") || "").trim();
  const sortRaw = (u.searchParams.get("sort") || "hot").trim().toLowerCase();

  const sub = subRaw.replace(/^r\//i, "");
  if (!sub || !/^[A-Za-z0-9_+]{2,40}$/.test(sub)) {
    return new Response(JSON.stringify({ ok: false, error: "bad_sub" }), { status: 400 });
  }

  const sort = ["hot", "new", "top", "rising"].includes(sortRaw) ? sortRaw : "hot";
  const feedUrl = `https://www.reddit.com/r/${sub}/${sort}.rss?limit=25`;

  let feed: string;
  try {
    const r = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WeeredBot/1.0; +https://weered.ca)",
        Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml",
      },
      cache: "no-store",
    });

    if (!r.ok) {
      return new Response(
        JSON.stringify({ ok: false, status: r.status, error: `Reddit returned ${r.status}` }),
        { status: 502 },
      );
    }

    feed = await r.text();
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || "fetch failed") }),
      { status: 502 },
    );
  }

  const items = parseAtomEntries(feed);

  return new Response(
    JSON.stringify({ ok: true, data: { children: items.map((p) => ({ data: p })) } }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=180",
      },
    },
  );
}
