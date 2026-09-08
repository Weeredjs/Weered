"use client";
// The one composer the forum writes through — new posts, comments and replies.
//
// The upload endpoint (/forum/uploads) and the image syntax in Markdown have
// both been live since the forum shipped; what was missing was any way for a
// member to reach them. Three ways now: the button, paste, and drag-and-drop,
// because the first thing anyone tries with a screenshot is ctrl-V.
import { useRef, useState } from "react";
import { forumFetch, FONT } from "./ForumHelpers";
import Markdown from "./Markdown";
import { EMOJI_CATEGORIES } from "../chat/emoji";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  /** Comment and reply boxes: drop the Write/Preview tabs, keep the toolbar. */
  minimal?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

const MAX_BYTES = 12 * 1024 * 1024;

export default function MarkdownComposer({
  value,
  onChange,
  placeholder,
  maxLength = 10000,
  rows = 5,
  minimal,
  autoFocus,
  onKeyDown,
}: Props) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCat, setEmojiCat] = useState(0);
  const [error, setError] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function insertAtCursor(text: string) {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + text);
      return;
    }
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    onChange(value.slice(0, start) + text + value.slice(end));
    setTimeout(() => {
      try {
        ta.focus();
        const pos = start + text.length;
        ta.setSelectionRange(pos, pos);
      } catch {
        /* the textarea went away mid-insert */
      }
    }, 0);
  }

  async function handleFile(f: File) {
    if (!f) return;
    // The API accepts these five and re-encodes everything to webp. SVG is not
    // on the list on purpose: an SVG is a document that can carry script.
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) {
      setError("PNG, JPEG, WebP or GIF only.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("That image is over 12MB.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ""));
        r.onerror = () => rej(r.error);
        r.readAsDataURL(f);
      });
      const out = await forumFetch("/forum/uploads", {
        method: "POST",
        body: JSON.stringify({ dataUrl }),
      });
      if (out?.ok && out.url) insertAtCursor(`\n![](${out.url})\n`);
      else setError(out?.error || "Upload failed.");
    } catch (e: any) {
      setError(e?.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function filesFrom(list: FileList | null | undefined): File[] {
    return list ? Array.from(list).filter((f) => f.type.startsWith("image/")) : [];
  }

  const tabBtn = (id: "write" | "preview", label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        border: "none",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
        background: tab === id ? "rgba(255,255,255,.08)" : "transparent",
        color: tab === id ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.4)",
      }}
    >
      {label}
    </button>
  );

  const toolBtn: React.CSSProperties = {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.7)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, fontFamily: FONT }}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        const imgs = filesFrom(e.dataTransfer?.files);
        setDragging(false);
        if (!imgs.length) return;
        e.preventDefault();
        handleFile(imgs[0]);
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}
      >
        {minimal ? (
          <span />
        ) : (
          <div
            style={{
              display: "flex",
              gap: 2,
              background: "rgba(255,255,255,.04)",
              borderRadius: 8,
              padding: 2,
            }}
          >
            {tabBtn("write", "Write")}
            {tabBtn("preview", "Preview")}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, alignItems: "center", position: "relative" }}>
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            style={{ ...toolBtn, padding: "4px 8px", fontSize: 13, lineHeight: 1 }}
            title="Emoji"
            aria-expanded={emojiOpen}
          >
            🙂
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ ...toolBtn, opacity: uploading ? 0.5 : 1 }}
            title="Upload an image, or just paste one"
          >
            {uploading ? "Uploading..." : "+ Image"}
          </button>

          {emojiOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 40,
                width: 268,
                padding: 8,
                borderRadius: 10,
                background: "rgba(17,17,24,.98)",
                border: "1px solid rgba(255,255,255,.12)",
                boxShadow: "0 12px 32px rgba(0,0,0,.5)",
              }}
            >
              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                {EMOJI_CATEGORIES.map((cat, ci) => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setEmojiCat(ci)}
                    style={{
                      flex: 1,
                      padding: "3px 0",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      background: emojiCat === ci ? "rgba(255,255,255,.1)" : "transparent",
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gap: 2,
                  maxHeight: 180,
                  overflowY: "auto",
                }}
              >
                {EMOJI_CATEGORIES[emojiCat].emojis.map((em, ei) => (
                  <button
                    key={em + ei}
                    type="button"
                    onClick={() => {
                      insertAtCursor(em);
                      setEmojiOpen(false);
                    }}
                    style={{
                      padding: 3,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 17,
                      lineHeight: 1.2,
                      borderRadius: 4,
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {tab === "write" || minimal ? (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          onPaste={(e) => {
            const imgs = filesFrom(e.clipboardData?.files);
            if (!imgs.length) return;
            e.preventDefault();
            handleFile(imgs[0]);
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${dragging ? "rgba(167,139,250,.7)" : "rgba(255,255,255,.1)"}`,
            background: dragging ? "rgba(167,139,250,.07)" : "rgba(0,0,0,.3)",
            color: "rgba(243,244,246,.92)",
            fontSize: 13,
            lineHeight: 1.6,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
            resize: "vertical",
            transition: "border-color .15s, background .15s",
          }}
        />
      ) : (
        <div
          style={{
            minHeight: rows * 22,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.1)",
            background: "rgba(0,0,0,.2)",
          }}
        >
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <div style={{ fontSize: 12, opacity: 0.4 }}>Nothing to preview yet.</div>
          )}
        </div>
      )}

      {(error || uploading) && (
        <div style={{ fontSize: 11, color: error ? "#f87171" : "var(--weered-accent-2, #a78bfa)" }}>
          {error || "Uploading image..."}
        </div>
      )}
    </div>
  );
}
