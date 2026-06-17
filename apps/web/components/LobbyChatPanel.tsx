"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOverlay } from "./overlays/OverlayProvider";
import { useWeered, useRoomMsgs, useRoomUsers } from "./WeeredProvider";
import { useUserHover } from "./UserHoverCard";
import EmptyState from "./EmptyState";
import { weeredToast } from "../lib/toast";
import { Icons } from "./chat/Icons";
import { TypingIndicator } from "./chat/TypingIndicator";
import { runSlashCommand } from "./chat/slashCommands";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatMembers } from "./chat/ChatMembers";
import { ChatMessage } from "./chat/ChatMessage";
import { API, ChatAtt, authHeadersChat } from "./chat/chatShared";

// Client-side screen — nsfwjs (lazy; the model ships in the package).
let _nsfwModel: any = null;
async function screenFile(file: File): Promise<{ ok: boolean }> {
  try {
    if (!_nsfwModel) {
      // Loaded from CDN at runtime — the embedded model shards break the
      // webpack minifier if bundled. Function() keeps both TS and webpack
      // from statically analyzing the import.
      const dynImport = new Function("u", "return import(u)") as (u: string) => Promise<any>;
      const nsfwjs = await dynImport("https://esm.sh/nsfwjs@4.3.0");
      _nsfwModel = await (nsfwjs.load ? nsfwjs.load() : nsfwjs.default.load());
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("decode"));
        img.src = url;
      });
      const preds: { className: string; probability: number }[] = await _nsfwModel.classify(img);
      const bad = preds.find(
        (p) => (p.className === "Porn" || p.className === "Hentai") && p.probability > 0.7,
      );
      return { ok: !bad };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return { ok: true }; // screen unavailable — the server re-screens
  }
}

