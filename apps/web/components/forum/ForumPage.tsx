"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "../WeeredProvider";
import { forumFetch, timeAgo, CATEGORY_CONFIG, TIER_COLORS, FONT } from "./ForumHelpers";
import { apiFetch } from "../../lib/api";
import { avatarBg } from "../../lib/avatarColor";
import { weeredForumReport } from "../../lib/forumReport";

type Post = {
  id: string; title: string; body: string; category: string;
  authorId: string; authorName: string; pinned: boolean; locked: boolean;
  score: number; commentCount: number; createdAt: string;
  sectionId?: string | null;
  tags?: any;
  author: { name: string; avatar?: string; avatarColor?: string; tier?: string; globalRole?: string } | null;
  myVote: number;
};

type Section = {
  id: string;
  lobbyId: string;
  slug: string;
  name: string;
  description: string;
  color?: string | null;
  icon?: string | null;
  order: number;
  postsOnly: boolean;
  postCount: number;
};

type SearchResults = {
  posts: any[];
  comments: any[];
};

const SORTS = [
  { id: "hot", label: "Hot" },
  { id: "new", label: "New" },
  { id: "top", label: "Top" },
];

const CATS = [
  { id: "", label: "All" },
  { id: "BUG_REPORT", label: "Bugs" },
  { id: "FEATURE_REQUEST", label: "Features" },
  { id: "DISCUSSION", label: "Discussion" },
  { id: "ANNOUNCEMENT", label: "News" },
];

