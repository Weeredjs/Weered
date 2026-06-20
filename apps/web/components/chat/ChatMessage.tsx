"use client";
import { type Ctx } from "../WeeredProvider";

import React from "react";
import { avatarBg } from "../../lib/avatarColor";
import { weeredConfirm } from "../../lib/confirm";
import { weeredToast } from "../../lib/toast";
import RoleIcon, { TierIcon } from "../RoleIcon";
import { ChatFlair, CrewFlair } from "./flair";
import { AttachmentBlock, ChatBody } from "./messageRender";
import { Icons } from "./Icons";
import { MoreMenu } from "./MoreMenu";
import { API, ChatAtt, nameStyleFor } from "./chatShared";

type ChatMessageProps = {
  m: any;
  i: number;
  msgs: any[];
  ctx: Ctx;
  effectiveRoomId: string;
  meta: any;
  liveRoomUsers: any[];
  readTsSnapshot: number;
  editingMsgId: string;
  setEditingMsgId: React.Dispatch<React.SetStateAction<string>>;
  editDraft: string;
  setEditDraft: React.Dispatch<React.SetStateAction<string>>;
  hoveredMsgId: string;
  setHoveredMsgId: React.Dispatch<React.SetStateAction<string>>;
  pickerMsgId: string;
  setPickerMsgId: React.Dispatch<React.SetStateAction<string>>;
  moreMenuMsgId: string;
  setMoreMenuMsgId: React.Dispatch<React.SetStateAction<string>>;
  setReplyingTo: React.Dispatch<
    React.SetStateAction<{ id: string; userName: string; body: string } | null>
  >;
  setLightbox: React.Dispatch<React.SetStateAction<ChatAtt | null>>;
  setDamagePicker: React.Dispatch<
    React.SetStateAction<{ amount: number; attackName: string; sourceMsgId: string } | null>
  >;
  rollFollowupDamage: (meta: any) => void;
  toggleReaction: (msgId: string, emoji: string) => void;
  openHover: (id: string, name: string, el: HTMLElement) => void;
  hoverClose: (ms?: number) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  replaceTop: (...args: any[]) => void;
};

