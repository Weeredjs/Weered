"use client";

import React from "react";
import { URL_RE, IMG_EXT, TENOR_RE, API, InlineTok, ChatAtt } from "./chatShared";
import {
  detectWeeredEmbed,
  WeeredEmbedKind,
  WeeredBountyEmbed,
  WeeredHunterEmbed,
  WeeredCrewEmbed,
  NexusModEmbed,
  LinkPreviewCard,
} from "./embeds";
import { MTG_DECK_URL_RE, MtgDeckChip, MtgCardChip } from "./mtg";

const MENTION_BODY_RE = /@([a-zA-Z0-9][a-zA-Z0-9_-]{1,31})/g;
const BOLD_RE = /\*\*([^*\n]+?)\*\*/g;
const ITALIC_RE = /(^|[^*])\*([^*\n]+?)\*(?!\*)/g;
const CODE_RE = /`([^`\n]+?)`/g;
const CARD_RE = /\[\[([^\]\n]{1,80})\]\]/g;

export function daysLeft(iso?: string | null): number | null {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
  return d > 0 ? d : 0;
}

export function AttachmentBlock({
  att,
  mine,
  onOpen,
}: {
  att: ChatAtt;
  mine: boolean;
  onOpen: (att: ChatAtt) => void;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const needsBlur = !att.trusted && !mine && !revealed;
  const maxW = 280;
  const ratio = att.w > 0 && att.h > 0 ? att.h / att.w : 0.66;
  const h = Math.min(280, Math.round(maxW * ratio));
  const exp = mine ? daysLeft(att.expiresAt) : null;
  return (
    <div style={{ marginTop: 5 }}>
      <div
        onClick={() => {
          if (needsBlur) setRevealed(true);
          else onOpen(att);
        }}
        style={{
          position: "relative",
          width: maxW,
          height: h,
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,.1)",
          cursor: "pointer",
          background: "rgba(0,0,0,.25)",
        }}
      >
        <img
          src={`${API}${att.thumbUrl}`}
          alt="attachment"
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            filter: needsBlur ? "blur(26px) saturate(.7)" : "none",
            transform: needsBlur ? "scale(1.1)" : "none",
            transition: "filter .25s",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
          }}
        />
        {needsBlur && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(243,244,246,.92)",
                textShadow: "0 1px 6px rgba(0,0,0,.8)",
              }}
            >
              From an unranked member
            </span>
            <span
              style={{
                fontSize: 10,
                color: "rgba(226,232,240,.75)",
                textShadow: "0 1px 6px rgba(0,0,0,.8)",
              }}
            >
              tap to view
            </span>
          </div>
        )}
      </div>
      {exp != null && (
        <div style={{ fontSize: 9, color: "rgba(148,163,184,.45)", marginTop: 3, paddingRight: 3 }}>
          expires in {exp}d · keep forever with Indicted
        </div>
      )}
    </div>
  );
}

export function ChatBody({
  text,
  onMentionClick,
}: {
  text: string;
  onMentionClick?: (handle: string) => void;
}) {
  if (!text) return null;
  const imageUrls: string[] = [];
  const linkUrls: string[] = [];
  const weeredEmbeds: { url: string; kind: WeeredEmbedKind; id: string }[] = [];

  const lines = text.split(/\n/);
  const blockNodes: React.ReactNode[] = [];
  let blockKey = 0;

  for (const line of lines) {
    const isQuote = /^>\s?/.test(line);
    const content = isQuote ? line.replace(/^>\s?/, "") : line;
    const inlineNode = renderInline(content, imageUrls, linkUrls, weeredEmbeds, onMentionClick);
    if (isQuote) {
      blockNodes.push(
        <div
          key={blockKey++}
          style={{
            borderLeft: "3px solid var(--weered-accent-ring, rgba(124,58,237,0.55))",
            paddingLeft: 8,
            color: "var(--weered-muted, rgba(148,163,184,.85))",
            margin: "2px 0",
          }}
        >
          {inlineNode}
        </div>,
      );
    } else {
      blockNodes.push(<React.Fragment key={blockKey++}>{inlineNode}</React.Fragment>);
      if (blockKey < lines.length) blockNodes.push(<br key={`br-${blockKey}`} />);
    }
  }

  return (
    <>
      <div style={{ opacity: 0.95, wordBreak: "break-word" }}>{blockNodes}</div>
      {imageUrls.map((src, i) => (
        <a key={`img-${i}`} href={src} target="_blank" rel="noopener noreferrer">
          <img
            src={src}
            alt="Chat image"
            loading="lazy"
            style={{
              maxWidth: 280,
              maxHeight: 200,
              borderRadius: 8,
              marginTop: 4,
              border: "1px solid rgba(255,255,255,.1)",
              display: "block",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </a>
      ))}
      {weeredEmbeds.slice(0, 2).map((e, i) => {
        if (e.kind === "bounty")
          return <WeeredBountyEmbed key={`wb-${i}`} id={e.id} href={e.url} />;
        if (e.kind === "hunter")
          return <WeeredHunterEmbed key={`wh-${i}`} id={e.id} href={e.url} />;
        if (e.kind === "crew") return <WeeredCrewEmbed key={`wc-${i}`} id={e.id} href={e.url} />;
        if (e.kind === "nexus") return <NexusModEmbed key={`wn-${i}`} id={e.id} href={e.url} />;
        return null;
      })}
      {weeredEmbeds.length === 0 &&
        linkUrls.slice(0, 1).map((url, i) => <LinkPreviewCard key={`lp-${i}`} url={url} />)}
    </>
  );
}

export function renderInline(
  text: string,
  imageUrls: string[],
  linkUrls: string[],
  weeredEmbeds: { url: string; kind: WeeredEmbedKind; id: string }[],
  onMentionClick?: (handle: string) => void,
): React.ReactNode {
  if (!text) return null;

  const toks: InlineTok[] = [];
  let m: RegExpExecArray | null;

  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    toks.push({ kind: "url", start: m.index, end: m.index + m[0].length, value: m[0], raw: m[0] });
  }
  CARD_RE.lastIndex = 0;
  while ((m = CARD_RE.exec(text)) !== null) {
    if (toks.some((t) => t.kind === "url" && m!.index >= t.start && m!.index < t.end)) continue;
    toks.push({
      kind: "card",
      start: m.index,
      end: m.index + m[0].length,
      value: m[1].trim(),
      raw: m[0],
    });
  }
  MENTION_BODY_RE.lastIndex = 0;
  while ((m = MENTION_BODY_RE.exec(text)) !== null) {
    if (toks.some((t) => t.kind === "url" && m!.index >= t.start && m!.index < t.end)) continue;
    toks.push({
      kind: "mention",
      start: m.index,
      end: m.index + m[0].length,
      value: m[1],
      raw: m[0],
    });
  }
  CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(text)) !== null) {
    toks.push({ kind: "code", start: m.index, end: m.index + m[0].length, value: m[1], raw: m[0] });
  }
  BOLD_RE.lastIndex = 0;
  while ((m = BOLD_RE.exec(text)) !== null) {
    if (toks.some((t) => t.kind === "code" && m!.index >= t.start && m!.index < t.end)) continue;
    toks.push({ kind: "bold", start: m.index, end: m.index + m[0].length, value: m[1], raw: m[0] });
  }
  ITALIC_RE.lastIndex = 0;
  while ((m = ITALIC_RE.exec(text)) !== null) {
    const starStart = m.index + m[1].length;
    const innerStart = starStart + 1;
    const innerEnd = innerStart + m[2].length;
    if (
      toks.some(
        (t) =>
          (t.kind === "code" || t.kind === "bold") && starStart >= t.start && starStart < t.end,
      )
    )
      continue;
    toks.push({
      kind: "italic",
      start: starStart,
      end: innerEnd + 1,
      value: m[2],
      raw: m[0].slice(m[1].length),
    });
  }
  toks.sort((a, b) => a.start - b.start);

  const keep: InlineTok[] = [];
  let prevEnd = -1;
  for (const t of toks) {
    if (t.start < prevEnd) continue;
    keep.push(t);
    prevEnd = t.end;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const t of keep) {
    if (t.start > cursor) parts.push(text.slice(cursor, t.start));
    if (t.kind === "url") {
      if (MTG_DECK_URL_RE.test(t.value)) {
        parts.push(<MtgDeckChip key={key++} url={t.value} />);
      } else {
        parts.push(
          <a
            key={key++}
            href={t.value}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#7c9dff",
              textDecoration: "underline",
              textUnderlineOffset: 2,
              wordBreak: "break-all",
            }}
          >
            {t.value}
          </a>,
        );
      }
      if (IMG_EXT.test(t.value) || TENOR_RE.test(t.value)) {
        imageUrls.push(t.value);
      } else {
        const weered = detectWeeredEmbed(t.value);
        if (weered) weeredEmbeds.push({ url: t.value, kind: weered.kind, id: weered.id });
        else linkUrls.push(t.value);
      }
    } else if (t.kind === "mention") {
      const handle = t.value;
      parts.push(
        <span
          key={key++}
          onClick={(e) => {
            e.stopPropagation();
            if (onMentionClick) onMentionClick(handle);
          }}
          style={{
            display: "inline-block",
            padding: "0 4px",
            borderRadius: 4,
            background: "var(--weered-accent-bg, rgba(124,58,237,0.18))",
            color: "var(--weered-accent-text, rgba(196,181,253,0.95))",
            fontWeight: 700,
            cursor: onMentionClick ? "pointer" : "default",
          }}
        >
          @{handle}
        </span>,
      );
    } else if (t.kind === "bold") {
      parts.push(
        <strong key={key++} style={{ fontWeight: 800 }}>
          {t.value}
        </strong>,
      );
    } else if (t.kind === "italic") {
      parts.push(
        <em key={key++} style={{ fontStyle: "italic" }}>
          {t.value}
        </em>,
      );
    } else if (t.kind === "code") {
      parts.push(
        <code
          key={key++}
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.92em",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 4,
            padding: "0 5px",
          }}
        >
          {t.value}
        </code>,
      );
    } else if (t.kind === "card") {
      parts.push(<MtgCardChip key={key++} name={t.value} />);
    }
    cursor = t.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}
