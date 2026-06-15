import type { Metadata } from "next";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const SITE = "https://weered.ca";

type Lobby = {
  id: string;
  name: string;
  description?: string | null;
  moduleType?: string | null;
  keywords?: string[] | string | null;
};
type Room = {
  id: string;
  roomId?: string;
  name: string;
  description?: string | null;
  _count?: { members?: number };
};
type Post = { id: string; title: string; commentCount?: number; createdAt?: string };
type Challenge = {
  id: string;
  status?: string;
  definition?: { title?: string; description?: string; difficulty?: number };
};

async function jget<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

async function loadLobbyBundle(id: string) {
  const [lobbyRes, roomsRes, postsRes, challengesRes] = await Promise.all([
    jget<{ lobby?: Lobby } & Lobby>(`${API}/lobbies/${encodeURIComponent(id)}`, {} as any),
    jget<{ rooms?: Room[] }>(`${API}/lobbies/${encodeURIComponent(id)}/rooms`, { rooms: [] }),
    jget<{ posts?: Post[] }>(
      `${API}/forum/posts?lobbyId=${encodeURIComponent(id)}&limit=10&sort=hot`,
      { posts: [] },
    ),
    jget<{ challenges?: Challenge[] }>(`${API}/challenges?lobbyId=${encodeURIComponent(id)}`, {
      challenges: [],
    }),
  ]);
  const lobby: Lobby = (lobbyRes as any).lobby ?? (lobbyRes as Lobby);
  return {
    lobby,
    rooms: (roomsRes.rooms ?? []).slice(0, 12),
    posts: (postsRes.posts ?? []).slice(0, 10),
    challenges: (challengesRes.challenges ?? [])
      .filter((c) => c.status === "ACTIVE" && c.definition?.title)
      .slice(0, 8),
  };
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const id = decodeURIComponent(params.id);
  const { lobby } = await loadLobbyBundle(id);
  const isThinForMeta = !lobby?.description || lobby.description.length < 500;
  const name = lobby?.name || id;
  const description = lobby?.description || `Overview of the ${name} lobby on Weered.`;
  const lobbyUrl = `${SITE}/lobby/${encodeURIComponent(id)}`;
  return {
    title: `${name}: community overview · Weered`,
    description: description.slice(0, 300),
    alternates: { canonical: lobbyUrl },
    openGraph: {
      title: `${name} on Weered`,
      description: description.slice(0, 300),
      url: lobbyUrl,
      type: "website",
    },
    robots: { index: !isThinForMeta, follow: true },
  };
}

