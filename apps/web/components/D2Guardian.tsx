"use client";
import { useState, useEffect, useCallback } from "react";
import EmptyState from "./EmptyState";
import { ACCENT_DESTINY, API, S, TIER_BORDER, TIER_COLORS, apiFetch } from "./D2Shared";
import { ItemDetailPanel, ItemTile, PerkRow } from "./D2Items";

export function BungieWeekly({ accentColor }: { accentColor?: string }) {
  const accent = accentColor || ACCENT_DESTINY;
  const [data, setData] = useState<any>(null);
  const [xur, setXur] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch("/bungie/weekly"), apiFetch("/bungie/xur")])
      .then(([w, x]) => {
        setData(w);
        setXur(x);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Loading Bungie data...
      </div>
    );

  const milestones = data?.milestones || [];
  const hasManifest = !!data?.manifestVersion;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          ...S.card,
          border: xur?.available
            ? "1px solid rgba(245,158,11,.30)"
            : "1px solid rgba(255,255,255,.08)",
          background: xur?.available ? "rgba(245,158,11,.06)" : "rgba(255,255,255,.03)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: xur?.available && xur?.items?.length ? 10 : 0,
          }}
        >
          <span style={{ fontSize: 22 }}>🐍</span>
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                color: xur?.available ? "rgb(253,230,138)" : "rgba(255,255,255,.6)",
              }}
            >
              Xur {xur?.available ? "is here!" : "is away"}
            </div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>
              {xur?.available ? "Exotic vendor is selling..." : "Returns every Friday at reset"}
            </div>
          </div>
        </div>
        {xur?.available && xur?.items?.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              borderTop: "1px solid rgba(245,158,11,.12)",
              paddingTop: 8,
            }}
          >
            {xur.items.map((item: any, i: number) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 8px",
                  borderRadius: 2,
                  border: `1px solid ${TIER_BORDER[item.tierName] || "rgba(255,255,255,.08)"}`,
                  background: `${TIER_COLORS[item.tierName] || "rgba(255,255,255,.03)"}18`,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    overflow: "hidden",
                    flexShrink: 0,
                    background: "rgba(0,0,0,.5)",
                    border: `1px solid ${TIER_BORDER[item.tierName] || "rgba(255,255,255,.08)"}`,
                    position: "relative",
                  }}
                >
                  {item.icon && (
                    <img
                      src={item.icon}
                      alt={(item.name || "Item") + " icon"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: item.tierName === "Exotic" ? "#ceae33" : "rgba(243,244,246,.9)",
                    }}
                  >
                    {item.name || "Unknown"}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.4 }}>
                    {item.tierName}
                    {item.slotName ? ` · ${item.slotName}` : ""}
                  </div>
                  <PerkRow perks={item.perks} max={5} />
                </div>
                {item.armorStats && (
                  <div style={{ fontSize: 9, opacity: 0.35, fontWeight: 600, flexShrink: 0 }}>
                    T{item.armorStats.total}
                  </div>
                )}
              </div>
            ))}
            {xur.cachedAt && (
              <div style={{ fontSize: 9, opacity: 0.2, textAlign: "center", marginTop: 2 }}>
                Cached {new Date(xur.cachedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </div>

      {milestones.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {milestones
            .filter((ms: any) => !ms.name.startsWith("Milestone"))
            .slice(0, 20)
            .map((ms: any) => (
              <div key={ms.hash} style={{ ...S.card }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: ms.activities?.length ? 8 : 0,
                  }}
                >
                  {ms.icon ? (
                    <img
                      src={ms.icon}
                      alt={ms.name + " icon"}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 2,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 2,
                        background: `${accent}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      📋
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{ms.name}</div>
                    {ms.description && (
                      <div
                        style={{
                          fontSize: 10,
                          opacity: 0.4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ms.description}
                      </div>
                    )}
                  </div>
                  {ms.activities?.length > 0 && (
                    <span style={{ fontSize: 10, opacity: 0.35, flexShrink: 0 }}>
                      {ms.activities.length} activities
                    </span>
                  )}
                </div>
                {hasManifest && ms.activities?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {ms.activities.slice(0, 5).map((act: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          borderRadius: 2,
                          background: "rgba(255,255,255,.02)",
                          border: "1px solid rgba(255,255,255,.04)",
                        }}
                      >
                        {act.icon && (
                          <img
                            src={act.icon}
                            alt={act.name + " icon"}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 2,
                              objectFit: "cover",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>{act.name}</div>
                          {act.lightLevel > 0 && (
                            <span style={{ fontSize: 9, opacity: 0.4 }}>
                              {act.lightLevel} Power
                            </span>
                          )}
                        </div>
                        {act.modifiers?.length > 0 && (
                          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                            {act.modifiers.slice(0, 6).map((mod: any, mi: number) => (
                              <div
                                key={mi}
                                title={`${mod.name}: ${mod.description || ""}`}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 2,
                                  overflow: "hidden",
                                  background: "rgba(0,0,0,.3)",
                                  border: "1px solid rgba(255,255,255,.06)",
                                }}
                              >
                                {mod.icon && (
                                  <img
                                    src={mod.icon}
                                    alt={mod.name + " modifier icon"}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      ) : (
        <div style={{ ...S.card, padding: 0 }}>
          <EmptyState
            compact
            title={data?.error ? "Bungie API's down." : "No milestone data."}
            hint={data?.error ? "Check back in a bit." : undefined}
          />
        </div>
      )}

      <div style={{ ...S.card, textAlign: "center" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            opacity: 0.4,
            letterSpacing: ".7px",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Weekly Reset
        </div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Every Tuesday at 17:00 UTC</div>
        {hasManifest && (
          <div style={{ fontSize: 9, opacity: 0.25, marginTop: 4 }}>
            Manifest v{data.manifestVersion}
          </div>
        )}
      </div>
    </div>
  );
}

export function GuardianLookup() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const CLASS_NAMES: Record<number, string> = { 0: "Titan", 1: "Hunter", 2: "Warlock" };
  const CLASS_EMOJI: Record<number, string> = { 0: "🛡", 1: "🗡", 2: "✨" };

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSelectedItem(null);
    try {
      const j = await apiFetch(`/bungie/player/${encodeURIComponent(query.trim())}`);
      if (j.ok && j.found) setResult(j);
      else if (j.ok && !j.found) setError("Guardian not found. Try BungieName#1234 format.");
      else setError(j.error || "Lookup failed");
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          style={{ ...S.input, flex: 1 }}
          placeholder="BungieName#1234"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button style={S.btnPri} onClick={search} disabled={loading}>
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "rgba(252,165,165,.8)", marginBottom: 10 }}>{error}</div>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              ...S.card,
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: `1px solid ${ACCENT_DESTINY}30`,
              background: `${ACCENT_DESTINY}08`,
            }}
          >
            {result.player?.iconPath && (
              <img
                src={result.player.iconPath}
                alt="Player emblem"
                style={{ width: 44, height: 44, borderRadius: 2, objectFit: "cover" }}
              />
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {result.player?.displayName}
                {result.player?.displayNameCode ? `#${result.player.displayNameCode}` : ""}
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>
                {result.totalCharacters} characters · Platform {result.player?.membershipType}
              </div>
            </div>
          </div>

          {result.privacyRestricted && (
            <div style={{ ...S.card, textAlign: "center", fontSize: 12, opacity: 0.5 }}>
              This guardian's equipment is private.
            </div>
          )}

          {(result.characters || []).map((c: any) => (
            <div key={c.characterId} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  ...S.card,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {c.emblemBackgroundPath && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: `url(${c.emblemBackgroundPath}) center/cover no-repeat`,
                      opacity: 0.15,
                    }}
                  />
                )}
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{CLASS_EMOJI[c.classType] || "?"}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>
                        {CLASS_NAMES[c.classType] || "Unknown"}
                      </div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color: "rgb(253,230,138)",
                          lineHeight: 1.1,
                        }}
                      >
                        {c.light}{" "}
                        <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.5 }}>Power</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.4 }}>
                    {Math.round((c.minutesPlayedTotal || 0) / 60)}h played
                  </div>
                </div>
              </div>
              {(c.weapons?.length > 0 || c.armor?.length > 0 || c.equipped?.length > 0) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 4 }}>
                  {(c.weapons || [])
                    .concat(c.armor || [])
                    .concat(c.otherEquipped || [])
                    .slice(0, 12)
                    .map((item: any, i: number) => (
                      <ItemTile key={i} item={item} compact onClick={() => setSelectedItem(item)} />
                    ))}
                  {!c.weapons?.length &&
                    !c.armor?.length &&
                    (c.equipped || [])
                      .slice(0, 12)
                      .map((item: any, i: number) => (
                        <ItemTile
                          key={`e${i}`}
                          item={item}
                          compact
                          onClick={() => setSelectedItem(item)}
                        />
                      ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!result && !error && !loading && (
        <div style={{ textAlign: "center", padding: 20, opacity: 0.3, fontSize: 13 }}>
          Search for any Destiny 2 guardian to see their characters and loadout
        </div>
      )}

      {selectedItem && (
        <ItemDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

export function MyGuardian({ accentColor }: { accentColor?: string }) {
  const accent = accentColor || ACCENT_DESTINY;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChar, setSelectedChar] = useState(0);
  const [subTab, setSubTab] = useState<"equipped" | "inventory" | "vault">("equipped");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState("");

  const fetchProfile = useCallback(() => {
    apiFetch("/bungie/me")
      .then((j) => {
        setData(j);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleEquip(itemId: string, charId: string) {
    setActionMsg("Equipping...");
    try {
      const j = await apiFetch("/bungie/equip", {
        method: "POST",
        body: JSON.stringify({ itemId, characterId: charId, membershipType: data?.platform }),
      });
      if (j.ok) {
        setActionMsg("Equipped!");
        setSelectedItem(null);
        fetchProfile();
      } else setActionMsg(j.error || j.message || "Equip failed");
    } catch {
      setActionMsg("Network error");
    }
    setTimeout(() => setActionMsg(""), 3000);
  }

  async function handleTransfer(item: any, toVault: boolean, charId: string) {
    setActionMsg(toVault ? "Vaulting..." : "Transferring...");
    try {
      const j = await apiFetch("/bungie/transfer", {
        method: "POST",
        body: JSON.stringify({
          itemReferenceHash: item.itemHash,
          stackSize: 1,
          transferToVault: toVault,
          itemId: item.itemInstanceId,
          characterId: charId,
          membershipType: data?.platform,
        }),
      });
      if (j.ok) {
        setActionMsg(toVault ? "Vaulted!" : "Transferred!");
        setSelectedItem(null);
        fetchProfile();
      } else setActionMsg(j.error || j.message || "Transfer failed");
    } catch {
      setActionMsg("Network error");
    }
    setTimeout(() => setActionMsg(""), 3000);
  }

  if (loading)
    return (
      <div style={{ padding: 20, textAlign: "center", opacity: 0.4, fontSize: 13 }}>
        Loading your Guardian...
      </div>
    );

  if (!data?.linked) {
    const linkUrl = `${API}/auth/bungie`;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 48, opacity: 0.3 }}>🔗</div>
        <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center" }}>
          Link your Bungie account
        </div>
        <div
          style={{
            fontSize: 12,
            opacity: 0.45,
            textAlign: "center",
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          Connect your Bungie.net account to view your characters, inventory, vault, and loadouts
          right here on Weered.
        </div>
        <a
          href={linkUrl}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 28px",
            borderRadius: 2,
            background: `${accent}20`,
            border: `1px solid ${accent}50`,
            color: accent,
            fontWeight: 800,
            fontSize: 14,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          Link Bungie Account
        </a>
        <div style={{ fontSize: 10, opacity: 0.25 }}>
          You will be redirected to Bungie.net to authorize
        </div>
      </div>
    );
  }

  if (error || data?.error) {
    const isExpired =
      data?.error === "token_expired" ||
      data?.error === "no_profile_data" ||
      data?.error === "fetch_failed";
    if (isExpired && data?.linked) {
      const linkUrl = `${API}/auth/bungie`;
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 48, opacity: 0.3 }}>🔄</div>
          <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center" }}>Session expired</div>
          <div
            style={{
              fontSize: 12,
              opacity: 0.45,
              textAlign: "center",
              maxWidth: 320,
              lineHeight: 1.5,
            }}
          >
            Your Bungie authorization has expired. Re-link to restore access to your characters,
            inventory, and vault.
          </div>
          <a
            href={linkUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 28px",
              borderRadius: 2,
              background: `${accent}20`,
              border: `1px solid ${accent}50`,
              color: accent,
              fontWeight: 800,
              fontSize: 14,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            Re-link Bungie Account
          </a>
          <div style={{ fontSize: 10, opacity: 0.25 }}>You will be redirected to Bungie.net</div>
        </div>
      );
    }
    return (
      <div
        style={{ padding: 20, textAlign: "center", color: "rgba(252,165,165,.8)", fontSize: 13 }}
      >
        {error || data?.message || data?.error}
      </div>
    );
  }

  const characters: any[] = Array.isArray(data?.characters)
    ? data.characters
    : typeof data?.characters === "object" && data.characters
      ? Object.values(data.characters)
      : [];
  const vault: any[] = data?.vault || [];
  const char = characters[selectedChar];
  const hasManifest = !!data?.manifestVersion;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        height: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 2,
            background: `${accent}25`,
            border: `1px solid ${accent}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          ⚔
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
          >
            {data.displayName}
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: 2,
                background: "rgba(34,197,94,.10)",
                border: "1px solid rgba(34,197,94,.25)",
                color: "rgba(134,239,172,.9)",
              }}
            >
              LINKED
            </span>
          </div>
          <div style={{ fontSize: 9, opacity: 0.4 }}>
            Platform {data.platform} · {characters.length} chars
            {data.vaultCount ? ` · ${data.vaultCount} vault` : ""}
          </div>
        </div>
        <button
          onClick={() => {
            window.location.href = `${API}/auth/bungie`;
          }}
          style={{ ...S.btn, fontSize: 10, padding: "3px 8px" }}
        >
          Re-link
        </button>
      </div>

      {characters.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid rgba(255,255,255,.06)",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {characters.map((c: any, i: number) => (
            <button
              key={c.characterId || i}
              onClick={() => {
                setSelectedChar(i);
                if (subTab === "vault") setSubTab("equipped");
              }}
              style={{
                flex: 1,
                padding: "6px 4px",
                border: "none",
                cursor: "pointer",
                minWidth: 0,
                background:
                  selectedChar === i && subTab !== "vault" ? `${accent}18` : "transparent",
                borderBottom:
                  selectedChar === i && subTab !== "vault"
                    ? `2px solid ${accent}`
                    : "2px solid transparent",
                color:
                  selectedChar === i && subTab !== "vault"
                    ? "rgba(243,244,246,.92)"
                    : "rgba(148,163,184,.55)",
                fontWeight: selectedChar === i && subTab !== "vault" ? 700 : 400,
                fontSize: 11,
                transition: "all .12s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 12 }}>
                {c.classType === 0 ? "🛡" : c.classType === 1 ? "🗡" : "✨"}
              </span>
              {c.className || ["Titan", "Hunter", "Warlock"][c.classType]}
              <span style={{ fontSize: 13, fontWeight: 900, color: "rgb(253,230,138)" }}>
                {c.light}
              </span>
            </button>
          ))}
          <button
            onClick={() => setSubTab("vault")}
            style={{
              padding: "6px 8px",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              background: subTab === "vault" ? "rgba(245,158,11,.08)" : "transparent",
              borderBottom:
                subTab === "vault" ? "2px solid rgba(245,158,11,.6)" : "2px solid transparent",
              color: subTab === "vault" ? "rgba(253,230,138,.9)" : "rgba(148,163,184,.55)",
              fontWeight: subTab === "vault" ? 700 : 400,
              fontSize: 11,
              transition: "all .12s",
            }}
          >
            🔒 Vault{data.vaultCount ? ` (${data.vaultCount})` : ""}
          </button>
        </div>
      )}

      {subTab !== "vault" && char && (
        <div
          style={{
            display: "flex",
            gap: 2,
            padding: "6px 12px",
            borderBottom: "1px solid rgba(255,255,255,.04)",
            flexShrink: 0,
          }}
        >
          {(["equipped", "inventory"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setSubTab(st)}
              style={{
                padding: "4px 10px",
                borderRadius: 2,
                border: "none",
                fontSize: 11,
                cursor: "pointer",
                background: subTab === st ? `${accent}20` : "transparent",
                color: subTab === st ? "rgba(243,244,246,.9)" : "rgba(148,163,184,.5)",
                fontWeight: subTab === st ? 700 : 400,
                textTransform: "capitalize",
              }}
            >
              {st}
              {st === "inventory" ? ` (${char.inventory?.length || 0})` : ""}
            </button>
          ))}
        </div>
      )}

      {actionMsg && (
        <div
          style={{
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 600,
            textAlign: "center",
            color:
              actionMsg.includes("failed") || actionMsg.includes("error")
                ? "rgba(252,165,165,.9)"
                : "rgba(134,239,172,.9)",
            background:
              actionMsg.includes("failed") || actionMsg.includes("error")
                ? "rgba(252,165,165,.06)"
                : "rgba(34,197,94,.06)",
            borderBottom: "1px solid rgba(255,255,255,.04)",
            flexShrink: 0,
          }}
        >
          {actionMsg}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
        {subTab === "vault" ? (
          <VaultView items={vault} onItemClick={setSelectedItem} />
        ) : char ? (
          subTab === "equipped" ? (
            <EquippedView char={char} hasManifest={hasManifest} onItemClick={setSelectedItem} />
          ) : (
            <InventoryGrid
              items={char.inventory || []}
              hasManifest={hasManifest}
              onItemClick={setSelectedItem}
            />
          )
        ) : (
          <EmptyState
            compact
            title="No character data."
            hint="Link your Bungie account to pull it in."
          />
        )}
      </div>

      {selectedItem && (
        <ItemDetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEquip={handleEquip}
          onTransfer={handleTransfer}
          characters={characters}
          currentCharId={char?.characterId}
        />
      )}
    </div>
  );
}

export function EquippedView({
  char,
  hasManifest,
  onItemClick,
}: {
  char: any;
  hasManifest: boolean;
  onItemClick?: (item: any) => void;
}) {
  const weapons = char.weapons || [];
  const armor = char.armor || [];
  const other = char.otherEquipped || [];
  const allEquipped = char.equipped || [];
  const hasGrouped = weapons.length > 0 || armor.length > 0;

  if (!hasGrouped && allEquipped.length > 0) {
    return (
      <div>
        <div style={S.label}>Equipped</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {allEquipped.slice(0, 12).map((item: any, i: number) => (
            <ItemTile
              key={i}
              item={item}
              compact
              onClick={onItemClick ? () => onItemClick(item) : undefined}
            />
          ))}
        </div>
        {!hasManifest && (
          <div style={{ fontSize: 10, opacity: 0.25, marginTop: 12, textAlign: "center" }}>
            Manifest not synced — item names unavailable
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {char.emblemBackgroundPath && (
        <div
          style={{
            borderRadius: 2,
            overflow: "hidden",
            position: "relative",
            height: 56,
            background: `url(${char.emblemBackgroundPath?.startsWith("http") ? char.emblemBackgroundPath : "https://www.bungie.net" + char.emblemBackgroundPath}) center/cover`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, rgba(0,0,0,.7) 0%, transparent 60%)",
              display: "flex",
              alignItems: "center",
              padding: "0 16px",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>
              {char.classType === 0 ? "🛡" : char.classType === 1 ? "🗡" : "✨"}
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {char.className}{" "}
                <span style={{ opacity: 0.4, fontWeight: 400, fontSize: 11 }}>{char.raceName}</span>
              </div>
              <div
                style={{ fontSize: 18, fontWeight: 900, color: "rgb(253,230,138)", lineHeight: 1 }}
              >
                {char.light}{" "}
                <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.5 }}>POWER</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {weapons.length > 0 && (
        <div>
          <div style={S.label}>Weapons</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {weapons.map((item: any, i: number) => (
              <ItemTile
                key={i}
                item={item}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
              />
            ))}
          </div>
        </div>
      )}
      {armor.length > 0 && (
        <div>
          <div style={S.label}>Armor</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {armor.map((item: any, i: number) => (
              <ItemTile
                key={i}
                item={item}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
              />
            ))}
          </div>
        </div>
      )}
      {other.length > 0 && (
        <div>
          <div style={S.label}>Other</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {other.map((item: any, i: number) => (
              <ItemTile
                key={i}
                item={item}
                compact
                onClick={onItemClick ? () => onItemClick(item) : undefined}
              />
            ))}
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, opacity: 0.2, textAlign: "center" }}>
        Last played:{" "}
        {char.dateLastPlayed ? new Date(char.dateLastPlayed).toLocaleDateString() : "—"} ·{" "}
        {Math.round((char.minutesPlayedTotal || 0) / 60)}h total
      </div>
    </div>
  );
}

export function InventoryGrid({
  items,
  hasManifest,
  onItemClick,
}: {
  items: any[];
  hasManifest: boolean;
  onItemClick?: (item: any) => void;
}) {
  if (!items.length) return <EmptyState compact title="Inventory empty." />;
  const exotics = items.filter((i: any) => i.tierName === "Exotic");
  const legendaries = items.filter((i: any) => i.tierName === "Legendary");
  const rest = items.filter((i: any) => i.tierName !== "Exotic" && i.tierName !== "Legendary");

  const renderGroup = (label: string, group: any[]) =>
    group.length === 0 ? null : (
      <div>
        <div style={S.label}>
          {label} ({group.length})
        </div>
        {hasManifest ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {group.map((item: any, i: number) => (
              <ItemTile
                key={i}
                item={item}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {group.map((item: any, i: number) => (
              <ItemTile
                key={i}
                item={item}
                compact
                onClick={onItemClick ? () => onItemClick(item) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {renderGroup("Exotics", exotics)}
      {renderGroup("Legendaries", legendaries)}
      {renderGroup("Other", rest)}
    </div>
  );
}

export function VaultView({
  items,
  onItemClick,
}: {
  items: any[];
  onItemClick?: (item: any) => void;
}) {
  const [filter, setFilter] = useState<"all" | "weapons" | "armor">("all");
  if (!items.length) return <EmptyState compact title="Vault empty or unreachable." />;
  const weaponBuckets = new Set([1498876634, 2465295065, 953998645]);
  const armorBuckets = new Set([3448274439, 3551918588, 14239492, 20886954, 1585787867]);
  const filtered = items.filter((i: any) => {
    if (filter === "weapons") return weaponBuckets.has(i.bucketHash);
    if (filter === "armor") return armorBuckets.has(i.bucketHash);
    return true;
  });
  filtered.sort((a: any, b: any) => {
    const ta = a.tierType || 0,
      tb = b.tierType || 0;
    if (ta !== tb) return tb - ta;
    return (b.primaryStat || 0) - (a.primaryStat || 0);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {(["all", "weapons", "armor"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "4px 10px",
              borderRadius: 2,
              border: "none",
              fontSize: 11,
              cursor: "pointer",
              background: filter === f ? "rgba(245,158,11,.15)" : "transparent",
              color: filter === f ? "rgba(253,230,138,.9)" : "rgba(148,163,184,.5)",
              fontWeight: filter === f ? 700 : 400,
              textTransform: "capitalize",
            }}
          >
            {f} (
            {f === "all"
              ? items.length
              : items.filter((i: any) =>
                  f === "weapons"
                    ? weaponBuckets.has(i.bucketHash)
                    : armorBuckets.has(i.bucketHash),
                ).length}
            )
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {filtered.slice(0, 100).map((item: any, i: number) => (
          <ItemTile
            key={i}
            item={item}
            compact
            onClick={onItemClick ? () => onItemClick(item) : undefined}
          />
        ))}
      </div>
      {filtered.length > 100 && (
        <div style={{ fontSize: 10, opacity: 0.3, textAlign: "center" }}>
          Showing first 100 of {filtered.length}
        </div>
      )}
    </div>
  );
}
