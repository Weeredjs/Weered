"use client";

import { useState, useEffect, useMemo } from "react";
import LobbyBranding, { type BrandingValue } from "../../../components/LobbyBranding";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers || {}) },
  });
  return r.json();
}

const MODULE_TYPES = [
  { id: "NONE", label: "None", desc: "Just rooms and chat", icon: "💬" },
  { id: "BUNGIE", label: "Destiny 2", desc: "Guardian stats, challenges, Xur", icon: "🔮" },
  { id: "RIOT", label: "League of Legends", desc: "Summoner lookup, ranked, rotation", icon: "⚔️" },
  { id: "FORTNITE", label: "Fortnite", desc: "Stats, item shop, cosmetics, news", icon: "🎯" },
  {
    id: "TRADING",
    label: "FakeOut",
    desc: "Paper trade crypto: live charts, fake money, leaderboards",
    icon: "📈",
  },
  { id: "TWITCH", label: "Twitch", desc: "Live stream integration", icon: "📺" },
  { id: "YOUTUBE", label: "YouTube", desc: "Video sync & watch parties", icon: "▶️" },
  { id: "FEED", label: "Feed", desc: "Community content feed", icon: "📰" },
  { id: "NEWS", label: "News", desc: "Live news feed from global sources", icon: "🗞️" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-)|(-$)/g, "")
    .slice(0, 40);
}

