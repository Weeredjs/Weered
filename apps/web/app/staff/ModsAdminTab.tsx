"use client";
import { useState, useEffect, useCallback } from "react";
import { S, apiFetch } from "./shared";

export function ModsAdminTab() {
  const [mods, setMods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExcluded, setShowExcluded] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ gameSlug: "windrose" });
    if (showExcluded) params.set("excluded", "1");
    if (search.trim()) params.set("search", search.trim());
    const j = await apiFetch(`/staff/mods?${params.toString()}`);
    setMods(j?.mods || []);
    setLoading(false);
  }, [showExcluded, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function toggle(mod: any, next: boolean) {
    setBusy(mod.id);
    setMsg("");
    let note: string | null = null;
    if (next) {
      const reason = window.prompt(
        `Hide "${mod.name}" from the public catalog?\n\nOptional note (e.g. "author requested removal via email 2026-04-27"):`,
        "Author requested removal",
      );
      if (reason === null) {
        setBusy(null);
        return;
      }
      note = reason.trim() || null;
    }
    const j = await apiFetch(`/staff/mods/${mod.id}`, {
      method: "PATCH",
      body: JSON.stringify({ excluded: next, note }),
    });
    setBusy(null);
    if (j?.ok) {
      setMsg(next ? `Hid "${mod.name}".` : `Restored "${mod.name}".`);
      reload();
    } else {
      setMsg(j?.error || "Failed.");
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or author..."
          style={{ ...S.input, flex: 1, minWidth: 200 }}
        />
        <button onClick={() => setShowExcluded((v) => !v)} style={showExcluded ? S.warn : S.btn}>
          {showExcluded ? "Showing excluded" : "Show active"}
        </button>
        <button onClick={() => reload()} style={S.btn}>
          Refresh
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>

      <div
        style={{ ...S.card, padding: "10px 14px", marginBottom: 14, fontSize: 12, opacity: 0.75 }}
      >
        <strong style={{ color: "rgb(216,180,254)" }}>How this works:</strong> Hide a mod when the
        author emails support requesting removal from the catalog. Hidden mods stop appearing on
        /mods/windrose and the in-app Mods tab. The Nexus poller will re-upsert metadata, but the
        excluded flag and note persist.
      </div>

      {loading ? (
        <div style={{ opacity: 0.4 }}>Loading…</div>
      ) : mods.length === 0 ? (
        <div style={{ opacity: 0.4 }}>{showExcluded ? "No excluded mods." : "No mods match."}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {mods.map((m) => (
            <div key={m.id} style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {m.thumbnailUrl ? (
                  <img
                    src={m.thumbnailUrl}
                    alt=""
                    style={{
                      width: 56,
                      height: 32,
                      objectFit: "cover",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 32,
                      borderRadius: 4,
                      background: "rgba(124,58,237,.12)",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.55 }}>
                    by {m.author || "?"} · 👍 {m.endorsements?.toLocaleString() || 0} · ⬇{" "}
                    {m.downloads?.toLocaleString() || 0}
                    {m.sourceUrl && (
                      <>
                        {" · "}
                        <a
                          href={m.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "rgb(167,139,250)" }}
                        >
                          source ↗
                        </a>
                      </>
                    )}
                  </div>
                  {m.excluded && m.excludedNote && (
                    <div
                      style={{
                        fontSize: 11,
                        marginTop: 4,
                        color: "rgb(252,165,165)",
                        fontStyle: "italic",
                      }}
                    >
                      Note: {m.excludedNote}
                      {m.excludedAt && (
                        <span style={{ opacity: 0.6 }}>
                          {" "}
                          · {new Date(m.excludedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggle(m, !m.excluded)}
                  disabled={busy === m.id}
                  style={m.excluded ? S.success : S.danger}
                >
                  {busy === m.id ? "…" : m.excluded ? "Restore" : "Hide"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
