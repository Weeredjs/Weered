"use client";
// Your background (James 2026-11-02): one colour, two as a gradient, or your
// banner, worn by your ID card, your profile, the card people open from your
// name and your row in presence and friends lists. Every paid plan ($6 up);
// the API checks too (api lib/lookBg.ts). Saved as you pick.
import React from "react";
import { useWeered } from "../WeeredProvider";
import { lookBgCss, mayPickLookBg, parseLookBg } from "@/lib/lookBg";
import { settingsFetch } from "./sheets/SettingsSheet";

type Kind = "none" | "colour" | "gradient" | "banner";
const API = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
const swatch: React.CSSProperties = {
  width: 36,
  height: 28,
  borderRadius: 6,
  border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
  background: "transparent",
  padding: 2,
  cursor: "pointer",
};

export function YourBackground() {
  const { me } = useWeered() as any;
  const paid = mayPickLookBg(me);
  const [kind, setKind] = React.useState<Kind>("none");
  const [a, setA] = React.useState("#7c3aed");
  const [b, setB] = React.useState("#22d3ee");
  const [banner, setBanner] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState("");

  // Your own profile hands back your setting, even after a plan lapses.
  const load = React.useCallback(() => {
    if (!me?.id) return;
    void fetch(`${API}/profile/${encodeURIComponent(me.id)}`)
      .then((r) => r.json())
      .then((j) => {
        setBanner(typeof j?.bannerUrl === "string" ? j.bannerUrl : null);
        const bg = parseLookBg(j?.lookBg);
        if (!bg) return setKind("none");
        setKind(bg.kind);
        if (bg.kind !== "banner") setA(bg.a);
        if (bg.kind === "gradient") setB(bg.b);
      })
      .catch(() => {});
  }, [me?.id]);
  React.useEffect(() => {
    load();
    window.addEventListener("weered:profile:updated", load);
    return () => window.removeEventListener("weered:profile:updated", load);
  }, [load]);

  const value = (k: Kind, ca = a, cb = b) =>
    k === "colour"
      ? `c:${ca}`
      : k === "gradient"
        ? `g:${ca},${cb}`
        : k === "banner"
          ? "banner"
          : "none";

  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function save(v: string, now = false) {
    clearTimeout(timer.current);
    const go = async () => {
      try {
        const r = await settingsFetch(`${API}/profile/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lookBg: v }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setMsg(j?.message || "Couldn't save that.");
          return;
        }
        setMsg("Saved");
        setTimeout(() => setMsg(""), 1500);
        try {
          window.dispatchEvent(new CustomEvent("weered:profile:updated"));
        } catch {}
      } catch {
        setMsg("Couldn't save that.");
      }
    };
    if (now) void go();
    else timer.current = setTimeout(() => void go(), 400);
  }

  const pick = (k: Kind) => {
    if (!paid || (k === "banner" && !banner)) return;
    setKind(k);
    save(value(k), true);
  };
  const preview = lookBgCss(value(kind), banner, "card");
  const previewRow = lookBgCss(value(kind), banner, "row");
  const name = String(me?.name || "You");

  const chip = (k: Kind, label: string, off = false) => (
    <button
      type="button"
      key={k}
      onClick={() => pick(k)}
      disabled={!paid || off}
      aria-pressed={kind === k}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${kind === k ? "rgba(167,139,250,.75)" : "rgba(255,255,255,.12)"}`,
        background: kind === k ? "rgba(124,58,237,.28)" : "rgba(255,255,255,.04)",
        color: "inherit",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: !paid || off ? "not-allowed" : "pointer",
        opacity: !paid || off ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Background</div>
      <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.5, marginBottom: 10 }}>
        Your ID card, your profile, the card people open from your name, and your row in their
        lists.
        {!paid && " Comes with every paid plan, from $6 a month."}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "stretch" }}>
        <div
          aria-hidden
          style={{
            width: 120,
            height: 64,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.1)",
            background: preview || "rgba(255,255,255,.04)",
            flexShrink: 0,
          }}
        />
        <div
          aria-hidden
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: previewRow || "rgba(255,255,255,.03)",
            alignSelf: "center",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "rgba(167,139,250,.5)",
              flexShrink: 0,
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {chip("none", "None")}
        {chip("colour", "One colour")}
        {chip("gradient", "Two colours")}
        {chip("banner", "My banner", !banner)}
      </div>

      {paid && (kind === "colour" || kind === "gradient") && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12 }}>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {kind === "gradient" ? "From" : "Colour"}
            <input
              type="color"
              value={a}
              onChange={(e) => {
                setA(e.target.value);
                save(value(kind, e.target.value, b));
              }}
              aria-label={kind === "gradient" ? "First colour" : "Background colour"}
              style={swatch}
            />
          </label>
          {kind === "gradient" && (
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              To
              <input
                type="color"
                value={b}
                onChange={(e) => {
                  setB(e.target.value);
                  save(value(kind, a, e.target.value));
                }}
                aria-label="Second colour"
                style={swatch}
              />
            </label>
          )}
        </div>
      )}
      {paid && !banner && (
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
          Upload a banner below to use it here.
        </div>
      )}
      {!paid && (
        <a
          href="/pricing"
          style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,.95)" }}
        >
          See the plans →
        </a>
      )}
      {msg && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
