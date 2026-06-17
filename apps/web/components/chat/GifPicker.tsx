"use client";

import { useEffect, useRef, useState } from "react";
import { onActivate } from "@/lib/a11y";

const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY || "";
const TENOR_URL = "https://tenor.googleapis.com/v2";

export function GifPicker({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${TENOR_URL}/featured?key=${TENOR_API_KEY}&limit=20&media_filter=tinygif,gif`)
      .then((r) => r.json())
      .then((j) => {
        setResults(j.results || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  function search() {
    if (!query.trim()) return;
    setLoading(true);
    fetch(
      `${TENOR_URL}/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(query)}&limit=20&media_filter=tinygif,gif`,
    )
      .then((r) => r.json())
      .then((j) => {
        setResults(j.results || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        right: 0,
        width: 320,
        maxHeight: 360,
        background: "#1a1a2e",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 12,
        padding: 8,
        zIndex: 50,
        boxShadow: "0 8px 32px rgba(0,0,0,.5)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search GIFs..."
          style={{
            flex: 1,
            padding: "5px 8px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,.1)",
            background: "rgba(0,0,0,.3)",
            color: "rgba(243,244,246,.9)",
            fontSize: 12,
            outline: "none",
          }}
        />
        <button
          onClick={search}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid rgba(124,58,237,.3)",
            background: "rgba(124,58,237,.12)",
            color: "rgba(216,180,254,.9)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Go
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 4,
        }}
      >
        {loading && (
          <div
            style={{
              gridColumn: "1/-1",
              textAlign: "center",
              padding: 16,
              opacity: 0.4,
              fontSize: 12,
            }}
          >
            Loading...
          </div>
        )}
        {results.map((r: any) => {
          const tiny = r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || "";
          const full = r.media_formats?.gif?.url || tiny;
          if (!tiny) return null;
          return (
            <img
              key={r.id}
              src={tiny}
              alt="GIF"
              loading="lazy"
              onClick={() => {
                onSelect(full);
                onClose();
              }}
              onKeyDown={onActivate(() => {
                onSelect(full);
                onClose();
              })}
              role="button"
              tabIndex={0}
              style={{
                width: "100%",
                height: 80,
                objectFit: "cover",
                borderRadius: 6,
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,.06)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,.4)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.06)")}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 9, textAlign: "right", opacity: 0.2, marginTop: 4 }}>
        Powered by Tenor
      </div>
    </div>
  );
}
