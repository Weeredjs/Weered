"use client";
import { Announcement } from "./AuditTab";
import React, { useState, useEffect, useCallback } from "react";
import { S, apiFetch } from "./shared";

export const ANN_PRESETS: {
  label: string;
  message: string;
  level: "info" | "warning" | "urgent";
}[] = [
  {
    label: "Maintenance",
    message: "Scheduled maintenance — Weered may be briefly unavailable. We'll be back shortly.",
    level: "warning",
  },
  {
    label: "Beta notice",
    message:
      "Early access build — things may break. Report bugs in the Forum. New features ship daily. Type @operator in any chat for help.",
    level: "info",
  },
  {
    label: "New feature",
    message: "New feature just shipped — check the Changelog in HQ to see what's new.",
    level: "info",
  },
  {
    label: "Outage",
    message:
      "We're aware of an issue affecting parts of Weered and are on it. Thanks for your patience.",
    level: "urgent",
  },
];

export const annLevelStyles: Record<
  string,
  { bg: string; border: string; color: string; label: string; emoji: string }
> = {
  info: {
    bg: "rgba(88,0,229,.12)",
    border: "rgba(88,0,229,.35)",
    color: "rgb(216,180,254)",
    label: "Info",
    emoji: "📢",
  },
  warning: {
    bg: "rgba(245,158,11,.10)",
    border: "rgba(245,158,11,.35)",
    color: "rgb(253,230,138)",
    label: "Warning",
    emoji: "⚠️",
  },
  urgent: {
    bg: "rgba(239,68,68,.10)",
    border: "rgba(239,68,68,.35)",
    color: "rgb(252,165,165)",
    label: "Urgent",
    emoji: "🚨",
  },
};

