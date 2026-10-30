"use client";

// First-run setup for the whole of Weered, built the way the lobby composer
// is: pick-and-choose sections on the left, a live preview on the right.
// Intro (set it up / skip) → You, Look, Layout → done, which points at the
// next step: a place of your own. Build your own Weered, then your own lobby.
// Saves the profile bits (status, avatar colour) and the UI prefs (theme,
// colourway, starfield, density, layout) to the account. "first" runs once
// per account; "again" is /setup from Settings. Moving single sections and
// adding blocks is Design mode's job (components/shell/ShellDesigner.tsx).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWeered } from "../WeeredProvider";
import { ComposerStyles, Section, alpha, inputStyle, labelStyle } from "../composer/ui";
import Confetti from "../composer/Confetti";
import SetupPreview from "./SetupPreview";
import { STATUS_EMOJI } from "./setupData";
import { LayoutThumb } from "../shell/ShellDesignPanels";
import {
  SHELL_PRESETS,
  presetLayout,
  railFromShell,
  shellFromPrefs,
  type ShellLayout,
} from "../../lib/shellLayout";
import { startDesign } from "../../lib/shellDesign";
import { AVATAR_PALETTE } from "../../lib/avatarColor";
import {
  PALETTES,
  paletteColours,
  PALETTE_IDS,
  readUiPrefs,
  saveUiPrefs,
  type Palette,
  type SiteThemeId,
} from "../../lib/uiPrefs";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const STEPS = [
  { id: "su-you", label: "You" },
  { id: "su-look", label: "Look" },
  { id: "su-layout", label: "Layout" },
];

// The layouts setup offers: the ones with nothing to fill in.
const SETUP_PRESETS = SHELL_PRESETS.filter((p) => p.setup);
const sameLayout = (a: ShellLayout, b: ShellLayout) =>
  JSON.stringify([a.left, a.right, a.home, a.hidden]) ===
  JSON.stringify([b.left, b.right, b.home, b.hidden]);

