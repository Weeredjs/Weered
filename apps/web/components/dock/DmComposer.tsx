"use client";

import React from "react";
import type { DmReplyTo } from "./types";

export function DmComposer(props: {
  dmReplyingTo: DmReplyTo | null;
  setDmReplyingTo: (v: DmReplyTo | null) => void;
  dmInputRef: React.RefObject<HTMLInputElement | null>;
  dmDraft: string;
  setDmDraft: (v: string) => void;
  dmSend: () => void | Promise<void>;
}) {
  const { dmReplyingTo, setDmReplyingTo, dmInputRef, dmDraft, setDmDraft, dmSend } = props;
  return (
    <div
      style={{
        padding: "8px 12px 10px",
        borderTop: "1px solid var(--weered-bd)",
        flexShrink: 0,
      }}
    >
      {dmReplyingTo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 10px",
            marginBottom: 6,
            borderRadius: 7,
            borderLeft: "2px solid var(--weered-accent-ring)",
            background: "var(--weered-accent-bg)",
            fontSize: 11,
          }}
        >
          <span
            style={{
              color: "var(--weered-accent-text)",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ↩ Replying to <strong>{dmReplyingTo.userName}</strong>
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--weered-muted)",
            }}
          >
            {dmReplyingTo.body}
          </span>
          <button
            type="button"
            onClick={() => setDmReplyingTo(null)}
            title="Cancel reply"
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: "var(--weered-muted)",
              cursor: "pointer",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          ref={dmInputRef}
          value={dmDraft}
          onChange={(e) => setDmDraft((e.target as any).value || "")}
          placeholder="Message..."
          style={{
            width: "100%",
            padding: "10px 42px 10px 16px",
            borderRadius: 22,
            border: "1px solid var(--weered-bd2)",
            background: "rgba(255,255,255,.05)",
            color: "var(--weered-text)",
            outline: "none",
            fontSize: 13,
            fontFamily: "inherit",
          }}
          onKeyDown={(e) => {
            if ((e as any).key === "Enter") {
              e.preventDefault();
              void dmSend();
            }
          }}
        />
        {dmDraft.trim() && (
          <button
            className="weered-dock-send"
            onClick={() => void dmSend()}
            style={{
              position: "absolute",
              right: 6,
              width: 30,
              height: 30,
              borderRadius: 999,
              border: "none",
              background: "var(--weered-accent-bg)",
              color: "var(--weered-accent-text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all .15s",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