export function BroadcastTab() {
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<"info" | "warning" | "urgent">("info");
  const [pin, setPin] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [items, setItems] = useState<Announcement[]>([]);

  const load = useCallback(async () => {
    const j = await apiFetch("/staff/announcements");
    if (j?.ok) setItems(j.announcements || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function applyPreset(p: (typeof ANN_PRESETS)[number]) {
    setMessage(p.message);
    setLevel(p.level);
  }

  async function send() {
    if (!message.trim() || busy) return;
    setBusy(true);
    setResult("");
    try {
      const flash = await apiFetch("/staff/broadcast", {
        method: "POST",
        body: JSON.stringify({ message: message.trim(), level }),
      });
      if (pin) {
        await apiFetch("/staff/announcements", {
          method: "POST",
          body: JSON.stringify({ message: message.trim(), level, pinned: true, sticky }),
        });
      } else {
        await apiFetch("/staff/announcements", {
          method: "POST",
          body: JSON.stringify({ message: message.trim(), level, pinned: false }),
        });
      }
      setResult(
        flash?.ok
          ? `Sent to ${flash.sent} user${flash.sent !== 1 ? "s" : ""}${pin ? " · pinned" : ""}.`
          : "Saved.",
      );
      setMessage("");
      setPin(false);
      setSticky(false);
      await load();
    } catch {
      setResult("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(a: Announcement) {
    await apiFetch(`/staff/announcements/${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: !a.pinned, sticky: !a.pinned ? a.sticky : false }),
    });
    await load();
  }
  async function toggleSticky(a: Announcement) {
    await apiFetch(`/staff/announcements/${a.id}`, {
      method: "PATCH",
      body: JSON.stringify({ sticky: !a.sticky, pinned: true }),
    });
    await load();
  }
  async function del(a: Announcement) {
    if (!confirm("Delete this announcement from history?")) return;
    await apiFetch(`/staff/announcements/${a.id}`, { method: "DELETE" });
    await load();
  }

  const pinnedItems = items.filter((a) => a.pinned);
  const historyItems = items.filter((a) => !a.pinned);

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.sectionTitle}>Compose Announcement</div>
        <div style={{ fontSize: 11, opacity: 0.45, marginBottom: 12 }}>
          Sends a toast to all connected users. Pin it to keep it as a banner — sticky banners can't
          be dismissed.
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {ANN_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              style={{
                padding: "5px 11px",
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,.10)",
                background: "rgba(255,255,255,.03)",
                color: "rgba(203,213,225,.8)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <textarea
          style={{ ...S.input, resize: "vertical", minHeight: 70, marginBottom: 6 }}
          placeholder="Announcement message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
        />
        <div style={{ fontSize: 10, opacity: 0.3, textAlign: "right", marginBottom: 10 }}>
          {message.length}/500
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {(["info", "warning", "urgent"] as const).map((l) => {
            const ls = annLevelStyles[l];
            const active = level === l;
            return (
              <button
                key={l}
                onClick={() => setLevel(l)}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 9,
                  textAlign: "center",
                  border: `1px solid ${active ? ls.border : "rgba(255,255,255,.08)"}`,
                  background: active ? ls.bg : "rgba(255,255,255,.02)",
                  color: active ? ls.color : "rgba(243,244,246,.5)",
                  fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {ls.emoji} {ls.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              cursor: "pointer",
              color: "rgba(203,213,225,.85)",
            }}
          >
            <input
              type="checkbox"
              checked={pin}
              onChange={(e) => {
                setPin(e.target.checked);
                if (!e.target.checked) setSticky(false);
              }}
            />{" "}
            Pin as banner
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              cursor: pin ? "pointer" : "default",
              color: pin ? "rgba(203,213,225,.85)" : "rgba(148,163,184,.35)",
            }}
          >
            <input
              type="checkbox"
              checked={sticky}
              disabled={!pin}
              onChange={(e) => setSticky(e.target.checked)}
            />{" "}
            Sticky (can't be dismissed)
          </label>
        </div>

        {message.trim() && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 9,
              background: annLevelStyles[level].bg,
              border: `1px solid ${annLevelStyles[level].border}`,
              color: annLevelStyles[level].color,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span style={{ marginRight: 8 }}>{annLevelStyles[level].emoji}</span>
            {message.trim()}
          </div>
        )}

        <button
          onClick={send}
          disabled={busy || !message.trim()}
          style={{
            ...S.btnPri,
            width: "100%",
            padding: "10px",
            fontSize: 13,
            opacity: busy || !message.trim() ? 0.5 : 1,
          }}
        >
          {busy ? "Sending…" : pin ? "Send + Pin" : "Send Broadcast"}
        </button>
        {result && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>{result}</div>}
      </div>

      {pinnedItems.length > 0 && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={S.sectionTitle}>Pinned Banners ({pinnedItems.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pinnedItems.map((a) => (
              <AnnRow key={a.id} a={a} onPin={togglePin} onSticky={toggleSticky} onDelete={del} />
            ))}
          </div>
        </div>
      )}

      {historyItems.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>History</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {historyItems.map((a) => (
              <AnnRow key={a.id} a={a} onPin={togglePin} onSticky={toggleSticky} onDelete={del} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AnnRow({
  a,
  onPin,
  onSticky,
  onDelete,
}: {
  a: Announcement;
  onPin: (a: Announcement) => void;
  onSticky: (a: Announcement) => void;
  onDelete: (a: Announcement) => void;
}) {
  const ls = annLevelStyles[a.level] || annLevelStyles.info;
  return (
    <div
      style={{
        padding: "9px 11px",
        borderRadius: 8,
        background: a.pinned ? ls.bg : "rgba(255,255,255,.02)",
        border: `1px solid ${a.pinned ? ls.border : "rgba(255,255,255,.06)"}`,
      }}
    >
      <div style={{ fontSize: 12, color: a.pinned ? ls.color : "rgba(243,244,246,.85)" }}>
        {ls.emoji} {a.message}
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}
      >
        <span style={{ fontSize: 10, opacity: 0.4 }}>
          {ls.label.toUpperCase()} · {a.createdByName || "staff"} ·{" "}
          {new Date(a.createdAt).toLocaleString()}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => onPin(a)} style={annBtn(a.pinned)}>
          {a.pinned ? "Unpin" : "Pin"}
        </button>
        {a.pinned && (
          <button onClick={() => onSticky(a)} style={annBtn(a.sticky)}>
            {a.sticky ? "Sticky ✓" : "Make sticky"}
          </button>
        )}
        <button
          onClick={() => onDelete(a)}
          style={{ ...annBtn(false), color: "rgba(252,165,165,.85)" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
export function annBtn(active: boolean): React.CSSProperties {
  return {
    padding: "3px 9px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
    borderRadius: 6,
    border: `1px solid ${active ? "rgba(124,58,237,.5)" : "rgba(255,255,255,.12)"}`,
    background: active ? "rgba(124,58,237,.15)" : "transparent",
    color: active ? "#c4b5fd" : "rgba(148,163,184,.85)",
  };
}

export type StaffEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  coverImageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: string;
  lobbyId: string | null;
  lobby?: { id: string; name: string } | null;
  createdById: string;
  createdByName: string;
  promotionStatus: string;
  promotionNote: string | null;
  promotionDenyReason: string | null;
  broadcastOnPublish: boolean;
  createdAt: string;
};
