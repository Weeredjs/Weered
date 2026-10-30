"use client";

// The Webpage block, in a lobby's Home or the viewer's own Weered. Weered asks
// once whether the site allows being shown inside another (GET /embed/check,
// cached a day on the server, shared by everyone using the link):
//   allowed → the live page, walled off in a sandboxed frame;
//   refused → a link card from the site's own title, picture and icon.
// So the block never shows the blank box a refused frame leaves. The page is
// loaded by the viewer's browser straight from the site, never through Weered.
import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

type Check =
  | { ok: false; error?: string }
  | {
      ok: true;
      url: string;
      frameable: boolean;
      embedUrl?: string;
      title?: string;
      description?: string;
      image?: string;
      icon?: string;
      site?: string;
    };

// One request per link per page view, however many blocks show it.
const asked = new Map<string, Promise<Check>>();
function check(url: string): Promise<Check> {
  let p = asked.get(url);
  if (!p) {
    p = fetch(`${API}/embed/check?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .catch(() => ({ ok: false }) as Check);
    asked.set(url, p);
  }
  return p;
}

function https(u: unknown): string {
  if (typeof u !== "string" || !u) return "";
  try {
    const x = new URL(u);
    return x.protocol === "https:" ? x.toString() : "";
  } catch {
    return "";
  }
}

export const WEB_HEIGHT = {
  rail: { s: 200, m: 320, l: 480 },
  wide: { s: 260, m: 440, l: 640 },
} as const;

export default function WebpageEmbed({
  url,
  height = "m",
  wide = true,
  title,
}: {
  url: string;
  height?: "s" | "m" | "l";
  wide?: boolean;
  title?: string;
}) {
  const safe = https(url);
  const [res, setRes] = useState<Check | null>(null);
  useEffect(() => {
    setRes(null);
    if (!safe) return;
    let alive = true;
    void check(safe).then((r) => alive && setRes(r));
    return () => {
      alive = false;
    };
  }, [safe]);

  if (!safe) return <div className="wsb-hint">Paste a link (https://…) in Design.</div>;
  if (!res) return <div className="wsb-hint">Checking the site…</div>;

  const h = WEB_HEIGHT[wide ? "wide" : "rail"][height];
  if (res.ok && res.frameable) {
    const src = https(res.embedUrl) || https(res.url) || safe;
    return (
      <div className="wsb-web" style={{ height: h }}>
        <iframe
          src={src}
          title={title || res.title || res.site || "Webpage"}
          // Walled off: its own scripts and forms, new tabs for links, but no
          // reach into Weered and no taking over the page around it.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
          allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </div>
    );
  }

  // Refused (or unreachable from here): a card that always works.
  const info = res.ok ? res : null;
  const image = https(info?.image);
  const icon = https(info?.icon);
  let host = "";
  try {
    host = new URL(safe).hostname.replace(/^www\./, "");
  } catch {}
  return (
    <a
      className="wsb-linkcard"
      href={https(info?.url) || safe}
      target="_blank"
      rel="noopener noreferrer"
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="wsb-linkcard-img" src={image} alt="" loading="lazy" />
      )}
      <span className="wsb-linkcard-body">
        <span className="wsb-linkcard-site">
          {icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" width={14} height={14} loading="lazy" />
          )}
          {info?.site || host}
        </span>
        <span className="wsb-linkcard-title">{title || info?.title || host}</span>
        {info?.description && wide && <span className="wsb-linkcard-desc">{info.description}</span>}
        <span className="wsb-linkcard-open">Open ↗</span>
      </span>
    </a>
  );
}
