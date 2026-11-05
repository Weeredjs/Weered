"use client";

// The crew's look, edited on its own page by its leader (James 2026-10-31:
// "biker patch look, tag [HELL]"): name, tag, tag shape, colour, the blurb and
// recruiting. Describe it and the fields fill in; Save keeps them. Before this
// the only editor was buried in the Windrose crew panel (WrCrew.tsx).
import React, { useState } from "react";
import DescribeBox from "../build/DescribeBox";
import { describeJob } from "../../lib/aiBuild";
import { API, authHeaders } from "../../lib/apiClient";

type Look = {
  name: string;
  tag: string;
  tagShape: "rounded" | "square" | "pill";
  accentColor: string;
  description: string;
  recruiting: boolean;
  recruitingNote: string;
};

const RADIUS = { rounded: 6, square: 0, pill: 999 } as const;

const field: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 11px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(0,0,0,.3)",
  color: "#f3f4f6",
  font: "inherit",
  fontSize: 13,
};
const label: React.CSSProperties = {
  display: "block",
  margin: "12px 0 5px",
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "rgba(226,232,240,.55)",
};

export default function CrewEditor({
  crew,
  onSaved,
}: {
  crew: {
    id: string;
    name: string;
    tag: string;
    tagShape?: string | null;
    accentColor?: string | null;
    description: string;
    recruiting: boolean;
    recruitingNote: string;
    logoUrl?: string | null;
    bannerUrl?: string | null;
  };
  onSaved: (crew: any) => void;
}) {
  const start = (): Look => ({
    name: crew.name,
    tag: crew.tag,
    tagShape: (["rounded", "square", "pill"].includes(String(crew.tagShape))
      ? crew.tagShape
      : "rounded") as Look["tagShape"],
    accentColor: /^#[0-9a-f]{6}$/i.test(String(crew.accentColor))
      ? String(crew.accentColor)
      : "#7c3aed",
    description: crew.description || "",
    recruiting: !!crew.recruiting,
    recruitingNote: crew.recruitingNote || "",
  });
  const [open, setOpen] = useState(false);
  const [look, setLook] = useState<Look>(start);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (p: Partial<Look>) => setLook((l) => ({ ...l, ...p }));
  // The crew's pictures save as soon as they're picked (POST /crews/:id/image,
  // checked like a profile banner); James 2026-11-05: "I can only change the colors".
  const [pics, setPics] = useState({ logo: crew.logoUrl || "", banner: crew.bannerUrl || "" });
  const [busy, setBusy] = useState<"" | "logo" | "banner">("");

  async function upload(kind: "logo" | "banner", file: File | undefined) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setMsg("That picture is over 4MB.");
      return;
    }
    setBusy(kind);
    setMsg("");
    try {
      const image = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result || ""));
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(file);
      });
      const r = await fetch(`${API}/crews/${encodeURIComponent(crew.id)}/image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ kind, image }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok && j.crew) {
        setPics((p) => ({ ...p, [kind]: j.url }));
        setMsg(kind === "logo" ? "Logo saved." : "Banner saved.");
        onSaved(j.crew);
      } else setMsg(j?.message || "That picture didn't upload. Try another.");
    } catch {
      setMsg("Couldn't reach Weered.");
    }
    setBusy("");
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch(`${API}/crews/${encodeURIComponent(crew.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...look,
          tag: look.tag
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 6),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok && j.crew) {
        setMsg("Saved.");
        onSaved(j.crew);
      } else
        setMsg(
          j?.error === "leader_only"
            ? "Only the crew's leader can change this."
            : j?.message || "Didn't save. Try again.",
        );
    } catch {
      setMsg("Couldn't reach Weered.");
    }
    setSaving(false);
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setLook(start());
          setOpen(true);
        }}
        style={{
          margin: "0 0 14px",
          padding: "8px 14px",
          borderRadius: 999,
          border: `1px solid ${look.accentColor}66`,
          background: `${look.accentColor}1a`,
          color: "#f3f4f6",
          font: "inherit",
          fontSize: 12.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ✦ Edit your crew&apos;s look
      </button>
    );

  return (
    <div
      style={{
        margin: "0 0 14px",
        padding: "14px 16px 16px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.1)",
        background: "rgba(10,10,18,.85)",
        color: "#f3f4f6",
        fontFamily: "inherit",
      }}
    >
      <DescribeBox
        kind="crew"
        accent={look.accentColor}
        className="db-in-tab"
        label="Describe your crew"
        placeholder="Biker patch look, tag [HELL], we ride at night"
        onBuild={async (prompt) => {
          const j = await describeJob<Look>("crew", prompt, { extra: { crewId: crew.id } });
          const before = look;
          setLook({ ...j.result, tag: j.result.tag || look.tag });
          setMsg("");
          return {
            summary: `${j.summary || "Here it is."} Save to keep it.`,
            undo: () => setLook(before),
          };
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 6px" }}>
        <span
          style={{
            padding: "3px 9px",
            borderRadius: RADIUS[look.tagShape],
            background: look.accentColor,
            color: "#fff",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: ".08em",
          }}
        >
          [{look.tag || "TAG"}]
        </span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{look.name || "Your crew"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 10 }}>
        <div>
          <span style={label}>Name</span>
          <input
            style={field}
            value={look.name}
            maxLength={60}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
        <div>
          <span style={label}>Tag</span>
          <input
            style={{ ...field, textTransform: "uppercase" }}
            value={look.tag}
            maxLength={6}
            onChange={(e) => set({ tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
        <div>
          <span style={label}>Tag shape</span>
          <select
            style={field}
            value={look.tagShape}
            onChange={(e) => set({ tagShape: e.target.value as Look["tagShape"] })}
          >
            <option value="rounded">Rounded</option>
            <option value="square">Square</option>
            <option value="pill">Pill</option>
          </select>
        </div>
        <div>
          <span style={label}>Colour</span>
          <input
            type="color"
            style={{ ...field, padding: 2, height: 36 }}
            value={look.accentColor}
            onChange={(e) => set({ accentColor: e.target.value })}
          />
        </div>
      </div>
      <span style={label}>Logo and banner</span>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {(
          [
            ["logo", "Logo", 64, 64],
            ["banner", "Banner", 230, 64],
          ] as const
        ).map(([kind, name, w, h]) => (
          <label
            key={kind}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 6,
              borderRadius: 10,
              border: "1px dashed rgba(255,255,255,.18)",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            <span
              style={{
                width: w,
                height: h,
                borderRadius: kind === "logo" ? 10 : 8,
                flexShrink: 0,
                background: pics[kind]
                  ? `url("${pics[kind]}") center / cover no-repeat`
                  : `linear-gradient(135deg, ${look.accentColor}55, rgba(0,0,0,.4))`,
                border: `1px solid ${look.accentColor}55`,
              }}
            />
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>
              {busy === kind
                ? "Uploading…"
                : `${pics[kind] ? "Change" : "Add"} ${name.toLowerCase()}`}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: "none" }}
              disabled={!!busy}
              onChange={(e) => {
                void upload(kind, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        ))}
      </div>
      <span style={label}>About the crew</span>
      <textarea
        style={{ ...field, resize: "vertical" }}
        rows={3}
        maxLength={800}
        value={look.description}
        onChange={(e) => set({ description: e.target.value })}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={look.recruiting}
          onChange={(e) => set({ recruiting: e.target.checked })}
        />
        Recruiting
      </label>
      {look.recruiting && (
        <>
          <span style={label}>Who you&apos;re looking for</span>
          <textarea
            style={{ ...field, resize: "vertical" }}
            rows={2}
            maxLength={400}
            value={look.recruitingNote}
            onChange={(e) => set({ recruitingNote: e.target.value })}
          />
        </>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
        <button
          type="button"
          onClick={save}
          disabled={saving || !look.name.trim()}
          style={{
            padding: "8px 18px",
            borderRadius: 999,
            border: `1px solid ${look.accentColor}`,
            background: look.accentColor,
            color: "#fff",
            font: "inherit",
            fontSize: 12.5,
            fontWeight: 800,
            cursor: "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.14)",
            background: "transparent",
            color: "rgba(243,244,246,.8)",
            font: "inherit",
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Close
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.75 }}>{msg}</span>}
      </div>
    </div>
  );
}
