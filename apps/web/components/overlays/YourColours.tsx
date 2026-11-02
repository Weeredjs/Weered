"use client";
// Your colours: your ID card and your row in people lists. Moved out of
// Settings → Appearance onto your profile, beside the rest of how you look to
// others (James 2026-11-02: the appearance settings were doubled up).
import React from "react";
import { Row, Section, settingsFetch } from "./sheets/SettingsSheet";

// Under Nebula these colours sit out: the colourway paints your own Weered,
// and people rows carry no tint or stripe there. They still dress your ID card
// and row inside lobbies with their own theme, and on Classic.
export function YourColours({ nebula = false }: { nebula?: boolean }) {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  const [panelBgColor, setPanelBgColor] = React.useState<string>("");
  const [panelAccentColor, setPanelAccentColor] = React.useState<string>("");
  const [pillBgColor, setPillBgColor] = React.useState<string>("");
  const [pillAccentColor, setPillAccentColor] = React.useState<string>("");
  const [savedMsg, setSavedMsg] = React.useState<string>("");

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("weered_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.panelBgColor) setPanelBgColor(u.panelBgColor);
        if (u?.panelAccentColor) setPanelAccentColor(u.panelAccentColor);
        if (u?.pillBgColor) setPillBgColor(u.pillBgColor);
        if (u?.pillAccentColor) setPillAccentColor(u.pillAccentColor);
      }
    } catch {}
  }, []);

  const saveTimer = React.useRef<any>(null);
  function scheduleSave(
    field: "panelBgColor" | "panelAccentColor" | "pillBgColor" | "pillAccentColor",
    value: string,
  ) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const r = await settingsFetch(`${apiBase}/profile/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        if (r.ok) {
          try {
            const raw = localStorage.getItem("weered_user");
            if (raw) {
              const u = JSON.parse(raw);
              u[field] = value || null;
              localStorage.setItem("weered_user", JSON.stringify(u));
            }
          } catch {}
          try {
            window.dispatchEvent(
              new CustomEvent("weered:profileColors", { detail: { field, value } }),
            );
          } catch {}
          try {
            window.dispatchEvent(new CustomEvent("weered:profile:updated"));
          } catch {}
          setSavedMsg("Saved");
          setTimeout(() => setSavedMsg(""), 1200);
        } else {
          setSavedMsg(
            r.status === 401 ? "Not saved: sign in again" : "Not saved (" + r.status + ")",
          );
          setTimeout(() => setSavedMsg(""), 4000);
        }
      } catch {
        setSavedMsg("Not saved: no connection");
        setTimeout(() => setSavedMsg(""), 4000);
      }
    }, 400);
  }

  function clearField(
    field: "panelBgColor" | "panelAccentColor" | "pillBgColor" | "pillAccentColor",
    setter: (v: string) => void,
  ) {
    setter("");
    scheduleSave(field, "");
  }

  function resetColors() {
    clearField("panelBgColor", setPanelBgColor);
    clearField("panelAccentColor", setPanelAccentColor);
    clearField("pillBgColor", setPillBgColor);
    clearField("pillAccentColor", setPillAccentColor);
  }

  const ACCENT_PRESETS: { label: string; value: string }[] = [
    { label: "Purple", value: "#5b21b6" },
    { label: "Gold", value: "#b8860b" },
    { label: "Crimson", value: "#9f1239" },
    { label: "Teal", value: "#0d7a6f" },
    { label: "Slate", value: "#3b4a6b" },
  ];

  return (
    <Section title={nebula ? "Your colors in themed lobbies" : "Your colors"} onReset={resetColors}>
      <div
        style={{
          fontSize: 11,
          color: "var(--weered-muted, rgba(148,163,184,.7))",
          marginBottom: 10,
        }}
      >
        {nebula
          ? "Nebula paints your own Weered from your colourway in Change your drip. These colours dress your ID card and your row inside lobbies with their own theme, and for anyone on Classic. Changes save automatically."
          : "Personalize how you appear in lobbies and on your ID card. Changes save automatically."}
      </div>

      <ColorPreview
        accent={panelAccentColor || "#5b21b6"}
        panelBg={panelBgColor || "#14161A"}
        pillBg={pillBgColor}
        pillStripe={pillAccentColor}
      />

      <div
        style={{
          margin: "12px 0 4px",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--weered-muted, rgba(148,163,184,.8))",
        }}
      >
        Quick accent
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {ACCENT_PRESETS.map((p) => {
          const active = panelAccentColor.toLowerCase() === p.value.toLowerCase();
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setPanelAccentColor(p.value);
                scheduleSave("panelAccentColor", p.value);
              }}
              title={p.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 700,
                border: active
                  ? `1px solid ${p.value}`
                  : "1px solid var(--weered-border, rgba(255,255,255,.12))",
                background: active ? `${p.value}22` : "transparent",
                color: "var(--weered-text, rgba(243,244,246,.9))",
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: p.value,
                  border: "1px solid rgba(255,255,255,.2)",
                }}
              />
              {p.label}
            </button>
          );
        })}
      </div>

      <ColorPickerRow
        label="Accent color"
        hint="Your accent on the ID card and rail — the crew tag, brackets and avatar ring. Applies inside themed lobbies, where it sits against that community's own skin; the default theme keeps the platform accent."
        value={panelAccentColor}
        onChange={(v) => {
          setPanelAccentColor(v);
          scheduleSave("panelAccentColor", v);
        }}
        onClear={() => clearField("panelAccentColor", setPanelAccentColor)}
      />
      <ColorPickerRow
        label="Panel background"
        hint="Tints the grey surfaces behind your rail sections and ID card body."
        value={panelBgColor}
        onChange={(v) => {
          setPanelBgColor(v);
          scheduleSave("panelBgColor", v);
        }}
        onClear={() => clearField("panelBgColor", setPanelBgColor)}
      />
      <ColorPickerRow
        label="Your row tint"
        hint="The background color of your name-row as it appears in other people's friends lists and rails."
        value={pillBgColor}
        onChange={(v) => {
          setPillBgColor(v);
          scheduleSave("pillBgColor", v);
        }}
        onClear={() => clearField("pillBgColor", setPillBgColor)}
      />
      <ColorPickerRow
        label="Row stripe"
        hint="The vertical bar on the left edge of your row. Leave default to use your role/tier color."
        value={pillAccentColor}
        onChange={(v) => {
          setPillAccentColor(v);
          scheduleSave("pillAccentColor", v);
        }}
        onClear={() => clearField("pillAccentColor", setPillAccentColor)}
      />
      <PillIntensityRow />
      <BannerUploadRow />
      {savedMsg && (
        <div
          style={{
            fontSize: 11,
            color: "var(--weered-accent-text, rgba(167,139,250,.85))",
            marginTop: 4,
            textAlign: "right",
          }}
        >
          {savedMsg}
        </div>
      )}
    </Section>
  );
}

function ColorPreview({
  accent,
  panelBg,
  pillBg,
  pillStripe,
}: {
  accent: string;
  panelBg: string;
  pillBg: string;
  pillStripe: string;
}) {
  const stripe = pillStripe || accent;
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <div
        style={{
          flex: "1 1 180px",
          minWidth: 160,
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,.08)",
          background: panelBg,
        }}
      >
        <div
          style={{
            height: 26,
            background: accent,
            clipPath: "polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)",
            display: "flex",
            alignItems: "center",
            padding: "0 10px",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#fff",
          }}
        >
          Your ID card
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px" }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              border: `2px solid ${accent}`,
              background: "rgba(255,255,255,.08)",
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 12, fontWeight: 700 }}>You</div>
        </div>
      </div>
      <div
        style={{
          flex: "1 1 180px",
          minWidth: 160,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: 9,
            opacity: 0.5,
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          In a friends list
        </div>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            overflow: "hidden",
            background: pillBg
              ? `linear-gradient(90deg, ${pillBg}99, ${pillBg}33 60%, transparent)`
              : "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 4,
              bottom: 4,
              width: 3,
              borderRadius: "0 2px 2px 0",
              background: stripe,
            }}
          />
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              background: "rgba(255,255,255,.1)",
              flexShrink: 0,
              marginLeft: 2,
            }}
          />
          <div style={{ fontSize: 12, fontWeight: 700 }}>You</div>
        </div>
      </div>
    </div>
  );
}

function BannerUploadRow() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE as string) || "https://api.weered.ca";
  const [bannerUrl, setBannerUrl] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string>("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("weered_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.id) {
          settingsFetch(`${apiBase}/profile/${encodeURIComponent(u.id)}`, {
            headers: {},
          })
            .then((r) => r.json())
            .then((j) => {
              if (j?.bannerUrl) setBannerUrl(String(j.bannerUrl));
            })
            .catch(() => {});
        }
      }
    } catch {}
  }, [apiBase]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setErr("");
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      setErr("Image must be under 4 MB.");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(f.type)) {
      setErr("Use PNG, JPEG, WebP, or GIF.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ""));
        r.onerror = () => rej(new Error("read_failed"));
        r.readAsDataURL(f);
      });
      const r = await settingsFetch(`${apiBase}/profile/banner/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setErr(j?.message || j?.error || "Upload failed.");
      } else {
        setBannerUrl(String(j.bannerUrl));
        try {
          window.dispatchEvent(
            new CustomEvent("weered:profileColors", { detail: { bannerUrl: j.bannerUrl } }),
          );
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent("weered:profile:updated"));
        } catch {}
      }
    } catch (ex: any) {
      setErr(ex?.message || "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clear() {
    setBusy(true);
    setErr("");
    try {
      const r = await settingsFetch(`${apiBase}/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerUrl: "" }),
      });
      if (r.ok) {
        setBannerUrl("");
        try {
          window.dispatchEvent(
            new CustomEvent("weered:profileColors", { detail: { bannerUrl: null } }),
          );
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent("weered:profile:updated"));
        } catch {}
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row
      label="ID card banner"
      hint="Wide image across the top of your ID card. PNG/JPEG/WebP/GIF, up to 4 MB."
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "stretch",
          minWidth: 240,
        }}
      >
        {bannerUrl && (
          <div
            style={{
              width: "100%",
              height: 56,
              borderRadius: 6,
              overflow: "hidden",
              background: `url(${bannerUrl}) center / cover no-repeat`,
              border: "1px solid rgba(255,255,255,.08)",
            }}
          />
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 4,
              cursor: busy ? "default" : "pointer",
              background: "rgba(167,139,250,.14)",
              border: "1px solid rgba(167,139,250,.4)",
              color: "rgba(216,180,254,.95)",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? "Uploading…" : bannerUrl ? "Replace" : "Upload banner"}
          </button>
          {bannerUrl && (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              style={{
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 4,
                cursor: busy ? "default" : "pointer",
                background: "transparent",
                border: "1px solid rgba(148,163,184,.3)",
                color: "rgba(148,163,184,.9)",
              }}
            >
              Clear
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onPick}
          style={{ display: "none" }}
        />
        {err && <div style={{ fontSize: 11, color: "rgba(252,165,165,.95)" }}>{err}</div>}
      </div>
    </Row>
  );
}

function PillIntensityRow() {
  const [val, setVal] = React.useState<number>(60);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("weered:pillBgIntensity");
      const n = raw == null ? 60 : Math.max(0, Math.min(100, Number(raw)));
      if (Number.isFinite(n)) setVal(n);
    } catch {}
  }, []);
  function update(n: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(n)));
    setVal(clamped);
    try {
      localStorage.setItem("weered:pillBgIntensity", String(clamped));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("weered:pillBgIntensity", { detail: clamped }));
    } catch {}
  }
  return (
    <Row
      label="Pill intensity"
      hint="How strongly tinted pills render. 0 turns the tint off entirely."
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={val}
          onChange={(e) => update(Number(e.target.value))}
          style={{ width: 120, accentColor: "var(--weered-accent-text, rgba(167,139,250,.85))" }}
        />
        <span
          style={{
            fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
            fontSize: 11,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            minWidth: 32,
            textAlign: "right",
          }}
        >
          {val}%
        </span>
      </div>
    </Row>
  );
}

function ColorPickerRow({
  label,
  hint,
  value,
  onChange,
  onClear,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const safeValue = /^#[0-9a-f]{6}$/i.test(value) ? value : "#5800E5";
  return (
    <Row label={label} hint={hint}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="color"
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 36,
            height: 28,
            borderRadius: 6,
            border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
            background: "transparent",
            padding: 2,
            cursor: "pointer",
          }}
        />
        <span
          style={{
            fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
            fontSize: 11,
            color: "var(--weered-muted, rgba(148,163,184,.75))",
            minWidth: 64,
          }}
        >
          {value || "default"}
        </span>
        {value && (
          <button
            type="button"
            onClick={onClear}
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              border: "1px solid var(--weered-border, rgba(255,255,255,.12))",
              background: "transparent",
              color: "var(--weered-muted, rgba(148,163,184,.85))",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            title="Reset to default"
          >
            Reset
          </button>
        )}
      </div>
    </Row>
  );
}
