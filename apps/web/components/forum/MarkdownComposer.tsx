"use client";

import React, { useRef, useState } from "react";
import { forumFetch, FONT } from "./ForumHelpers";
import Markdown from "./Markdown";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  minimal?: boolean;
};

export default function MarkdownComposer({ value, onChange, placeholder, maxLength = 10000, rows = 5, minimal }: Props) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function insertAtCursor(text: string) {
    const ta = taRef.current;
    if (!ta) { onChange(value + text); return; }
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    setTimeout(() => {
      try {
        ta.focus();
        const pos = start + text.length;
        ta.setSelectionRange(pos, pos);
      } catch {}
    }, 0);
  }

  async function handleFile(f: File) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { alert("Image files only."); return; }
    if (f.size > 12 * 1024 * 1024) { alert("Image too large (12MB max)."); return; }
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ""));
        r.onerror = () => rej(r.error);
        r.readAsDataURL(f);
      });
      const out = await forumFetch("/forum/uploads", { method: "POST", body: JSON.stringify({ dataUrl }) });
      if (out?.ok && out.url) {
        insertAtCursor(`\n![](${out.url})\n`);
      } else {
        alert(out?.error || "Upload failed");
      }
    } catch (e: any) {
      alert(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const tabBtn = (id: "write" | "preview", label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        padding: "4px 10px", borderRadius: 6, border: "none",
        fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        background: tab === id ? "rgba(255,255,255,.08)" : "transparent",
        color: tab === id ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.4)",
      }}
    >{label}</button>
  );

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,.04)", borderRadius: 8, padding: 2 }}>
          {tabBtn("write", "Write")}
          {tabBtn("preview", "Preview")}
        </div>
        {!minimal && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,.1)",
              background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.7)",
              fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              opacity: uploading ? 0.5 : 1,
            }}
            title="Upload image"
          >
            {uploading ? "Uploading..." : "+ Image"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      {tab === "write" ? (
        <textarea
          ref={taRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.3)",
            color: "rgba(243,244,246,.92)", fontSize: 13, lineHeight: 1.6,
            outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            resize: "vertical",
          }}
        />
      ) : (
        <div style={{
          minHeight: rows * 22, padding: "10px 12px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.2)",
        }}>
          {value.trim() ? <Markdown text={value} /> : <div style={{ fontSize: 12, opacity: 0.4 }}>Nothing to preview yet.</div>}
        </div>
      )}
    </div>
  );
}
