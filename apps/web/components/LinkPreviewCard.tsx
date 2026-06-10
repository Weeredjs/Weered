"use client";

import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

export default function LinkPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/unfurl?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(j => { if (!cancelled && j.ok && (j.title || j.description)) setData(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  if (!data) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block", marginTop: 6 }}>
      <div style={{
        borderRadius: 8, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)",
        overflow: "hidden", maxWidth: 320, transition: "border-color .15s",
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,.3)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,.08)")}
      >
        {data.image && (
          <img src={data.image} alt={data.title || "Link preview"}
            style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
            onError={e => (e.currentTarget.style.display = "none")} />
        )}
        <div style={{ padding: "8px 10px" }}>
          {data.siteName && (
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "rgba(124,58,237,.6)", marginBottom: 3 }}>
              {data.siteName}
            </div>
          )}
          {data.title && (
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.9)", lineHeight: 1.3, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>
              {data.title}
            </div>
          )}
          {data.description && (
            <div style={{ fontSize: 11, color: "rgba(148,163,184,.6)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>
              {data.description}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