export function ChatMessage(props: ChatMessageProps) {
  const {
    m,
    i,
    msgs,
    ctx,
    effectiveRoomId,
    meta,
    liveRoomUsers,
    readTsSnapshot,
    editingMsgId,
    setEditingMsgId,
    editDraft,
    setEditDraft,
    hoveredMsgId,
    setHoveredMsgId,
    pickerMsgId,
    setPickerMsgId,
    moreMenuMsgId,
    setMoreMenuMsgId,
    setReplyingTo,
    setLightbox,
    setDamagePicker,
    rollFollowupDamage,
    toggleReaction,
    openHover,
    hoverClose,
    inputRef,
    replaceTop,
  } = props;

  const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "😢", "😮", "🙌"];

  if (m?.kind === "poker") {
    const pMeta = m?.meta || {};
    const action = String(pMeta.action || "").toLowerCase();
    const amount = Number(pMeta.amount || 0);
    const isAggressive = action === "raise" || action === "bet" || action === "all-in";
    const isFold = action === "fold";
    const accent = isAggressive
      ? "rgba(239,68,68,.85)"
      : isFold
        ? "rgba(148,163,184,.6)"
        : "rgba(196,165,90,.85)";
    const bgTint = isAggressive
      ? "rgba(239,68,68,.06)"
      : isFold
        ? "rgba(148,163,184,.04)"
        : "rgba(196,165,90,.05)";
    const chipBg = isAggressive
      ? "rgba(239,68,68,.18)"
      : isFold
        ? "rgba(148,163,184,.16)"
        : "rgba(196,165,90,.18)";
    const chipFg = isAggressive ? "#ef4444" : isFold ? "#94a3b8" : "#C4A55A";
    const playerName = String(m?.user?.name || "player");
    const verb = action.toUpperCase().replace("-", " ");
    return (
      <div
        key={`poker-${m.id}-${i}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          margin: "4px 0",
          fontSize: 12,
          fontFamily: "monospace",
          borderLeft: `2px solid ${accent}`,
          background: bgTint,
          borderRadius: 4,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "1px",
            opacity: 0.45,
          }}
        >
          POKER
        </span>
        <span style={{ fontWeight: 700, color: "rgba(243,244,246,.85)" }}>{playerName}</span>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.5px",
            background: chipBg,
            color: chipFg,
          }}
        >
          {verb}
        </span>
        {amount > 0 && (
          <span
            style={{
              marginLeft: "auto",
              fontWeight: 800,
              fontSize: 13,
              color: chipFg,
            }}
          >
            ${amount.toLocaleString()}
          </span>
        )}
      </div>
    );
  }
  if (m?.kind === "poker-winner") {
    const wMeta = m?.meta || {};
    const winners: any[] = Array.isArray(wMeta.winners) ? wMeta.winners : [];
    const pot = Number(wMeta.pot || 0);
    const reason = String(wMeta.reason || "showdown");
    const isFold = reason === "fold";
    const accent = "rgba(34,197,94,.9)";
    const bgTint = "linear-gradient(90deg, rgba(34,197,94,.10) 0%, rgba(196,165,90,.06) 100%)";
    return (
      <div
        key={`pokerwin-${m.id}-${i}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          padding: "8px 12px",
          margin: "6px 0",
          fontSize: 12,
          fontFamily: "monospace",
          borderLeft: `3px solid ${accent}`,
          background: bgTint,
          borderRadius: 4,
          boxShadow: "0 0 12px rgba(34,197,94,.15)",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "1px",
            color: "#22c55e",
          }}
        >
          ★ POT WON
        </span>
        {winners.map((w: any, wi: number) => (
          <span key={wi} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 800, color: "rgba(243,244,246,.95)" }}>
              {String(w.userName || "winner")}
            </span>
            <span style={{ fontWeight: 800, color: "#22c55e" }}>
              +${Number(w.amount || 0).toLocaleString()}
            </span>
            {w.hand && !isFold && (
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  background: "rgba(196,165,90,.18)",
                  color: "#C4A55A",
                }}
              >
                {String(w.hand)}
              </span>
            )}
            {wi < winners.length - 1 && <span style={{ color: "rgba(243,244,246,.3)" }}>·</span>}
          </span>
        ))}
        {isFold && (
          <span style={{ fontSize: 10, opacity: 0.6, fontStyle: "italic" }}>(others folded)</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(243,244,246,.5)" }}>
          pot ${pot.toLocaleString()}
        </span>
      </div>
    );
  }
  if (m?.kind === "trade") {
    const tMeta = m?.meta || {};
    const side = String(tMeta.side || "").toUpperCase();
    const isLong = side === "BUY";
    const traderName = String(m?.user?.name || "trader");
    const sym = String(tMeta.symbol || "").replace(/USDT$/, "");
    const qty = Number(tMeta.quantity || 0);
    const px = Number(tMeta.price || 0);
    const notional = qty * px;
    return (
      <div
        key={`trade-${m.id}-${i}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          margin: "4px 0",
          fontSize: 12,
          fontFamily: "monospace",
          borderLeft: `2px solid ${isLong ? "rgba(34,197,94,.6)" : "rgba(239,68,68,.6)"}`,
          background: isLong ? "rgba(34,197,94,.04)" : "rgba(239,68,68,.04)",
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", opacity: 0.4 }}>
          FAKEOUT
        </span>
        <span style={{ fontWeight: 700, color: "rgba(243,244,246,.85)" }}>{traderName}</span>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.5px",
            background: isLong ? "rgba(34,197,94,.18)" : "rgba(239,68,68,.18)",
            color: isLong ? "#22c55e" : "#ef4444",
          }}
        >
          {isLong ? "LONG" : "SHORT"}
        </span>
        <span style={{ color: "rgba(243,244,246,.55)" }}>{sym}</span>
        <span style={{ color: "rgba(243,244,246,.4)" }}>·</span>
        <span style={{ color: "rgba(243,244,246,.6)" }}>
          {qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </span>
        <span style={{ color: "rgba(243,244,246,.4)" }}>@</span>
        <span style={{ color: "rgba(243,244,246,.7)" }}>
          $
          {px >= 1
            ? px.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : px.toFixed(6)}
        </span>
        <span style={{ marginLeft: "auto", color: "rgba(243,244,246,.35)", fontSize: 11 }}>
          ${notional.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
    );
  }
  if (m?.kind === "dice") {
    const dMeta = m?.meta || {};
    const isNat20 = !!dMeta.isNat20;
    const isNat1 = !!dMeta.isNat1;
    const accent = isNat20
      ? "rgba(34,197,94,.85)"
      : isNat1
        ? "rgba(239,68,68,.85)"
        : "rgba(196,165,90,.85)";
    const bgTint = isNat20
      ? "rgba(34,197,94,.06)"
      : isNat1
        ? "rgba(239,68,68,.06)"
        : "rgba(196,165,90,.05)";
    const chipBg = isNat20
      ? "rgba(34,197,94,.18)"
      : isNat1
        ? "rgba(239,68,68,.18)"
        : "rgba(196,165,90,.18)";
    const chipFg = isNat20 ? "#22c55e" : isNat1 ? "#ef4444" : "#C4A55A";
    const rollerName = String(m?.user?.name || "roller");
    const expr = String(dMeta.expression || "");
    const total = Number(dMeta.total || 0);
    const rolls: number[] = Array.isArray(dMeta.rolls) ? dMeta.rolls : [];
    const dropped: number[] = Array.isArray(dMeta.dropped) ? dMeta.dropped : [];
    const modifier = Number(dMeta.modifier || 0);
    const adv = !!dMeta.advantage;
    const dis = !!dMeta.disadvantage;
    const tag = isNat20
      ? "NAT 20"
      : isNat1
        ? "NAT 1"
        : adv
          ? "ADV"
          : dis
            ? "DIS"
            : expr.toUpperCase() || `D${dMeta.sides || ""}`;
    return (
      <div
        key={`dice-${m.id}-${i}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          margin: "4px 0",
          fontSize: 12,
          fontFamily: "monospace",
          borderLeft: `2px solid ${accent}`,
          background: bgTint,
          borderRadius: 4,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "1px",
            opacity: 0.45,
          }}
        >
          DICE TOWER
        </span>
        <span style={{ fontWeight: 700, color: "rgba(243,244,246,.85)" }}>{rollerName}</span>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.5px",
            background: chipBg,
            color: chipFg,
          }}
        >
          {tag}
        </span>
        <span style={{ color: "rgba(243,244,246,.55)" }}>{expr}</span>
        <span style={{ color: "rgba(243,244,246,.4)" }}>·</span>
        <span style={{ color: "rgba(243,244,246,.6)" }}>
          [{rolls.join(",")}]
          {dropped.length > 0 && (
            <span style={{ textDecoration: "line-through", opacity: 0.4, marginLeft: 4 }}>
              {dropped.join(",")}
            </span>
          )}
          {modifier !== 0 && <span> {modifier > 0 ? `+${modifier}` : modifier}</span>}
        </span>
        <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 14, color: chipFg }}>
          {total}
        </span>
        {dMeta.intent === "attack" && dMeta.damageExpression && (
          <button
            onClick={() => rollFollowupDamage(dMeta)}
            style={{
              marginLeft: 8,
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              background: "rgba(239,68,68,.18)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,.4)",
              borderRadius: 3,
              cursor: "pointer",
            }}
            title={`Roll ${dMeta.damageExpression}`}
          >
            Damage · {String(dMeta.damageExpression)}
          </button>
        )}
        {dMeta.intent === "damage" && (
          <button
            onClick={() =>
              setDamagePicker({
                amount: total,
                attackName: String(dMeta.attackName || "attack"),
                sourceMsgId: String(m?.id || ""),
              })
            }
            style={{
              marginLeft: 8,
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              background: "rgba(196,165,90,.18)",
              color: "#C4A55A",
              border: "1px solid rgba(196,165,90,.4)",
              borderRadius: 3,
              cursor: "pointer",
            }}
            title="Apply this damage to a token or combatant"
          >
            Apply HP →
          </button>
        )}
      </div>
    );
  }
  const uname = String(m?.user?.name || m?.user?.id || m?.name || m?.username || m?.author || "?");
  const mId = String(m?.id || "");
  const meId = String(ctx?.me?.id || "");
  const msgTs = Number(m?.ts || 0);
  const prevTs = i > 0 ? Number(msgs[i - 1]?.ts || 0) : 0;
  const myMsg = !!(meId && String(m?.user?.id || m?.userId || "") === meId);
  const showNewDivider =
    !myMsg && readTsSnapshot > 0 && msgTs > readTsSnapshot && (i === 0 || prevTs <= readTsSnapshot);
  const meName = String(ctx?.me?.name || "");
  const msgUserId = String(m?.user?.id || m?.userId || "");
  const isMine = !!(meId && msgUserId === meId) || !!(meName && uname === meName);
  const ts = Number(m?.ts || 0);
  const editedAt = m?.editedAt ? Number(m.editedAt) : 0;
  const deletedAt = m?.deletedAt ? Number(m.deletedAt) : 0;
  const editable = isMine && !deletedAt && ts > 0 && Date.now() - ts < 15 * 60 * 1000;
  const deletable = isMine && !deletedAt;
  const isEditing = editingMsgId === mId && mId !== "";
  const msgAvatar = m?.user?.avatar || null;
  const isHovered = hoveredMsgId === mId;

  function commitEdit() {
    const next = editDraft.trim();
    if (!next || !mId) {
      setEditingMsgId("");
      return;
    }
    if (next !== String(m?.body || "")) {
      try {
        ctx?.sendRaw?.({
          type: "chat:edit",
          roomId: effectiveRoomId,
          msgId: mId,
          body: next,
        });
      } catch {}
    }
    setEditingMsgId("");
    setEditDraft("");
  }

  async function handleDelete() {
    const ok = await weeredConfirm({
      title: "Delete this message?",
      body: "It'll be wiped for everyone in this room.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      ctx?.sendRaw?.({
        type: "chat:delete",
        roomId: effectiveRoomId,
        msgId: mId,
      });
    } catch {}
  }

  return (
    <React.Fragment key={mId || i}>
      {showNewDivider && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "10px 0 6px",
            color: "#ef4444",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "2px",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <span
            style={{
              flex: 1,
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(239,68,68,.45), rgba(239,68,68,.45))",
            }}
          />
          <span
            style={{
              whiteSpace: "nowrap",
              textShadow: "0 0 6px rgba(239,68,68,.35)",
            }}
          >
            New
          </span>
          <span
            style={{
              flex: 1,
              height: 1,
              background:
                "linear-gradient(90deg, rgba(239,68,68,.45), rgba(239,68,68,.45), transparent)",
            }}
          />
        </div>
      )}
      <div
        data-chat-message
        data-msg-id={mId}
        onMouseEnter={() => mId && setHoveredMsgId(mId)}
        onMouseLeave={() => setHoveredMsgId((cur) => (cur === mId ? "" : cur))}
        style={{ display: "flex", gap: 10, marginBottom: 8, position: "relative" }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            flexShrink: 0,
            background: msgAvatar
              ? "rgba(255,255,255,.08)"
              : avatarBg(uname, isMine, m?.user?.avatarColor),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            overflow: "hidden",
            opacity: deletedAt ? 0.4 : 1,
          }}
        >
          {msgAvatar ? (
            <img
              src={msgAvatar}
              alt={uname + " avatar"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            uname.slice(0, 1).toUpperCase()
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1, opacity: deletedAt ? 0.55 : 1 }}>
          {(() => {
            const roomUsers: any[] = liveRoomUsers;
            const umeta = msgUserId ? roomUsers.find((u: any) => u?.id === msgUserId) : undefined;
            const uRole = umeta?.globalRole || m?.user?.globalRole;
            const uTier = umeta?.tier || m?.user?.tier;
            const nameStyle = nameStyleFor(uRole, uTier);
            return (
              <div
                data-chat-username
                style={{
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
                onMouseEnter={(e) => {
                  if (msgUserId) openHover(msgUserId, uname, e.currentTarget as HTMLElement);
                }}
                onMouseLeave={() => hoverClose(160)}
              >
                <span
                  className={
                    (umeta as any)?.nameEffect
                      ? "weered-name-" + (umeta as any).nameEffect
                      : undefined
                  }
                  style={nameStyle}
                >
                  {uname}
                </span>
                {uRole && String(uRole).toUpperCase() !== "USER" && (
                  <RoleIcon
                    role={String(uRole).toUpperCase()}
                    size={13}
                    style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))" }}
                  />
                )}
                {msgUserId && <CrewFlair userId={msgUserId} size={13} />}
                <span
                  className="chat-author-flair"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  {uTier && String(uTier).toUpperCase() !== "INNOCENT" && (
                    <TierIcon
                      tier={String(uTier).toUpperCase()}
                      size={13}
                      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))" }}
                    />
                  )}
                  {msgUserId && <ChatFlair userId={msgUserId} size="sm" />}
                </span>
                {editedAt > 0 && !deletedAt && (
                  <span
                    title={new Date(editedAt).toLocaleString()}
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: "var(--weered-muted, rgba(148,163,184,.55))",
                      marginLeft: 2,
                    }}
                  >
                    (edited)
                  </span>
                )}
              </div>
            );
          })()}
          {m.replyTo?.id && !deletedAt && (
            <button
              type="button"
              onClick={() => {
                try {
                  const el = document.querySelector(
                    `[data-msg-id="${m.replyTo.id}"]`,
                  ) as HTMLElement | null;
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.style.transition = "background 0.2s";
                    const prev = el.style.background;
                    el.style.background = "rgba(124,58,237,0.10)";
                    setTimeout(() => {
                      el.style.background = prev;
                    }, 900);
                  }
                } catch {}
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 8px 2px 6px",
                marginBottom: 3,
                marginTop: -1,
                fontSize: 11,
                background: "transparent",
                border: "none",
                borderLeft: "2px solid var(--weered-accent-ring, rgba(124,58,237,0.45))",
                color: "var(--weered-muted, rgba(148,163,184,.75))",
                cursor: "pointer",
                fontFamily: "inherit",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  color: "var(--weered-accent-text, rgba(196,181,253,.85))",
                  fontWeight: 700,
                }}
              >
                ↩ {m.replyTo.userName}
              </span>
              <span
                style={{
                  opacity: 0.75,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.replyTo.body}
              </span>
            </button>
          )}
          {deletedAt ? (
            <div
              style={{
                fontSize: 12,
                fontStyle: "italic",
                color: "var(--weered-muted, rgba(148,163,184,.55))",
              }}
            >
              [message deleted]
            </div>
          ) : isEditing ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                marginTop: 2,
              }}
            >
              <textarea
                autoFocus
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitEdit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingMsgId("");
                    setEditDraft("");
                  }
                }}
                style={{
                  width: "100%",
                  minHeight: 60,
                  resize: "vertical",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--weered-border2, rgba(255,255,255,.18))",
                  background: "var(--weered-panel2, rgba(0,0,0,.25))",
                  color: "var(--weered-text, rgba(243,244,246,.95))",
                  fontFamily: "inherit",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  fontSize: 10,
                  color: "var(--weered-muted, rgba(148,163,184,.55))",
                }}
              >
                <span>Enter to save</span>
                <span>·</span>
                <span>Esc to cancel</span>
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => {
                    setEditingMsgId("");
                    setEditDraft("");
                  }}
                  style={{
                    padding: "3px 8px",
                    fontSize: 10,
                    fontWeight: 700,
                    background: "transparent",
                    border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
                    borderRadius: 6,
                    color: "var(--weered-muted, rgba(148,163,184,.75))",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commitEdit}
                  style={{
                    padding: "3px 10px",
                    fontSize: 10,
                    fontWeight: 800,
                    background: "var(--weered-accent-bg, rgba(124,58,237,.18))",
                    border: "1px solid var(--weered-accent-ring, rgba(124,58,237,.45))",
                    borderRadius: 6,
                    color: "var(--weered-accent-text, #c4b5fd)",
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <ChatBody
                text={m?.body || m?.text || ""}
                onMentionClick={(h) => replaceTop("profile", { userId: h })}
              />
              {m.attachment && (
                <AttachmentBlock
                  att={m.attachment as ChatAtt}
                  mine={String(m?.user?.id || "") === String(ctx?.me?.id || "")}
                  onOpen={(a) => setLightbox(a)}
                />
              )}
            </>
          )}
          {Array.isArray(m.reactions) && m.reactions.length > 0 && !deletedAt && (
            <div
              data-reaction-ui
              style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}
            >
              {m.reactions.map((r: any) => {
                const mine =
                  Array.isArray(r.users) &&
                  String(ctx?.me?.id || "") &&
                  r.users.includes(String(ctx?.me?.id || ""));
                return (
                  <button
                    key={r.emoji}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleReaction(mId, r.emoji);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 7px",
                      borderRadius: 10,
                      border: `1px solid ${mine ? "var(--weered-accent-ring, rgba(124,58,237,.55))" : "var(--weered-border, rgba(255,255,255,.1))"}`,
                      background: mine
                        ? "var(--weered-accent-bg, rgba(124,58,237,.18))"
                        : "rgba(255,255,255,.04)",
                      color: mine
                        ? "var(--weered-accent-text, rgba(196,181,253,.95))"
                        : "var(--weered-muted, rgba(148,163,184,.85))",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all .12s",
                      lineHeight: 1.1,
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{r.emoji}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {mId && (isHovered || moreMenuMsgId === mId) && !isEditing && !deletedAt && (
          <div
            data-reaction-ui
            data-more-menu
            style={{
              position: "absolute",
              top: 2,
              right: 6,
              display: "flex",
              gap: 1,
              padding: 2,
              borderRadius: 8,
              background: "var(--weered-panel2, rgba(16,16,20,.98))",
              border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
              boxShadow: "0 4px 14px rgba(0,0,0,.4)",
              zIndex: 2,
            }}
          >
            <button
              type="button"
              title="Add Reaction"
              onClick={(e) => {
                e.stopPropagation();
                setPickerMsgId((cur) => (cur === mId ? "" : mId));
                setMoreMenuMsgId("");
              }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "none",
                background: "transparent",
                color: "var(--weered-muted, rgba(148,163,184,.8))",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background .1s, color .1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)";
                (e.currentTarget as HTMLElement).style.color =
                  "var(--weered-text, rgba(243,244,246,.95))";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "var(--weered-muted, rgba(148,163,184,.8))";
              }}
            >
              <Icons.Smile />
            </button>
            <button
              type="button"
              title="Reply"
              onClick={(e) => {
                e.stopPropagation();
                setReplyingTo({
                  id: mId,
                  userName: uname || "user",
                  body: String(m?.body || ""),
                });
                try {
                  inputRef.current?.focus();
                } catch {}
              }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "none",
                background: "transparent",
                color: "var(--weered-muted, rgba(148,163,184,.8))",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background .1s, color .1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)";
                (e.currentTarget as HTMLElement).style.color =
                  "var(--weered-text, rgba(243,244,246,.95))";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "var(--weered-muted, rgba(148,163,184,.8))";
              }}
            >
              <Icons.Reply />
            </button>
            <button
              type="button"
              title="More"
              onClick={(e) => {
                e.stopPropagation();
                setMoreMenuMsgId((cur) => (cur === mId ? "" : mId));
                setPickerMsgId("");
              }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "none",
                background: moreMenuMsgId === mId ? "rgba(255,255,255,.08)" : "transparent",
                color:
                  moreMenuMsgId === mId
                    ? "var(--weered-text, rgba(243,244,246,.95))"
                    : "var(--weered-muted, rgba(148,163,184,.8))",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background .1s, color .1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)";
                (e.currentTarget as HTMLElement).style.color =
                  "var(--weered-text, rgba(243,244,246,.95))";
              }}
              onMouseLeave={(e) => {
                if (moreMenuMsgId !== mId) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--weered-muted, rgba(148,163,184,.8))";
                }
              }}
            >
              <Icons.More />
            </button>
          </div>
        )}
        {moreMenuMsgId === mId &&
          !deletedAt &&
          !isEditing &&
          (() => {
            const meId = String(ctx?.me?.id || "");
            const meRole = String(ctx?.me?.globalRole || "").toUpperCase();
            const meIsElevated = ["GOD", "STAFF", "SUPPORT", "ADMIN"].includes(meRole);
            const ownerId = String(meta?.ownerId || "");
            const mods = Array.isArray(meta?.mods) ? meta.mods.map(String) : [];
            const canPin = meIsElevated || (!!meId && (meId === ownerId || mods.includes(meId)));
            const pinnedSet: string[] = Array.isArray(ctx?.pinnedByRoom?.[effectiveRoomId])
              ? ctx.pinnedByRoom[effectiveRoomId]
              : [];
            const isPinned = pinnedSet.includes(mId);
            const targetRole = String(m?.user?.globalRole || "USER").toUpperCase();
            const canKick = meIsElevated && !isMine && !!msgUserId && targetRole !== "GOD";
            return (
              <MoreMenu
                msgId={mId}
                body={String(m?.body || "")}
                userName={uname}
                isMine={isMine}
                editable={editable}
                deletable={deletable}
                roomId={effectiveRoomId}
                isPinned={isPinned}
                canPin={canPin}
                canKick={canKick}
                onClose={() => setMoreMenuMsgId("")}
                onAddReaction={() => {
                  setPickerMsgId(mId);
                  setMoreMenuMsgId("");
                }}
                onReply={() => {
                  setReplyingTo({
                    id: mId,
                    userName: uname || "user",
                    body: String(m?.body || ""),
                  });
                  try {
                    inputRef.current?.focus();
                  } catch {}
                  setMoreMenuMsgId("");
                }}
                onEdit={() => {
                  setEditingMsgId(mId);
                  setEditDraft(String(m?.body || ""));
                  setMoreMenuMsgId("");
                }}
                onDelete={() => {
                  handleDelete();
                  setMoreMenuMsgId("");
                }}
                onTogglePin={() => {
                  try {
                    ctx?.sendRaw?.({
                      type: isPinned ? "chat:unpin" : "chat:pin",
                      msgId: mId,
                    });
                  } catch {}
                }}
                onKick={async () => {
                  const ok = await weeredConfirm({
                    title: `Kick ${uname} from chat?`,
                    body: `They'll be disconnected from every room they're in. Their socket will close. They can rejoin manually unless you also ban.`,
                    confirmLabel: "Kick",
                    destructive: true,
                  });
                  if (!ok) return;
                  try {
                    const token =
                      (typeof window !== "undefined" ? localStorage.getItem("weered_token") : "") ||
                      "";
                    const r = await fetch(
                      `${API}/staff/users/${encodeURIComponent(msgUserId)}/kick`,
                      {
                        method: "POST",
                        headers: token
                          ? {
                              Authorization: `Bearer ${token}`,
                              "Content-Type": "application/json",
                            }
                          : { "Content-Type": "application/json" },
                      },
                    );
                    const j = await r.json().catch(() => ({}));
                    if (j?.ok) weeredToast.success(`Kicked ${uname}.`);
                    else
                      weeredToast.error(
                        j?.error === "forbidden"
                          ? "Not authorized."
                          : j?.error === "cannot_kick_god"
                            ? "Cannot kick GOD."
                            : "Kick failed.",
                      );
                  } catch {
                    weeredToast.error("Kick failed.");
                  }
                }}
              />
            );
          })()}
        {pickerMsgId === mId && (
          <div
            data-reaction-ui
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            role="button"
            tabIndex={0}
            style={{
              position: "absolute",
              top: 30,
              right: 4,
              display: "flex",
              gap: 2,
              padding: 5,
              borderRadius: 8,
              background: "var(--weered-panel2, rgba(16,16,20,.98))",
              border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
              boxShadow: "0 6px 20px rgba(0,0,0,.5)",
              zIndex: 3,
            }}
          >
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggleReaction(mId, e)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 5,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background .1s, transform .1s",
                }}
                onMouseEnter={(ev) => {
                  (ev.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)";
                  (ev.currentTarget as HTMLElement).style.transform = "scale(1.15)";
                }}
                onMouseLeave={(ev) => {
                  (ev.currentTarget as HTMLElement).style.background = "transparent";
                  (ev.currentTarget as HTMLElement).style.transform = "none";
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </React.Fragment>
  );
}