export default function SetupFlow({
  mode,
  onClose,
}: {
  mode: "first" | "again";
  /** Called after the flow fades out; `next` is where to go, if anywhere. */
  onClose: (next?: string) => void;
}) {
  const { me } = useWeered() as any;
  const prefs0 = useMemo(() => readUiPrefs(), []);
  const [phase, setPhase] = useState<"intro" | "build" | "done">(
    mode === "first" ? "intro" : "build",
  );
  const [leaving, setLeaving] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── You ──
  const name = String(me?.name || "").trim();
  const [avatar, setAvatar] = useState<string | null>(me?.avatar || null);
  const initialColor = useRef<string>("");
  const [avatarColor, setAvatarColor] = useState<string>("#8b5cf6");
  const [statusEmoji, setStatusEmoji] = useState("");
  const [statusText, setStatusText] = useState("");
  const initialStatus = useRef({ emoji: "", text: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  useEffect(() => {
    if (!me?.id) return;
    let c = me?.avatarColor || "";
    try {
      c = c || localStorage.getItem("weered:avatarColor") || "";
    } catch {}
    initialColor.current = c || "#8b5cf6";
    setAvatarColor(c || "#8b5cf6");
    if (me?.avatar) setAvatar(me.avatar);
    fetch(`${API}/profile/${encodeURIComponent(me.id)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        const s = { emoji: String(j?.statusEmoji || ""), text: String(j?.statusText || "") };
        initialStatus.current = s;
        setStatusEmoji(s.emoji);
        setStatusText(s.text);
        if (j?.avatar) setAvatar(String(j.avatar));
      })
      .catch(() => {});
  }, [me?.id, me?.avatar, me?.avatarColor]);

  // ── Look + layout ──
  const classicTheme: SiteThemeId =
    prefs0.theme && prefs0.theme !== "nebula" ? prefs0.theme : "press";
  const [look, setLook] = useState<"nebula" | "classic">(
    !prefs0.theme || prefs0.theme === "nebula" ? "nebula" : "classic",
  );
  const [palette, setPalette] = useState<Palette>(prefs0.palette || "violet");
  const [stars, setStars] = useState(prefs0.stars !== false);
  const [compact, setCompact] = useState(prefs0.density === "compact");
  // Start from the viewer's own layout; a preset it matches shows as picked.
  const layout0 = useMemo(() => shellFromPrefs(prefs0), [prefs0]);
  const [layout, setLayout] = useState<ShellLayout>(layout0);
  const [presetId, setPresetId] = useState<string>(() => {
    const hit = SETUP_PRESETS.find((p) => {
      const l = presetLayout(p.id);
      return l && sameLayout(l, layout0);
    });
    return hit ? hit.id : "mine";
  });
  const thumbs = useMemo(() => Object.fromEntries(SETUP_PRESETS.map((p) => [p.id, p.build()])), []);
  const [pulse, setPulse] = useState(0);
  const bump = () => setPulse((n) => n + 1);

  const [saving, setSaving] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [active, setActive] = useState(STEPS[0].id);

  const C =
    look === "nebula"
      ? paletteColours(palette)
      : {
          a: "#7c3aed",
          b: "#5b21b6",
          c: "#1e1b2e",
          hi: "#c4b5fd",
          bg: "#0c0b12",
          ink: "#0d0b1c",
          on: "#ffffff",
        };

  // Which section is on screen, for the step pills: the last one whose top
  // has passed a line a third of the way down, or the last one at the end.
  useEffect(() => {
    if (phase !== "build") return;
    const root = scroller.current;
    if (!root) return;
    const onScroll = () => {
      const line = root.getBoundingClientRect().top + root.clientHeight / 3;
      let cur = STEPS[0].id;
      for (const st of STEPS) {
        const el = document.getElementById(st.id);
        if (el && el.getBoundingClientRect().top <= line) cur = st.id;
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4)
        cur = STEPS[STEPS.length - 1].id;
      setActive(cur);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
    // `mounted`: the flow renders nothing on its first pass, so on /setup
    // (which starts at "build") the scroller only exists after it.
  }, [phase, mounted]);

  // Lock the page behind while the flow is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const close = (next?: string) => {
    setLeaving(true);
    setTimeout(() => onClose(next), 320);
  };
  const skip = () => {
    if (mode === "first") saveUiPrefs({ setup: "skipped", setupAt: new Date().toISOString() });
    close();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "done") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function upload(file: File) {
    setUploading(true);
    setUploadErr("");
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("load"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      const size = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - size) / 2,
        (img.height - size) / 2,
        size,
        size,
        0,
        0,
        256,
        256,
      );
      URL.revokeObjectURL(url);
      const r = await fetch(`${API}/profile/avatar/upload`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: canvas.toDataURL("image/webp", 0.85) }),
      });
      const j = await r.json().catch(() => null);
      if (j?.ok && j.avatar) {
        setAvatar(String(j.avatar));
        bump();
        try {
          window.dispatchEvent(new Event("weered:profile:updated"));
        } catch {}
      } else setUploadErr(j?.message || j?.error || "That one didn't upload. Try another image.");
    } catch {
      setUploadErr("That one didn't upload. Try another image.");
    }
    setUploading(false);
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    const patch: Record<string, string> = {};
    if (
      statusText.trim() !== initialStatus.current.text ||
      statusEmoji !== initialStatus.current.emoji
    ) {
      patch.statusText = statusText.trim();
      patch.statusEmoji = statusEmoji;
    }
    if (avatarColor !== initialColor.current) patch.avatarColor = avatarColor;
    if (Object.keys(patch).length) {
      await fetch(`${API}/profile/me`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {});
      if (patch.avatarColor) {
        try {
          localStorage.setItem("weered:avatarColor", avatarColor);
          window.dispatchEvent(new CustomEvent("weered:avatarColor", { detail: avatarColor }));
        } catch {}
      }
    }

    saveUiPrefs({
      theme: look === "nebula" ? "nebula" : classicTheme,
      palette,
      stars,
      density: compact ? "compact" : "comfortable",
      shell: layout,
      rail: railFromShell(layout),
      ...(mode === "first" || prefs0.setup !== "done"
        ? { setup: "done" as const, setupAt: new Date().toISOString() }
        : {}),
    });
    try {
      localStorage.setItem("weered:onboarded:profile", "1");
      window.dispatchEvent(new Event("weered:profile:updated"));
    } catch {}
    setSaving(false);
    setPhase("done");
    setConfetti((n) => n + 1);
  }

  if (!mounted) return null;

  const accentBtn: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    minHeight: 56,
    padding: "0 30px",
    borderRadius: 16,
    border: `1px solid ${alpha(C.hi, 0.55)}`,
    background: `linear-gradient(135deg, ${C.a}, ${C.b})`,
    boxShadow: `0 18px 50px ${alpha(C.a, 0.45)}, inset 0 1px 0 rgba(255,255,255,.25)`,
    color: C.on,
    fontFamily: "var(--font-rajdhani), 'Rajdhani', system-ui, sans-serif",
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: ".01em",
    cursor: "pointer",
    transition: "transform .18s, box-shadow .25s, background .4s",
  };
  const ghostBtn: React.CSSProperties = {
    ...accentBtn,
    border: "1px solid rgba(255,255,255,.2)",
    background: "rgba(255,255,255,.05)",
    boxShadow: "none",
    color: "#fff",
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="su-title"
      className={`su-root${leaving ? " su-leaving" : ""}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99995,
        color: "#fff",
        fontFamily: "var(--font-rajdhani), 'Rajdhani', system-ui, sans-serif",
        background: `radial-gradient(1100px 700px at 12% -10%, ${alpha(C.b, 0.5)}, transparent 62%), radial-gradient(900px 700px at 105% 5%, ${alpha(C.c, 0.75)}, transparent 62%), radial-gradient(1000px 800px at 55% 125%, ${alpha(C.c, 0.5)}, transparent 60%), ${C.bg}`,
        transition: "background .6s",
        // The composer's Section reads these; set here so setup looks the
        // same whichever site theme is behind it.
        ["--weered-panel2" as any]: alpha(C.ink, 0.62),
        ["--weered-border" as any]: alpha(C.a, 0.2),
      }}
    >
      <ComposerStyles />
      <style>{SETUP_CSS}</style>
      <div aria-hidden className="su-stars-far cz-anim" />
      <div
        aria-hidden
        className="su-glow cz-anim"
        style={{ background: `radial-gradient(closest-side, ${alpha(C.a, 0.35)}, transparent)` }}
      />

      {phase === "intro" && (
        <div className="su-intro">
          <img src="/brand/logo/weered-logo-128.png" alt="" className="su-logo" />
          <div className="su-kicker" style={{ color: C.hi }}>
            {name ? `Welcome, ${name}` : "Welcome"}
          </div>
          <h1 id="su-title" className="su-headline">
            Let&apos;s make it yours.
          </h1>
          <p className="su-sub">
            Pick a look and a layout. Then, if you want one, a place of your own.
          </p>
          <div className="su-cta">
            <button
              type="button"
              autoFocus
              className="su-btn su-btn-main"
              style={accentBtn}
              onClick={() => setPhase("build")}
            >
              Set it up →
            </button>
            <button type="button" className="su-btn" style={ghostBtn} onClick={skip}>
              Skip
            </button>
          </div>
          <div className="su-note">You can run this any time from Settings.</div>
        </div>
      )}

      {phase === "build" && (
        <div ref={scroller} className="su-scroll">
          {/* Top bar */}
          <div className="su-top">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <img src="/brand/logo/weered-logo-128.png" alt="" style={{ width: 28, height: 28 }} />
              <div id="su-title" style={{ fontSize: 19, fontWeight: 700, whiteSpace: "nowrap" }}>
                Set up Weered
              </div>
            </div>
            <nav className="su-pills" aria-label="Setup steps">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className="cz-chip"
                  aria-current={active === s.id ? "step" : undefined}
                  onClick={() => {
                    const root = scroller.current;
                    const el = document.getElementById(s.id);
                    if (!root || !el) return;
                    const top =
                      el.getBoundingClientRect().top -
                      root.getBoundingClientRect().top +
                      root.scrollTop -
                      72;
                    root.scrollTo({ top, behavior: "smooth" });
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: `1px solid ${active === s.id ? alpha(C.a, 0.7) : "rgba(255,255,255,.1)"}`,
                    background: active === s.id ? alpha(C.a, 0.2) : "rgba(255,255,255,.04)",
                    color: active === s.id ? "#fff" : "rgba(255,255,255,.7)",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 99,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10.5,
                      background: active === s.id ? C.a : "rgba(255,255,255,.1)",
                      color: active === s.id ? C.on : "#fff",
                    }}
                  >
                    {i + 1}
                  </span>
                  {s.label}
                </button>
              ))}
            </nav>
            <button type="button" onClick={skip} className="su-skip">
              {mode === "first" ? "Skip for now" : "Close"}
            </button>
          </div>

          <div className="cz-shell" style={{ paddingTop: 8 }}>
            <div style={{ minWidth: 0 }}>
              {/* 01 You */}
              <Section
                id="su-you"
                n={1}
                title="You"
                kicker="How people see you around Weered."
                accent={C.a}
              >
                <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                  <div
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: "50%",
                      flex: "0 0 84px",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 36,
                      fontWeight: 900,
                      background: avatar ? `url("${avatar}") center/cover` : avatarColor,
                      boxShadow: `0 0 0 3px rgba(10,8,20,.9), 0 0 0 5px ${alpha(C.a, 0.6)}, 0 14px 36px ${alpha(C.a, 0.45)}`,
                      transition: "box-shadow .4s, background .3s",
                    }}
                  >
                    {avatar ? null : (name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ display: "grid", gap: 10, minWidth: 0, flex: "1 1 240px" }}>
                    <div
                      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                    >
                      <label
                        className="cz-chip"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "9px 14px",
                          borderRadius: 11,
                          border: `1px solid ${alpha(C.a, 0.5)}`,
                          background: alpha(C.a, 0.16),
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: uploading ? "wait" : "pointer",
                        }}
                      >
                        {uploading ? "Uploading…" : avatar ? "Change photo" : "Upload a photo"}
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          disabled={uploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void upload(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {!avatar && (
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>
                          or pick a colour
                        </span>
                      )}
                    </div>
                    {!avatar && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {AVATAR_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Avatar colour ${c}`}
                            aria-pressed={avatarColor === c}
                            onClick={() => {
                              setAvatarColor(c);
                              bump();
                            }}
                            className="cz-chip"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 99,
                              background: c,
                              cursor: "pointer",
                              border:
                                avatarColor === c ? "2px solid #fff" : "1px solid rgba(0,0,0,.4)",
                              boxShadow: avatarColor === c ? `0 0 0 3px ${alpha(c, 0.5)}` : "none",
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {uploadErr && <div style={{ fontSize: 13, color: "#fca5a5" }}>{uploadErr}</div>}
                  </div>
                </div>
                <div style={{ marginTop: 18 }}>
                  <label htmlFor="su-status" style={labelStyle}>
                    Status
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {STATUS_EMOJI.map((e) => (
                      <button
                        key={e}
                        type="button"
                        aria-pressed={statusEmoji === e}
                        onClick={() => {
                          setStatusEmoji(statusEmoji === e ? "" : e);
                          bump();
                        }}
                        className="cz-chip"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 11,
                          fontSize: 19,
                          cursor: "pointer",
                          border: `1px solid ${statusEmoji === e ? alpha(C.a, 0.8) : "rgba(255,255,255,.1)"}`,
                          background:
                            statusEmoji === e ? alpha(C.a, 0.22) : "rgba(255,255,255,.04)",
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <input
                    id="su-status"
                    value={statusText}
                    maxLength={80}
                    onChange={(e) => setStatusText(e.target.value)}
                    placeholder="What are you up to?"
                    style={inputStyle}
                  />
                </div>
              </Section>

              {/* 02 Look */}
              <Section
                id="su-look"
                n={2}
                title="Look"
                kicker="One layout, your colours. Changes everywhere but themed lobbies."
                accent={C.a}
              >
                <div className="cz-presets">
                  {/* The light colourway (Blizzard) lives in Design and Settings; this
                      preview is drawn for dark glass. */}
                  {PALETTE_IDS.filter((id) => !PALETTES[id].light).map((id) => {
                    const pl = PALETTES[id];
                    const on = look === "nebula" && palette === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={on}
                        className="cz-card"
                        onClick={() => {
                          setLook("nebula");
                          setPalette(id);
                          bump();
                        }}
                        style={{
                          position: "relative",
                          height: 116,
                          padding: 0,
                          borderRadius: 14,
                          overflow: "hidden",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "#fff",
                          fontFamily: "inherit",
                          border: on ? `2px solid ${pl.a}` : "1px solid rgba(255,255,255,.12)",
                          boxShadow: on
                            ? `0 0 0 3px ${alpha(pl.a, 0.3)}, 0 14px 34px -14px ${alpha(pl.a, 0.9)}`
                            : "none",
                          background: `radial-gradient(120% 90% at 0% 0%, ${alpha(pl.b, 0.75)}, transparent 60%), radial-gradient(90% 90% at 100% 100%, ${alpha(pl.c, 0.95)}, transparent 65%), ${pl.bg}`,
                        }}
                      >
                        <span aria-hidden className="su-card-stars" />
                        <span
                          style={{
                            position: "absolute",
                            top: 9,
                            left: 10,
                            display: "flex",
                            gap: 4,
                          }}
                        >
                          {[pl.a, pl.b, pl.hi].map((s) => (
                            <i
                              key={s}
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 9,
                                background: s,
                                display: "block",
                                border: "1px solid rgba(0,0,0,.35)",
                              }}
                            />
                          ))}
                        </span>
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: 0,
                            padding: "18px 11px 9px",
                            background: "linear-gradient(transparent, rgba(0,0,0,.7))",
                          }}
                        >
                          <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>
                            Nebula · {pl.name}
                          </span>
                          <span
                            style={{
                              display: "block",
                              fontSize: 11.5,
                              color: "rgba(255,255,255,.65)",
                            }}
                          >
                            {pl.tagline}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={look === "classic"}
                    className="cz-card"
                    onClick={() => {
                      setLook("classic");
                      bump();
                    }}
                    style={{
                      position: "relative",
                      height: 116,
                      padding: 0,
                      borderRadius: 14,
                      overflow: "hidden",
                      cursor: "pointer",
                      textAlign: "left",
                      color: "#fff",
                      fontFamily: "inherit",
                      border:
                        look === "classic"
                          ? "2px solid #a78bfa"
                          : "1px solid rgba(255,255,255,.12)",
                      boxShadow: look === "classic" ? "0 0 0 3px #a78bfa4d" : "none",
                      background:
                        "linear-gradient(100deg, #3b0764 0 58%, transparent 58.5%) 12px 14px / 70% 13px no-repeat, linear-gradient(#0e1014, #0e1014) 12px 27px / 60% 26px no-repeat, linear-gradient(100deg, #3b0764 0 58%, transparent 58.5%) 12px 60px / 70% 13px no-repeat, #141416",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: "18px 11px 9px",
                        background: "linear-gradient(transparent, rgba(0,0,0,.7))",
                      }}
                    >
                      <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>
                        Classic
                      </span>
                      <span
                        style={{ display: "block", fontSize: 11.5, color: "rgba(255,255,255,.65)" }}
                      >
                        The look you have now.
                      </span>
                    </span>
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                  {[
                    {
                      on: stars,
                      label: "Starfield",
                      set: () => setStars(!stars),
                      dis: look !== "nebula",
                    },
                    {
                      on: compact,
                      label: "Compact sidebar",
                      set: () => setCompact(!compact),
                      dis: false,
                    },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={o.on}
                      disabled={o.dis}
                      className="cz-chip"
                      onClick={() => {
                        o.set();
                        bump();
                      }}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        fontFamily: "inherit",
                        fontWeight: 700,
                        fontSize: 13.5,
                        cursor: o.dis ? "default" : "pointer",
                        opacity: o.dis ? 0.4 : 1,
                        color: "#fff",
                        border: `1px solid ${o.on ? alpha(C.a, 0.8) : "rgba(255,255,255,.12)"}`,
                        background: o.on ? alpha(C.a, 0.22) : "rgba(255,255,255,.04)",
                      }}
                    >
                      {o.on ? "● " : "○ "}
                      {o.label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* 03 Layout */}
              <Section
                id="su-layout"
                n={3}
                title="Layout"
                kicker="Where everything sits. Friends where you can see them, or a quieter screen."
                accent={C.a}
              >
                <div className="su-layouts">
                  {presetId === "mine" && (
                    <LayoutCard
                      on
                      name="Yours"
                      blurb="The layout you have now."
                      thumb={layout0}
                      C={C}
                      onPick={() => {
                        setLayout(layout0);
                        setPresetId("mine");
                        bump();
                      }}
                    />
                  )}
                  {SETUP_PRESETS.map((pr) => (
                    <LayoutCard
                      key={pr.id}
                      on={presetId === pr.id}
                      name={pr.name}
                      blurb={pr.blurb}
                      thumb={thumbs[pr.id]}
                      C={C}
                      onPick={() => {
                        const l = presetLayout(pr.id);
                        if (!l) return;
                        setLayout(l);
                        setPresetId(pr.id);
                        bump();
                      }}
                    />
                  ))}
                </div>
                <div className="su-layout-note">
                  Later, <b>✦ Design</b> on Home moves any section, puts Friends wherever you like,
                  and adds blocks: a Twitch stream, a playlist, links, a countdown.
                </div>
              </Section>
            </div>

            <div className="cz-previewcol">
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "1.2px",
                  color: "rgba(255,255,255,.45)",
                  margin: "4px 2px 10px",
                }}
              >
                LIVE PREVIEW
              </div>
              <FitPreview>
                <SetupPreview
                  name={name}
                  avatar={avatar}
                  avatarColor={avatarColor}
                  statusEmoji={statusEmoji}
                  statusText={statusText}
                  tier={me?.tier && me.tier !== "INNOCENT" ? String(me.tier) : undefined}
                  look={look}
                  palette={palette}
                  stars={stars}
                  compact={compact}
                  layout={layout}
                  pulseKey={pulse}
                />
              </FitPreview>
            </div>
          </div>

          {/* Finish bar */}
          <div className="su-bar">
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.6)", minWidth: 0 }}>
              {look === "nebula" ? `Nebula · ${paletteColours(palette).name}` : "Classic"}
              {" · "}
              {presetId === "mine"
                ? "your layout"
                : `${SETUP_PRESETS.find((x) => x.id === presetId)?.name || ""} layout`}
            </div>
            <button
              type="button"
              onClick={finish}
              disabled={saving}
              className="su-btn su-btn-main"
              style={{ ...accentBtn, minHeight: 50, fontSize: 18, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving…" : "Finish setup"}
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="su-intro">
          <Confetti fire={confetti} colors={[C.a, C.b, C.hi, "#ffffff"]} />
          <div className="su-kicker" style={{ color: C.hi }}>
            All set
          </div>
          <h1 id="su-title" className="su-headline">
            You&apos;re in.
          </h1>
          <p className="su-sub">
            Your Weered is set. Next, a place of your own: a lobby with its own look, rooms and
            members, on your own domain if you want.
          </p>
          <div className="su-cta">
            <button
              type="button"
              autoFocus
              className="su-btn su-btn-main"
              style={accentBtn}
              onClick={() => close("/lobby/create")}
            >
              Build my place →
            </button>
            <button
              type="button"
              className="su-btn"
              style={ghostBtn}
              onClick={() => close("/home")}
            >
              Take me home
            </button>
          </div>
          <button
            type="button"
            className="su-note su-note-link"
            onClick={() => {
              if (mode === "first") {
                close();
                setTimeout(() => startDesign(), 360);
              } else close("/home?design=1");
            }}
          >
            Or fine-tune your layout in Design →
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** The preview, scaled down to fit the window beside the steps (a layout
 *  with everything on is taller than a laptop screen). */
function FitPreview({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<{ s: number; h: number } | null>(null);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => {
      if (!window.matchMedia("(min-width: 1080px)").matches) return setFit(null);
      const natural = el.offsetHeight; // layout height; transforms don't change it
      // Below the top bar, above the finish bar and the steps' end padding:
      // any taller and the sticky column runs out of room at the last step.
      const room = window.innerHeight - 330;
      const s = Math.max(0.5, Math.min(1, room / Math.max(1, natural)));
      setFit(s < 1 ? { s, h: natural * s } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div style={fit ? { height: fit.h } : undefined}>
      <div
        ref={inner}
        style={fit ? { transform: `scale(${fit.s})`, transformOrigin: "top center" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function LayoutCard({
  on,
  name,
  blurb,
  thumb,
  C,
  onPick,
}: {
  on: boolean;
  name: string;
  blurb: string;
  thumb: Pick<ShellLayout, "left" | "right" | "home">;
  C: { a: string; hi: string; on: string };
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className="cz-card"
      onClick={onPick}
      style={{
        position: "relative",
        padding: 10,
        borderRadius: 16,
        textAlign: "left",
        cursor: "pointer",
        color: "#fff",
        fontFamily: "inherit",
        border: `1px solid ${on ? alpha(C.a, 0.85) : "rgba(255,255,255,.1)"}`,
        background: on
          ? `radial-gradient(120% 120% at 0% 0%, ${alpha(C.a, 0.3)}, transparent 60%), rgba(255,255,255,.04)`
          : "rgba(255,255,255,.035)",
        boxShadow: on
          ? `0 0 0 3px ${alpha(C.a, 0.18)}, 0 16px 40px -20px ${alpha(C.a, 0.9)}`
          : "none",
      }}
    >
      <LayoutThumb layout={thumb} accent={C.a} hi={C.hi} height={66} />
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 9 }}>{name}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.35, marginTop: 1 }}>
        {blurb}
      </div>
      {on && (
        <span
          aria-hidden
          className="cz-anim"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 22,
            height: 22,
            borderRadius: 99,
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            fontWeight: 900,
            background: C.a,
            color: C.on,
            animation: "cz-pop .3s",
          }}
        >
          ✓
        </span>
      )}
    </button>
  );
}

const SETUP_CSS = `
.su-root{animation:su-in .45s ease both;overflow:hidden;overflow:clip}
.su-root.su-leaving{animation:su-out .32s ease both}
.su-stars-far{position:absolute;inset:-560px;pointer-events:none;opacity:.8;
  background-image:
    radial-gradient(circle at 60px 110px, rgba(255,255,255,.95) 0 1px, transparent 2px),
    radial-gradient(circle at 330px 40px, rgba(255,255,255,.75) 0 .9px, transparent 1.8px),
    radial-gradient(circle at 470px 380px, rgba(255,255,255,.85) 0 1px, transparent 2px),
    radial-gradient(circle at 210px 470px, rgba(255,255,255,.8) 0 1px, transparent 2px),
    radial-gradient(circle at 520px 210px, rgba(255,255,255,.65) 0 .9px, transparent 1.8px),
    radial-gradient(circle at 23px 41px, rgba(255,255,255,.7) 0 .7px, transparent 1.3px),
    radial-gradient(circle at 141px 289px, rgba(255,255,255,.6) 0 .6px, transparent 1.2px),
    radial-gradient(circle at 411px 133px, rgba(255,255,255,.6) 0 .6px, transparent 1.2px),
    radial-gradient(circle at 300px 520px, rgba(255,255,255,.55) 0 .6px, transparent 1.2px);
  background-size:560px 560px;animation:su-drift 260s linear infinite, su-twinkle 6s ease-in-out infinite alternate}
.su-glow{position:absolute;width:70vmax;height:70vmax;left:50%;top:42%;transform:translate(-50%,-50%);pointer-events:none;filter:blur(30px);animation:su-breathe 9s ease-in-out infinite alternate;transition:background .6s}
.su-intro{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px 16px}
.su-logo{width:64px;height:64px;filter:drop-shadow(0 0 22px rgba(255,255,255,.35));animation:su-rise .7s .05s cubic-bezier(.2,.8,.2,1) both}
.su-kicker{margin-top:22px;font-size:15px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;animation:su-rise .7s .1s cubic-bezier(.2,.8,.2,1) both}
.su-headline{margin:12px 0 0;font-size:clamp(46px,9vw,112px);line-height:.92;font-weight:700;letter-spacing:-.03em;color:#fff;text-shadow:0 0 70px rgba(255,255,255,.18);animation:su-rise .8s .16s cubic-bezier(.2,.8,.2,1) both}
.su-sub{margin:20px 0 0;max-width:36ch;font-size:clamp(17px,2.2vw,21px);line-height:1.4;font-weight:500;color:rgba(255,255,255,.72);animation:su-rise .8s .24s cubic-bezier(.2,.8,.2,1) both}
.su-cta{margin-top:clamp(28px,5vh,44px);display:flex;gap:12px;flex-wrap:wrap;justify-content:center;animation:su-rise .8s .32s cubic-bezier(.2,.8,.2,1) both}
.su-btn{min-width:168px}
.su-btn:hover{transform:translateY(-2px)}
.su-btn:focus-visible{outline:2px solid #fff;outline-offset:3px}
.su-btn-main::after{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.25) 50%,transparent 70%);transform:translateX(-120%);animation:su-sheen 4s 1.2s ease-in-out infinite}
.su-note{margin-top:18px;font-size:13.5px;color:rgba(255,255,255,.45);animation:su-rise .8s .4s cubic-bezier(.2,.8,.2,1) both}
.su-scroll{position:relative;z-index:1;height:100%;overflow-y:auto;overscroll-behavior:contain;animation:su-rise .5s cubic-bezier(.2,.8,.2,1) both}
.su-top{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px clamp(16px,3vw,28px);background:linear-gradient(180deg,rgba(5,4,12,.85),rgba(5,4,12,.55));backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.06)}
.su-pills{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;min-width:0}
.su-pills::-webkit-scrollbar{display:none}
.su-skip{flex:0 0 auto;background:none;border:none;color:rgba(255,255,255,.6);font:inherit;font-weight:700;font-size:14.5px;cursor:pointer;padding:8px 4px}
.su-skip:hover{color:#fff}
.su-scroll .cz-previewcol{top:76px}
.su-layouts{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.su-layout-note{margin-top:14px;font-size:14px;line-height:1.5;color:rgba(255,255,255,.55)}
.su-layout-note b{color:#fff}
.su-note-link{display:block;margin-left:auto;margin-right:auto;background:none;border:none;font-family:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.su-note-link:hover{color:#fff}
.su-more{margin-top:12px;background:none;border:1px solid rgba(255,255,255,.14);border-radius:999px;color:#fff;font:inherit;font-weight:700;font-size:13.5px;padding:8px 16px;cursor:pointer}
.su-arrow{width:24px;height:16px;padding:0;border:none;border-radius:4px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.75);font-size:8px;cursor:pointer;line-height:1}
.su-arrow:disabled{opacity:.25;cursor:default}
.su-card-stars{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle at 20% 30%, rgba(255,255,255,.8) 0 .7px, transparent 1.3px),radial-gradient(circle at 70% 20%, rgba(255,255,255,.6) 0 .6px, transparent 1.2px),radial-gradient(circle at 85% 55%, rgba(255,255,255,.7) 0 .7px, transparent 1.3px),radial-gradient(circle at 40% 60%, rgba(255,255,255,.5) 0 .6px, transparent 1.2px)}
.su-bar{position:sticky;bottom:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px clamp(16px,3vw,28px);background:linear-gradient(0deg,rgba(5,4,12,.92),rgba(5,4,12,.6));backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid rgba(255,255,255,.06)}
.su-stars{animation:su-drift-small 120s linear infinite}
@keyframes su-in{from{opacity:0}to{opacity:1}}
@keyframes su-out{to{opacity:0;transform:scale(1.02)}}
@keyframes su-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes su-drift{to{transform:translate3d(560px,560px,0)}}
@keyframes su-drift-small{to{transform:translate3d(220px,220px,0)}}
@keyframes su-twinkle{from{opacity:.45}to{opacity:.95}}
@keyframes su-breathe{from{transform:translate(-50%,-50%) scale(.9);opacity:.75}to{transform:translate(-50%,-50%) scale(1.08);opacity:1}}
@keyframes su-sheen{0%{transform:translateX(-120%)}55%,100%{transform:translateX(120%)}}
@keyframes su-flash{0%{opacity:1}100%{opacity:0}}
@media (max-width:720px){.su-top{flex-wrap:wrap}.su-pills{order:3;width:100%}}
@media (prefers-reduced-motion:reduce){
  .su-root,.su-root *{animation:none!important}
}
`;
