"use client";

import React from "react";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered } from "./WeeredProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#c9a066";

const BIOME_LABEL: Record<string, string> = {
  PLAINS: "Plains", COAST: "Coast", CLIFFS: "Cliffs", SWAMP: "Swamp",
  CAVE: "Cave", MOUNTAIN: "Mountain", ISLAND: "Island",
};
const TYPE_LABEL: Record<string, string> = {
  SHIP: "Ship", DOCK: "Dock", FORTRESS: "Fortress", TAVERN: "Tavern",
  HIDEOUT: "Hideout", OUTPOST: "Outpost", BRIDGE: "Bridge", MISC: "Misc",
};

/**
 * Full-bleed build detail. Image carousel left, metadata + voting +
 * comments right. ESC to close, arrow keys to navigate carousel.
 */
export default function WindroseBuildDetail({
  slug,
  onClose,
  onDeleted,
}: {
  slug: string;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { openSheet } = useOverlay();
  const w: any = useWeered();
  const me = w?.me;
  const [build, setBuild] = React.useState<any>(null);
  const [myVote, setMyVote] = React.useState(0);
  const [mySave, setMySave] = React.useState(false);
  const [comments, setComments] = React.useState<any[]>([]);
  const [commentBody, setCommentBody] = React.useState("");
  const [commentSubmitting, setCommentSubmitting] = React.useState(false);
  const [imgIdx, setImgIdx] = React.useState(0);
  const [shareCopied, setShareCopied] = React.useState(false);
  const [showReport, setShowReport] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [voteAnimating, setVoteAnimating] = React.useState(0);

  // Fetch build
  React.useEffect(() => {
    let alive = true;
    const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
    fetch(`${API}/windrose/builds/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    })
      .then(r => r.json())
      .then(j => { if (alive && j?.ok) { setBuild(j.build); setMyVote(j.myVote || 0); setMySave(!!j.mySave); } });
    fetch(`${API}/windrose/builds/${encodeURIComponent(slug)}/comments`)
      .then(r => r.json())
      .then(j => { if (alive && j?.ok) setComments(j.comments || []); });
    return () => { alive = false; };
  }, [slug]);

  const images: any[] = Array.isArray(build?.images) ? build.images : [];
  const current = images[imgIdx] || null;

  // Keyboard nav
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setImgIdx(i => Math.max(0, i - 1));
      else if (e.key === "ArrowRight") setImgIdx(i => Math.min(images.length - 1, i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  async function vote(value: 1 | -1) {
    const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
    if (!tok) return;
    const newValue = myVote === value ? 0 : value;
    // Optimistic
    const prevVote = myVote;
    setMyVote(newValue);
    setVoteAnimating(newValue || prevVote);
    setTimeout(() => setVoteAnimating(0), 400);
    try {
      const r = await fetch(`${API}/windrose/builds/${encodeURIComponent(slug)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ value: newValue }),
      });
      const j = await r.json();
      if (j?.ok) {
        setBuild((b: any) => b ? { ...b, upvotes: j.upvotes, downvotes: j.downvotes } : b);
      } else {
        setMyVote(prevVote); // rollback
      }
    } catch {
      setMyVote(prevVote);
    }
  }

  async function toggleSave() {
    const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
    if (!tok) return;
    setMySave(prev => !prev);
    try {
      const r = await fetch(`${API}/windrose/builds/${encodeURIComponent(slug)}/save`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}` },
      });
      const j = await r.json();
      if (j?.ok) {
        setMySave(j.saved);
        setBuild((b: any) => b ? { ...b, saveCount: j.saveCount } : b);
      }
    } catch {}
  }

  async function postComment() {
    if (!commentBody.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
      if (!tok) return;
      const r = await fetch(`${API}/windrose/builds/${encodeURIComponent(slug)}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      const j = await r.json();
      if (j?.ok) {
        setComments(prev => [j.comment, ...prev]);
        setCommentBody("");
      }
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/windrose/build/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch {}
  }

  async function deleteBuild() {
    const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
    if (!tok) return;
    const r = await fetch(`${API}/windrose/builds/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tok}` },
    });
    const j = await r.json();
    if (j?.ok) {
      onDeleted?.();
      onClose();
    }
  }

  if (!build) {
    return (
      <Backdrop onClose={onClose}>
        <div style={{ padding: 30, color: "rgba(228,212,176,.6)" }}>Loading log…</div>
      </Backdrop>
    );
  }

  const isAuthor = me?.id && me.id === build.author.id;
  const score = (build.upvotes || 0) - (build.downvotes || 0);

  return (
    <Backdrop onClose={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(1240px, 100%)",
          maxHeight: "92vh",
          background: "linear-gradient(180deg, rgba(28,22,12,.97), rgba(14,10,6,.99))",
          border: "2px solid rgba(232,196,138,.55)",
          borderRadius: 6,
          boxShadow: "0 0 0 1px rgba(0,0,0,.5), 0 30px 80px rgba(0,0,0,.7), 0 0 30px rgba(232,196,138,.15)",
          color: "rgba(228,212,176,.92)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 1fr)",
          overflow: "hidden",
          fontFamily: "inherit",
        }}
      >
        {/* LEFT — image carousel */}
        <div style={{
          position: "relative",
          background: build.primaryColor || "#0a0804",
          minHeight: 360,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {current && (
            <img
              src={current.url}
              alt={build.title}
              style={{
                width: "100%", height: "100%",
                maxHeight: "92vh",
                objectFit: "contain",
                display: "block",
              }}
            />
          )}
          {images.length > 1 && (
            <>
              {imgIdx > 0 && (
                <button
                  onClick={() => setImgIdx(i => Math.max(0, i - 1))}
                  style={navBtnStyle("left")}
                  aria-label="Previous image"
                >‹</button>
              )}
              {imgIdx < images.length - 1 && (
                <button
                  onClick={() => setImgIdx(i => Math.min(images.length - 1, i + 1))}
                  style={navBtnStyle("right")}
                  aria-label="Next image"
                >›</button>
              )}
              <div style={{
                position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
                display: "flex", gap: 4,
                padding: "4px 8px",
                background: "rgba(0,0,0,.5)",
                borderRadius: 999,
                border: "1px solid rgba(232,196,138,.35)",
              }}>
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    style={{
                      width: 6, height: 6, borderRadius: 3,
                      background: i === imgIdx ? "#e8c48a" : "rgba(228,212,176,.35)",
                      border: "none", padding: 0, cursor: "pointer",
                      transition: "background .12s",
                    }}
                  />
                ))}
              </div>
            </>
          )}
          {build.featured && (
            <div style={{
              position: "absolute", top: 12, left: 12,
              padding: "5px 10px",
              background: "rgba(185,28,28,.92)",
              border: "1px solid rgba(232,196,138,.85)",
              color: "rgba(232,196,138,.95)",
              fontSize: 9, fontWeight: 800, letterSpacing: "1.6px",
              textTransform: "uppercase",
              borderRadius: 2,
              boxShadow: "0 4px 12px rgba(0,0,0,.5)",
            }}>★ Captain's Pick</div>
          )}
          <button onClick={onClose} style={{ ...navBtnStyle("right"), top: 12, right: 12, bottom: "auto", transform: "none", width: 36, height: 36, fontSize: 18 }}>✕</button>
        </div>

        {/* RIGHT — meta + voting + comments */}
        <div style={{ overflow: "auto", padding: 18, display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
          <div style={{
            fontFamily: "var(--font-pirata, 'Pirata One'), serif",
            fontSize: 28, lineHeight: 1.1,
            color: "#e8c48a",
            letterSpacing: 0.5,
            marginBottom: 6,
          }}>{build.title}</div>

          {/* Author */}
          <button
            type="button"
            onClick={() => openSheet("profile", { userId: build.author.id })}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 0",
              background: "none", border: "none",
              cursor: "pointer", color: "inherit", textAlign: "left",
              fontFamily: "inherit",
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 999, flexShrink: 0,
              background: build.author.avatar ? "rgba(255,255,255,.08)" : (build.author.avatarColor || "rgba(201,160,102,.4)"),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: "#fff",
              overflow: "hidden",
              border: "1.5px solid rgba(201,160,102,.55)",
            }}>
              {build.author.avatar
                ? <img src={build.author.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (build.author.name || "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(228,212,176,.95)" }}>{build.author.name}</div>
              <div style={{ fontSize: 10, color: "rgba(228,212,176,.5)", letterSpacing: 0.4 }}>
                Filed {new Date(build.createdAt).toLocaleDateString()}
              </div>
            </div>
          </button>

          {/* Badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10, marginBottom: 14 }}>
            {build.biome && <Badge>{BIOME_LABEL[build.biome] || build.biome}</Badge>}
            {build.buildType && <Badge>{TYPE_LABEL[build.buildType] || build.buildType}</Badge>}
            {build.shipClass && <Badge>{build.shipClass}</Badge>}
            {build.difficulty && <Badge>{build.difficulty}</Badge>}
            {build.partsCount ? <Badge>{build.partsCount.toLocaleString()} parts</Badge> : null}
            {build.inGameLocation && <Badge muted>{build.inGameLocation}</Badge>}
          </div>

          {build.description && (
            <div style={{
              fontSize: 13, lineHeight: 1.55,
              color: "rgba(228,212,176,.85)",
              padding: "10px 12px",
              background: "rgba(20,16,8,.6)",
              border: "1px solid rgba(201,160,102,.18)",
              borderRadius: 4,
              marginBottom: 14,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>{build.description}</div>
          )}

          {build.tags && build.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
              {build.tags.map((t: string, i: number) => (
                <span key={i} style={{
                  padding: "2px 7px",
                  background: "rgba(201,160,102,.12)",
                  border: "1px solid rgba(201,160,102,.28)",
                  borderRadius: 999,
                  fontSize: 10, color: "rgba(228,212,176,.75)",
                }}>#{t}</span>
              ))}
            </div>
          )}

          {/* Vote + save + share row */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "stretch" }}>
            <VoteBtn
              direction="up" active={myVote === 1}
              onClick={() => vote(1)}
              animating={voteAnimating === 1}
            />
            <div style={{
              flex: 1, minWidth: 0,
              display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
              background: "rgba(20,16,8,.6)",
              border: "1px solid rgba(201,160,102,.25)",
              borderRadius: 4,
              padding: "6px 0",
            }}>
              <div style={{
                fontSize: 22, fontWeight: 900,
                color: score > 0 ? "#4ade80" : score < 0 ? "#f87171" : "rgba(228,212,176,.6)",
                lineHeight: 1,
              }}>{score >= 0 ? "+" : ""}{score}</div>
              <div style={{ fontSize: 9, opacity: 0.55, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>
                {build.views || 0} views · {build.saveCount || 0} saved
              </div>
            </div>
            <VoteBtn
              direction="down" active={myVote === -1}
              onClick={() => vote(-1)}
              animating={voteAnimating === -1}
            />
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <SmallBtn onClick={toggleSave} active={mySave}>
              {mySave ? "✓ Saved" : "Save"}
            </SmallBtn>
            <SmallBtn onClick={copyShareLink}>{shareCopied ? "✓ Copied" : "Share"}</SmallBtn>
            {!isAuthor && (
              <SmallBtn onClick={() => setShowReport(true)} danger>Report</SmallBtn>
            )}
            {isAuthor && (
              <SmallBtn onClick={() => setConfirmDelete(true)} danger>Delete</SmallBtn>
            )}
          </div>

          {/* Comments */}
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "1.4px",
            color: "rgba(232,196,138,.7)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}>Talk · {comments.length}</div>

          {me?.id ? (
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input
                value={commentBody}
                onChange={e => setCommentBody(e.target.value.slice(0, 500))}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                placeholder="Add a comment…"
                style={{
                  flex: 1, padding: "8px 10px",
                  background: "rgba(10,8,4,.6)",
                  border: "1px solid rgba(201,160,102,.3)",
                  color: "rgba(228,212,176,.95)",
                  borderRadius: 3, fontSize: 12, outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={postComment}
                disabled={!commentBody.trim() || commentSubmitting}
                style={{
                  padding: "0 14px",
                  background: commentBody.trim() && !commentSubmitting ? `${ACCENT}28` : "rgba(201,160,102,.1)",
                  border: `1px solid ${commentBody.trim() && !commentSubmitting ? ACCENT : "rgba(201,160,102,.25)"}`,
                  color: commentBody.trim() && !commentSubmitting ? "#e8c48a" : "rgba(228,212,176,.4)",
                  borderRadius: 3, fontSize: 11, fontWeight: 700,
                  cursor: commentBody.trim() && !commentSubmitting ? "pointer" : "default",
                  fontFamily: "inherit",
                }}
              >Post</button>
            </div>
          ) : (
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12 }}>Sign in to comment.</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {comments.length === 0 ? (
              <div style={{ fontSize: 11, opacity: 0.45, padding: "8px 0" }}>No comments yet. Be the first.</div>
            ) : comments.map(c => (
              <div key={c.id} style={{
                display: "flex", gap: 8,
                padding: "8px 10px",
                background: "rgba(20,16,8,.5)",
                border: "1px solid rgba(201,160,102,.12)",
                borderRadius: 3,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 999, flexShrink: 0,
                  background: c.user?.avatar ? "rgba(255,255,255,.08)" : (c.user?.avatarColor || "rgba(201,160,102,.35)"),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 800, color: "#fff",
                  overflow: "hidden",
                }}>
                  {c.user?.avatar ? <img src={c.user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (c.user?.name || "?").slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(228,212,176,.85)" }}>{c.user?.name || "—"}</span>
                    <span style={{ fontSize: 9, opacity: 0.4 }}>{relTime(c.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(228,212,176,.85)", lineHeight: 1.4, wordBreak: "break-word" }}>{c.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Report dialog */}
      {showReport && (
        <ReportDialog
          slug={slug}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this build?"
          body="This is permanent. Comments and votes go with it."
          onConfirm={deleteBuild}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(8,5,2,.82)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >{children}</div>
  );
}

function Badge({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span style={{
      padding: "3px 8px",
      borderRadius: 3,
      fontSize: 10, fontWeight: 800,
      letterSpacing: "0.6px",
      textTransform: "uppercase",
      background: muted ? "rgba(255,255,255,.05)" : "rgba(201,160,102,.18)",
      border: `1px solid ${muted ? "rgba(255,255,255,.1)" : "rgba(201,160,102,.4)"}`,
      color: muted ? "rgba(228,212,176,.6)" : "#e8c48a",
    }}>{children}</span>
  );
}

function VoteBtn({ direction, active, onClick, animating }: { direction: "up" | "down"; active: boolean; onClick: () => void; animating: boolean }) {
  const isUp = direction === "up";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 56, height: 64,
        background: active ? (isUp ? "rgba(74,222,128,.18)" : "rgba(248,113,113,.18)") : "rgba(20,16,8,.6)",
        border: `1.5px solid ${active ? (isUp ? "rgba(74,222,128,.6)" : "rgba(248,113,113,.6)") : "rgba(201,160,102,.25)"}`,
        borderRadius: 4,
        color: active ? (isUp ? "#4ade80" : "#f87171") : "rgba(228,212,176,.65)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22,
        fontFamily: "inherit",
        transition: "transform .15s, background .15s",
        transform: animating ? "scale(1.18)" : "scale(1)",
      }}
    >
      {isUp ? "▲" : "▼"}
    </button>
  );
}

function SmallBtn({ children, onClick, active, danger }: { children: React.ReactNode; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "7px 10px",
        background: danger
          ? "rgba(185,28,28,.12)"
          : active
            ? "rgba(232,196,138,.22)"
            : "rgba(20,16,8,.6)",
        border: `1px solid ${danger ? "rgba(239,68,68,.4)" : active ? "rgba(232,196,138,.6)" : "rgba(201,160,102,.3)"}`,
        color: danger ? "#fca5a5" : active ? "#e8c48a" : "rgba(228,212,176,.85)",
        borderRadius: 3,
        fontSize: 11, fontWeight: 700, letterSpacing: ".5px",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >{children}</button>
  );
}

const REPORT_REASONS = [
  { id: "SPAM",      label: "Spam" },
  { id: "NSFW",      label: "NSFW" },
  { id: "THEFT",     label: "Stolen / repost" },
  { id: "OFFENSIVE", label: "Offensive" },
  { id: "OTHER",     label: "Other" },
];

function ReportDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [reason, setReason] = React.useState("SPAM");
  const [note, setNote] = React.useState("");
  const [done, setDone] = React.useState(false);
  async function submit() {
    const tok = (() => { try { return localStorage.getItem("weered_token") || ""; } catch { return ""; } })();
    if (!tok) return;
    await fetch(`${API}/windrose/builds/${encodeURIComponent(slug)}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ reason, note: note.trim() || undefined }),
    });
    setDone(true);
    setTimeout(onClose, 1200);
  }
  return (
    <Backdrop onClose={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(440px, 100%)", padding: 20,
        background: "linear-gradient(180deg, rgba(28,22,12,.97), rgba(14,10,6,.99))",
        border: "2px solid rgba(232,196,138,.55)", borderRadius: 6,
        color: "rgba(228,212,176,.92)", fontFamily: "inherit",
      }}>
        {done ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 18, color: "#4ade80", marginBottom: 6 }}>Reported</div>
            <div style={{ fontSize: 12, opacity: 0.65 }}>The crew thanks you. Mods will review.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: "#e8c48a" }}>Report this build</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 12 }}>Pick a reason. Add a note if it helps.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
              {REPORT_REASONS.map(r => (
                <label key={r.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", borderRadius: 3,
                  background: reason === r.id ? "rgba(232,196,138,.16)" : "rgba(20,16,8,.5)",
                  border: `1px solid ${reason === r.id ? "rgba(232,196,138,.55)" : "rgba(201,160,102,.18)"}`,
                  cursor: "pointer",
                  fontSize: 12,
                }}>
                  <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 500))}
              placeholder="Optional details…"
              rows={3}
              style={{ width: "100%", padding: "8px 10px", background: "rgba(10,8,4,.6)", border: "1px solid rgba(201,160,102,.3)", color: "rgba(228,212,176,.95)", borderRadius: 3, fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "9px 12px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(228,212,176,.7)", borderRadius: 3, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>Cancel</button>
              <button onClick={submit} style={{ flex: 1, padding: "9px 12px", background: "rgba(185,28,28,.7)", border: "1px solid rgba(239,68,68,.6)", color: "white", borderRadius: 3, cursor: "pointer", fontSize: 12, fontWeight: 800, fontFamily: "inherit" }}>Submit Report</button>
            </div>
          </>
        )}
      </div>
    </Backdrop>
  );
}

function ConfirmDialog({ title, body, onConfirm, onCancel }: { title: string; body: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Backdrop onClose={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(380px, 100%)", padding: 20,
        background: "linear-gradient(180deg, rgba(28,22,12,.97), rgba(14,10,6,.99))",
        border: "2px solid rgba(232,196,138,.55)", borderRadius: 6,
        color: "rgba(228,212,176,.92)", fontFamily: "inherit",
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#e8c48a", marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 14 }}>{body}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "9px 12px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(228,212,176,.7)", borderRadius: 3, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "9px 12px", background: "rgba(185,28,28,.7)", border: "1px solid rgba(239,68,68,.6)", color: "white", borderRadius: 3, cursor: "pointer", fontSize: 12, fontWeight: 800, fontFamily: "inherit" }}>Delete</button>
        </div>
      </div>
    </Backdrop>
  );
}

function navBtnStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%", transform: "translateY(-50%)",
    [side]: 12,
    width: 44, height: 44,
    background: "rgba(0,0,0,.55)",
    border: "1px solid rgba(232,196,138,.4)",
    borderRadius: 4,
    color: "rgba(232,196,138,.95)",
    fontSize: 24, lineHeight: 1,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "inherit",
  } as any;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 30) return d + "d ago";
  return new Date(iso).toLocaleDateString();
}