export default function ForumPage({ lobbyId, lobbyName }: { lobbyId?: string; lobbyName?: string } = {}) {
  const embedded = !!lobbyId;
  const router = useRouter();
  const w: any = useWeered();
  const me = w?.me;
  const myLobbyRole: string | undefined = w?.lobbyRole || w?.myLobbyRole;
  const isStaff = !!me && (me.globalRole === "GOD" || me.globalRole === "ADMIN" || me.globalRole === "MOD");
  const isLobbyMod = myLobbyRole === "OWNER" || myLobbyRole === "MOD";
  const canManageSections = !!lobbyId && (isStaff || isLobbyMod);

  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState("hot");
  const [category, setCategory] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [postCat, setPostCat] = useState("DISCUSSION");
  const [postSection, setPostSection] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadSections = useCallback(async () => {
    if (!lobbyId) { setSections([]); return; }
    const data = await apiFetch<any>(`/forum/sections?lobbyId=${encodeURIComponent(lobbyId)}`, { silent: true });
    if (data?.ok) setSections(data.sections || []);
  }, [lobbyId]);

  const load = useCallback(async () => {
    setLoading(true);
    let params = `sort=${sort}&limit=25`;
    if (sectionId) params += `&sectionId=${encodeURIComponent(sectionId)}`;
    if (category && !sectionId) params += `&category=${category}`;
    if (lobbyId) params += `&lobbyId=${encodeURIComponent(lobbyId)}`;
    const data = await forumFetch(`/forum/posts?${params}`);
    if (data?.ok) setPosts(data.posts || []);
    setLoading(false);
  }, [sort, category, sectionId, lobbyId]);

  useEffect(() => { loadSections(); }, [loadSections]);
  useEffect(() => { if (!searchActive) load(); }, [load, searchActive]);

  async function runSearch(q: string) {
    if (!q.trim() || q.trim().length < 2) {
      setSearchActive(false); setSearchResults(null); return;
    }
    setSearchActive(true); setSearching(true);
    let path = `/forum/search?q=${encodeURIComponent(q.trim())}`;
    if (lobbyId) path += `&lobbyId=${encodeURIComponent(lobbyId)}`;
    const data = await apiFetch<any>(path);
    if (data?.ok) setSearchResults(data.results || { posts: [], comments: [] });
    setSearching(false);
  }

  function clearSearch() {
    setSearchQ(""); setSearchActive(false); setSearchResults(null);
  }

  async function handleVote(postId: string, value: number) {
    const data = await forumFetch(`/forum/posts/${postId}/vote`, {
      method: "POST", body: JSON.stringify({ value }),
    });
    if (data?.ok) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, score: data.score, myVote: value } : p));
    }
  }

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean).slice(0, 8);
    const data = await forumFetch("/forum/posts", {
      method: "POST",
      body: JSON.stringify({
        title: title.trim(), body: body.trim(), category: postCat,
        lobbyId: lobbyId || undefined,
        sectionId: postSection || undefined,
        tags,
      }),
    });
    if (data?.ok) {
      setComposing(false);
      setTitle(""); setBody(""); setPostCat("DISCUSSION"); setPostSection(""); setTagsInput("");
      load(); loadSections();
    }
    setSubmitting(false);
  }

  const activeSection = useMemo(() => sections.find(s => s.id === sectionId) || null, [sections, sectionId]);

  function selectSection(id: string) {
    setSectionId(id);
    setCategory("");
    setDrawerOpen(false);
    if (searchActive) clearSearch();
  }

  return (
    <div style={{
      display: "flex",
      maxWidth: embedded ? undefined : 1100,
      margin: embedded ? 0 : "0 auto",
      fontFamily: FONT,
      height: "100%",
      overflow: "hidden",
    }}>
      {embedded && (
        <SectionSidebar
          sections={sections}
          activeId={sectionId}
          onSelect={selectSection}
          canManage={canManageSections}
          onManage={() => { setEditingSection(null); setSectionModalOpen(true); }}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
      )}

      <div style={{
        flex: 1,
        minWidth: 0,
        padding: embedded ? "12px 14px 40px" : "20px 16px 60px",
        overflow: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,.08) transparent",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: embedded ? 12 : 20, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {embedded && (
              <button
                onClick={() => setDrawerOpen(true)}
                title="Sections"
                className="forum-mobile-only"
                style={{
                  display: "none", padding: "6px 10px", borderRadius: 6,
                  background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)",
                  color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}
              >&#9776;</button>
            )}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: embedded ? 15 : 22, fontWeight: 900, margin: 0, letterSpacing: "-0.3px" }}>
                {embedded
                  ? (activeSection ? `${activeSection.icon || ""} ${activeSection.name}`.trim() : (lobbyName || "Community Feed"))
                  : "Forum"}
              </h1>
              {!embedded && <div style={{ fontSize: 11, opacity: 0.35, marginTop: 2 }}>Bug reports, feature requests, and community discussion</div>}
              {embedded && activeSection?.description && (
                <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>{activeSection.description}</div>
              )}
            </div>
          </div>
          {me && (
            <button onClick={() => { setComposing(true); if (sectionId) setPostSection(sectionId); }} style={{
              padding: "8px 16px", borderRadius: 8,
              background: "linear-gradient(135deg, rgba(124,58,237,.7), rgba(167,139,250,.5))",
              border: "1px solid rgba(124,58,237,.4)",
              color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", flexShrink: 0,
            }}>
              + New Post
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); runSearch(searchQ); }}
          style={{ display: "flex", gap: 6, marginBottom: 12 }}
        >
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder={`Search ${embedded ? "this lobby" : "all forum posts"}...`}
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.3)",
              color: "rgba(243,244,246,.92)", fontSize: 12,
              outline: "none", fontFamily: "inherit",
            }}
          />
          {searchActive && (
            <button type="button" onClick={clearSearch} style={{
              padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.08)",
              background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.55)",
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}>Clear</button>
          )}
          <button type="submit" style={{
            padding: "0 14px", borderRadius: 8, border: "1px solid rgba(124,58,237,.4)",
            background: "rgba(124,58,237,.3)", color: "#fff",
            fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>Search</button>
        </form>

        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.04)", borderRadius: 999, padding: 3 }}>
            {SORTS.map(s => (
              <button key={s.id} onClick={() => setSort(s.id)} style={{
                padding: "6px 14px", borderRadius: 999, border: "none",
                fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                background: sort === s.id ? "linear-gradient(135deg, rgba(124,58,237,.7), rgba(167,139,250,.45))" : "transparent",
                color: sort === s.id ? "#fff" : "rgba(255,255,255,.45)",
                transition: "all 0.15s",
                boxShadow: sort === s.id ? "0 1px 0 rgba(255,255,255,.05) inset" : "none",
              }}>{s.label}</button>
            ))}
          </div>
          {!embedded && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {CATS.map(c => {
                const cfg = CATEGORY_CONFIG[c.id];
                const active = category === c.id;
                return (
                  <button key={c.id} onClick={() => setCategory(c.id)} style={{
                    padding: "4px 10px", borderRadius: 6, border: "none",
                    fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    background: active ? (cfg?.bg || "rgba(255,255,255,.08)") : "transparent",
                    color: active ? (cfg?.color || "rgba(255,255,255,.8)") : "rgba(255,255,255,.35)",
                    transition: "all 0.15s",
                  }}>{c.label}</button>
                );
              })}
            </div>
          )}
        </div>

        {composing && (
          <div style={{
            marginBottom: 16, padding: "16px 18px", borderRadius: 12,
            background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)",
          }}>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Post title..."
              maxLength={200}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.3)",
                color: "rgba(243,244,246,.92)", fontSize: 14, fontWeight: 700,
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                marginBottom: 10,
              }}
            />
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Write your post... (supports markdown)"
              maxLength={10000}
              rows={6}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.3)",
                color: "rgba(243,244,246,.92)", fontSize: 13, lineHeight: 1.6,
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                resize: "vertical", marginBottom: 10,
              }}
            />
            <input
              value={tagsInput} onChange={e => setTagsInput(e.target.value)}
              placeholder="Tags (comma separated, max 8)"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8,
                border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.3)",
                color: "rgba(243,244,246,.92)", fontSize: 12,
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                marginBottom: 10,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {embedded && sections.length > 0 ? (
                  <select
                    value={postSection}
                    onChange={e => setPostSection(e.target.value)}
                    style={{
                      padding: "6px 10px", borderRadius: 6,
                      background: "rgba(0,0,0,.4)", color: "rgba(243,244,246,.92)",
                      border: "1px solid rgba(255,255,255,.1)", fontSize: 11,
                      fontFamily: "inherit", outline: "none",
                    }}
                  >
                    <option value="">No section</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>
                        {(s.icon ? s.icon + " " : "") + s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => (
                      <button key={id} onClick={() => setPostCat(id)} style={{
                        padding: "4px 10px", borderRadius: 6, border: `1px solid ${postCat === id ? cfg.color + "55" : "rgba(255,255,255,.06)"}`,
                        background: postCat === id ? cfg.bg : "transparent",
                        color: postCat === id ? cfg.color : "rgba(255,255,255,.3)",
                        fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      }}>{cfg.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setComposing(false)} style={{
                  padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)",
                  background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.5)",
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}>Cancel</button>
                <button onClick={handleSubmit} disabled={submitting || !title.trim() || !body.trim()} style={{
                  padding: "7px 18px", borderRadius: 8, border: "1px solid rgba(124,58,237,.4)",
                  background: "rgba(124,58,237,.3)", color: "#fff",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  opacity: submitting || !title.trim() || !body.trim() ? 0.4 : 1,
                }}>{submitting ? "Posting..." : "Post"}</button>
              </div>
            </div>
          </div>
        )}

        {searchActive ? (
          <SearchResultsView
            results={searchResults}
            loading={searching}
            query={searchQ}
            onPostClick={(id) => router.push(`/forum/${id}`)}
            sections={sections}
          />
        ) : loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ height: 72, borderRadius: 10, background: "rgba(255,255,255,.03)", animation: `shimmer 1.5s ease-in-out ${i * 0.1}s infinite` }} />
            ))}
            <style>{`@keyframes shimmer{0%,100%{opacity:0.3}50%{opacity:0.6}}`}</style>
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 20px" }}>
            <div style={{ fontSize: 26, marginBottom: 10, opacity: 0.35 }}>&#9998;</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(243,244,246,.75)" }}>The board's empty.</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "rgba(148,163,184,.55)" }}>Post the first thread. Someone will pile in.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {posts.map(post => {
              const cat = CATEGORY_CONFIG[post.category];
              const tierColor = TIER_COLORS[post.author?.tier || "INNOCENT"] || "#94a3b8";
              const aColor = post.author?.avatarColor || avatarBg(post.authorName);
              const sec = post.sectionId ? sections.find(s => s.id === post.sectionId) : null;
              const tagList: string[] = Array.isArray(post.tags) ? post.tags.filter((t: any) => typeof t === "string") : [];
              return (
                <div
                  key={post.id}
                  style={{
                    display: "flex", gap: 10, padding: "12px 14px",
                    borderRadius: 10, background: "rgba(255,255,255,.025)",
                    border: `1px solid ${post.pinned ? "rgba(245,158,11,.2)" : "rgba(255,255,255,.06)"}`,
                    cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
                  }}
                  onClick={() => router.push(`/forum/${post.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/forum/${post.id}`); } }}
                  tabIndex={0}
                  role="button"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.025)"; }}
                >
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    flexShrink: 0, width: 36,
                  }}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => e.stopPropagation()}
                  >
                    <button onClick={() => handleVote(post.id, post.myVote === 1 ? 0 : 1)} style={{
                      background: "none", border: "none", cursor: "pointer", padding: 2,
                      color: post.myVote === 1 ? "#a78bfa" : "rgba(255,255,255,.25)",
                      fontSize: 14, lineHeight: 1,
                    }}>&#9650;</button>
                    <span style={{
                      fontSize: 12, fontWeight: 800,
                      color: post.score > 0 ? "#a78bfa" : post.score < 0 ? "#ef4444" : "rgba(255,255,255,.4)",
                    }}>{post.score}</span>
                    <button onClick={() => handleVote(post.id, post.myVote === -1 ? 0 : -1)} style={{
                      background: "none", border: "none", cursor: "pointer", padding: 2,
                      color: post.myVote === -1 ? "#ef4444" : "rgba(255,255,255,.25)",
                      fontSize: 14, lineHeight: 1,
                    }}>&#9660;</button>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                      {post.pinned && <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 800 }}>&#128204; PINNED</span>}
                      {post.locked && <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 800 }}>&#128274; LOCKED</span>}
                      {sec && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                          background: (sec.color ? `${sec.color}22` : "rgba(255,255,255,.06)"),
                          color: sec.color || "rgba(255,255,255,.7)",
                          border: `1px solid ${sec.color ? sec.color + "30" : "rgba(255,255,255,.06)"}`,
                        }}>{sec.icon ? `${sec.icon} ` : ""}{sec.name}</span>
                      )}
                      {!sec && cat && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                          background: cat.bg, color: cat.color, border: `1px solid ${cat.color}30`,
                        }}>{cat.label}</span>
                      )}
                      {tagList.slice(0, 4).map(t => (
                        <span key={t} style={{
                          fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                          background: "rgba(255,255,255,.04)", color: "rgba(167,139,250,.75)",
                          border: "1px solid rgba(167,139,250,.18)",
                        }}>#{t}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>
                      {post.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, opacity: 0.45 }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                        background: post.author?.avatar ? "transparent" : aColor,
                        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 8, fontWeight: 900, color: "#fff",
                      }}>
                        {post.author?.avatar ? (
                          <img src={post.author.avatar} alt={post.authorName + " avatar"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : post.authorName[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{post.authorName}</span>
                      <span style={{ color: tierColor, fontWeight: 700, fontSize: 8 }}>{post.author?.tier}</span>
                      <span>&middot;</span>
                      <span>{timeAgo(post.createdAt)}</span>
                      <span>&middot;</span>
                      <span>{post.commentCount} comment{post.commentCount !== 1 ? "s" : ""}</span>
                      {me && (
                        <button
                          onClick={(e) => { e.stopPropagation(); weeredForumReport({ postId: post.id }); }}
                          title="Report"
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "rgba(148,163,184,.5)", fontSize: 11, marginLeft: "auto",
                            fontFamily: "inherit", padding: "0 4px",
                          }}
                        >&#9873;</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sectionModalOpen && lobbyId && (
        <SectionManageModal
          lobbyId={lobbyId}
          sections={sections}
          editing={editingSection}
          onClose={() => { setSectionModalOpen(false); setEditingSection(null); }}
          onSaved={() => { loadSections(); }}
          onEdit={(s) => setEditingSection(s)}
        />
      )}
    </div>
  );
}

function SectionSidebar({
  sections, activeId, onSelect, canManage, onManage, drawerOpen, onCloseDrawer,
}: {
  sections: Section[];
  activeId: string;
  onSelect: (id: string) => void;
  canManage: boolean;
  onManage: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const inner = (
    <div style={{
      display: "flex", flexDirection: "column",
      gap: 2,
      padding: "12px 8px",
      height: "100%", overflow: "auto",
      scrollbarWidth: "thin",
      scrollbarColor: "rgba(255,255,255,.08) transparent",
    }}>
      <SectionRow active={!activeId} onClick={() => onSelect("")} icon="📋" name="All" count={sections.reduce((sum, s) => sum + s.postCount, 0)} description="All posts in this lobby" />
      {sections.map(s => (
        <SectionRow
          key={s.id}
          active={activeId === s.id}
          onClick={() => onSelect(s.id)}
          icon={s.icon || "•"}
          name={s.name}
          count={s.postCount}
          color={s.color || undefined}
          description={s.description}
          postsOnly={s.postsOnly}
        />
      ))}
      {canManage && (
        <button
          onClick={onManage}
          style={{
            marginTop: 8, padding: "8px 10px", borderRadius: 6,
            background: "rgba(124,58,237,.12)", border: "1px dashed rgba(124,58,237,.4)",
            color: "rgba(167,139,250,.85)", fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}
        >+ Manage sections</button>
      )}
    </div>
  );

  return (
    <>
      <aside className="forum-desktop-sidebar" style={{
        width: 200, flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,.06)",
        background: "rgba(255,255,255,.015)",
      }}>
        {inner}
      </aside>
      {drawerOpen && (
        <div
          onClick={onCloseDrawer}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCloseDrawer(); } }}
          tabIndex={0}
          role="button"
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,.6)",
            display: "flex",
          }}
        >
          <aside
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            style={{
              width: 240, height: "100%",
              background: "#0b0d11",
              borderRight: "1px solid rgba(255,255,255,.08)",
            }}
          >
            {inner}
          </aside>
        </div>
      )}
      <style>{`
        @media (max-width: 720px) {
          .forum-desktop-sidebar { display: none !important; }
          .forum-mobile-only { display: inline-block !important; }
        }
      `}</style>
    </>
  );
}

