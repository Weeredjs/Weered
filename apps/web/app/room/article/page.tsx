"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const API  = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";
const WS   = process.env.NEXT_PUBLIC_WS_URL   || "wss://ws.weered.ca";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMsg { id: string; userId: string; name: string; body: string; ts: number; }
interface PresenceUser { id: string; name: string; color?: string; }

// ── Voice prompt modal ────────────────────────────────────────────────────────
function VoicePrompt({ roomId, onJoin, onDismiss }: { roomId: string; onJoin: () => void; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 600); }, []);

  return (
    <>
      <style>{`
        @keyframes vpIn { from { opacity:0; transform:translate(-50%,-48%) scale(0.9); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
        @keyframes vpBg { from { opacity:0 } to { opacity:1 } }
      `}</style>
      {visible && (
        <>
          <div onClick={onDismiss} style={{
            position:"fixed", inset:0, zIndex:300,
            background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)",
            animation:"vpBg 0.2s ease forwards",
          }} />
          <div style={{
            position:"fixed", top:"50%", left:"50%", zIndex:301,
            transform:"translate(-50%,-50%)",
            animation:"vpIn 0.28s cubic-bezier(0.22,1,0.36,1) forwards",
            width:"min(360px, 90vw)",
          }}>
            <div style={{
              background:"rgba(10,10,18,0.97)", borderRadius:20,
              border:"1px solid rgba(255,255,255,0.10)",
              boxShadow:"0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
              padding:"28px 24px 24px", textAlign:"center",
            }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🎙️</div>
              <div style={{ fontSize:17, fontWeight:800, color:"rgba(243,244,246,0.97)", marginBottom:6 }}>
                Join Voice?
              </div>
              <div style={{ fontSize:12, color:"rgba(148,163,184,0.5)", lineHeight:1.6, marginBottom:22 }}>
                Others are discussing this article live.<br/>Jump in or just listen.
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={onDismiss} style={{
                  flex:1, padding:"11px", borderRadius:10,
                  border:"1px solid rgba(255,255,255,0.08)",
                  background:"rgba(255,255,255,0.04)",
                  color:"rgba(148,163,184,0.6)", fontSize:13, fontWeight:700, cursor:"pointer",
                }}>
                  Not now
                </button>
                <button onClick={onJoin} style={{
                  flex:1, padding:"11px", borderRadius:10,
                  border:"1px solid rgba(124,58,237,0.45)",
                  background:"linear-gradient(135deg,rgba(124,58,237,0.8),rgba(217,70,239,0.6))",
                  color:"white", fontSize:13, fontWeight:800, cursor:"pointer",
                  boxShadow:"0 4px 20px rgba(124,58,237,0.3)",
                }}>
                  Join Voice
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Chat drawer ───────────────────────────────────────────────────────────────
function ArticleChatDrawer({ roomId, open, onToggle }: { roomId: string; open: boolean; onToggle: () => void }) {
  const [msgs, setMsgs]     = useState<ChatMsg[]>([]);
  const [input, setInput]   = useState("");
  const [user, setUser]     = useState<{ id: string; name: string } | null>(null);
  const wsRef               = useRef<WebSocket | null>(null);
  const bottomRef           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("weered_user") || "{}");
      const t = localStorage.getItem("weered_token");
      if (u?.id) setUser(u);
      const ws = new WebSocket(WS);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", token: t }));
        ws.send(JSON.stringify({ type: "join", roomId }));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "chat" && msg.roomId === roomId) {
            setMsgs(prev => [...prev.slice(-199), { id: msg.id || Date.now().toString(), userId: msg.userId, name: msg.name, body: msg.body, ts: msg.ts || Date.now() }]);
          }
          if (msg.type === "history") {
            setMsgs((msg.messages || []).map((m: any) => ({ id: m.id, userId: m.userId, name: m.name || m.userName, body: m.body, ts: new Date(m.createdAt).getTime() })));
          }
        } catch {}
      };
      return () => ws.close();
    } catch {}
  }, [roomId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  function send() {
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "chat", roomId, body: input.trim() }));
    setInput("");
  }

  return (
    <>
      <style>{`
        @keyframes drawerIn  { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @keyframes drawerOut { from { transform:translateX(0); opacity:1; } to { transform:translateX(100%); opacity:0; } }
        .art-chat-tab {
          position:absolute; right:0; top:50%;
          transform:translateY(-50%);
          writing-mode:vertical-rl; text-orientation:mixed; rotate:180deg;
          padding:14px 7px;
          background:rgba(124,58,237,0.18); border:1px solid rgba(124,58,237,0.30); border-right:none;
          border-radius:10px 0 0 10px;
          color:rgba(167,139,250,0.90); font-size:11px; font-weight:700; letter-spacing:0.12em;
          cursor:pointer; z-index:49; user-select:none; backdrop-filter:blur(8px);
          transition:right 0.38s cubic-bezier(0.22,1,0.36,1), background 0.15s;
        }
        .art-chat-tab:hover { background:rgba(124,58,237,0.30); }
        .art-msg-input {
          flex:1; padding:10px 12px;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);
          border-radius:10px; color:rgba(226,232,240,0.9); font-size:13px; outline:none;
          transition:border-color 0.15s;
        }
        .art-msg-input:focus { border-color:rgba(124,58,237,0.45); }
        .art-send-btn {
          padding:10px 16px; border-radius:10px;
          background:rgba(124,58,237,0.7); border:none;
          color:white; font-size:13px; font-weight:700; cursor:pointer;
          transition:all 0.15s;
        }
        .art-send-btn:hover { background:rgba(124,58,237,0.9); }
      `}</style>

      {/* Tab */}
      <div
        className="art-chat-tab"
        onClick={onToggle}
        style={{ right: open ? "min(320px,85%)" : 0 }}
      >
        CHAT
      </div>

      {/* Drawer */}
      {open && (
        <div style={{
          position:"absolute", top:0, right:0, bottom:0, width:"min(320px,85%)",
          background:"rgba(10,10,18,0.88)", backdropFilter:"blur(18px) saturate(1.4)",
          borderLeft:"1px solid rgba(124,58,237,0.20)",
          borderRadius:"0 0 0 0", zIndex:50,
          display:"flex", flexDirection:"column",
          animation:"drawerIn 0.36s cubic-bezier(0.22,1,0.36,1) forwards",
          boxShadow:"-8px 0 40px rgba(0,0,0,0.5)",
        }}>
          {/* Header */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"12px 14px 10px",
            borderBottom:"1px solid rgba(124,58,237,0.12)", flexShrink:0,
          }}>
            <span style={{ fontSize:11, fontWeight:800, color:"rgba(196,181,253,0.8)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
              Room Chat
            </span>
            <div onClick={onToggle} style={{
              width:24, height:24, borderRadius:6, border:"1px solid rgba(255,255,255,0.08)",
              background:"rgba(255,255,255,0.04)", color:"rgba(148,163,184,0.6)",
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", fontSize:12,
            }}>✕</div>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"10px 12px", display:"flex", flexDirection:"column", gap:8, minHeight:0 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign:"center", color:"rgba(100,116,139,0.35)", fontSize:12, marginTop:40 }}>
                No messages yet — start the discussion
              </div>
            )}
            {msgs.map(m => (
              <div key={m.id} style={{ display:"flex", flexDirection:"column", gap:2 }}>
                <span style={{ fontSize:10, fontWeight:700, color:"rgba(148,163,184,0.5)" }}>{m.name}</span>
                <div style={{
                  padding:"7px 10px", borderRadius:10,
                  background: m.userId === user?.id ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.05)",
                  border: m.userId === user?.id ? "1px solid rgba(124,58,237,0.25)" : "1px solid rgba(255,255,255,0.06)",
                  fontSize:13, color:"rgba(226,232,240,0.88)", lineHeight:1.45,
                  alignSelf: m.userId === user?.id ? "flex-end" : "flex-start",
                  maxWidth:"90%",
                }}>
                  {m.body}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding:"10px 12px", borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", gap:8, flexShrink:0 }}>
            <input
              className="art-msg-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Say something..."
            />
            <button className="art-send-btn" onClick={send}>→</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main article room ─────────────────────────────────────────────────────────
function ArticleRoomInner() {
  const sp          = useSearchParams();
  const router      = useRouter();
  const roomId      = sp?.get("room")    || "";
  const articleUrl  = sp?.get("article") || "";
  const [chatOpen, setChatOpen]         = useState(true);
  const [showVoice, setShowVoice]       = useState(false);
  const [voiceDismissed, setVoiceDismissed] = useState(false);
  const [iframeLoading, setIframeLoading]   = useState(true);
  const [iframeBlocked, setIframeBlocked]   = useState(false);
  const [browserUrl, setBrowserUrl]     = useState(articleUrl);
  const [urlInput, setUrlInput]         = useState(articleUrl);

  // Show voice prompt after 2 seconds
  useEffect(() => {
    if (!voiceDismissed) {
      const t = setTimeout(() => setShowVoice(true), 2000);
      return () => clearTimeout(t);
    }
  }, [voiceDismissed]);

  const domain = (() => { try { return new URL(articleUrl).hostname.replace(/^www\./, ""); } catch { return ""; } })();

  function navigate(url: string) {
    let full = url.trim();
    if (!full.startsWith("http")) full = `https://${full}`;
    setBrowserUrl(full);
    setUrlInput(full);
    setIframeLoading(true);
    setIframeBlocked(false);
  }

  return (
    <>
      <style>{`
        .art-nav-btn {
          width:28px; height:28px; border-radius:6px; flex-shrink:0;
          border:1px solid rgba(255,255,255,0.07); background:rgba(255,255,255,0.04);
          color:rgba(148,163,184,0.6); font-size:13px; cursor:pointer;
          display:flex; align-items:center; justify-content:center; transition:all 0.12s;
        }
        .art-nav-btn:hover { background:rgba(255,255,255,0.09); color:rgba(226,232,240,0.8); }
        .art-url-input {
          flex:1; padding:6px 10px 6px 28px;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);
          border-radius:8px; color:rgba(203,213,225,0.8); font-size:12px; outline:none;
          box-sizing:border-box; font-family:monospace; transition:border-color 0.15s;
        }
        .art-url-input:focus { border-color:rgba(124,58,237,0.4); }
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 32px)", minHeight:0 }}>

        {/* Room header bar */}
        <div style={{
          display:"flex", alignItems:"center", gap:10,
          padding:"8px 16px", flexShrink:0,
          background:"var(--weered-panel)",
          borderBottom:"1px solid var(--weered-border)",
        }}>
          <button onClick={() => router.back()} className="art-nav-btn" title="Back to lobby">←</button>
          <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, minWidth:0 }}>
            <span style={{
              padding:"3px 8px", borderRadius:6,
              background:"rgba(124,58,237,0.15)", border:"1px solid rgba(124,58,237,0.3)",
              fontSize:10, fontWeight:800, color:"rgba(167,139,250,0.85)",
              letterSpacing:"0.06em", whiteSpace:"nowrap",
            }}>ARTICLE ROOM</span>
            <span style={{
              fontSize:13, fontWeight:700, color:"rgba(226,232,240,0.75)",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            }}>{domain}</span>
          </div>
          {/* Voice module button */}
          <button
            onClick={() => setShowVoice(true)}
            style={{
              padding:"5px 12px", borderRadius:8,
              border:"1px solid rgba(34,197,94,0.3)", background:"rgba(34,197,94,0.10)",
              color:"rgba(34,197,94,0.8)", fontSize:11, fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", gap:5,
            }}
          >
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#22C55E", display:"inline-block", boxShadow:"0 0 6px #22C55E" }} />
            Voice
          </button>
        </div>

        {/* Browser area */}
        <div style={{
          flex:1, minHeight:0, position:"relative",
          border:"1px solid var(--weered-border)",
          borderRadius:16, overflow:"hidden",
          margin:"8px 12px 12px",
          background:"var(--weered-panel2)",
          display:"flex", flexDirection:"column",
        }}>
          {/* Browser chrome */}
          <div style={{
            display:"flex", alignItems:"center", gap:8,
            padding:"8px 12px", flexShrink:0,
            background:"rgba(0,0,0,0.3)",
            borderBottom:"1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ position:"relative", flex:1 }}>
              <span style={{
                position:"absolute", left:10, top:"50%", transform:"translateY(-50%)",
                fontSize:11, color:"rgba(100,116,139,0.4)", pointerEvents:"none",
              }}>🔒</span>
              <input
                className="art-url-input"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && navigate(urlInput)}
              />
            </div>
            <button onClick={() => window.open(browserUrl,"_blank")} className="art-nav-btn" title="Open in new tab">↗</button>
            <div style={{
              padding:"3px 8px", borderRadius:6,
              background:"rgba(124,58,237,0.12)", border:"1px solid rgba(124,58,237,0.22)",
              fontSize:9, fontWeight:700, color:"rgba(167,139,250,0.6)",
              letterSpacing:"0.06em", whiteSpace:"nowrap",
            }}>WEERED BROWSER</div>
          </div>

          {/* iframe */}
          <div style={{ flex:1, position:"relative", minHeight:0 }}>
            {iframeLoading && !iframeBlocked && (
              <div style={{
                position:"absolute", inset:0, zIndex:2,
                display:"flex", alignItems:"center", justifyContent:"center",
                background:"rgba(8,8,16,0.85)", backdropFilter:"blur(6px)",
              }}>
                <span style={{ fontSize:12, color:"rgba(148,163,184,0.35)", letterSpacing:"0.06em" }}>
                  Loading article...
                </span>
              </div>
            )}
            {iframeBlocked ? (
              <div style={{
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                height:"100%", gap:14, padding:40,
              }}>
                <div style={{ fontSize:32 }}>🚫</div>
                <div style={{ fontSize:15, fontWeight:800, color:"rgba(243,244,246,0.7)" }}>
                  {domain} blocks embedding
                </div>
                <div style={{ fontSize:12, color:"rgba(148,163,184,0.4)", textAlign:"center", maxWidth:300, lineHeight:1.7 }}>
                  This site prevents embedding. You can still discuss it here — open it in a new tab to read along.
                </div>
                <button
                  onClick={() => window.open(browserUrl,"_blank")}
                  style={{
                    padding:"10px 20px", borderRadius:10, cursor:"pointer",
                    background:"rgba(124,58,237,0.2)", border:"1px solid rgba(124,58,237,0.4)",
                    color:"rgba(167,139,250,0.9)", fontSize:13, fontWeight:700,
                  }}
                >Open in new tab ↗</button>
              </div>
            ) : (
              <iframe
                key={browserUrl}
                src={browserUrl}
                style={{ width:"100%", height:"100%", border:"none", display:"block" }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
                onLoad={() => setIframeLoading(false)}
                onError={() => { setIframeLoading(false); setIframeBlocked(true); }}
                title="Article"
              />
            )}
          </div>

          {/* Chat drawer */}
          <ArticleChatDrawer
            roomId={roomId}
            open={chatOpen}
            onToggle={() => setChatOpen(o => !o)}
          />
        </div>
      </div>

      {/* Voice prompt */}
      {showVoice && !voiceDismissed && (
        <VoicePrompt
          roomId={roomId}
          onJoin={() => { setShowVoice(false); setVoiceDismissed(true); /* TODO: wire LiveKit join */ }}
          onDismiss={() => { setShowVoice(false); setVoiceDismissed(true); }}
        />
      )}
    </>
  );
}

export default function ArticleRoomPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh", background:"#080810" }} />}>
      <ArticleRoomInner />
    </Suspense>
  );
}
