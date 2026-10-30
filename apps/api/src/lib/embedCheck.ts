// Can this page be shown inside a Weered section? The Webpage block asks once
// per link (cached for a day, shared by everyone using the same link):
//   - a site that allows framing is shown live;
//   - a site that refuses (X-Frame-Options, CSP frame-ancestors) becomes a
//     link card from its own title, description, picture and icon;
//   - a few services with an official embed (Google Docs/Sheets/Slides/
//     Calendar/Forms, Figma, Discord widgets) get their embed address.
// The page itself is never relayed through Weered: the viewer's browser loads
// it from the site. Only this check touches the server, through fetchSafe
// (private addresses and redirect tricks refused).
import { fetchSafe } from "./ssrfGuard";
import { decodeEntities, stripTags } from "./htmlText";

export type EmbedCheck =
  | { ok: false; error: string }
  | {
      ok: true;
      url: string;
      frameable: boolean;
      embedUrl?: string;
      title?: string;
      description?: string;
      image?: string;
      icon?: string;
      site?: string;
    };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 WeeredEmbedCheck";
const DAY = 24 * 3600_000;
const FAIL_TTL = 10 * 60_000;
const MAX_CACHE = 2000;
const MAX_HEAD = 256 * 1024;

/** May a page with these headers be framed by another site? */
export function frameDecision(h: { get(name: string): string | null }): boolean {
  const xfo = (h.get("x-frame-options") || "").trim().toLowerCase();
  if (xfo) {
    // Browsers honour DENY and SAMEORIGIN; ALLOW-FROM and anything else is ignored.
    const first = xfo.split(",")[0].trim();
    if (first === "deny" || first === "sameorigin") return false;
  }
  // Repeated CSP headers arrive comma-joined; each policy applies.
  for (const policy of (h.get("content-security-policy") || "").split(",")) {
    const m = policy.match(/(?:^|;)\s*frame-ancestors\s+([^;]*)/i);
    if (!m) continue;
    const sources = m[1].trim().toLowerCase().split(/\s+/);
    // A list of named hosts can't include every lobby's own domain.
    if (!sources.some((s) => s === "*" || s === "https:" || s === "https://*")) return false;
  }
  return true;
}

/** The official embed address for services that have one, or null. */
export function knownEmbed(u: URL): string | null {
  const h = u.hostname.toLowerCase();
  const p = u.pathname;
  if (h === "docs.google.com") {
    let m = p.match(/^\/(document|presentation|forms)\/d\/e\/([\w-]+)\/(pub|viewform|embed)/);
    if (m) {
      if (m[1] === "presentation") return `https://docs.google.com/presentation/d/e/${m[2]}/embed`;
      if (m[1] === "forms")
        return `https://docs.google.com/forms/d/e/${m[2]}/viewform?embedded=true`;
      return `https://docs.google.com/document/d/e/${m[2]}/pub?embedded=true`;
    }
    m = p.match(/^\/spreadsheets\/d\/e\/([\w-]+)\/pubhtml/);
    if (m)
      return `https://docs.google.com/spreadsheets/d/e/${m[1]}/pubhtml?widget=true&headers=false`;
    // A shared (not published) doc: its preview is the embeddable view.
    m = p.match(/^\/(document|spreadsheets|presentation)\/d\/([\w-]+)/);
    if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
    return null;
  }
  if (h === "calendar.google.com" && p.startsWith("/calendar/embed")) return u.toString();
  if ((h === "www.figma.com" || h === "figma.com") && /^\/(file|design|proto|board)\//.test(p))
    return `https://www.figma.com/embed?embed_host=weered&url=${encodeURIComponent(u.toString())}`;
  if (
    (h === "discord.com" || h === "discordapp.com") &&
    p === "/widget" &&
    u.searchParams.get("id")
  )
    return u.toString();
  return null;
}

function tagAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

const clean = (s: string | undefined, max: number) =>
  s
    ? decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim().slice(0, max) || undefined
    : undefined;

function httpsUrl(v: string | undefined, base: URL): string | undefined {
  if (!v) return undefined;
  try {
    const u = new URL(decodeEntities(v.trim()), base);
    return u.protocol === "https:" ? u.toString().slice(0, 600) : undefined;
  } catch {
    return undefined;
  }
}

/** Title, description, picture, icon and site name from a page's <head>. */
export function parseMeta(html: string, base: URL) {
  const end = html.search(/<\/head>/i);
  const head = (end > 0 ? html.slice(0, end) : html).slice(0, MAX_HEAD);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = tagAttrs(m[0]);
    const key = (a.property || a.name || "").toLowerCase();
    if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content;
  }
  let icon: string | undefined;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = tagAttrs(m[0]);
    const rel = (a.rel || "").toLowerCase().split(/\s+/);
    if (a.href && (rel.includes("icon") || rel.includes("apple-touch-icon"))) {
      icon = httpsUrl(a.href, base);
      if (icon && rel.includes("apple-touch-icon")) break;
    }
  }
  const t = head.match(/<title[^>]*>([\s\S]{0,400}?)<\/title>/i);
  return {
    title: clean(meta["og:title"] || meta["twitter:title"] || t?.[1], 140),
    description: clean(
      meta["og:description"] || meta.description || meta["twitter:description"],
      280,
    ),
    image: httpsUrl(meta["og:image"] || meta["twitter:image"], base),
    icon: icon || httpsUrl("/favicon.ico", base),
    site: clean(meta["og:site_name"], 60) || base.hostname.replace(/^www\./, ""),
  };
}

async function readHead(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const dec = new TextDecoder("utf-8");
  let out = "";
  let n = 0;
  try {
    while (n < MAX_HEAD) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      out += dec.decode(value, { stream: true });
      if (/<\/head>/i.test(out)) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return out;
}

const cache = new Map<string, { at: number; ttl: number; value: EmbedCheck }>();
function remember(key: string, value: EmbedCheck, ttl: number): EmbedCheck {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), ttl, value });
  return value;
}

export async function checkEmbed(raw: string): Promise<EmbedCheck> {
  let u: URL;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return { ok: false, error: "bad_url" };
  }
  if (u.protocol !== "https:" || u.toString().length > 600)
    return { ok: false, error: "https_only" };
  u.hash = "";
  const key = u.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;

  const official = knownEmbed(u);
  if (official)
    return remember(
      key,
      { ok: true, url: key, frameable: true, embedUrl: official, site: u.hostname },
      DAY,
    );

  try {
    const res = await fetchSafe(
      key,
      { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" } },
      6000,
      { webPortsOnly: true },
    );
    const finalUrl = new URL(res.url || key);
    // A refusal or an error page says nothing about what a browser would get
    // (sites often turn servers away), so anything but a success shows as a
    // link card, which always works, named from the address alone.
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return remember(
        key,
        {
          ok: true,
          url: finalUrl.toString(),
          frameable: false,
          site: finalUrl.hostname.replace(/^www\./, ""),
        },
        DAY,
      );
    }
    const html = /html/i.test(res.headers.get("content-type") || "") ? await readHead(res) : "";
    if (!html) res.body?.cancel().catch(() => {});
    return remember(
      key,
      {
        ok: true,
        url: finalUrl.toString(),
        frameable: frameDecision(res.headers),
        ...parseMeta(html, finalUrl),
      },
      DAY,
    );
  } catch (e) {
    const error = String((e as Error)?.message || "unreachable").slice(0, 40);
    return remember(key, { ok: false, error }, FAIL_TTL);
  }
}