function SectionRow({
  active, onClick, icon, name, count, color, description, postsOnly,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  name: string;
  count: number;
  color?: string;
  description?: string;
  postsOnly?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={description || ""}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", borderRadius: 6,
        background: active ? "rgba(124,58,237,.18)" : "transparent",
        border: active ? "1px solid rgba(124,58,237,.35)" : "1px solid transparent",
        color: active ? "#fff" : "rgba(255,255,255,.65)",
        cursor: "pointer", fontFamily: "inherit", fontSize: 12,
        textAlign: "left",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span style={{ fontSize: 13, color: color || undefined, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: active ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {name}
        {postsOnly && <span style={{ marginLeft: 4, fontSize: 9, color: "rgba(245,158,11,.7)" }}>&#9474;mod</span>}
      </span>
      <span style={{ fontSize: 10, opacity: 0.5, fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </button>
  );
}

function SearchResultsView({
  results, loading, query, onPostClick, sections,
}: {
  results: SearchResults | null;
  loading: boolean;
  query: string;
  onPostClick: (postId: string) => void;
  sections: Section[];
}) {
  if (loading) return <div style={{ padding: "20px 0", color: "rgba(255,255,255,.5)", fontSize: 12 }}>Searching...</div>;
  if (!results) return null;
  const empty = (results.posts?.length || 0) === 0 && (results.comments?.length || 0) === 0;
  if (empty) return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,.55)" }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>No matches for "{query}"</div>
      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>Try fewer or different words.</div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {results.posts?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.55, letterSpacing: 1, marginBottom: 6 }}>POSTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {results.posts.map((p: any) => {
              const sec = p.sectionId ? sections.find(s => s.id === p.sectionId) : null;
              return (
                <button
                  key={p.id}
                  onClick={() => onPostClick(p.id)}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 8,
                    background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)",
                    color: "inherit", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{p.title}</div>
                  {sec && <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 4 }}>{sec.icon} {sec.name}</div>}
                  <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.4 }}>{p.snippet}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {results.comments?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.55, letterSpacing: 1, marginBottom: 6 }}>COMMENTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {results.comments.map((c: any) => (
              <button
                key={c.id}
                onClick={() => onPostClick(c.postId)}
                style={{
                  textAlign: "left", padding: "10px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)",
                  color: "inherit", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 2 }}>on: {c.postTitle}</div>
                <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>{c.snippet}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionManageModal({
  lobbyId, sections, editing, onClose, onSaved, onEdit,
}: {
  lobbyId: string;
  sections: Section[];
  editing: Section | null;
  onClose: () => void;
  onSaved: () => void;
  onEdit: (s: Section | null) => void;
}) {
  const [slug, setSlug] = useState(editing?.slug || "");
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [color, setColor] = useState(editing?.color || "");
  const [icon, setIcon] = useState(editing?.icon || "");
  const [postsOnly, setPostsOnly] = useState(!!editing?.postsOnly);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSlug(editing?.slug || "");
    setName(editing?.name || "");
    setDescription(editing?.description || "");
    setColor(editing?.color || "");
    setIcon(editing?.icon || "");
    setPostsOnly(!!editing?.postsOnly);
  }, [editing]);

  async function save() {
    if (!name.trim() || !slug.trim()) return;
    setBusy(true);
    const body = { lobbyId, slug: slug.trim(), name: name.trim(), description: description.trim(), color: color || null, icon: icon || null, postsOnly };
    const path = editing ? `/forum/sections/${editing.id}` : `/forum/sections`;
    const method = editing ? "PATCH" : "POST";
    const data = await apiFetch<any>(path, { method, body: JSON.stringify(body) });
    setBusy(false);
    if (data?.ok) {
      onSaved();
      onEdit(null);
      if (!editing) {
        setSlug(""); setName(""); setDescription(""); setColor(""); setIcon(""); setPostsOnly(false);
      }
    }
  }

  async function remove(s: Section, force = false) {
    if (!window.confirm(`Delete section "${s.name}"?${s.postCount > 0 ? `\n\n${s.postCount} post(s) will become uncategorized.` : ""}`)) return;
    setBusy(true);
    const data = await apiFetch<any>(`/forum/sections/${s.id}${force ? "?force=true" : ""}`, { method: "DELETE", silent: true });
    setBusy(false);
    if (data?.ok) { onSaved(); return; }
    if (data?.error?.includes("force")) {
      if (window.confirm(`Section has ${data.postCount} post(s). Delete anyway?`)) remove(s, true);
    }
  }

  async function reorder(s: Section, dir: -1 | 1) {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(x => x.id === s.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    const order = sorted.map((x, i) => {
      if (x.id === s.id) return { id: x.id, order: swapWith.order };
      if (x.id === swapWith.id) return { id: x.id, order: s.order };
      return { id: x.id, order: x.order };
    });
    setBusy(true);
    const data = await apiFetch<any>(`/forum/sections/reorder`, {
      method: "POST", body: JSON.stringify({ lobbyId, order }),
    });
    setBusy(false);
    if (data?.ok) onSaved();
  }

  return (
    <div onClick={onClose} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); } }} tabIndex={0} role="button" style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 560, maxHeight: "85vh",
        background: "#0b0d11", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12,
        padding: 18, overflow: "auto", fontFamily: FONT, color: "rgba(243,244,246,.92)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Manage sections</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(255,255,255,.5)",
            fontSize: 18, cursor: "pointer",
          }}>&times;</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
          {sections.map((s, i) => (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", borderRadius: 6,
              background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
            }}>
              <span style={{ fontSize: 14 }}>{s.icon || "•"}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{s.name}</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{s.postCount} posts</span>
              <button onClick={() => reorder(s, -1)} disabled={i === 0 || busy} style={btnIcon}>&#9650;</button>
              <button onClick={() => reorder(s, 1)} disabled={i === sections.length - 1 || busy} style={btnIcon}>&#9660;</button>
              <button onClick={() => onEdit(s)} style={btnIcon}>&#9998;</button>
              <button onClick={() => remove(s)} style={{ ...btnIcon, color: "#ef4444" }}>&times;</button>
            </div>
          ))}
          {sections.length === 0 && (
            <div style={{ fontSize: 11, opacity: 0.5, padding: "12px 0" }}>No sections yet. Create one below.</div>
          )}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, opacity: 0.6, marginBottom: 8 }}>
            {editing ? `EDIT: ${editing.name}` : "NEW SECTION"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" style={inputStyle} />
            <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="slug-like-this" style={inputStyle} />
            <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="Icon (emoji)" style={inputStyle} />
            <input value={color} onChange={e => setColor(e.target.value)} placeholder="#hexcolor" style={inputStyle} />
          </div>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" style={{ ...inputStyle, marginTop: 8, width: "100%", boxSizing: "border-box" }} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, opacity: 0.75 }}>
            <input type="checkbox" checked={postsOnly} onChange={e => setPostsOnly(e.target.checked)} />
            Mods-only posting
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            {editing && (
              <button onClick={() => onEdit(null)} style={{
                padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)",
                background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.5)",
                fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}>New</button>
            )}
            <button onClick={save} disabled={busy || !name.trim() || !slug.trim()} style={{
              padding: "7px 18px", borderRadius: 8, border: "1px solid rgba(124,58,237,.4)",
              background: "rgba(124,58,237,.3)", color: "#fff",
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              opacity: busy || !name.trim() || !slug.trim() ? 0.4 : 1,
            }}>{editing ? "Save" : "Create"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 6,
  border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.3)",
  color: "rgba(243,244,246,.92)", fontSize: 12,
  outline: "none", fontFamily: "inherit",
};

const btnIcon: React.CSSProperties = {
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.06)",
  color: "rgba(255,255,255,.65)",
  cursor: "pointer",
  padding: "3px 7px",
  fontSize: 10,
  borderRadius: 4,
  fontFamily: "inherit",
};