export default function LobbyChatPanel(
  props: {
    title?: string;
    style?: React.CSSProperties;
    roomId?: string;
    embedded?: boolean;
    hideInput?: boolean;
  } = {},
) {
  const { replaceTop } = useOverlay();
  const ctx: any = useWeered();

  const _lobbyMod =
    String(ctx?.currentLobbyId || "").toLowerCase() === "windrose" ? "WINDROSE" : undefined;
  const {
    openHover,
    scheduleClose: hoverClose,
    card: hoverCard,
  } = useUserHover({
    lobbyModuleType: _lobbyMod,
    onViewProfile: (id) => replaceTop("profile", { userId: id }),
    onMessage: (id, name) => {
      try {
        window.dispatchEvent(
          new CustomEvent("weered:dock:open", { detail: { mode: "dm", peer: { id, name } } }),
        );
      } catch {}
    },
  });

  const activeRoomId = String(ctx?.activeRoomId || "");
  const joinedRoomId = String(ctx?.joinedRoomId || "");
  const joinStatus = String(ctx?.joinStatus || "idle");

  const effectiveRoomId = (() => {
    let forced = String(props.roomId || "").trim();
    if (forced.startsWith("room:")) forced = forced.slice(5);
    try {
      forced = decodeURIComponent(forced);
    } catch {}
    return forced || activeRoomId;
  })();

  const metaByRoom = ctx?.metaByRoom || {};
  const adminByRoom = ctx?.adminByRoom || {};
  const statusByRoom = ctx?.statusByRoom || {};

  const msgs = useRoomMsgs(effectiveRoomId);
  const liveRoomUsers = useRoomUsers(effectiveRoomId);
  const meta = metaByRoom[effectiveRoomId] || ctx?.meta || null;
  const admin = adminByRoom[effectiveRoomId] || ctx?.admin || null;
  const effectiveJoinStatus = statusByRoom[effectiveRoomId] || joinStatus;

  const displayRoomName = String(
    meta?.name || meta?.title || meta?.label || admin?.name || "",
  ).trim();

  useEffect(() => {
    let forced = String(props.roomId || "").trim();
    if (!forced) return;
    if (forced.startsWith("room:")) forced = forced.slice(5);
    try {
      forced = decodeURIComponent(forced);
    } catch {}
    forced = String(forced || "").trim();
    if (!forced) return;
    try {
      ctx?.setActiveRoomId?.(forced);
    } catch {}
  }, [props.roomId]);

  const roomLabel = effectiveRoomId;

  const [text, setText] = useState("");
  const [mentionState, setMentionState] = useState<{
    query: string;
    start: number;
    index: number;
  } | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const [readTsSnapshot, setReadTsSnapshot] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!effectiveRoomId) return;
    try {
      const stored = Number(localStorage.getItem(`weered:lastRead:${effectiveRoomId}`)) || 0;
      if (stored === 0) {
        const now = Date.now();
        localStorage.setItem(`weered:lastRead:${effectiveRoomId}`, String(now));
        setReadTsSnapshot(now);
      } else {
        setReadTsSnapshot(stored);
      }
    } catch {
      setReadTsSnapshot(Date.now());
    }
  }, [effectiveRoomId]);
  const markRoomReadNow = useCallback(() => {
    if (!effectiveRoomId) return;
    try {
      localStorage.setItem(`weered:lastRead:${effectiveRoomId}`, String(Date.now()));
    } catch {}
  }, [effectiveRoomId]);
  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2500) return;
    lastTypingSentRef.current = now;
    try {
      (ctx as any)?.sendRaw?.({ type: "chat:typing" });
    } catch {}
  }, [ctx]);

  const mentionLookup = useMemo(() => {
    const out: Record<string, string> = { operator: "The Operator" };
    const roomUsers: any[] = liveRoomUsers;
    for (const u of roomUsers) {
      const key = String(u?.usernameKey || "").toLowerCase();
      if (key && u?.name) out[key] = u.name;
    }
    return out;
  }, [liveRoomUsers, effectiveRoomId]);

  const mentionCandidates = useMemo(() => {
    if (!mentionState) return [] as any[];
    const q = mentionState.query.toLowerCase();
    const roomUsers: any[] = liveRoomUsers;
    const myId = String(ctx?.me?.id || "");
    return roomUsers
      .filter((u) => u?.id && u.id !== myId && u?.name && u.name.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [mentionState, liveRoomUsers, effectiveRoomId, ctx?.me?.id]);

  const acceptMention = useCallback(
    (username: string) => {
      setMentionState((s) => {
        if (!s) return null;
        const before = text.slice(0, s.start);
        const after = text.slice(s.start + 1 + s.query.length);
        const next = `${before}@${username} ${after}`;
        setText(next);
        setTimeout(() => {
          const el = inputRef.current;
          if (el) {
            const pos = before.length + username.length + 2;
            el.focus();
            try {
              el.setSelectionRange(pos, pos);
            } catch {}
          }
        }, 0);
        return null;
      });
    },
    [text],
  );
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCat, setEmojiCat] = useState(0);
  const [gifOpen, setGifOpen] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string>("");

  const [damagePicker, setDamagePicker] = useState<null | {
    amount: number;
    attackName: string;
    sourceMsgId: string;
  }>(null);
  const [pickerTokens, setPickerTokens] = useState<any[]>([]);
  const [pickerCombatants, setPickerCombatants] = useState<any[]>([]);
  useEffect(() => {
    if (!damagePicker || !effectiveRoomId) return;
    let alive = true;
    (async () => {
      try {
        const tok = (ctx as any)?.token;
        const r = await fetch(`${API}/maps/${encodeURIComponent(effectiveRoomId)}`, {
          headers: tok ? { Authorization: `Bearer ${tok}` } : {},
        });
        const j = await r.json();
        if (!alive) return;
        setPickerTokens(Array.isArray(j?.tokens) ? j.tokens : []);
      } catch {
        if (alive) setPickerTokens([]);
      }
      try {
        const cache = (window as any).__weeredInitiative?.[effectiveRoomId];
        setPickerCombatants(Array.isArray(cache?.combatants) ? cache.combatants : []);
      } catch {
        setPickerCombatants([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [damagePicker, effectiveRoomId, ctx]);

  async function applyDamageToToken(tokenId: string) {
    if (!damagePicker) return;
    const t = pickerTokens.find((x) => x.id === tokenId);
    if (!t) return;
    const newHp = Math.max(0, (t.hp || 0) - damagePicker.amount);
    try {
      const tok = (ctx as any)?.token;
      await fetch(`${API}/maps/tokens/${encodeURIComponent(tokenId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({ hp: newHp }),
      });
      if (t.combatantId) {
        try {
          window.dispatchEvent(
            new CustomEvent("weered:dnd:combatant:damage", {
              detail: {
                roomId: effectiveRoomId,
                combatantId: t.combatantId,
                amount: damagePicker.amount,
              },
            }),
          );
        } catch {}
        try {
          (ctx as any)?.sendRaw?.({
            type: "dnd:combatant:damage",
            roomId: effectiveRoomId,
            combatantId: t.combatantId,
            amount: damagePicker.amount,
          });
        } catch {}
      }
      try {
        weeredToast.success(`-${damagePicker.amount} HP → ${t.name}`);
      } catch {}
    } catch {
      try {
        weeredToast.error("Failed to apply damage");
      } catch {}
    }
    setDamagePicker(null);
  }

  function applyDamageToCombatant(combatantId: string) {
    if (!damagePicker) return;
    const c = pickerCombatants.find((x) => x.id === combatantId);
    try {
      window.dispatchEvent(
        new CustomEvent("weered:dnd:combatant:damage", {
          detail: { roomId: effectiveRoomId, combatantId, amount: damagePicker.amount },
        }),
      );
    } catch {}
    try {
      (ctx as any)?.sendRaw?.({
        type: "dnd:combatant:damage",
        roomId: effectiveRoomId,
        combatantId,
        amount: damagePicker.amount,
      });
    } catch {}
    try {
      weeredToast.success(`-${damagePicker.amount} HP → ${c?.name || "combatant"}`);
    } catch {}
    setDamagePicker(null);
  }

  async function rollFollowupDamage(meta: any) {
    const lobbyId = String(ctx?.currentLobbyId || "");
    if (!lobbyId) {
      try {
        weeredToast.error("Not in a lobby");
      } catch {}
      return;
    }
    if (!meta?.damageExpression) return;
    try {
      const tok = (ctx as any)?.token;
      await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/dice/roll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({
          expression: meta.damageExpression,
          intent: "damage",
          attackName: meta.attackName,
          characterId: meta.characterId,
        }),
      });
    } catch {
      try {
        weeredToast.error("Damage roll failed");
      } catch {}
    }
  }
  const [editDraft, setEditDraft] = useState<string>("");
  const [hoveredMsgId, setHoveredMsgId] = useState<string>("");
  const [pickerMsgId, setPickerMsgId] = useState<string>("");
  const [moreMenuMsgId, setMoreMenuMsgId] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    userName: string;
    body: string;
  } | null>(null);

  const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "😢", "😮", "🙌"];

  function toggleReaction(msgId: string, emoji: string) {
    try {
      (ctx as any)?.sendRaw?.({ type: "reaction:toggle", roomId: effectiveRoomId, msgId, emoji });
    } catch {}
    setPickerMsgId("");
  }

  useEffect(() => {
    if (!pickerMsgId) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t && t.closest?.("[data-reaction-ui]")) return;
      setPickerMsgId("");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pickerMsgId]);

  useEffect(() => {
    if (!moreMenuMsgId) return;
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t && t.closest?.("[data-more-menu]")) return;
      setMoreMenuMsgId("");
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreMenuMsgId("");
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreMenuMsgId]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const emojiRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiOpen]);

  const insertEmoji = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  }, []);

  const joinedStrict = Boolean(
    effectiveRoomId &&
    joinedRoomId &&
    effectiveRoomId === joinedRoomId &&
    effectiveJoinStatus === "joined",
  );
  const chatBlocked = props.embedded ? Boolean(meta?.chatDisabled) : Boolean(meta?.locked);
  const joinedByMeta = Boolean((meta || admin) && !chatBlocked && !admin?.locked);
  const canType = (joinedStrict || joinedByMeta) && !chatBlocked;
  const msgTrim = String(text || "").trim();
  const canSend = !!canType && msgTrim.length > 0; // attachment-only send handled via canSendNow below

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [msgs.length, effectiveRoomId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) markRoomReadNow();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [markRoomReadNow, effectiveRoomId]);

  const [pendingAtt, setPendingAtt] = React.useState<ChatAtt | null>(null);
  const [attBusy, setAttBusy] = React.useState(false);
  const [mediaElig, setMediaElig] = React.useState<any>(null);
  const [lockOpen, setLockOpen] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<ChatAtt | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const fetchElig = React.useCallback(async () => {
    try {
      const r = await fetch(`${API}/chat/media/eligibility`, { headers: { ...authHeadersChat() } });
      const j = await r.json();
      if (j?.ok) {
        setMediaElig(j);
        return j;
      }
    } catch {}
    return null;
  }, []);

  const handleFile = React.useCallback(
    async (file: File) => {
      if (!file || !file.type.startsWith("image/")) return;
      if (file.size > 8 * 1024 * 1024) {
        weeredToast.error("Images max 8MB.");
        return;
      }
      setAttBusy(true);
      try {
        const sc = await screenFile(file);
        if (!sc.ok) {
          weeredToast.error("That one didn\u2019t pass the door check.");
          return;
        }
        const dataUrl: string = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result || ""));
          fr.onerror = () => rej(new Error("read"));
          fr.readAsDataURL(file);
        });
        const r = await fetch(`${API}/chat/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeadersChat() },
          body: JSON.stringify({ image: dataUrl, roomId: effectiveRoomId }),
        });
        const j = await r.json();
        if (!j?.ok) {
          if (j?.error === "locked") {
            setMediaElig((e: any) => ({
              ...(e || {}),
              allowed: false,
              notoriety: j.notoriety,
              required: j.required,
            }));
            setLockOpen(true);
          } else if (j?.error === "media_banned")
            weeredToast.error("Media privileges are currently revoked.");
          else if (j?.error === "failed_screen" || j?.error === "blocked_content")
            weeredToast.error("That one didn\u2019t pass the door check.");
          else weeredToast.error("Upload failed.");
          return;
        }
        setPendingAtt(j.attachment as ChatAtt);
        try {
          if (!localStorage.getItem("weered:media:welcomed")) {
            localStorage.setItem("weered:media:welcomed", "1");
            weeredToast.success(
              "The Operator: You\u2019ve earned media privileges. Post like you\u2019ve got something to lose.",
            );
          }
        } catch {}
      } finally {
        setAttBusy(false);
      }
    },
    [effectiveRoomId],
  );

  const onAttachClick = React.useCallback(async () => {
    if (!canType || attBusy) return;
    const e = mediaElig || (await fetchElig());
    if (e && !e.allowed) {
      setLockOpen(true);
      return;
    }
    fileRef.current?.click();
  }, [canType, attBusy, mediaElig, fetchElig]);

  const canSendNow = canSend || (!!canType && !!pendingAtt);

  const onSend = () => {
    if (!canType) return;
    const msg = String(text || "").trim();
    if (!msg && !pendingAtt) return;
    if (msg.startsWith("/")) {
      const handled = runSlashCommand(msg, {
        me: ctx?.me,
        send: (body: string) => {
          try {
            ctx?.sendChat?.(body, replyingTo ? { replyToId: replyingTo.id } : undefined);
          } catch {}
        },
        openGif: (_q?: string) => {
          setGifOpen(true);
          setEmojiOpen(false);
        },
        clear: () => {
          setText("");
          setReplyingTo(null);
        },
        tip: (toUsername: string, amount: number, note: string) => {
          const token = (() => {
            try {
              return localStorage.getItem("weered_token") || "";
            } catch {
              return "";
            }
          })();
          fetch(`${API}/paper/tip`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ toUsername, amount, note }),
          })
            .then((r) => r.json())
            .then((j) => {
              if (j?.ok) {
                const recipientName = j.recipient?.name || toUsername;
                const noteStr = note ? ` — *${note}*` : "";
                try {
                  ctx?.sendChat?.(
                    `💰 tipped **${recipientName}** \`${amount.toLocaleString()} Paper\`${noteStr}`,
                  );
                } catch {}
                weeredToast.success(
                  `Sent ${amount.toLocaleString()} Paper to ${recipientName}. Balance: ${Number(j.balance || 0).toLocaleString()}`,
                );
              } else {
                weeredToast.error(j?.message || j?.error || "Tip failed.");
              }
            })
            .catch(() => weeredToast.error("Tip failed — network error."));
        },
      });
      if (handled) return;
    }
    try {
      ctx?.sendChat?.(msg, {
        ...(replyingTo ? { replyToId: replyingTo.id } : {}),
        ...(pendingAtt ? { attachmentId: pendingAtt.id } : {}),
      });
    } catch {}
    setText("");
    setPendingAtt(null);
    setReplyingTo(null);
    markRoomReadNow();
  };

  return (
    <>
      <div
        className="weered-chat-layout"
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100%",
          minHeight: 0,
          ...props.style,
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }}
        >
          {!props.embedded && (
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-white/90">
                {props.title || "Lobby Chat"}
              </div>
              <div className="text-xs text-white/60 truncate">
                room: {displayRoomName ? `${displayRoomName}  (#${roomLabel})` : roomLabel}
              </div>
            </div>
          )}

          {(() => {
            const pinIds: string[] = Array.isArray(ctx?.pinnedByRoom?.[effectiveRoomId])
              ? ctx.pinnedByRoom[effectiveRoomId]
              : [];
            if (pinIds.length === 0) return null;
            const pinMsgs = pinIds
              .map((pid) => msgs.find((m: any) => String(m?.id || "") === pid))
              .filter(Boolean) as any[];
            if (pinMsgs.length === 0) return null;
            return (
              <details
                style={{
                  marginBottom: 8,
                  background: "linear-gradient(90deg, rgba(217,169,66,.08), rgba(217,169,66,.02))",
                  border: "1px solid rgba(217,169,66,.22)",
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              >
                <summary
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "rgba(232,196,138,.85)",
                    listStyle: "none",
                  }}
                >
                  <Icons.Pin />
                  Pinned · {pinMsgs.length}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 9, opacity: 0.6, letterSpacing: "1px" }}>
                    click to expand
                  </span>
                </summary>
                <div
                  style={{
                    padding: "4px 10px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {pinMsgs.map((pm) => {
                    const pid = String(pm?.id || "");
                    const puname = String(
                      pm?.user?.name || pm?.user?.id || pm?.name || pm?.author || "?",
                    );
                    const pbody = String(pm?.body || pm?.text || "");
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => {
                          try {
                            const el = document.querySelector(
                              `[data-msg-id="${pid}"]`,
                            ) as HTMLElement | null;
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                              const prev = el.style.background;
                              el.style.transition = "background 0.2s";
                              el.style.background = "rgba(232,196,138,0.18)";
                              setTimeout(() => {
                                el.style.background = prev;
                              }, 1200);
                            }
                          } catch {}
                        }}
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 8,
                          padding: "6px 10px",
                          border: "1px solid rgba(217,169,66,.18)",
                          borderRadius: 5,
                          background: "rgba(0,0,0,.15)",
                          color: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                      >
                        <span
                          style={{ color: "rgba(232,196,138,0.9)", fontWeight: 700, flexShrink: 0 }}
                        >
                          {puname}
                        </span>
                        <span
                          style={{
                            opacity: 0.75,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                          }}
                        >
                          {pbody.length > 140 ? `${pbody.slice(0, 140)}…` : pbody}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </details>
            );
          })()}

          <div
            ref={listRef}
            data-weered-msglist
            style={{
              border: props.embedded ? "none" : "1px solid var(--weered-border)",
              borderRadius: props.embedded ? 0 : 14,
              padding: props.embedded ? "0 10px" : 10,
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              background: props.embedded ? "transparent" : "rgba(255,255,255,.02)",
              marginBottom: props.hideInput ? 0 : 10,
            }}
          >
            <style>{`[data-weered-msglist] > div { content-visibility: auto; contain-intrinsic-size: auto 56px; }`}</style>
            {msgs.length === 0 ? (
              <EmptyState title="Crickets." hint="Be the one who drops the first line." />
            ) : (
              msgs.map((m: any, i: number) => (
                <ChatMessage
                  key={`m-${m?.id ?? i}-${i}`}
                  m={m}
                  i={i}
                  msgs={msgs}
                  ctx={ctx}
                  effectiveRoomId={effectiveRoomId}
                  meta={meta}
                  liveRoomUsers={liveRoomUsers}
                  readTsSnapshot={readTsSnapshot}
                  editingMsgId={editingMsgId}
                  setEditingMsgId={setEditingMsgId}
                  editDraft={editDraft}
                  setEditDraft={setEditDraft}
                  hoveredMsgId={hoveredMsgId}
                  setHoveredMsgId={setHoveredMsgId}
                  pickerMsgId={pickerMsgId}
                  setPickerMsgId={setPickerMsgId}
                  moreMenuMsgId={moreMenuMsgId}
                  setMoreMenuMsgId={setMoreMenuMsgId}
                  setReplyingTo={setReplyingTo}
                  setLightbox={setLightbox}
                  setDamagePicker={setDamagePicker}
                  rollFollowupDamage={rollFollowupDamage}
                  toggleReaction={toggleReaction}
                  openHover={openHover}
                  hoverClose={hoverClose}
                  inputRef={inputRef}
                  replaceTop={replaceTop}
                />
              ))
            )}
          </div>

          {lightbox && (
            <div
              onClick={() => setLightbox(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setLightbox(null);
                }
              }}
              tabIndex={0}
              role="button"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 100000,
                background: "rgba(0,0,0,.82)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "zoom-out",
                padding: 24,
              }}
            >
              <img
                src={`${API}${lightbox.url}`}
                alt="attachment"
                style={{
                  maxWidth: "92vw",
                  maxHeight: "86vh",
                  borderRadius: 12,
                  boxShadow: "0 24px 80px rgba(0,0,0,.6)",
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                tabIndex={0}
              />
              <div
                style={{ position: "absolute", bottom: 18, display: "flex", gap: 14, fontSize: 12 }}
              >
                <a
                  href={`${API}${lightbox.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "rgba(216,180,254,.9)", textDecoration: "none" }}
                >
                  Open original
                </a>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    fetch(`${API}/chat/attachments/${lightbox.id}/report`, {
                      method: "POST",
                      headers: { ...authHeadersChat() },
                    })
                      .then(() => weeredToast.success("Reported."))
                      .catch(() => {});
                    setLightbox(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      fetch(`${API}/chat/attachments/${lightbox.id}/report`, {
                        method: "POST",
                        headers: { ...authHeadersChat() },
                      })
                        .then(() => weeredToast.success("Reported."))
                        .catch(() => {});
                      setLightbox(null);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  style={{ color: "rgba(252,165,165,.8)", cursor: "pointer" }}
                >
                  Report
                </span>
              </div>
            </div>
          )}
          <TypingIndicator roomId={effectiveRoomId} meId={ctx?.me?.id} />

          {!props.hideInput && (
            <ChatComposer
              ctx={ctx}
              effectiveRoomId={effectiveRoomId}
              pendingAtt={pendingAtt}
              setPendingAtt={setPendingAtt}
              lockOpen={lockOpen}
              setLockOpen={setLockOpen}
              mediaElig={mediaElig}
              mentionState={mentionState}
              setMentionState={setMentionState}
              mentionCandidates={mentionCandidates}
              acceptMention={acceptMention}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              inputRef={inputRef}
              fileRef={fileRef}
              emojiRef={emojiRef}
              text={text}
              setText={setText}
              broadcastTyping={broadcastTyping}
              handleFile={handleFile}
              canType={canType}
              chatBlocked={chatBlocked}
              onAttachClick={onAttachClick}
              attBusy={attBusy}
              gifOpen={gifOpen}
              setGifOpen={setGifOpen}
              emojiOpen={emojiOpen}
              setEmojiOpen={setEmojiOpen}
              emojiCat={emojiCat}
              setEmojiCat={setEmojiCat}
              insertEmoji={insertEmoji}
              onSend={onSend}
              canSend={canSend}
              canSendNow={canSendNow}
            />
          )}
          {!props.embedded && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => replaceTop("dock")}
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--weered-border)",
                  background: "rgba(255,255,255,.04)",
                  color: "inherit",
                  fontWeight: 800,
                  padding: "8px 10px",
                }}
              >
                Open Dock
              </button>
            </div>
          )}
        </div>
        <ChatMembers
          ctx={ctx}
          liveRoomUsers={liveRoomUsers}
          openHover={openHover}
          hoverClose={hoverClose}
        />
        {damagePicker && (
          <div
            onClick={() => setDamagePicker(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setDamagePicker(null);
              }
            }}
            tabIndex={0}
            role="button"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              tabIndex={0}
              role="button"
              style={{
                background: "#1a1410",
                color: "#f3f4f6",
                border: "1px solid rgba(196,165,90,.4)",
                borderRadius: 8,
                padding: 18,
                minWidth: 360,
                maxWidth: 520,
                maxHeight: "80vh",
                overflow: "auto",
                fontFamily: "var(--font-cormorant), serif",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-pirata), serif",
                    fontSize: 18,
                    color: "#F5D58A",
                  }}
                >
                  Apply {damagePicker.amount} damage
                </div>
                <button
                  onClick={() => setDamagePicker(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#888",
                    cursor: "pointer",
                    fontSize: 18,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
                from {damagePicker.attackName}
              </div>

              {pickerTokens.length === 0 && pickerCombatants.length === 0 && (
                <div style={{ padding: "16px 0", textAlign: "center", opacity: 0.5 }}>
                  No targets — open the Battle Map or Initiative tab in the D&D module.
                </div>
              )}

              {pickerTokens.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "1px",
                      opacity: 0.55,
                      marginBottom: 6,
                    }}
                  >
                    MAP TOKENS
                  </div>
                  {pickerTokens.map((t) => (
                    <button
                      key={`tok-${t.id}`}
                      onClick={() => applyDamageToToken(t.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "8px 10px",
                        marginBottom: 4,
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(255,255,255,.08)",
                        borderRadius: 4,
                        color: "#f3f4f6",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: t.color || "#C4A55A",
                        }}
                      />
                      <span style={{ flex: 1 }}>{t.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>
                        {t.hp}/{t.hpMax} HP
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {pickerCombatants.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "1px",
                      opacity: 0.55,
                      marginBottom: 6,
                    }}
                  >
                    INITIATIVE
                  </div>
                  {pickerCombatants.map((c) => (
                    <button
                      key={`cmb-${c.id}`}
                      onClick={() => applyDamageToCombatant(c.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "8px 10px",
                        marginBottom: 4,
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(255,255,255,.08)",
                        borderRadius: 4,
                        color: "#f3f4f6",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>
                        {c.hpCurrent}/{c.hpMax} HP
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {hoverCard}
    </>
  );
}
