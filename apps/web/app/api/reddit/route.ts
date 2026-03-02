export async function GET(req: Request) {
  const u = new URL(req.url);
  const subRaw = (u.searchParams.get("sub") || "").trim();
  const sortRaw = (u.searchParams.get("sort") || "hot").trim().toLowerCase();
  const limitRaw = u.searchParams.get("limit") || "25";
  const after = u.searchParams.get("after") || "";
  const t = (u.searchParams.get("t") || "").trim().toLowerCase();

  // sanitize subreddit
  const sub = subRaw.replace(/^r\//i, "");
  if (!sub || !/^[A-Za-z0-9_+]{2,40}$/.test(sub)) {
    return new Response(JSON.stringify({ ok: false, error: "bad_sub" }), { status: 400 });
  }

  const sort = ["hot", "new", "top", "rising"].includes(sortRaw) ? sortRaw : "hot";
  const limit = Math.min(50, Math.max(5, parseInt(limitRaw || "25", 10) || 25));

  const qs = new URLSearchParams();
  qs.set("raw_json", "1");
  qs.set("limit", String(limit));
  if (after) qs.set("after", after);
  if (sort === "top" && t) qs.set("t", t);

  const url = `https://api.reddit.com/r/${sub}/${sort}.json?${qs.toString()}`;

  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; WeeredBot/1.0; +https://weered.ca)",
      "Accept": "application/json",
    },
    // Next route handler: ensure it doesn't cache forever during dev
    cache: "no-store",
  });

  const txt = await r.text();
  if (!r.ok) {
    return new Response(JSON.stringify({ ok: false, status: r.status, body: txt.slice(0, 300) }), { status: 502 });
  }

  return new Response(txt, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // light caching is fine, but keep it short
      "Cache-Control": "public, max-age=15, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
