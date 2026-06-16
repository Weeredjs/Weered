"use client";
import { useState, useEffect, useCallback } from "react";
import { GlobalRole, ROLE_RANK, S, apiFetch, fmtDate } from "./shared";

export function BoardTab({ myRole }: { myRole: GlobalRole }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    apiFetch("/staff/board")
      .then((j) => {
        setPosts(j.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!body.trim()) return;
    setPosting(true);
    setMsg("");
    const j = await apiFetch("/staff/board", {
      method: "POST",
      body: JSON.stringify({ body: body.trim() }),
    });
    if (j.ok) {
      setBody("");
      load();
    } else setMsg(j.error || "Failed");
    setPosting(false);
  }

  async function togglePin(id: string) {
    await apiFetch(`/staff/board/${id}/pin`, { method: "POST", body: JSON.stringify({}) });
    load();
  }

  async function remove(id: string) {
    await apiFetch(`/staff/board/${id}`, { method: "DELETE" });
    load();
  }

  if (loading)
    return <div style={{ textAlign: "center", padding: 20, opacity: 0.4 }}>Loading board...</div>;

  const canManage = ROLE_RANK[myRole] >= ROLE_RANK["STAFF"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          ...S.card,
          border: "1px solid rgba(124,58,237,.20)",
          background: "rgba(124,58,237,.04)",
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Post a note, task, or update for the team..."
          rows={3}
          style={{ ...S.input, resize: "vertical", minHeight: 60, fontFamily: "inherit" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 10, opacity: 0.3 }}>{body.length}/2000</span>
          <button style={S.btnPri} onClick={submit} disabled={posting || !body.trim()}>
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
        {msg && (
          <div style={{ fontSize: 11, color: "rgba(252,165,165,.8)", marginTop: 4 }}>{msg}</div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {posts.map((p: any) => (
          <div
            key={p.id}
            style={{
              ...S.card,
              borderLeft: p.pinned ? "3px solid rgba(245,158,11,.5)" : "3px solid transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: "rgba(124,58,237,.15)",
                  border: "1px solid rgba(124,58,237,.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {(p.authorName || "?").slice(0, 1).toUpperCase()}
              </div>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{p.authorName}</span>
              {p.pinned && (
                <span
                  style={{
                    fontSize: 9,
                    padding: "1px 5px",
                    borderRadius: 999,
                    background: "rgba(245,158,11,.12)",
                    border: "1px solid rgba(245,158,11,.25)",
                    color: "rgb(253,230,138)",
                  }}
                >
                  PINNED
                </span>
              )}
              <span style={{ fontSize: 10, opacity: 0.3, marginLeft: "auto" }}>
                {fmtDate(p.createdAt)}
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", opacity: 0.85 }}>
              {p.body}
            </div>
            {canManage && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  style={{ ...S.btn, fontSize: 10, padding: "3px 8px" }}
                  onClick={() => togglePin(p.id)}
                >
                  {p.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  style={{ ...S.danger, fontSize: 10, padding: "3px 8px" }}
                  onClick={() => remove(p.id)}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
        {posts.length === 0 && (
          <div style={{ textAlign: "center", padding: 30, opacity: 0.3, fontSize: 13 }}>
            No posts yet. Be the first to post something.
          </div>
        )}
      </div>
    </div>
  );
}
