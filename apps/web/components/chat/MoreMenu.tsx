"use client";

import React from "react";
import { weeredReport } from "../../lib/report";
import { weeredToast } from "../../lib/toast";
import { Icons } from "./Icons";

export function MoreMenuItem({
  icon,
  label,
  onClick,
  danger,
  divider,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}) {
  const color = danger ? "rgba(252,165,165,.95)" : "var(--weered-text, rgba(243,244,246,.92))";
  const hoverBg = danger ? "rgba(239,68,68,.15)" : "rgba(124,58,237,.18)";
  return (
    <>
      {divider && (
        <div style={{ height: 1, margin: "4px 6px", background: "rgba(255,255,255,.06)" }} />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "7px 10px",
          border: "none",
          background: "transparent",
          color,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 500,
          textAlign: "left",
          borderRadius: 5,
          transition: "background .1s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = hoverBg;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span
          style={{
            width: 16,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.85,
          }}
        >
          {icon}
        </span>
        <span style={{ flex: 1 }}>{label}</span>
      </button>
    </>
  );
}

export function MoreMenu({
  msgId,
  body,
  userName,
  isMine,
  editable,
  deletable,
  roomId,
  isPinned,
  canPin,
  canKick,
  onClose,
  onAddReaction,
  onReply,
  onEdit,
  onDelete,
  onTogglePin,
  onKick,
}: {
  msgId: string;
  body: string;
  userName: string;
  isMine: boolean;
  editable: boolean;
  deletable: boolean;
  roomId: string;
  isPinned: boolean;
  canPin: boolean;
  canKick: boolean;
  onClose: () => void;
  onAddReaction: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onKick: () => void;
}) {
  const copy = async (txt: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      weeredToast.success(okMsg);
    } catch {
      weeredToast.error("Clipboard unavailable.");
    }
  };
  const handleForward = () => {
    copy(`↪ ${userName}: ${body}`, "Forward text copied — paste in any chat.");
    onClose();
  };
  const handleCopyText = () => {
    copy(body, "Message copied.");
    onClose();
  };
  const handleCopyLink = () => {
    const path =
      typeof window !== "undefined"
        ? window.location.pathname
        : `/room/${encodeURIComponent(roomId)}`;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://weered.ca";
    copy(`${origin}${path}?msg=${encodeURIComponent(msgId)}`, "Message link copied.");
    onClose();
  };
  const handleMarkUnread = () => {
    try {
      const key = `weered:unread:${roomId}`;
      localStorage.setItem(key, msgId);
      weeredToast("Marked unread from this message.");
    } catch {}
    onClose();
  };
  const handleSpeak = () => {
    try {
      const synth = (window as any).speechSynthesis;
      if (!synth) {
        weeredToast.error("Speech not supported in this browser.");
        return;
      }
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(body);
      utter.rate = 1;
      utter.pitch = 1;
      synth.speak(utter);
    } catch {
      weeredToast.error("Speak failed.");
    }
    onClose();
  };
  const handleReport = async () => {
    const res = await weeredReport({ targetType: "MESSAGE", targetId: msgId, context: roomId });
    if (res?.ok) weeredToast.success("Report submitted. Staff will review.");
    else if (res && !res.ok)
      weeredToast.error(
        res.error === "report_rate_limit"
          ? "You're reporting too fast. Try again in a few minutes."
          : "Report failed.",
      );
    onClose();
  };

  return (
    <div
      data-reaction-ui
      data-more-menu
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
      }}
      role="button"
      tabIndex={0}
      style={{
        position: "absolute",
        top: 22,
        right: 4,
        minWidth: 220,
        padding: 5,
        borderRadius: 8,
        background: "var(--weered-panel2, rgba(16,16,20,.98))",
        border: "1px solid var(--weered-border, rgba(255,255,255,.1))",
        boxShadow: "0 10px 32px rgba(0,0,0,.55)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MoreMenuItem icon={<Icons.Smile />} label="Add Reaction" onClick={onAddReaction} />
      <MoreMenuItem icon={<Icons.Reply />} label="Reply" onClick={onReply} />
      <MoreMenuItem icon={<Icons.Forward />} label="Forward" onClick={handleForward} />
      <MoreMenuItem divider icon={<Icons.Copy />} label="Copy Text" onClick={handleCopyText} />
      <MoreMenuItem icon={<Icons.Unread />} label="Mark Unread" onClick={handleMarkUnread} />
      <MoreMenuItem icon={<Icons.Link />} label="Copy Message Link" onClick={handleCopyLink} />
      <MoreMenuItem icon={<Icons.Speak />} label="Speak Message" onClick={handleSpeak} />
      {canPin && (
        <MoreMenuItem
          divider
          icon={<Icons.Pin />}
          label={isPinned ? "Unpin Message" : "Pin Message"}
          onClick={() => {
            onTogglePin();
            onClose();
          }}
        />
      )}
      {editable && (
        <MoreMenuItem divider icon={<Icons.Edit />} label="Edit Message" onClick={onEdit} />
      )}
      {deletable && (
        <MoreMenuItem icon={<Icons.Trash />} label="Delete Message" onClick={onDelete} danger />
      )}
      {!isMine && (
        <MoreMenuItem
          divider
          icon={<Icons.Flag />}
          label="Report Message"
          onClick={handleReport}
          danger
        />
      )}
      {canKick && (
        <MoreMenuItem
          divider
          icon={<Icons.Trash />}
          label={`Kick ${userName} from chat`}
          onClick={() => {
            onKick();
            onClose();
          }}
          danger
        />
      )}
    </div>
  );
}
