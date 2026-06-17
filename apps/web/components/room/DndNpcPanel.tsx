"use client";

import React, { useEffect, useRef, useState } from "react";
import { weeredConfirm } from "../../lib/confirm";
import { onActivate } from "@/lib/a11y";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

const NPC_PRESETS = [
  {
    name: "Tavern Keeper",
    portrait: "🍺",
    personality:
      "Warm and gossipy. Knows everyone in town. Speaks with a hearty laugh and offers advice over ale.",
    knowledge:
      "Local rumors, town history, who's been causing trouble, directions to nearby landmarks.",
    secrets:
      "Has a hidden cellar with contraband goods. Knows the location of an old treasure map.",
    greeting: "Welcome, traveler! Pull up a chair — what'll it be?",
    appearance: "A stout, ruddy-faced human with a stained apron and a booming voice.",
  },
  {
    name: "Mysterious Stranger",
    portrait: "🗡️",
    personality:
      "Cloaked and cryptic. Speaks in riddles and half-truths. Knows far more than they should.",
    knowledge: "Ancient prophecies, forgotten lore, the movements of shadowy organizations.",
    secrets:
      "Is a disguised celestial on a reconnaissance mission. Has been watching the party for weeks.",
    greeting: "Ah... I've been expecting someone like you.",
    appearance: "A hooded figure in dark travelling clothes, face obscured by shadow.",
  },
  {
    name: "Merchant",
    portrait: "💰",
    personality: "Shrewd but fair. Loves to haggle and gets excited about rare items.",
    knowledge:
      "Trade routes, item values, exotic goods from distant lands, regional supply and demand.",
    secrets: "Smuggles rare magical components. Has a contact in the thieves' guild.",
    greeting: "Fine wares for fine adventurers! Come, come — let me show you what I've got.",
    appearance: "A well-dressed halfling with rings on every finger and a cart full of goods.",
  },
  {
    name: "Guard Captain",
    portrait: "🛡️",
    personality:
      "Duty-bound and tired. Pragmatic with a dry wit. Respects those who help the town.",
    knowledge: "Local laws, recent crimes, patrol routes, threats, active bounties.",
    secrets: "Guard force is undermanned. Suspects the mayor of corruption but lacks proof.",
    greeting: "State your business. We've had enough trouble around here.",
    appearance: "A weathered half-elf in dented plate armor with a scar across her jaw.",
  },
  {
    name: "Sage",
    portrait: "📚",
    personality: "Brilliant but absent-minded. Goes on tangents about obscure topics.",
    knowledge: "History, arcane theory, monster lore, ancient civilizations, magical artifacts.",
    secrets:
      "Has been researching a dangerous summoning ritual. Knows the true nature of the local curse.",
    greeting: "Oh! Visitors! I was just reading about the most fascinating— ahem. How can I help?",
    appearance: "An elderly gnome with ink-stained fingers, wild white hair, and tiny spectacles.",
  },
];

const PORTRAIT_OPTIONS = [
  "🍺",
  "🗡️",
  "💰",
  "🛡️",
  "📚",
  "🧙",
  "👸",
  "🐉",
  "⚔️",
  "🧝",
  "🧛",
  "🎭",
  "👹",
  "🦹",
  "🧌",
  "🐺",
  "👁️",
  "🏴‍☠️",
  "🦴",
  "🧞",
];

const ACCENT = "#C4A55A";

const S = {
  card: {
    borderRadius: 12,
    border: `1px solid ${ACCENT}22`,
    background: `${ACCENT}08`,
    padding: "14px 16px",
  } as React.CSSProperties,
  btn: {
    padding: "6px 14px",
    borderRadius: 8,
    border: `1px solid ${ACCENT}33`,
    background: `${ACCENT}12`,
    color: "rgba(243,244,246,.85)",
    fontSize: 11,
    fontWeight: 700 as const,
    cursor: "pointer",
    transition: "all .15s",
  } as React.CSSProperties,
  btnPri: {
    padding: "8px 20px",
    borderRadius: 10,
    border: `1px solid ${ACCENT}55`,
    background: `${ACCENT}22`,
    color: "rgba(243,244,246,.95)",
    fontSize: 12,
    fontWeight: 700 as const,
    cursor: "pointer",
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${ACCENT}22`,
    background: "rgba(0,0,0,.3)",
    color: "rgba(243,244,246,.9)",
    fontSize: 12,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${ACCENT}22`,
    background: "rgba(0,0,0,.3)",
    color: "rgba(243,244,246,.9)",
    fontSize: 12,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
    resize: "vertical" as const,
    minHeight: 60,
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    fontWeight: 600 as const,
    color: "rgba(148,163,184,.6)",
    letterSpacing: "0.03em",
  } as React.CSSProperties,
};

