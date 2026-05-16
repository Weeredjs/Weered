/**
 * Server-rendered SEO slab for /lobby/[id].
 *
 * Hidden visually for authenticated users via CSS gate
 * (`html[data-weered-authed] .seo-slab { display: none }`) set by the
 * theme-boot script in app/layout.tsx before paint. Visible to crawlers
 * and to unauthenticated landings — the live client app mounts on top.
 *
 * Pulls four cheap reads in parallel. All have public endpoints; no auth
 * needed. Failures degrade silently — the slab still renders whatever it
 * could fetch.
 */
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const SITE = "https://weered.ca";

type Lobby = { id: string; name: string; description?: string | null; moduleType?: string | null };
type Room  = { id: string; roomId?: string; name: string; description?: string | null; _count?: { members?: number } };
type Post  = { id: string; title: string; body?: string | null; commentCount?: number; score?: number; createdAt?: string };
type Challenge = { id: string; status?: string; definition?: { title?: string; description?: string; difficulty?: number } };

async function jget<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function LobbySeoSlab({ lobbyId }: { lobbyId: string }) {
  const id = decodeURIComponent(lobbyId);

  const [lobbyRes, roomsRes, postsRes, challengesRes] = await Promise.all([
    jget<{ lobby?: Lobby } & Lobby>(`${API}/lobbies/${encodeURIComponent(id)}`, {} as any),
    jget<{ rooms?: Room[] }>(`${API}/lobbies/${encodeURIComponent(id)}/rooms`, { rooms: [] }),
    jget<{ posts?: Post[] }>(`${API}/forum/posts?lobbyId=${encodeURIComponent(id)}&limit=6&sort=hot`, { posts: [] }),
    jget<{ challenges?: Challenge[] }>(`${API}/challenges?lobbyId=${encodeURIComponent(id)}`, { challenges: [] }),
  ]);

  const lobby: Lobby = (lobbyRes as any).lobby ?? (lobbyRes as Lobby);
  const rooms = (roomsRes.rooms ?? []).slice(0, 8);
  const posts = (postsRes.posts ?? []).slice(0, 6);
  const challenges = (challengesRes.challenges ?? []).filter(c => c.status === "ACTIVE" && c.definition?.title).slice(0, 6);

  if (!lobby?.name) return null;

  const url = `${SITE}/lobby/${encodeURIComponent(id)}`;

  return (
    <aside className="seo-slab" aria-label={`${lobby.name} lobby overview`}>
      <div className="seo-slab-inner">
        <header className="seo-slab-header">
          <p className="seo-slab-eyebrow">Weered lobby</p>
          <h1 className="seo-slab-title">{lobby.name}</h1>
          {lobby.description && (
            <p className="seo-slab-desc">{lobby.description}</p>
          )}
        </header>

        {challenges.length > 0 && (
          <section className="seo-slab-section">
            <h2>Active challenges</h2>
            <ul>
              {challenges.map(c => (
                <li key={c.id}>
                  <strong>{c.definition!.title}</strong>
                  {c.definition?.description && <span> — {c.definition.description}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {rooms.length > 0 && (
          <section className="seo-slab-section">
            <h2>Rooms in this lobby</h2>
            <ul>
              {rooms.map(r => {
                const rid = r.id || r.roomId;
                return (
                  <li key={rid}>
                    <Link href={`/room/${encodeURIComponent(rid!)}`}>{r.name}</Link>
                    {r.description && <span> — {r.description}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {posts.length > 0 && (
          <section className="seo-slab-section">
            <h2>Recent discussions</h2>
            <ul>
              {posts.map(p => (
                <li key={p.id}>
                  <Link href={`/forum/${encodeURIComponent(p.id)}`}>{p.title}</Link>
                  {typeof p.commentCount === "number" && <span className="seo-slab-meta"> · {p.commentCount} {p.commentCount === 1 ? "reply" : "replies"}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="seo-slab-footer">
          <p>
            Weered is a real-time community platform for lobbies, rooms, presence, and modules.
            <Link href="/"> Join the {lobby.name} community on Weered →</Link>
          </p>
          <p className="seo-slab-canonical">
            <Link href={url}>{url}</Link>
          </p>
        </footer>
      </div>
    </aside>
  );
}
