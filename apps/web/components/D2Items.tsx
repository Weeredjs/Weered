"use client";
import { useState } from "react";
import { S, TIER_BORDER, TIER_COLORS } from "./D2Shared";

export function PerkRow({ perks, max = 6 }: { perks?: any[]; max?: number }) {
  if (!perks?.length) return null;
  const visible = perks.filter((p: any) => p.icon && p.name).slice(0, max);
  if (!visible.length) return null;
  return (
    <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
      {visible.map((p: any, i: number) => (
        <div
          key={i}
          title={p.name}
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            overflow: "hidden",
            background: "rgba(0,0,0,.4)",
            border: "1px solid rgba(255,255,255,.08)",
            flexShrink: 0,
          }}
        >
          <img
            src={p.icon}
            alt={p.name + " perk icon"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      ))}
    </div>
  );
}

export const STAT_BARS = [
  { key: "mobility", label: "MOB", color: "#7dd3fc" },
  { key: "resilience", label: "RES", color: "#f87171" },
  { key: "recovery", label: "REC", color: "#a3e635" },
  { key: "discipline", label: "DIS", color: "#818cf8" },
  { key: "intellect", label: "INT", color: "#fbbf24" },
  { key: "strength", label: "STR", color: "#f472b6" },
];

export function ArmorStatBar({ stats }: { stats: any }) {
  if (!stats) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {STAT_BARS.map((s) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
          <span
            style={{ width: 24, fontWeight: 700, color: s.color, opacity: 0.8, textAlign: "right" }}
          >
            {s.label}
          </span>
          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: "rgba(255,255,255,.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(((stats[s.key] || 0) / 42) * 100, 100)}%`,
                height: "100%",
                borderRadius: 3,
                background: s.color,
                opacity: 0.6,
              }}
            />
          </div>
          <span
            style={{
              width: 18,
              fontWeight: 700,
              color: "rgba(255,255,255,.6)",
              textAlign: "right",
            }}
          >
            {stats[s.key] || 0}
          </span>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          fontSize: 10,
          fontWeight: 800,
          color: "rgba(253,230,138,.7)",
          marginTop: 2,
        }}
      >
        Total: {stats.total || 0}
      </div>
    </div>
  );
}

