"use client";

import React, { useRef, useState } from "react";
import type { MapData, TokenData } from "./TacticalMap";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#C4A55A";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || localStorage.getItem("token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

const stoneBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid rgba(196,165,90,.30)",
  background: "linear-gradient(180deg, rgba(60,42,28,0.85) 0%, rgba(36,26,18,0.92) 100%)",
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(243,236,220,0.88)",
  fontFamily: "inherit",
  cursor: "pointer",
  letterSpacing: ".3px",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const stoneBtnActive: React.CSSProperties = {
  ...stoneBtn,
  borderColor: `${ACCENT}88`,
  background: `linear-gradient(180deg, ${ACCENT}22 0%, ${ACCENT}11 100%)`,
  color: ACCENT,
};

type Props = {
  roomId: string;
  map: MapData | null;
  isDM: boolean;
  tool: "select" | "addToken" | "addHidden" | "fogReveal" | "fogClear" | "measure";
  setTool: (t: Props["tool"]) => void;
  selectedToken: TokenData | null;
  onUploaded: () => void;
  onClearSelection: () => void;
  onClearMeasure: () => void;
};

export default function TacticalMapToolbar({
  roomId,
  map,
  isDM,
  tool,
  setTool,
  selectedToken,
  onUploaded,
  onClearSelection,
  onClearMeasure,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      alert("Map images must be under 8MB.");
      return;
    }
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) {
      alert("Map must be PNG, JPEG, or WebP.");
      return;
    }

    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(new Error("read_failed"));
        r.readAsDataURL(f);
      });
      const dims: { w: number; h: number } = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("decode_failed"));
        img.src = dataUrl;
      });
      const name = f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Battle Map";
      const r = await fetch(`${API}/maps/${encodeURIComponent(roomId)}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ image: dataUrl, widthPx: dims.w, heightPx: dims.h, name }),
      });
      const j = await r.json();
      if (!j.ok) alert(`Upload failed: ${j.error || "unknown"}`);
      else onUploaded();
    } catch (err: any) {
      alert(`Upload failed: ${err?.message || err}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function patchMap(data: any) {
    if (!map) return;
    await fetch(`${API}/maps/${map.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    }).catch(() => {});
  }

  async function deleteSelected() {
    if (!selectedToken) return;
    if (!window.confirm(`Remove "${selectedToken.name}"?`)) return;
    await fetch(`${API}/maps/tokens/${selectedToken.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    onClearSelection();
  }

  async function setHp(delta: number) {
    if (!selectedToken) return;
    const next = Math.max(0, selectedToken.hp + delta);
    await fetch(`${API}/maps/tokens/${selectedToken.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ hp: next }),
    }).catch(() => {});
  }

  async function clearAllFog() {
    if (!map) return;
    if (!window.confirm("Hide the entire map again?")) return;
    await fetch(`${API}/maps/${map.id}/fog/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  async function deleteMap() {
    if (!map) return;
    if (!window.confirm(`Remove the entire map "${map.name}"?`)) return;
    await fetch(`${API}/maps/${map.id}`, { method: "DELETE", headers: authHeaders() });
  }

  return (
    <div
      className="weered-dnd-modules"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "8px 12px",
        borderBottom: `1px solid ${ACCENT}33`,
        background: "linear-gradient(180deg, rgba(28,20,14,0.95) 0%, rgba(18,12,8,0.95) 100%)",
        flexShrink: 0,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-pirata), serif",
          fontSize: 16,
          color: ACCENT,
          letterSpacing: ".5px",
          marginRight: 8,
        }}
      >
        ⚔ Battle Map
      </span>

      <button
        style={tool === "select" ? stoneBtnActive : stoneBtn}
        onClick={() => {
          setTool("select");
          onClearMeasure();
        }}
      >
        ↖ Select
      </button>
      <button
        style={tool === "measure" ? stoneBtnActive : stoneBtn}
        onClick={() => {
          setTool("measure");
          onClearMeasure();
        }}
        disabled={!map}
        title="Click two cells to measure"
      >
        📏 Measure
      </button>

      {isDM && (
        <>
          <span style={{ width: 1, height: 18, background: `${ACCENT}33`, margin: "0 4px" }} />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={onPickFile}
          />
          <button style={stoneBtn} disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "⏳ Uploading…" : map ? "🗺 Replace Map" : "🗺 Upload Map"}
          </button>
          {map && (
            <>
              <button
                style={tool === "addToken" ? stoneBtnActive : stoneBtn}
                onClick={() => setTool("addToken")}
                title="Click on the map to place"
              >
                ＋ Token
              </button>
              <button
                style={tool === "addHidden" ? stoneBtnActive : stoneBtn}
                onClick={() => setTool("addHidden")}
                title="Hidden from players"
              >
                ＋ Hidden
              </button>
              <button
                style={tool === "fogReveal" ? stoneBtnActive : stoneBtn}
                onClick={() => setTool("fogReveal")}
              >
                🌫 Reveal Fog
              </button>
              <button
                style={tool === "fogClear" ? stoneBtnActive : stoneBtn}
                onClick={() => setTool("fogClear")}
              >
                🌑 Hide Fog
              </button>
              <button style={stoneBtn} onClick={clearAllFog}>
                Hide All
              </button>
              <button style={stoneBtn} onClick={() => setShowGrid((s) => !s)}>
                # Grid
              </button>
              <button style={stoneBtn} onClick={deleteMap}>
                🗑 Map
              </button>
            </>
          )}
        </>
      )}

      {selectedToken && (
        <>
          <span style={{ width: 1, height: 18, background: `${ACCENT}33`, margin: "0 4px" }} />
          <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>{selectedToken.name}</span>
          {selectedToken.hpMax > 0 && (
            <>
              <span style={{ fontSize: 11, color: "rgba(243,236,220,.7)" }}>
                HP {selectedToken.hp}/{selectedToken.hpMax}
              </span>
              <button style={stoneBtn} onClick={() => setHp(-1)}>
                −
              </button>
              <button style={stoneBtn} onClick={() => setHp(+1)}>
                +
              </button>
            </>
          )}
          {isDM && (
            <button style={stoneBtn} onClick={deleteSelected}>
              🗑
            </button>
          )}
        </>
      )}

      {showGrid && map && isDM && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            paddingTop: 8,
            borderTop: `1px dashed ${ACCENT}33`,
            marginTop: 4,
            alignItems: "center",
          }}
        >
          <label style={{ fontSize: 11, color: "rgba(243,236,220,.75)" }}>
            <input
              type="checkbox"
              checked={map.gridEnabled}
              onChange={(e) => patchMap({ gridEnabled: e.target.checked })}
            />{" "}
            Show grid
          </label>
          <label style={{ fontSize: 11, color: "rgba(243,236,220,.75)" }}>
            <input
              type="checkbox"
              checked={map.fogEnabled}
              onChange={(e) => patchMap({ fogEnabled: e.target.checked })}
            />{" "}
            Fog of war
          </label>
          <label
            style={{
              fontSize: 11,
              color: "rgba(243,236,220,.75)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Cell px
            <input
              type="number"
              min={8}
              max={500}
              defaultValue={map.gridSize}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v)) patchMap({ gridSize: v });
              }}
              style={{
                width: 60,
                padding: "2px 6px",
                background: "rgba(0,0,0,.3)",
                border: `1px solid ${ACCENT}33`,
                color: "inherit",
                borderRadius: 4,
              }}
            />
          </label>
          <label
            style={{
              fontSize: 11,
              color: "rgba(243,236,220,.75)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Color
            <input
              type="color"
              defaultValue={map.gridColor}
              onBlur={(e) => patchMap({ gridColor: e.target.value })}
            />
          </label>
          <label
            style={{
              fontSize: 11,
              color: "rgba(243,236,220,.75)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Opacity
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              defaultValue={map.gridOpacity}
              onChange={(e) => patchMap({ gridOpacity: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
