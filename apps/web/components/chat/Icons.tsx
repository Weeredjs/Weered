"use client";

import React from "react";

const svgProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
export const Icons = {
  Smile: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  Reply: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  ),
  Forward: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  ),
  More: (p: any = {}) => (
    <svg {...svgProps} fill="currentColor" stroke="none" {...p}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  ),
  Copy: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Link: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  Unread: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  ),
  Speak: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  Edit: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4c0-.55.45-1 1-1h4c.55 0 1 .45 1 1v2" />
    </svg>
  ),
  Flag: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  Pin: (p: any = {}) => (
    <svg {...svgProps} {...p}>
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14l-1.5-4.5a2 2 0 0 1 .5-2L20 9V3H4v6l1.5 1.5a2 2 0 0 1 .5 2L5 17z" />
    </svg>
  ),
  Gif: (p: any = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm3.3 3.2v2.6h1.5v.6H8.5c-.1.3-.4.5-.9.5-.7 0-1.2-.5-1.2-1.4S7 9.1 7.7 9.1c.5 0 .9.3 1 .6h1.1c-.1-.8-.9-1.6-2.1-1.6-1.5 0-2.4 1-2.4 2.5s.9 2.5 2.3 2.5c.8 0 1.4-.4 1.6-.9l.1.8h.8V10H7.3v-1.8zm5.3 0h-1.2v5.2h1.2V8.2zm1.4 0v5.2h1.2v-2h1.6v-.9h-1.6v-1.4h2.1v-.9h-3.3z" />
    </svg>
  ),
  Emoji: (p: any = {}) => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  Send: (p: any = {}) => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
    </svg>
  ),
};
