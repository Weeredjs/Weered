"use client";

import React from "react";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url: string): string {
  const u = String(url || "").trim();
  if (/^(https?:|\/|#)/i.test(u)) return u;
  return "#";
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_m, alt: string, url: string) =>
      `<img src="${safeUrl(url)}" alt="${alt}" style="max-width:100%;border-radius:6px;margin:6px 0;" />`,
  );
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, text: string, url: string) =>
      `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" style="color:#a78bfa;text-decoration:underline;">${text}</a>`,
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_\s][^_]*?)_/g, "$1<em>$2</em>");
  out = out.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(0,0,0,.35);padding:1px 5px;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em;">$1</code>',
  );
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = String(md || "")
    .replace(/\r\n/g, "\n")
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
        `<blockquote style="border-left:3px solid rgba(167,139,250,.4);padding:4px 12px;margin:6px 0;color:rgba(229,231,235,.7);">${renderInline(text)}</blockquote>`,
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
