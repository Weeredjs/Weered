"use client";

import React from "react";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(url: string): string {
  const u = String(url || "").trim();
  if (/^(https?:|\/|#)/i.test(u)) return u;
  return "#";
}

// Inline formatting. The old version escaped the text, then ran every pattern
// over the growing HTML string, so a later pass (code spans, emphasis) could
// rewrite characters inside an href/src attribute that an earlier pass had
// built (audit 2026-09-27). Now the text is split into code spans, images,
// links and plain runs first; each piece is escaped for the place it lands, and
// emphasis only ever runs over escaped plain text, which holds no attributes.
const INLINE_TOKEN = /`([^`]+)`|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)/g;

const CODE_STYLE =
  "background:rgba(0,0,0,.35);padding:1px 5px;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em;";
const IMG_STYLE = "max-width:100%;border-radius:6px;margin:6px 0;";
const LINK_STYLE = "color:var(--weered-accent-2, #a78bfa);text-decoration:underline;";

/** Bold and italics, over text that is already escaped. */
function emphasis(escaped: string): string {
  let out = escaped;
  out = out.replaceAll(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replaceAll(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replaceAll(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
  out = out.replaceAll(/(^|[^_])_([^_\s][^_]*?)_/g, "$1<em>$2</em>");
  return out;
}

function renderInline(s: string): string {
  const src = String(s || "");
  let out = "";
  let last = 0;
  for (const m of src.matchAll(INLINE_TOKEN)) {
    const at = m.index ?? 0;
    out += emphasis(escapeHtml(src.slice(last, at)));
    last = at + m[0].length;
    if (m[1] !== undefined) {
      out += `<code style="${CODE_STYLE}">${escapeHtml(m[1])}</code>`;
    } else if (m[3] !== undefined) {
      out += `<img src="${escapeHtml(safeUrl(m[3]))}" alt="${escapeHtml(m[2] || "")}" style="${IMG_STYLE}" />`;
    } else {
      out += `<a href="${escapeHtml(safeUrl(m[5]))}" target="_blank" rel="noopener noreferrer" style="${LINK_STYLE}">${emphasis(escapeHtml(m[4]))}</a>`;
    }
  }
  out += emphasis(escapeHtml(src.slice(last)));
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = String(md || "")
    .replaceAll("\r\n", "\n")
    .split("\n");
  const out: string[] = [];
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  function flushList() {
    if (!listType) return;
    out.push(
      `<${listType} style="padding-left:22px;margin:6px 0;">${listItems.map((li) => `<li>${li}</li>`).join("")}</${listType}>`,
    );
    listType = null;
    listItems = [];
  }

  while (i < lines.length) {
    const ln = lines[i];
    if (ln.startsWith("```")) {
      if (inCode) {
        out.push(
          `<pre style="background:rgba(0,0,0,.4);padding:10px 12px;border-radius:8px;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;margin:8px 0;"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`,
        );
        codeBuf = [];
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(ln);
      i++;
      continue;
    }

    if (!ln.trim()) {
      flushList();
      out.push("");
      i++;
      continue;
    }
    const h = ln.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flushList();
      const lvl = h[1].length;
      const sizes = [0, 18, 16, 14];
      out.push(
        `<h${lvl} style="font-size:${sizes[lvl]}px;font-weight:800;margin:10px 0 6px;letter-spacing:-0.2px;">${renderInline(h[2])}</h${lvl}>`,
      );
      i++;
      continue;
    }
    if (/^>\s?/.test(ln)) {
      flushList();
      const text = ln.replace(/^>\s?/, "");
      out.push(
        `<blockquote style="border-left:3px solid var(--weered-border2, rgba(167,139,250,.4));padding:4px 12px;margin:6px 0;color:rgba(229,231,235,.7);">${renderInline(text)}</blockquote>`,
      );
      i++;
      continue;
    }
    const ul = ln.match(/^[\s]*[-*+]\s+(.+)$/);
    if (ul) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(renderInline(ul[1]));
      i++;
      continue;
    }
    const ol = ln.match(/^[\s]*\d+\.\s+(.+)$/);
    if (ol) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(renderInline(ol[1]));
      i++;
      continue;
    }
    flushList();
    const para: string[] = [ln];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(```|#{1,3}\s|>\s?|[\s]*[-*+]\s+|[\s]*\d+\.\s+)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p style="margin:6px 0;line-height:1.65;">${renderInline(para.join(" "))}</p>`);
  }
  flushList();
  if (inCode && codeBuf.length) {
    out.push(
      `<pre style="background:rgba(0,0,0,.4);padding:10px 12px;border-radius:8px;overflow-x:auto;"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`,
    );
  }
  return out.join("\n");
}

export default function Markdown({ text, style }: { text: string; style?: React.CSSProperties }) {
  const html = React.useMemo(() => renderMarkdown(text), [text]);
  return (
    <div
      className="weered-md"
      style={{
        fontSize: 13,
        lineHeight: 1.65,
        color: "rgba(229,231,235,.78)",
        wordBreak: "break-word",
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
