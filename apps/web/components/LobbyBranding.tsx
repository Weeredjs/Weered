"use client";

import React, { useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export type BrandingValue = {
  name: string;
  description: string;
  accentColor: string;
  logoUrl: string;
  bannerUrl: string;
};

const ACCENT_PRESETS = [
  "#7c3aed",
  "#22c55e",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#3b82f6",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#14b8a6",
  "#d946ef",
  "#f43f5e",
  "#0ea5e9",
  "#a855f7",
  "#84cc16",
];

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export default function LobbyBranding({
  value,
  onChange,
  showName = true,
}: {
  value: BrandingValue;
  onChange: (patch: Partial<BrandingValue>) => void;
  showName?: boolean;
}) {
  const accent = /^#[0-9a-f]{6}$/i.test(value.accentColor) ? value.accentColor : "#7c3aed";

  return (
    <div
      className="weered-lobby-branding"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr minmax(280px, 360px)",
        gap: 24,
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
        {showName && (
          <>
            <Field label="Lobby name">
              <input
                value={value.name}
                onChange={(e) => onChange({ name: e.target.value.slice(0, 40) })}
                placeholder="e.g. Night Shift Gaming"
                style={inputStyle}
              />
            </Field>
            <Field label="Description" optional>
              <textarea
                value={value.description}
                onChange={(e) => onChange({ description: e.target.value.slice(0, 200) })}
                placeholder="What's this lobby about?"
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 70, fontFamily: "inherit" }}
              />
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(148,163,184,.5)",
                  textAlign: "right",
                  marginTop: 2,
                }}
              >
                {value.description.length}/200
              </div>
            </Field>
          </>
        )}

        <Field label="Accent color">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
            {ACCENT_PRESETS.map((c) => {
              const active = accent.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ accentColor: c })}
                  title={c}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    cursor: "pointer",
                    background: c,
                    border: active ? "2px solid #fff" : "2px solid transparent",
                    boxShadow: active ? `0 0 0 2px ${c}` : "none",
                  }}
                />
              );
            })}
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            >
              <input
                type="color"
                value={accent}
                onChange={(e) => onChange({ accentColor: e.target.value })}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,.15)",
                  background: "transparent",
                  padding: 2,
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(148,163,184,.6)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {accent}
              </span>
            </label>
          </div>
        </Field>

        <Field label="Logo" optional>
          <ImageUpload
            kind="logo"
            current={value.logoUrl}
            accent={accent}
            onUploaded={(url) => onChange({ logoUrl: url })}
            onClear={() => onChange({ logoUrl: "" })}
            square
          />
        </Field>

        <Field label="Banner" optional>
          <ImageUpload
            kind="banner"
            current={value.bannerUrl}
            accent={accent}
            onUploaded={(url) => onChange({ bannerUrl: url })}
            onClear={() => onChange({ bannerUrl: "" })}
          />
        </Field>
      </div>

      <div style={{ position: "sticky", top: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "rgba(148,163,184,.6)",
            marginBottom: 10,
          }}
        >
          Live preview
        </div>
        <LobbyPreview value={value} accent={accent} />
      </div>

      <style>{`
        @media (max-width: 720px) {
          .weered-lobby-branding { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function LobbyPreview({ value, accent }: { value: BrandingValue; accent: string }) {
  const name = value.name.trim() || "Your Lobby";
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 14,
        overflow: "hidden",
        background: "#0E1014",
      }}
    >
      <div
        style={{
          height: 96,
          position: "relative",
          background: value.bannerUrl
            ? `linear-gradient(180deg, rgba(14,16,20,.3), rgba(14,16,20,.85)), url(${value.bannerUrl}) center/cover no-repeat`
            : `radial-gradient(ellipse 90% 70% at 25% 0%, ${accent}55 0%, transparent 65%), linear-gradient(150deg, ${accent}33, #14161A)`,
        }}
      />
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}66, ${accent})` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        <div
          style={{
            width: 46,
            height: 46,
            flexShrink: 0,
            borderRadius: 10,
            marginTop: -34,
            zIndex: 1,
            border: `2px solid ${accent}`,
            outline: "3px solid #0E1014",
            background: value.logoUrl
              ? `url(${value.logoUrl}) center/cover, #14161A`
              : `${accent}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-barlow), sans-serif",
            fontWeight: 900,
            fontSize: 20,
            color: "#fff",
          }}
        >
          {!value.logoUrl && name.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 19,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: "#fff",
              lineHeight: 1.05,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
          {value.description.trim() && (
            <div
              style={{
                fontSize: 11,
                color: "rgba(148,163,184,.7)",
                marginTop: 2,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {value.description}
            </div>
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          padding: "0 14px 12px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "#fff", borderBottom: `2px solid ${accent}`, paddingBottom: 4 }}>
          Rooms
        </span>
        <span style={{ color: "rgba(148,163,184,.5)" }}>Feed</span>
        <span style={{ color: "rgba(148,163,184,.5)" }}>Events</span>
      </div>
    </div>
  );
}

function ImageUpload({
  kind,
  current,
  accent,
  onUploaded,
  onClear,
  square,
}: {
  kind: "logo" | "banner";
  current: string;
  accent: string;
  onUploaded: (url: string) => void;
  onClear: () => void;
  square?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    setErr("");
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      setErr("Under 4 MB please.");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp|gif|svg\+xml)$/.test(f.type)) {
      setErr("PNG, JPEG, WebP, GIF, or SVG.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ""));
        r.onerror = () => rej(new Error("read"));
        r.readAsDataURL(f);
      });
      const r = await fetch(`${API}/lobbies/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ image: dataUrl, kind }),
      });
      const j = await r.json();
      if (j?.ok && j.url) onUploaded(j.url);
      else setErr(j?.message || j?.error || "Upload failed.");
    } catch {
      setErr("Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {current ? (
        <div
          style={{
            width: square ? 48 : 96,
            height: 48,
            borderRadius: 8,
            flexShrink: 0,
            background: `url(${current}) center/cover no-repeat`,
            border: `1px solid ${accent}40`,
          }}
        />
      ) : (
        <div
          style={{
            width: square ? 48 : 96,
            height: 48,
            borderRadius: 8,
            flexShrink: 0,
            border: "1px dashed rgba(255,255,255,.15)",
            background: "rgba(255,255,255,.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            color: "rgba(148,163,184,.4)",
          }}
        >
          {square ? "◆" : "▭"}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
              border: `1px solid ${accent}55`,
              background: `${accent}15`,
              color: "#fff",
              borderRadius: 7,
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? "Uploading…" : current ? "Replace" : "Upload"}
          </button>
          {current && (
            <button
              type="button"
              onClick={onClear}
              style={{
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,.12)",
                background: "transparent",
                color: "rgba(148,163,184,.85)",
                borderRadius: 7,
              }}
            >
              Clear
            </button>
          )}
        </div>
        {err && <div style={{ fontSize: 10, color: "#fca5a5" }}>{err}</div>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        onChange={pick}
        style={{ display: "none" }}
      />
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "1px",
          textTransform: "uppercase",
          color: "rgba(148,163,184,.7)",
          marginBottom: 7,
        }}
      >
        {label}
        {optional && <span style={{ marginLeft: 6, opacity: 0.5, fontWeight: 600 }}>Optional</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  fontSize: 14,
  background: "rgba(0,0,0,.25)",
  border: "1px solid rgba(255,255,255,.10)",
  color: "rgba(243,244,246,.96)",
  borderRadius: 10,
  outline: "none",
};
