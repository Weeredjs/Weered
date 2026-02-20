export async function GET(req: Request) {
  const u = new URL(req.url);
  const permalink = (u.searchParams.get("permalink") || "").trim();

  if (!permalink.startsWith("/r/") || permalink.includes("://")) {
    return new Response(JSON.stringify({ ok: false, error: "bad_permalink" }), { status: 400 });
  }

  const qs = new URLSearchParams();
  qs.set("raw_json", "1");
  qs.set("limit", "50");

  const url = `https://www.reddit.com${permalink}.json?${qs.toString()}`;

  const r = await fetch(url, {
    headers: {
      "User-Agent": "weered-dev/0.1 (contact: local)",
      "Accept": "application/json",
    },
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
      "Cache-Control": "public, max-age=15, s-maxage=60, stale-while-revalidate=120",
    },
  });
}