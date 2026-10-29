"use client";

// Design mode's inspector: the selected block's width and settings.
import React from "react";
import {
  BLOCK_CATALOG,
  SIZE_LABEL,
  TAB_DEFAULT_LABEL,
  type Block,
  type BlockSize,
  type TabId,
} from "../../lib/lobbyLayout";
import { IconBtn, chip, input, label } from "./designerKit";

// ── Inspector ──────────────────────────────────────────────────────────────
export function Inspector({
  accent,
  block,
  index,
  count,
  onPatch,
  onMove,
  onDuplicate,
  onRemove,
  onClose,
}: {
  accent: string;
  block: Block;
  index: number;
  count: number;
  onPatch: (fn: (b: Block) => Block) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const meta = BLOCK_CATALOG.find((c) => c.type === block.type);
  const pr = block.props;
  const setProp = (k: string, v: any) => onPatch((b) => ({ ...b, props: { ...b.props, [k]: v } }));
  const field = (k: string, lbl: string, ph = "", multiline = false) => (
    <div>
      <div style={label}>{lbl}</div>
      {multiline ? (
        <textarea
          value={pr[k] ?? ""}
          placeholder={ph}
          rows={4}
          onChange={(e) => setProp(k, e.target.value)}
          style={{ ...input, resize: "vertical" }}
          aria-label={lbl}
        />
      ) : (
        <input
          value={pr[k] ?? ""}
          placeholder={ph}
          onChange={(e) => setProp(k, e.target.value)}
          style={input}
          aria-label={lbl}
        />
      )}
    </div>
  );
  return (
    <div>
      <div
        style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            Block
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>
            {meta?.icon} {meta?.name}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{meta?.blurb}</div>
        </div>
        <IconBtn title="Close" onClick={onClose}>
          ✕
        </IconBtn>
      </div>

      <div style={label}>Width</div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["s", "m", "l", "full"] as BlockSize[]).map((s) => (
          <button
            key={s}
            style={{ ...chip(block.size === s, accent), flex: 1, padding: "7px 4px" }}
            onClick={() => onPatch((b) => ({ ...b, size: s }))}
          >
            {SIZE_LABEL[s]}
          </button>
        ))}
      </div>

      {block.type === "welcome" && (
        <>
          {field("title", "Headline", "Welcome in")}
          {field("body", "Copy", "", true)}
          {field("cta", "Button", "Jump in")}
          <div style={label}>Button opens</div>
          <select
            value={pr.ctaTab || "rooms"}
            onChange={(e) => setProp("ctaTab", e.target.value)}
            style={input}
            aria-label="Button opens"
          >
            {(Object.keys(TAB_DEFAULT_LABEL) as TabId[]).map((t) => (
              <option key={t} value={t}>
                {TAB_DEFAULT_LABEL[t]}
              </option>
            ))}
          </select>
          <div style={label}>Align</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["left", "center"].map((a) => (
              <button
                key={a}
                style={{ ...chip((pr.align || "left") === a, accent), flex: 1 }}
                onClick={() => setProp("align", a)}
              >
                {a === "left" ? "Left" : "Centre"}
              </button>
            ))}
          </div>
        </>
      )}
      {block.type === "rules" && (
        <>
          {field("title", "Title", "House rules")}
          {field("body", "One rule per line", "", true)}
        </>
      )}
      {block.type === "stream" && field("channel", "Twitch channel", "e.g. timbosdojo")}
      {(block.type === "video" || block.type === "music") && (
        <>
          {field(
            "url",
            block.type === "music" ? "Spotify or YouTube playlist link" : "YouTube link",
            "https://",
          )}
          {field("title", "Title (optional)")}
        </>
      )}
      {block.type === "image" && (
        <>
          {field("url", "Image link (https)", "https://")}
          {field("caption", "Caption")}
          {field("link", "Clicking it opens (optional)", "https://")}
        </>
      )}
      {block.type === "countdown" && (
        <>
          {field("label", "What's coming", "Season finale")}
          <div style={label}>When</div>
          <input
            type="datetime-local"
            value={pr.at ? toLocalInput(pr.at) : ""}
            onChange={(e) =>
              setProp("at", e.target.value ? new Date(e.target.value).toISOString() : "")
            }
            style={input}
            aria-label="When"
          />
        </>
      )}
      {block.type === "links" && (
        <>
          {field("title", "Title", "Links")}
          <div style={label}>Links</div>
          <div style={{ display: "grid", gap: 6 }}>
            {(pr.items || []).map((it: any, i: number) => (
              <div
                key={i}
                style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 4 }}
              >
                <input
                  value={it.label}
                  placeholder="Label"
                  onChange={(e) =>
                    setProp(
                      "items",
                      pr.items.map((x: any, j: number) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                  style={{ ...input, padding: "6px 8px" }}
                  aria-label="Link label"
                />
                <input
                  value={it.url}
                  placeholder="https://"
                  onChange={(e) =>
                    setProp(
                      "items",
                      pr.items.map((x: any, j: number) =>
                        j === i ? { ...x, url: e.target.value } : x,
                      ),
                    )
                  }
                  style={{ ...input, padding: "6px 8px" }}
                  aria-label="Link address"
                />
                <button
                  onClick={() =>
                    setProp(
                      "items",
                      pr.items.filter((_: any, j: number) => j !== i),
                    )
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                  aria-label="Remove link"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              style={chip(false, accent)}
              onClick={() => setProp("items", [...(pr.items || []), { label: "", url: "" }])}
            >
              + Add link
            </button>
          </div>
        </>
      )}
      {["rooms", "events", "feed", "requests", "stats"].includes(block.type) &&
        field("title", "Heading (optional)")}
      {["rooms", "events", "feed", "requests"].includes(block.type) && (
        <>
          <div style={label}>Show up to</div>
          <input
            type="range"
            min={1}
            max={12}
            value={pr.limit || 6}
            onChange={(e) => setProp("limit", Number(e.target.value))}
            style={{ width: "100%", accentColor: accent }}
            aria-label="How many to show"
          />
          <div style={{ fontSize: 12, opacity: 0.6 }}>{pr.limit || 6}</div>
        </>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
        <button style={chip(false, accent)} disabled={index <= 0} onClick={() => onMove(-1)}>
          ↑ Earlier
        </button>
        <button style={chip(false, accent)} disabled={index >= count - 1} onClick={() => onMove(1)}>
          ↓ Later
        </button>
        <button style={chip(false, accent)} onClick={onDuplicate}>
          Duplicate
        </button>
        <button
          style={{ ...chip(false, accent), borderColor: "rgba(239,68,68,.4)", color: "#fca5a5" }}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