export default function CreateLobbyPage() {
  const router = useRouter();

  const [_me, setMe] = useState<any>(null);
  const [tier, setTier] = useState("INNOCENT");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("weered_token");
    if (!token) {
      router.replace("/subscribe");
      return;
    }
    apiFetch("/staff/me")
      .then((j) => {
        if (j?.user) {
          setMe(j.user);
          setTier(String(j.user?.tier || "INNOCENT").toUpperCase());
        } else if (j?.globalRole) {
          setTier("KINGPIN");
          setMe({ name: "staff" });
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        router.replace("/subscribe");
      });

    try {
      const u = JSON.parse(localStorage.getItem("weered_user") || "null");
      if (u) {
        setMe(u);
        setTier(String(u?.tier || "INNOCENT").toUpperCase());
      }
    } catch {}
  }, []);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState("#7c3aed");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const branding: BrandingValue = { name, description, accentColor: accent, logoUrl, bannerUrl };
  const patchBranding = (p: Partial<BrandingValue>) => {
    if (p.name !== undefined) setName(p.name);
    if (p.description !== undefined) setDescription(p.description);
    if (p.accentColor !== undefined) setAccent(p.accentColor);
    if (p.logoUrl !== undefined) setLogoUrl(p.logoUrl);
    if (p.bannerUrl !== undefined) setBannerUrl(p.bannerUrl);
  };
  const [moduleType, setModuleType] = useState("NONE");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "reserved"
  >("idle");

  useEffect(() => {
    if (!slugManual && name) setSlug(slugify(name));
  }, [name, slugManual]);

  useEffect(() => {
    if (!slug || slug.length < 2) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const j = await apiFetch(`/lobbies/${encodeURIComponent(slug)}`);
        if (j?.ok && j?.lobby) setSlugStatus("taken");
        else setSlugStatus("available");
      } catch {
        setSlugStatus("available");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  const canCreate = useMemo(() => {
    return name.trim().length >= 2 && slug.length >= 2 && slugStatus === "available" && !creating;
  }, [name, slug, slugStatus, creating]);

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    setError("");
    const j = await apiFetch("/lobbies", {
      method: "POST",
      body: JSON.stringify({
        id: slug,
        name: name.trim(),
        description: description.trim(),
        accentColor: accent,
        logoUrl: logoUrl || undefined,
        bannerUrl: bannerUrl || undefined,
        moduleType,
      }),
    });
    if (j?.ok) {
      router.push(`/lobby/${encodeURIComponent(slug)}`);
    } else {
      setError(j?.message || j?.error || "Failed to create lobby");
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          background: "#050810",
          color: "rgba(255,255,255,.4)",
          fontSize: 13,
        }}
      >
        Loading...
      </div>
    );
  }

  if (tier === "INNOCENT") {
    return (
      <div
        style={{
          height: "100%",
          background: "#050810",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚖️</div>
        <div
          style={{
            fontWeight: 900,
            fontSize: 24,
            color: "rgba(243,244,246,.92)",
            marginBottom: 8,
            letterSpacing: "-0.5px",
          }}
        >
          Upgrade Required
        </div>
        <div
          style={{
            fontSize: 14,
            color: "rgba(148,163,184,.55)",
            marginBottom: 28,
            textAlign: "center",
            maxWidth: 360,
          }}
        >
          You need an Indicted subscription or higher to create your own lobby.
        </div>
        <button
          onClick={() => router.push("/subscribe")}
          style={{
            padding: "12px 28px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, rgba(88,0,229,.9), rgba(167,139,250,.85))",
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(88,0,229,.35)",
          }}
        >
          View Plans
        </button>
        <button
          onClick={() => router.push("/home")}
          style={{
            marginTop: 12,
            padding: "8px 20px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.10)",
            background: "transparent",
            color: "rgba(255,255,255,.4)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        background: "#050810",
        color: "rgba(243,244,246,.92)",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ marginBottom: 40 }}>
          <button
            onClick={() => router.push("/home")}
            style={{
              background: "none",
              border: "none",
              color: "rgba(148,163,184,.4)",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
              marginBottom: 16,
              fontFamily: "inherit",
            }}
          >
            ← Back
          </button>
          <div style={{ fontWeight: 900, fontSize: 28, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
            Create Your Lobby
          </div>
          <div style={{ fontSize: 13, color: "rgba(148,163,184,.5)", marginTop: 8 }}>
            Your community, your rules. Pick a name, set the vibe, and open the doors.
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <LobbyBranding value={branding} onChange={patchBranding} />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".5px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.35)",
              marginBottom: 8,
            }}
          >
            URL Slug
          </label>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 12,
                color: "rgba(148,163,184,.35)",
                pointerEvents: "none",
              }}
            >
              weered.ca/lobby/
            </span>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugManual(true);
              }}
              placeholder="your-lobby"
              maxLength={40}
              style={{
                width: "100%",
                padding: "12px 16px 12px 126px",
                borderRadius: 10,
                background: "rgba(255,255,255,.04)",
                border: `1px solid ${slugStatus === "available" ? "rgba(34,197,94,.35)" : slugStatus === "taken" || slugStatus === "reserved" ? "rgba(239,68,68,.35)" : "rgba(255,255,255,.10)"}`,
                color: "rgba(243,244,246,.92)",
                fontSize: 14,
                fontWeight: 600,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "border-color .15s",
              }}
            />
          </div>
          <div style={{ fontSize: 11, marginTop: 6, height: 16 }}>
            {slugStatus === "checking" && (
              <span style={{ color: "rgba(148,163,184,.4)" }}>Checking availability...</span>
            )}
            {slugStatus === "available" && slug.length >= 2 && (
              <span style={{ color: "rgba(34,197,94,.7)" }}>✓ Available</span>
            )}
            {slugStatus === "taken" && (
              <span style={{ color: "rgba(239,68,68,.7)" }}>✗ Already taken</span>
            )}
            {slugStatus === "reserved" && (
              <span style={{ color: "rgba(239,68,68,.7)" }}>✗ This name is reserved</span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 36 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".5px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.35)",
              marginBottom: 10,
            }}
          >
            Primary Module
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {MODULE_TYPES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModuleType(m.id)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: moduleType === m.id ? `${accent}12` : "rgba(255,255,255,.03)",
                  border:
                    moduleType === m.id
                      ? `1px solid ${accent}40`
                      : "1px solid rgba(255,255,255,.08)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all .15s",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{m.icon}</span>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: moduleType === m.id ? "rgba(243,244,246,.92)" : "rgba(243,244,246,.6)",
                    }}
                  >
                    {m.label}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,.4)", marginTop: 2 }}>
                    {m.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {name && (
          <div style={{ marginBottom: 32 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: ".5px",
                textTransform: "uppercase",
                color: "rgba(255,255,255,.35)",
                marginBottom: 10,
              }}
            >
              Preview
            </label>
            <div
              style={{
                borderRadius: 14,
                overflow: "hidden",
                border: `1px solid ${accent}22`,
                background: "rgba(255,255,255,.02)",
              }}
            >
              <div
                style={{ height: 3, background: `linear-gradient(90deg, ${accent}55, ${accent})` }}
              />
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: `${accent}15`,
                      border: `1px solid ${accent}25`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                      fontWeight: 900,
                      color: accent,
                    }}
                  >
                    {name.trim().slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.2px" }}>
                      {name}
                    </div>
                    {description && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginTop: 2 }}>
                        {description}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 5,
                      background: `${accent}12`,
                      border: `1px solid ${accent}20`,
                      color: accent,
                      textTransform: "uppercase",
                      letterSpacing: ".5px",
                    }}
                  >
                    lobby
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,.3)" }}>
                    weered.ca/lobby/{slug || "..."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(239,68,68,.08)",
              border: "1px solid rgba(239,68,68,.25)",
              color: "rgba(252,165,165,.9)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: canCreate
              ? `linear-gradient(135deg, ${accent}dd, ${accent})`
              : "rgba(255,255,255,.06)",
            color: canCreate ? "#fff" : "rgba(255,255,255,.25)",
            fontWeight: 800,
            fontSize: 15,
            cursor: canCreate ? "pointer" : "default",
            fontFamily: "inherit",
            letterSpacing: "-0.2px",
            boxShadow: canCreate ? `0 4px 20px ${accent}44` : "none",
            transition: "all .2s",
            opacity: creating ? 0.6 : 1,
          }}
        >
          {creating ? "Creating..." : "Create Lobby"}
        </button>

        <div
          style={{
            fontSize: 11,
            color: "rgba(148,163,184,.3)",
            textAlign: "center",
            marginTop: 14,
          }}
        >
          You can customize branding, rooms, and modules after creation from the Admin panel.
        </div>
      </div>
    </div>
  );
}
