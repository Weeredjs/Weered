"use client";

import * as React from "react";

type Thread = { id: string; title: string; preview: string; unread?: number; lastTs: string };
type Msg = { id: string; author: string; text: string; ts: string };

function nowTs(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

export default function DockSheet(props: { payload?: any; onClose?: () => void }) {
  const threads = React.useMemo<Thread[]>(
    () => [
      { id: "dm:alice", title: "Alice", preview: "You: yep sounds good", unread: 2, lastTs: "10:12" },
      { id: "dm:bob", title: "Bob", preview: "Bob: lol", unread: 0, lastTs: "09:48" },
      { id: "team:weered", title: "Weered Team", preview: "Room tabs are live", unread: 5, lastTs: "10:01" },
    ],
    []
  );

  const [activeId, setActiveId] = React.useState<string>(threads[0]?.id ?? "dm:alice");
  const [draftByThread, setDraftByThread] = React.useState<Record<string,string>>({});

  const draft = draftByThread[activeId] ?? "";

  const messages = React.useMemo<Msg[]>(
    () => [
      { id: "m1", author: "Alice", text: "Dock looks clean. Next: wire to WS.", ts: "10:12" },
      { id: "m2", author: "You", text: "Yep — UI-first. No regressions.", ts: "10:13" },
      { id: "m3", author: "Alice", text: "Perfect.", ts: "10:14" },
    ],
    [activeId]
  );

  const listRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    // snap to bottom when switching threads
    requestAnimationFrame(() => {
      if (!listRef.current) return;
      listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, [activeId]);

  const setDraft = React.useCallback((v: string) => {
    setDraftByThread((cur) => ({ ...cur, [activeId]: v }));
  }, [activeId]);

  const send = React.useCallback(() => {
    const v = draft.trim();
    if (!v) return;
    // UI-only: clear current draft; later wire to WS + optimistic append
    setDraft("");
  }, [draft, setDraft]);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", minHeight: 560 }}>
      {/* Left: thread list */}
      <div
        style={{
          width: 300,
          borderRight: "1px solid rgba(255,255,255,.08)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap: 10 }}>
          <div style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.75 }}>
            Messages
          </div>
          <button
            onClick={() => {}}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(255,255,255,.04)",
              padding: "6px 10px",
              cursor: "pointer",
              color: "rgba(229,231,235,.95)",
              fontWeight: 900
            }}
            title="New DM (placeholder)"
          >
            New
          </button>
        </div>

        <input
          placeholder="Search (placeholder)"
          value=""
          readOnly
          style={{
            width: "100%",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.10)",
            background: "rgba(255,255,255,.04)",
            padding: "8px 10px",
            outline: "none",
            color: "rgba(229,231,235,.95)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 6, overflow: "auto", paddingRight: 2 }}>
          {threads.map((t) => {
            const active = t.id === activeId;
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: "1px solid " + (active ? "rgba(124,58,237,.35)" : "rgba(255,255,255,.08)"),
                  background: active ? "rgba(124,58,237,.14)" : "rgba(255,255,255,.03)",
                  padding: "10px 10px",
                  cursor: "pointer",
                  color: "rgba(229,231,235,.96)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {t.title}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap: 8 }}>
                    <span style={{ fontSize: 11, opacity: .7 }}>{t.lastTs}</span>
                    {!!t.unread && (
                      <span
                        style={{
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(217,70,239,.35)",
                          background: "rgba(217,70,239,.14)",
                          color: "rgba(229,231,235,.95)",
                        }}
                      >
                        {t.unread}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.78,
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {t.preview}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", fontSize: 12, opacity: 0.7 }}>
          UI-only • WS hookup later
        </div>
      </div>

      {/* Right: thread */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 950 }}>{activeId}</div>
          <button
            onClick={() => props.onClose?.()}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(255,255,255,.04)",
              padding: "8px 10px",
              cursor: "pointer",
              color: "rgba(229,231,235,.95)",
            }}
            title="Close"
          >
            Close
          </button>
        </div>

        <div
          ref={listRef}
          style={{
            flex: 1,
            overflow: "auto",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.map((m) => (
            <div key={m.id} style={{ alignSelf: m.author === "You" ? "flex-end" : "flex-start", maxWidth: "78%" }}>
              <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 4 }}>
                {m.author} · {m.ts}
              </div>
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: m.author === "You" ? "rgba(124,58,237,.16)" : "rgba(255,255,255,.04)",
                  padding: "10px 12px",
                  lineHeight: 1.35,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", gap: 10 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message… (Enter sends, Shift+Enter newline)"
            style={{
              flex: 1,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(255,255,255,.04)",
              padding: "10px 12px",
              outline: "none",
              color: "rgba(229,231,235,.95)",
              resize: "none",
              height: 44,
              lineHeight: 1.25,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(124,58,237,.35)",
              background: "rgba(124,58,237,.18)",
              padding: "10px 14px",
              cursor: "pointer",
              color: "rgba(229,231,235,.95)",
              fontWeight: 950,
            }}
            title={"Send (" + nowTs() + ")"}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}