interface NpcConfig {
  personality?: string;
  knowledge?: string;
  secrets?: string;
  appearance?: string;
  greeting?: string;
  voice?: { pitch?: number; rate?: number };
}

interface Npc {
  id: string;
  roomId: string;
  name: string;
  portrait: string;
  config: NpcConfig;
  createdBy: string;
}

interface NpcMsg {
  id: string;
  npcId: string;
  userId?: string;
  userName?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

function speak(text: string, pitch = 1, rate = 0.95) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/\*[^*]+\*/g, "").trim();
  if (!clean) return;
  const utt = new SpeechSynthesisUtterance(clean);
  utt.pitch = pitch;
  utt.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") ||
          v.name.includes("Microsoft") ||
          v.name.includes("Daniel") ||
          v.name.includes("Samantha")),
    ) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0];
  if (preferred) utt.voice = preferred;
  window.speechSynthesis.speak(utt);
}

export default function DndNpcPanel({ roomId }: { roomId: string }) {
  const [view, setView] = useState<"gallery" | "chat" | "create">("gallery");
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [messages, setMessages] = useState<NpcMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [loadingNpcs, setLoadingNpcs] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [cName, setCName] = useState("");
  const [cPortrait, setCPortrait] = useState("🧙");
  const [cPersonality, setCPersonality] = useState("");
  const [cKnowledge, setCKnowledge] = useState("");
  const [cSecrets, setCSecrets] = useState("");
  const [cAppearance, setCAppearance] = useState("");
  const [cGreeting, setCGreeting] = useState("");
  const [cPitch, setCPitch] = useState(1.0);
  const [cRate, setCRate] = useState(0.95);
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    loadNpcs();
  }, [roomId]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  function loadNpcs() {
    setLoadingNpcs(true);
    fetch(`${API}/rooms/${encodeURIComponent(roomId)}/npcs`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setNpcs(j.npcs || []);
      })
      .catch(() => {})
      .finally(() => setLoadingNpcs(false));
  }

  function openChat(npc: Npc) {
    setActiveNpc(npc);
    setView("chat");
    setMessages([]);
    fetch(`${API}/rooms/${encodeURIComponent(roomId)}/npcs/${npc.id}/messages`, {
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setMessages(j.messages || []);
        setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 60);
      })
      .catch(() => {});
  }

  async function sendMessage() {
    if (!input.trim() || !activeNpc || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        npcId: activeNpc.id,
        userId: "me",
        userName: "You",
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 60);

    try {
      const res = await fetch(
        `${API}/rooms/${encodeURIComponent(roomId)}/npcs/${activeNpc.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ content: text }),
        },
      );
      const j = await res.json();
      if (j.ok && j.message) {
        setMessages((prev) => [...prev, j.message]);
        if (autoSpeak) {
          const v = activeNpc.config?.voice || {};
          speak(j.message.content, v.pitch ?? 1, v.rate ?? 0.95);
        }
      }
    } catch {}
    setSending(false);
    setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 60);
  }

  async function handleSave() {
    if (!cName.trim()) return;
    setCreating(true);
    const config: NpcConfig = {
      personality: cPersonality,
      knowledge: cKnowledge,
      secrets: cSecrets,
      appearance: cAppearance,
      greeting: cGreeting,
      voice: { pitch: cPitch, rate: cRate },
    };

    try {
      const url = editId
        ? `${API}/rooms/${encodeURIComponent(roomId)}/npcs/${editId}`
        : `${API}/rooms/${encodeURIComponent(roomId)}/npcs`;
      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: cName.trim(), portrait: cPortrait, config }),
      });
      const j = await res.json();
      if (j.ok) {
        loadNpcs();
        resetForm();
        setView("gallery");
      }
    } catch {}
    setCreating(false);
  }

  async function handleDelete(npcId: string) {
    await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/npcs/${npcId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).catch(() => {});
    loadNpcs();
    if (activeNpc?.id === npcId) {
      setView("gallery");
      setActiveNpc(null);
    }
  }

  function applyPreset(p: (typeof NPC_PRESETS)[0]) {
    setCName(p.name);
    setCPortrait(p.portrait);
    setCPersonality(p.personality);
    setCKnowledge(p.knowledge);
    setCSecrets(p.secrets);
    setCAppearance(p.appearance);
    setCGreeting(p.greeting);
  }

  function startEdit(npc: Npc) {
    setEditId(npc.id);
    setCName(npc.name);
    setCPortrait(npc.portrait);
    setCPersonality(npc.config.personality || "");
    setCKnowledge(npc.config.knowledge || "");
    setCSecrets(npc.config.secrets || "");
    setCAppearance(npc.config.appearance || "");
    setCGreeting(npc.config.greeting || "");
    setCPitch(npc.config.voice?.pitch ?? 1);
    setCRate(npc.config.voice?.rate ?? 0.95);
    setView("create");
  }

  function resetForm() {
    setEditId(null);
    setCName("");
    setCPortrait("🧙");
    setCPersonality("");
    setCKnowledge("");
    setCSecrets("");
    setCAppearance("");
    setCGreeting("");
    setCPitch(1);
    setCRate(0.95);
  }

  if (view === "gallery") {
    return (
      <div
        style={{
          padding: "14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(243,244,246,.85)" }}>
            NPCs{" "}
            {npcs.length > 0 && (
              <span style={{ fontWeight: 400, color: "rgba(148,163,184,.4)", fontSize: 11 }}>
                ({npcs.length})
              </span>
            )}
          </div>
          <button
            onClick={() => {
              resetForm();
              setView("create");
            }}
            style={S.btn}
          >
            + Summon NPC
          </button>
        </div>

        {loadingNpcs ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "rgba(148,163,184,.4)",
              fontSize: 12,
            }}
          >
            Loading...
          </div>
        ) : npcs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.2 }}>🧙</div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "rgba(255,255,255,.25)",
                marginBottom: 6,
              }}
            >
              No NPCs yet
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,.15)",
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              Summon an AI-driven NPC for your party to interact with.
              <br />
              They remember conversations and stay in character.
            </div>
            <button
              onClick={() => {
                resetForm();
                setView("create");
              }}
              style={S.btnPri}
            >
              + Summon NPC
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            {npcs.map((npc) => (
              <div
                key={npc.id}
                className="weered-npc-card"
                style={{
                  ...S.card,
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all .18s",
                }}
                onClick={() => openChat(npc)}
                onKeyDown={onActivate(() => {
                  openChat(npc);
                })}
                tabIndex={0}
                role="button"
              >
                <div style={{ fontSize: 36, marginBottom: 6 }}>{npc.portrait || "🧙"}</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "rgba(243,244,246,.9)",
                    marginBottom: 4,
                  }}
                >
                  {npc.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(148,163,184,.4)",
                    marginBottom: 10,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {npc.config?.personality?.slice(0, 40) || "A mysterious figure"}...
                </div>
                <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openChat(npc);
                    }}
                    style={{ ...S.btn, fontSize: 10, padding: "4px 10px" }}
                  >
                    Talk
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(npc);
                    }}
                    style={{ ...S.btn, fontSize: 10, padding: "4px 8px", opacity: 0.5 }}
                  >
                    ✎
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await weeredConfirm({
                        title: `Dismiss ${npc.name}?`,
                        body: "The NPC gets removed from the room.",
                        confirmLabel: "Dismiss",
                        destructive: true,
                      });
                      if (ok) handleDelete(npc.id);
                    }}
                    style={{
                      ...S.btn,
                      fontSize: 10,
                      padding: "4px 8px",
                      opacity: 0.5,
                      borderColor: "rgba(239,68,68,.2)",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <style>{`
          .weered-npc-card:hover {
            border-color: ${ACCENT}55 !important;
            background: ${ACCENT}14 !important;
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0,0,0,.3), 0 0 20px ${ACCENT}10;
          }
        `}</style>
      </div>
    );
  }

  if (view === "chat" && activeNpc) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderBottom: `1px solid ${ACCENT}15`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setView("gallery")}
            style={{ ...S.btn, fontSize: 10, padding: "4px 10px" }}
          >
            ←
          </button>
          <span style={{ fontSize: 22 }}>{activeNpc.portrait}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(243,244,246,.9)" }}>
              {activeNpc.name}
            </div>
            {activeNpc.config.appearance && (
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(148,163,184,.35)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {activeNpc.config.appearance}
              </div>
            )}
          </div>
          <button
            onClick={() => setAutoSpeak((v) => !v)}
            title={autoSpeak ? "Auto-speak ON — NPC will speak aloud" : "Auto-speak OFF"}
            style={{
              ...S.btn,
              fontSize: 10,
              padding: "4px 10px",
              background: autoSpeak ? `${ACCENT}30` : `${ACCENT}0a`,
              borderColor: autoSpeak ? `${ACCENT}66` : `${ACCENT}22`,
            }}
          >
            {autoSpeak ? "🔊 Voice" : "🔇 Mute"}
          </button>
        </div>

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {messages.length === 0 && !sending && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "rgba(148,163,184,.3)",
                fontSize: 12,
              }}
            >
              Say something to {activeNpc.name}...
            </div>
          )}
          {messages.map((m) => {
            const isNpc = m.role === "assistant";
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isNpc ? "flex-start" : "flex-end",
                  alignSelf: isNpc ? "flex-start" : "flex-end",
                  maxWidth: "85%",
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 12,
                    background: isNpc ? `${ACCENT}12` : "rgba(255,255,255,.06)",
                    border: `1px solid ${isNpc ? `${ACCENT}22` : "rgba(255,255,255,.08)"}`,
                    fontSize: 13,
                    color: "rgba(243,244,246,.88)",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.content}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 2,
                    padding: "0 4px",
                  }}
                >
                  <span style={{ fontSize: 9, color: "rgba(148,163,184,.25)" }}>
                    {isNpc ? activeNpc.name : m.userName || "You"}
                  </span>
                  {isNpc && (
                    <button
                      onClick={() => {
                        const v = activeNpc.config?.voice || {};
                        speak(m.content, v.pitch ?? 1, v.rate ?? 0.95);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 11,
                        opacity: 0.35,
                        padding: 0,
                      }}
                      title="Speak aloud"
                    >
                      🔊
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {sending && (
            <div style={{ alignSelf: "flex-start", maxWidth: "85%" }}>
              <div
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  background: `${ACCENT}0c`,
                  border: `1px solid ${ACCENT}18`,
                  fontSize: 14,
                  color: `${ACCENT}66`,
                }}
              >
                <span className="weered-npc-thinking">●●●</span>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderTop: `1px solid ${ACCENT}15`,
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={`Speak to ${activeNpc.name}...`}
            maxLength={1000}
            disabled={sending}
            autoFocus
            style={{ ...S.input, flex: 1 }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            style={{
              ...S.btnPri,
              opacity: sending || !input.trim() ? 0.4 : 1,
              flexShrink: 0,
            }}
          >
            {sending ? "..." : "Send"}
          </button>
        </div>

        <style>{`
          @keyframes weered-npc-pulse {
            0%, 80%, 100% { opacity: .2; }
            40% { opacity: 1; }
          }
          .weered-npc-thinking { animation: weered-npc-pulse 1.4s ease-in-out infinite; }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "14px 12px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => {
            resetForm();
            setView("gallery");
          }}
          style={{ ...S.btn, fontSize: 10, padding: "4px 10px" }}
        >
          ←
        </button>
        <span style={{ fontSize: 14, fontWeight: 800, color: "rgba(243,244,246,.85)" }}>
          {editId ? "Edit NPC" : "Summon NPC"}
        </span>
      </div>

      {!editId && (
        <div>
          <div style={S.label}>Quick Presets</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {NPC_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                style={{ ...S.btn, fontSize: 10, padding: "4px 10px" }}
              >
                {p.portrait} {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={S.label}>Name</div>
        <input
          value={cName}
          onChange={(e) => setCName(e.target.value)}
          placeholder="e.g. Gundren Rockseeker"
          maxLength={64}
          style={{ ...S.input, marginTop: 4 }}
        />
      </div>

      <div>
        <div style={S.label}>Portrait</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
          {PORTRAIT_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => setCPortrait(p)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${p === cPortrait ? `${ACCENT}66` : "rgba(255,255,255,.08)"}`,
                background: p === cPortrait ? `${ACCENT}22` : "rgba(0,0,0,.2)",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={S.label}>Personality</div>
        <textarea
          value={cPersonality}
          onChange={(e) => setCPersonality(e.target.value)}
          placeholder="How does this NPC act, speak, and treat strangers?"
          style={{ ...S.textarea, marginTop: 4 }}
        />
      </div>

      <div>
        <div style={S.label}>
          Knowledge <span style={{ fontWeight: 400, opacity: 0.5 }}>— what they know</span>
        </div>
        <textarea
          value={cKnowledge}
          onChange={(e) => setCKnowledge(e.target.value)}
          placeholder="What does this NPC know about? Local rumors, quest info, world lore..."
          style={{ ...S.textarea, marginTop: 4 }}
        />
      </div>

      <div>
        <div style={S.label}>
          Secrets <span style={{ fontWeight: 400, opacity: 0.5 }}>— hard to extract</span>
        </div>
        <textarea
          value={cSecrets}
          onChange={(e) => setCSecrets(e.target.value)}
          placeholder="What does this NPC hide? They'll be evasive — players have to work for it."
          style={{ ...S.textarea, marginTop: 4 }}
        />
      </div>

      <div>
        <div style={S.label}>Appearance</div>
        <input
          value={cAppearance}
          onChange={(e) => setCAppearance(e.target.value)}
          placeholder="What do they look like?"
          maxLength={200}
          style={{ ...S.input, marginTop: 4 }}
        />
      </div>

      <div>
        <div style={S.label}>
          Greeting <span style={{ fontWeight: 400, opacity: 0.5 }}>— first thing they say</span>
        </div>
        <input
          value={cGreeting}
          onChange={(e) => setCGreeting(e.target.value)}
          placeholder="e.g. Welcome, traveler! What brings you to these parts?"
          maxLength={300}
          style={{ ...S.input, marginTop: 4 }}
        />
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div style={S.label}>
            Voice Pitch <span style={{ fontWeight: 400, opacity: 0.5 }}>{cPitch.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.8"
            step="0.1"
            value={cPitch}
            onChange={(e) => setCPitch(Number(e.target.value))}
            style={{ width: "100%", marginTop: 4, accentColor: ACCENT }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 9,
              color: "rgba(148,163,184,.3)",
            }}
          >
            <span>Deep</span>
            <span>High</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={S.label}>
            Voice Speed <span style={{ fontWeight: 400, opacity: 0.5 }}>{cRate.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0.6"
            max="1.4"
            step="0.1"
            value={cRate}
            onChange={(e) => setCRate(Number(e.target.value))}
            style={{ width: "100%", marginTop: 4, accentColor: ACCENT }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 9,
              color: "rgba(148,163,184,.3)",
            }}
          >
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>
        <button
          onClick={() =>
            speak(cGreeting || "Greetings, adventurer. I am but a humble voice.", cPitch, cRate)
          }
          style={{ ...S.btn, fontSize: 10, marginBottom: 12, flexShrink: 0 }}
        >
          🔊 Test
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={creating || !cName.trim()}
        style={{
          ...S.btnPri,
          width: "100%",
          marginTop: 4,
          opacity: creating || !cName.trim() ? 0.4 : 1,
        }}
      >
        {creating ? "Summoning..." : editId ? "Save Changes" : "⚡ Summon NPC"}
      </button>
    </div>
  );
}