export function PerkDetail({ perk }: { perk: any }) {
  const [expanded, setExpanded] = useState(false);
  const hasAlts = perk.availablePlugs?.length > 0;

  return (
    <div>
      <div
        onClick={() => hasAlts && setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: "6px 8px",
          borderRadius: 2,
          background: "rgba(255,255,255,.03)",
          border: "1px solid rgba(255,255,255,.05)",
          cursor: hasAlts ? "pointer" : "default",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 2,
            overflow: "hidden",
            flexShrink: 0,
            background: "rgba(0,0,0,.4)",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          {perk.icon && (
            <img
              src={perk.icon}
              alt={perk.name + " perk icon"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
          >
            {perk.name}
            {hasAlts && (
              <span style={{ fontSize: 8, opacity: 0.35, fontWeight: 400 }}>
                {expanded ? "▲" : "▼"} {perk.availablePlugs.length} options
              </span>
            )}
          </div>
          {perk.description && (
            <div style={{ fontSize: 10, opacity: 0.45, marginTop: 2, lineHeight: 1.4 }}>
              {perk.description}
            </div>
          )}
        </div>
      </div>

      {expanded && perk.availablePlugs && (
        <div
          style={{
            marginLeft: 36,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            marginTop: 2,
            marginBottom: 2,
          }}
        >
          {perk.availablePlugs.map((alt: any, j: number) => (
            <div
              key={j}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
                padding: "4px 6px",
                borderRadius: 2,
                background: "rgba(124,58,237,.04)",
                border: "1px solid rgba(124,58,237,.08)",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "rgba(0,0,0,.3)",
                  border: "1px solid rgba(255,255,255,.06)",
                }}
              >
                {alt.icon && (
                  <img
                    src={alt.icon}
                    alt={alt.name + " perk icon"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(167,139,250,.8)" }}>
                  {alt.name}
                </div>
                {alt.description && (
                  <div style={{ fontSize: 9, opacity: 0.35, marginTop: 1, lineHeight: 1.3 }}>
                    {alt.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ItemDetailPanel({
  item,
  onClose,
  onEquip,
  onTransfer,
  characters,
  currentCharId,
}: {
  item: any;
  onClose: () => void;
  onEquip?: (itemId: string, charId: string) => void;
  onTransfer?: (item: any, toVault: boolean, charId: string) => void;
  characters?: any[];
  currentCharId?: string;
}) {
  const tier = item.tierName || "Unknown";
  const borderColor = TIER_BORDER[tier] || "rgba(255,255,255,.08)";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: "rgba(5,8,16,.92)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            opacity: 0.5,
            letterSpacing: ".5px",
            textTransform: "uppercase",
          }}
        >
          Item Detail
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,.5)",
            cursor: "pointer",
            fontSize: 16,
            padding: "2px 6px",
          }}
        >
          ✕
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 2,
              overflow: "hidden",
              flexShrink: 0,
              border: `2px solid ${borderColor}`,
              position: "relative",
              background: "rgba(0,0,0,.5)",
            }}
          >
            {item.icon && (
              <img
                src={item.icon}
                alt={(item.name || "Item") + " icon"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            {item.watermark && (
              <img
                src={item.watermark}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: 0.25,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: tier === "Exotic" ? "#ceae33" : "#fff",
              }}
            >
              {item.name}
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.5,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 2,
              }}
            >
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 2,
                  background: `${TIER_COLORS[tier] || "rgba(255,255,255,.1)"}40`,
                  border: `1px solid ${borderColor}`,
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {tier}
              </span>
              {item.slotName && <span>{item.slotName}</span>}
              {item.damageType && item.damageType !== "None" && (
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  {item.damageIcon && (
                    <img
                      src={item.damageIcon}
                      alt={item.damageType + " damage icon"}
                      style={{ width: 11, height: 11, opacity: 0.7 }}
                    />
                  )}
                  {item.damageType}
                </span>
              )}
            </div>
            {item.primaryStat && (
              <div
                style={{ fontSize: 24, fontWeight: 900, color: "rgb(253,230,138)", marginTop: 4 }}
              >
                {item.primaryStat}
              </div>
            )}
          </div>
        </div>

        {item.description && (
          <div style={{ fontSize: 12, opacity: 0.5, lineHeight: 1.5 }}>{item.description}</div>
        )}

        {item.perks?.length > 0 &&
          (() => {
            const realPerks = item.perks.filter((p: any) => p.icon && p.name && !p.isJunk);
            const junkPerks = item.perks.filter((p: any) => p.icon && p.name && p.isJunk);
            return (
              <>
                {realPerks.length > 0 && (
                  <div>
                    <div style={S.label}>Perks</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {realPerks.map((p: any, i: number) => (
                        <PerkDetail key={i} perk={p} />
                      ))}
                    </div>
                  </div>
                )}
                {junkPerks.length > 0 && (
                  <div>
                    <div style={{ ...S.label, opacity: 0.25 }}>Mod Slots</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {junkPerks.map((p: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "4px 8px",
                            borderRadius: 2,
                            background: "rgba(255,255,255,.015)",
                            border: "1px solid rgba(255,255,255,.03)",
                          }}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 2,
                              overflow: "hidden",
                              flexShrink: 0,
                              background: "rgba(0,0,0,.3)",
                              border: "1px dashed rgba(255,255,255,.08)",
                            }}
                          >
                            {p.icon && (
                              <img
                                src={p.icon}
                                alt={p.name + " perk icon"}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  opacity: 0.3,
                                }}
                              />
                            )}
                          </div>
                          <span style={{ fontSize: 10, opacity: 0.3, fontStyle: "italic" }}>
                            {p.name}
                          </span>
                          {p.availablePlugs?.length > 0 && (
                            <span style={{ fontSize: 9, opacity: 0.35, marginLeft: "auto" }}>
                              {p.availablePlugs.length} available
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

        {item.armorStats && (
          <div>
            <div style={S.label}>Stats</div>
            <ArmorStatBar stats={item.armorStats} />
          </div>
        )}

        {(onEquip || onTransfer) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            {onEquip && currentCharId && !item.isEquipped && (
              <button
                onClick={() => onEquip(item.itemInstanceId, currentCharId)}
                style={{ ...S.btnPri, width: "100%", padding: "10px 0", fontWeight: 800 }}
              >
                Equip
              </button>
            )}
            {onTransfer && currentCharId && (
              <button
                onClick={() => onTransfer(item, true, currentCharId)}
                style={{ ...S.btn, width: "100%", padding: "8px 0", fontSize: 11 }}
              >
                Send to Vault
              </button>
            )}
            {onTransfer &&
              characters &&
              characters
                .filter((c) => c.characterId !== currentCharId)
                .map((c: any) => (
                  <button
                    key={c.characterId}
                    onClick={() => onTransfer(item, false, c.characterId)}
                    style={{ ...S.btn, width: "100%", padding: "8px 0", fontSize: 11 }}
                  >
                    Transfer to {c.className}
                  </button>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ItemTile({
  item,
  compact,
  onClick,
}: {
  item: any;
  compact?: boolean;
  onClick?: () => void;
}) {
  const tier = item.tierName || "Unknown";
  const borderColor = TIER_BORDER[tier] || "rgba(255,255,255,.08)";
  const bgColor = TIER_COLORS[tier] || "rgba(255,255,255,.03)";
  const clickStyle = onClick ? { cursor: "pointer" } : {};

  if (compact) {
    return (
      <div
        title={`${item.name || "?"}${item.primaryStat ? ` (${item.primaryStat})` : ""}`}
        onClick={onClick}
        style={{
          width: 44,
          height: 44,
          borderRadius: 2,
          background: item.icon ? "rgba(0,0,0,.5)" : bgColor,
          border: `1.5px solid ${borderColor}`,
          overflow: "hidden",
          position: "relative",
          ...clickStyle,
        }}
      >
        {item.icon && (
          <img
            src={item.icon}
            alt={(item.name || "Item") + " icon"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {item.primaryStat && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "rgba(0,0,0,.75)",
              textAlign: "center",
              fontSize: 9,
              fontWeight: 800,
              color: tier === "Exotic" ? "#ceae33" : "#fff",
              padding: "1px 0",
            }}
          >
            {item.primaryStat}
          </div>
        )}
        {item.watermark && (
          <img
            src={item.watermark}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.25,
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 2,
        border: `1px solid ${borderColor}`,
        background: `${bgColor}18`,
        ...clickStyle,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 2,
          overflow: "hidden",
          flexShrink: 0,
          background: item.icon ? "rgba(0,0,0,.5)" : bgColor,
          border: `1px solid ${borderColor}`,
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
        {item.watermark && (
          <img
            src={item.watermark}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.3,
              pointerEvents: "none",
            }}
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
            color: tier === "Exotic" ? "#ceae33" : "rgba(243,244,246,.9)",
          }}
        >
          {item.name || "Unknown Item"}
        </div>
        <div style={{ fontSize: 10, opacity: 0.4, display: "flex", alignItems: "center", gap: 6 }}>
          {item.slotName && <span>{item.slotName}</span>}
          {item.damageType && item.damageType !== "None" && (
            <>
              <span style={{ opacity: 0.3 }}>·</span>
              {item.damageIcon && (
                <img
                  src={item.damageIcon}
                  alt={item.damageType + " damage icon"}
                  style={{ width: 10, height: 10, opacity: 0.6 }}
                />
              )}
              <span>{item.damageType}</span>
            </>
          )}
        </div>
        <PerkRow perks={item.perks} max={5} />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 2,
          flexShrink: 0,
        }}
      >
        {item.primaryStat && (
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: tier === "Exotic" ? "#ceae33" : "rgba(253,230,138,.9)",
            }}
          >
            {item.primaryStat}
          </div>
        )}
        {item.armorStats && (
          <div style={{ fontSize: 9, opacity: 0.35, fontWeight: 600 }}>
            T{item.armorStats.total}
          </div>
        )}
      </div>
    </div>
  );
}
