"use client";

import React from "react";
import { onActivate } from "@/lib/a11y";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#c9a066";

const BIOMES = ["PLAINS", "COAST", "CLIFFS", "SWAMP", "CAVE", "MOUNTAIN", "ISLAND"];
const BUILD_TYPES = ["SHIP", "DOCK", "FORTRESS", "TAVERN", "HIDEOUT", "OUTPOST", "BRIDGE", "MISC"];
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "MASTERWORK"];
const SHIP_CLASSES = ["SLOOP", "BRIG", "GALLEON", "FRIGATE"];

const MAX_IMAGES = 3;

type ImageSlot = { dataUrl: string; previewUrl: string };

export default function WindroseBuildBuilder({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [images, setImages] = React.useState<ImageSlot[]>([]);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [biome, setBiome] = React.useState("");
  const [buildType, setBuildType] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("");
  const [shipClass, setShipClass] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [partsCount, setPartsCount] = React.useState("");
  const [inGameLocation, setInGameLocation] = React.useState("");
  const [watermarked, setWatermarked] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const valid = title.trim().length >= 3 && images.length > 0;

  async function handleFiles(list: FileList | File[]) {
    setError("");
    const files = Array.from(list).slice(0, MAX_IMAGES - images.length);
    const next: ImageSlot[] = [];
    for (const f of files) {
      if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(f.type)) {
        setError("Use PNG, JPEG, WebP, or GIF.");
        continue;
      }
      if (f.size > 8 * 1024 * 1024) {
        setError("Each image must be under 8 MB before upload.");
        continue;
      }
      try {
        const dataUrl: string = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result || ""));
          r.onerror = () => rej(new Error("read_failed"));
          r.readAsDataURL(f);
        });
        next.push({ dataUrl, previewUrl: dataUrl });
      } catch {
        setError("Could not read one of the files.");
      }
    }
    if (next.length > 0) setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
  }

  function reorder(from: number, to: number) {
    if (from === to || to < 0 || to >= images.length) return;
    const arr = [...images];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    setImages(arr);
  }
  function removeAt(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }
  function addTag() {
    const t = tagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .slice(0, 24);
    if (!t || tags.includes(t) || tags.length >= 8) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const tok = (() => {
        try {
          return localStorage.getItem("weered_token") || "";
        } catch {
          return "";
        }
      })();
      if (!tok) {
        setError("Sign in to file a log.");
        setSubmitting(false);
        return;
      }
      const r = await fetch(`${API}/windrose/builds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          biome: biome || undefined,
          buildType: buildType || undefined,
          difficulty: difficulty || undefined,
          shipClass: buildType === "SHIP" ? shipClass || undefined : undefined,
          tags,
          partsCount: partsCount ? Number(partsCount) : undefined,
          inGameLocation: inGameLocation.trim() || undefined,
          watermarked,
          images: images.map((i) => i.dataUrl),
        }),
      });
      if (r.status === 429) {
        const j = await r.json().catch(() => ({}));
        setError(`Slow down — try again in ${Math.ceil((j.retryAfterMs || 60_000) / 1000)}s.`);
        return;
      }
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setError(j?.message || j?.error || "Submission failed.");
        return;
      }
      onCreated(j.build.slug);
    } catch (e: any) {
      setError(e?.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={onActivate(() => onClose())}
      tabIndex={0}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8,5,2,.78)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 20,
        overflow: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onActivate((e) => {
          e.stopPropagation();
        })}
        tabIndex={0}
        role="button"
        style={{
          width: "min(960px, 100%)",
          background: "linear-gradient(180deg, rgba(28,22,12,.97), rgba(14,10,6,.99))",
          border: "2px solid rgba(232,196,138,.55)",
          borderRadius: 6,
          boxShadow:
            "0 0 0 1px rgba(0,0,0,.5), 0 30px 80px rgba(0,0,0,.7), 0 0 30px rgba(232,196,138,.15)",
          padding: 20,
          color: "rgba(228,212,176,.92)",
          fontFamily: "inherit",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-pirata, 'Pirata One'), serif",
                fontSize: 26,
                color: "#e8c48a",
                letterSpacing: 1,
                lineHeight: 1,
              }}
            >
              File a Log
            </div>
            <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
              Show the crew what you built. Up to 3 images, max 8 MB each before compression.
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
            gap: 16,
          }}
        >
          <div>
            <Label>Images</Label>
            <DropZone
              count={images.length}
              onPick={(files) => handleFiles(files)}
              onClick={() => fileRef.current?.click()}
              accent={ACCENT}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {images.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 6,
                  marginTop: 8,
                }}
              >
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "relative",
                      paddingBottom: "66%",
                      overflow: "hidden",
                      borderRadius: 4,
                      border: `1px solid ${ACCENT}55`,
                    }}
                  >
                    <img
                      src={img.previewUrl}
                      alt=""
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,.7) 100%)",
                        pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 4,
                        bottom: 4,
                        fontSize: 9,
                        fontWeight: 800,
                        color: "#e8c48a",
                        letterSpacing: 1,
                      }}
                    >
                      #{idx + 1}
                      {idx === 0 ? " · COVER" : ""}
                    </div>
                    <div
                      style={{ position: "absolute", right: 4, top: 4, display: "flex", gap: 3 }}
                    >
                      {idx > 0 && (
                        <Mini onClick={() => reorder(idx, idx - 1)} title="Move up">
                          ↑
                        </Mini>
                      )}
                      {idx < images.length - 1 && (
                        <Mini onClick={() => reorder(idx, idx + 1)} title="Move down">
                          ↓
                        </Mini>
                      )}
                      <Mini onClick={() => removeAt(idx)} title="Remove" danger>
                        ✕
                      </Mini>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <Label>Title</Label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                placeholder="The Stormbreaker — flagship galleon"
                style={inputStyle}
              />
              <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2, textAlign: "right" }}>
                {title.length}/80
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <Label>Description</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
                placeholder="What's the build, why does it work, anything sailors should know..."
                rows={5}
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2, textAlign: "right" }}>
                {description.length}/4000
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <Label>
                Tags <span style={{ opacity: 0.55, fontWeight: 400 }}>· up to 8</span>
              </Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {tags.map((t, i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 3,
                      background: `${ACCENT}26`,
                      border: `1px solid ${ACCENT}55`,
                      fontSize: 11,
                      color: "#e8c48a",
                    }}
                  >
                    {t}
                    <button
                      onClick={() => setTags((prev) => prev.filter((_, j) => j !== i))}
                      style={{
                        background: "none",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: 12,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
                placeholder="naval, raid, pvp..."
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <Label>Biome</Label>
            <Selector value={biome} setValue={setBiome} options={BIOMES} />

            <Label style={{ marginTop: 10 }}>Build Type</Label>
            <Selector value={buildType} setValue={setBuildType} options={BUILD_TYPES} />

            {buildType === "SHIP" && (
              <>
                <Label style={{ marginTop: 10 }}>Ship Class</Label>
                <Selector value={shipClass} setValue={setShipClass} options={SHIP_CLASSES} />
              </>
            )}

            <Label style={{ marginTop: 10 }}>Difficulty</Label>
            <Selector value={difficulty} setValue={setDifficulty} options={DIFFICULTIES} />

            <Label style={{ marginTop: 10 }}>Parts (optional)</Label>
            <input
              value={partsCount}
              onChange={(e) => setPartsCount(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="e.g. 1240"
              style={inputStyle}
            />

            <Label style={{ marginTop: 10 }}>In-game location (optional)</Label>
            <input
              value={inGameLocation}
              onChange={(e) => setInGameLocation(e.target.value.slice(0, 60))}
              placeholder="Coords or named region"
              style={inputStyle}
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
                padding: "8px 10px",
                background: "rgba(20,16,8,.6)",
                border: "1px solid rgba(201,160,102,.25)",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              <input
                type="checkbox"
                checked={watermarked}
                onChange={(e) => setWatermarked(e.target.checked)}
              />
              <span>Watermark with my handle (deters reposts)</span>
            </label>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 10px",
                  background: "rgba(185,28,28,.18)",
                  border: "1px solid rgba(239,68,68,.4)",
                  borderRadius: 3,
                  color: "#fca5a5",
                  fontSize: 11,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!valid || submitting}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "12px 14px",
                background:
                  valid && !submitting
                    ? `linear-gradient(135deg, ${ACCENT} 0%, #e8c48a 100%)`
                    : "rgba(201,160,102,.18)",
                color: valid && !submitting ? "#1a1410" : "rgba(228,212,176,.4)",
                border: `1px solid ${valid && !submitting ? "rgba(232,196,138,.85)" : "rgba(201,160,102,.25)"}`,
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: "uppercase",
                cursor: valid && !submitting ? "pointer" : "default",
                fontFamily: "inherit",
                boxShadow:
                  valid && !submitting
                    ? "0 0 12px rgba(232,196,138,.25), inset 0 1px 0 rgba(255,255,255,.25)"
                    : "none",
              }}
            >
              {submitting ? "Filing the log…" : "File Log"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "1.4px",
        color: "rgba(232,196,138,.7)",
        textTransform: "uppercase",
        marginBottom: 5,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "rgba(10,8,4,.6)",
  border: "1px solid rgba(201,160,102,.35)",
  color: "rgba(228,212,176,.95)",
  borderRadius: 3,
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const closeBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 4,
  color: "rgba(228,212,176,.7)",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "inherit",
};

function DropZone({
  count,
  onPick,
  onClick,
  accent,
}: {
  count: number;
  onPick: (f: FileList) => void;
  onClick: () => void;
  accent: string;
}) {
  const [hover, setHover] = React.useState(false);
  const remaining = MAX_IMAGES - count;
  return (
    <div
      onClick={onClick}
      onKeyDown={onActivate(() => onClick())}
      tabIndex={0}
      role="button"
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        if (e.dataTransfer.files) onPick(e.dataTransfer.files);
      }}
      style={{
        padding: "18px 14px",
        border: `2px dashed ${hover ? accent : "rgba(201,160,102,.4)"}`,
        borderRadius: 4,
        background: hover ? `${accent}14` : "rgba(10,8,4,.4)",
        textAlign: "center",
        cursor: "pointer",
        transition: "all .12s",
        opacity: remaining > 0 ? 1 : 0.5,
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 4, opacity: 0.7 }}>📎</div>
      <div style={{ fontSize: 12, color: "rgba(228,212,176,.75)" }}>
        {remaining > 0
          ? `Drop or click to add images (${remaining} slot${remaining === 1 ? "" : "s"} left)`
          : "Max 3 images per build"}
      </div>
    </div>
  );
}

function Selector({
  value,
  setValue,
  options,
}: {
  value: string;
  setValue: (v: string) => void;
  options: string[];
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => setValue(active ? "" : o)}
            style={{
              padding: "4px 8px",
              borderRadius: 3,
              border: `1px solid ${active ? ACCENT : "rgba(201,160,102,.25)"}`,
              background: active ? `${ACCENT}28` : "transparent",
              color: active ? "#e8c48a" : "rgba(228,212,176,.7)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".5px",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {o.toLowerCase().replace(/^./, (c) => c.toUpperCase())}
          </button>
        );
      })}
    </div>
  );
}

function Mini({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 22,
        height: 22,
        background: danger ? "rgba(185,28,28,.7)" : "rgba(0,0,0,.65)",
        border: `1px solid ${danger ? "rgba(239,68,68,.6)" : "rgba(201,160,102,.45)"}`,
        borderRadius: 3,
        color: "rgba(228,212,176,.95)",
        fontSize: 10,
        fontWeight: 800,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