export default async function LobbyAboutPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = decodeURIComponent(params.id);
  const { lobby, rooms, posts, challenges } = await loadLobbyBundle(id);
  const isThin = !lobby?.description || lobby.description.length < 500;
  const lfgGuideIds = new Set<string>([
    "destiny2",
    "league-of-legends",
    "mtg",
    "helldivers2",
    "poe",
    "dnd",
  ]);
  const hasLfgGuide = lfgGuideIds.has(id);

  if (!lobby?.name) {
    return (
      <main
        style={{
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          maxWidth: 720,
          margin: "40px auto",
        }}
      >
        <h1>Lobby not found</h1>
        <p>
          The lobby <code>{id}</code> doesn&apos;t exist. <Link href="/">Browse Weered →</Link>
        </p>
      </main>
    );
  }

  const lobbyUrl = `${SITE}/lobby/${encodeURIComponent(id)}`;
  const keywords = Array.isArray(lobby.keywords)
    ? lobby.keywords
    : typeof lobby.keywords === "string"
      ? lobby.keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Lobbies", item: `${SITE}/lobby` },
      { "@type": "ListItem", position: 3, name: lobby.name, item: lobbyUrl },
      { "@type": "ListItem", position: 4, name: "About", item: `${lobbyUrl}/about` },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    dateModified: new Date().toISOString(),
    mainEntity: [
      {
        "@type": "Question",
        name: `What is the ${lobby.name} lobby on Weered?`,
        acceptedAnswer: {
          "@type": "Answer",
          text:
            lobby.description ||
            `${lobby.name} is one of the themed game-community lobbies on Weered: voice rooms, chat, presence, and forum discussion built around the ${lobby.name} community.`,
        },
      },
      {
        "@type": "Question",
        name: `How do I join the ${lobby.name} lobby on Weered?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Open ${lobbyUrl} and create a free Weered account using Steam, Xbox, PSN, or email. The ${lobby.name} lobby is public, no invite required. Once joined, you can enter voice rooms, post in the forum, and see other members' real-time presence.`,
        },
      },
      {
        "@type": "Question",
        name: `Is the ${lobby.name} lobby free to use?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes. Joining and using the ${lobby.name} lobby on Weered is free. Weered has an optional premium tier with cosmetic flair and custom community branding, but all core features (voice, chat, presence, forum, tournaments) work without paying.`,
        },
      },
      {
        "@type": "Question",
        name: `What can I do in the ${lobby.name} lobby?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Live voice rooms${
            rooms.length > 0
              ? ` (${rooms.length} pinned room${rooms.length === 1 ? "" : "s"} including ${rooms
                  .slice(0, 3)
                  .map((r) => r.name)
                  .join(", ")})`
              : ""
          }, real-time member presence (what each member is playing across Steam/Xbox/PSN/Twitch), forum discussions${posts.length > 0 ? ` (${posts.length} recent posts)` : ""}${challenges.length > 0 ? `, active challenges (${challenges.length} live)` : ""}, and any game-integrated modules Weered provides for ${lobby.name} (summoner lookup, leaderboards, deck imports, etc., depending on the game).`,
        },
      },
    ],
  };

  return (
    <main
      style={{
        padding: "32px 20px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        maxWidth: 820,
        margin: "0 auto",
        lineHeight: 1.55,
        color: "#e8e8ea",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <nav aria-label="Breadcrumb" style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
        <Link href="/" style={{ color: "#7c9dff" }}>
          Weered
        </Link>
        {" / "}
        <Link href="/lobby" style={{ color: "#7c9dff" }}>
          Lobbies
        </Link>
        {" / "}
        <Link href={lobbyUrl} style={{ color: "#7c9dff" }}>
          {lobby.name}
        </Link>
        {" / About"}
      </nav>

      <header style={{ marginBottom: 28 }}>
        <p
          style={{
            fontSize: 12,
            opacity: 0.6,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          Weered lobby overview
        </p>
        <h1 style={{ fontSize: 32, margin: "0 0 12px", lineHeight: 1.15 }}>{lobby.name}</h1>
        {lobby.description && <p style={{ fontSize: 17, opacity: 0.92 }}>{lobby.description}</p>}
        <p style={{ marginTop: 16 }}>
          <Link
            href={lobbyUrl}
            style={{
              display: "inline-block",
              padding: "10px 18px",
              background: "#7c9dff",
              color: "#0b0b10",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Open the {lobby.name} lobby →
          </Link>
        </p>
      </header>

      {challenges.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>Active challenges</h2>
          <ul style={{ paddingLeft: 20 }}>
            {challenges.map((c) => (
              <li key={c.id} style={{ marginBottom: 8 }}>
                <strong>{c.definition!.title}</strong>
                {c.definition?.description && <span>: {c.definition.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rooms.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>Rooms in this lobby</h2>
          <ul style={{ paddingLeft: 20 }}>
            {rooms.map((r) => {
              const rid = r.id || r.roomId;
              return (
                <li key={rid} style={{ marginBottom: 8 }}>
                  <Link
                    href={`/room/${encodeURIComponent(rid!)}`}
                    style={{ color: "#7c9dff", fontWeight: 600 }}
                  >
                    {r.name}
                  </Link>
                  {r.description && <span>: {r.description}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {posts.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>Recent discussions</h2>
          <ul style={{ paddingLeft: 20 }}>
            {posts.map((p) => (
              <li key={p.id} style={{ marginBottom: 8 }}>
                <Link href={`/forum/${encodeURIComponent(p.id)}`} style={{ color: "#7c9dff" }}>
                  {p.title}
                </Link>
                {typeof p.commentCount === "number" && (
                  <span style={{ opacity: 0.65, fontSize: 13 }}>
                    {" "}
                    · {p.commentCount} {p.commentCount === 1 ? "reply" : "replies"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {keywords.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>Topics covered</h2>
          <p style={{ opacity: 0.85 }}>{keywords.join(" · ")}</p>
        </section>
      )}

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, marginBottom: 10 }}>About Weered</h2>
        <p>
          Weered is a real-time community platform built around <em>lobbies</em>: themed hubs where
          each game, interest, or scene gets its own space. Live voice rooms, persistent chat,
          presence (who&apos;s playing what, right now), forum discussions, challenges, and
          tournaments are all first-class features of every lobby. No invites, no servers to set up.
          Just join.
        </p>
        <p>
          The {lobby.name} lobby is one of {`many`} on the platform. To participate, open the live
          lobby and create an account in seconds. Steam, Xbox, PSN, or email all work. Most rooms
          are public; lobby owners can run their own moderation, tiers, and rules.
        </p>
      </section>

      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 16,
          marginTop: 32,
          fontSize: 14,
          opacity: 0.75,
        }}
      >
        <p>
          <Link href={lobbyUrl} style={{ color: "#7c9dff", fontWeight: 600 }}>
            → Open the live {lobby.name} lobby
          </Link>
        </p>
        {hasLfgGuide && (
          <p style={{ marginBottom: 8 }}>
            <Link href={`/lfg/${id}`} style={{ color: "#7c9dff" }}>
              How to find a {lobby.name} group on Weered →
            </Link>
          </p>
        )}
        <p style={{ marginTop: 8 }}>
          Canonical:{" "}
          <Link href={lobbyUrl} style={{ color: "#7c9dff" }}>
            {lobbyUrl}
          </Link>
        </p>
      </footer>
    </main>
  );
}

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API}/lobbies?limit=200`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const lobbies = data?.lobbies ?? data ?? [];
    return (Array.isArray(lobbies) ? lobbies : [])
      .map((l: any) => ({ id: l.id }))
      .filter((p: any) => p.id);
  } catch {
    return [];
  }
}
