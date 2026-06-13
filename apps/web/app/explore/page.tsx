import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Weered | Lobbies, Guides & Comparisons",
  description: "Browse every Weered game lobby, LFG guide, and platform comparison. The full directory of communities and resources on weered.ca.",
  alternates: { canonical: "https://weered.ca/explore" },
};

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

const SKIP_LOBBIES = new Set(["lobby", "weered.ca", "path-of-exile", "hq"]);
const isRedditMirror = (id: string) => id.startsWith("r/") || id.startsWith("r%2F");

type LinkItem = { href: string; label: string };

async function getData(): Promise<{ lobbies: LinkItem[]; guides: LinkItem[]; compare: LinkItem[]; lfg: LinkItem[] }> {
  let lobbies: LinkItem[] = [];
  let guides: LinkItem[] = [];
  try {
    const res = await fetch(`${API}/lobbies`, { next: { revalidate: 3600 } });
    const data = await res.json();
    if (data?.ok && Array.isArray(data.lobbies)) {
      const usable = data.lobbies.filter((l: any) => l?.id && !SKIP_LOBBIES.has(l.id) && !isRedditMirror(l.id));
      lobbies = usable.map((l: any) => ({ href: `/lobby/${encodeURIComponent(l.id)}`, label: l.name || l.id }));
      guides = usable
        .filter((l: any) => typeof l?.description === "string" && l.description.length >= 500)
        .map((l: any) => ({ href: `/about/lobby/${encodeURIComponent(l.id)}`, label: `${l.name || l.id}: overview` }));
    }
  } catch {}

  let compare: LinkItem[] = [];
  try {
    const competitors = require("../../data/competitors.json")?.competitors ?? [];
    compare = competitors.map((c: any) => ({ href: `/compare/weered-vs/${c.id}`, label: `Weered vs ${c.name || c.id}` }));
  } catch {}

  let lfg: LinkItem[] = [];
  try {
    const g = require("../../data/lfg-guides.json")?.guides ?? [];
    lfg = g.map((x: any) => ({ href: `/lfg/${x.lobby_id}`, label: `${x.game || x.lobby_id} LFG guide` }));
  } catch {}

  return { lobbies, guides, compare, lfg };
}

const KEY_PAGES: LinkItem[] = [
  { href: "/lobby", label: "All lobbies" },
  { href: "/compare", label: "Compare Weered" },
  { href: "/lfg", label: "LFG guides" },
  { href: "/why-not-discord", label: "Why not Discord?" },
  { href: "/alternatives/discord", label: "Discord alternative" },
  { href: "/tournaments/destiny-2", label: "Destiny 2 tournaments" },
  { href: "/play/chess", label: "Play chess" },
  { href: "/play/path-of-exile", label: "Path of Exile" },
  { href: "/play/fakeout", label: "FakeOut paper trading" },
  { href: "/forum", label: "Forum" },
  { href: "/map", label: "Live map" },
  { href: "/premium", label: "Premium" },
  { href: "/desktop", label: "Desktop app" },
];

function Section({ title, items }: { title: string; items: LinkItem[] }) {
  if (!items.length) return null;
  return (
    <section className="ex-section">
      <h2 className="ex-h2">{title}</h2>
      <ul className="ex-list">
        {items.map(i => (
          <li key={i.href}><a href={i.href}>{i.label}</a></li>
        ))}
      </ul>
    </section>
  );
}

export default async function ExplorePage() {
  const { lobbies, guides, compare, lfg } = await getData();

  return (
    <div className="ex-root">
      <style>{`
        .ex-root { min-height: 100vh; background: #050810; color: rgba(232,232,240,0.8);
          font-family: 'DM Mono', monospace; padding: 56px 24px 64px; }
        .ex-inner { width: min(960px, 100%); margin: 0 auto; }
        .ex-title { font-family: var(--font-barlow), 'Barlow Condensed', sans-serif; font-weight: 900;
          font-size: clamp(28px, 6vw, 48px); letter-spacing: -1.5px; line-height: 1.1;
          background: linear-gradient(135deg, #fff 0%, rgba(167,139,250,0.85) 60%, rgba(124,58,237,0.65) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin: 0 0 6px; }
        .ex-sub { font-size: 12px; color: rgba(148,163,184,0.6); margin-bottom: 40px; line-height: 1.7; }
        .ex-section { margin-bottom: 36px; }
        .ex-h2 { font-size: 12px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(167,139,250,0.8); margin: 0 0 14px; padding-bottom: 8px;
          border-bottom: 1px solid rgba(124,58,237,0.15); }
        .ex-list { list-style: none; padding: 0; margin: 0;
          display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px 24px; }
        .ex-list a { color: rgba(203,213,225,0.75); text-decoration: none; font-size: 13px; line-height: 2.1;
          transition: color 0.15s; }
        .ex-list a:hover { color: rgba(167,139,250,0.95); }
        .ex-foot { margin-top: 48px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05);
          font-size: 11px; color: rgba(255,255,255,0.2); }
        .ex-foot a { color: rgba(167,139,250,0.5); text-decoration: none; }
      `}</style>
      <div className="ex-inner">
        <h1 className="ex-title">Explore Weered</h1>
        <p className="ex-sub">Every lobby, guide, and comparison on the platform. The full directory.</p>

        <Section title="Game Lobbies" items={lobbies} />
        <Section title="Compare" items={compare} />
        <Section title="LFG Guides" items={lfg} />
        <Section title="Lobby Overviews" items={guides} />
        <Section title="Key Pages" items={KEY_PAGES} />

        <div className="ex-foot">
          <a href="/">← weered.ca</a>
        </div>
      </div>
    </div>
  );
}
