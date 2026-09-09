"use client";
// Field Manual — the reference a unit keeps open at the planning table.
//
// Maps with their year and a paragraph of what the fight is; the four modes;
// the seventeen roles grouped the way the game groups them; and the vehicle
// park, side by side. All static, all readable with nothing linked.
import React, { useState } from "react";
import { S, ALLIED as US, AXIS as NVA } from "./shared";
import {
  HLLV_MAPS,
  HLLV_MODES,
  HLLV_ROLES,
  HLLV_VEHICLES,
  type HllvRole,
} from "../../lib/hllv/data";

const GROUPS: HllvRole["type"][] = [
  "Command",
  "Infantry",
  "Recon",
  "Armor",
  "Mortar",
  "Helicopter",
];

export default function FieldManual({ accent }: { accent: string }) {
  const [part, setPart] = useState<"maps" | "roles" | "vehicles">("maps");
  const btn = (id: typeof part, label: string) => (
    <button key={id} style={part === id ? S.btn : S.btnQuiet} onClick={() => setPart(id)}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ ...S.row, marginTop: 12, flexWrap: "wrap" }}>
        {btn("maps", "Maps & modes")}
        {btn("roles", "Roles")}
        {btn("vehicles", "Vehicles")}
      </div>

      {part === "maps" && (
        <>
          <div style={S.kick}>Six maps at launch</div>
          {HLLV_MAPS.map((m) => (
            <div key={m.code} style={S.card}>
              <div style={{ ...S.row, justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: "rgba(236,242,250,.95)" }}>
                  {m.name}
                </div>
                <div style={{ ...S.badge, color: accent, border: `1px solid ${accent}55` }}>
                  {m.tag} · {m.year}
                </div>
              </div>
              <div style={{ ...S.muted, marginTop: 6 }}>{m.brief}</div>
              <div style={{ ...S.muted, marginTop: 6, fontSize: 11.5, opacity: 0.75 }}>
                US line comes in from the {m.usFrom}. Layer code <code>{m.code}</code>.
              </div>
            </div>
          ))}
          <div style={S.kick}>Modes</div>
          <div style={S.card}>
            {HLLV_MODES.map((md) => (
              <div key={md.id} style={{ ...S.muted, marginBottom: 6 }}>
                <b style={{ color: "rgba(236,242,250,.9)" }}>{md.name}</b> — {md.brief}
              </div>
            ))}
          </div>
        </>
      )}

      {part === "roles" && (
        <>
          <div style={{ ...S.muted, marginTop: 10 }}>
            50 a side. US and NVA share the role list except the air: the NVA have no helicopters
            and fight the Huey with the DShKM. Bold names lead their element.
          </div>
          {GROUPS.map((g) => {
            const rows = HLLV_ROLES.filter((r) => r.type === g);
            if (!rows.length) return null;
            return (
              <div key={g}>
                <div style={S.kick}>{g}</div>
                <div style={S.card}>
                  {rows.map((r) => (
                    <div key={r.id} style={{ ...S.muted, marginBottom: 7 }}>
                      <span
                        style={{
                          color: "rgba(236,242,250,.92)",
                          fontWeight: r.lead ? 800 : 600,
                        }}
                      >
                        {r.name}
                      </span>
                      {r.usOnly && (
                        <span
                          style={{
                            ...S.badge,
                            marginLeft: 6,
                            color: US,
                            border: `1px solid ${US}55`,
                          }}
                        >
                          US ONLY
                        </span>
                      )}{" "}
                      — {r.brief}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {part === "vehicles" && (
        <>
          {(["US", "NVA"] as const).map((side) => (
            <div key={side}>
              <div style={{ ...S.kick, color: side === "US" ? US : NVA }}>{side}</div>
              <div style={S.card}>
                {HLLV_VEHICLES.filter((v) => v.side === side || v.side === "Both").map((v, i) => (
                  <div key={side + i} style={{ ...S.muted, marginBottom: 7 }}>
                    <b style={{ color: "rgba(236,242,250,.9)" }}>{v.name}</b>{" "}
                    <span style={{ opacity: 0.7 }}>· {v.type}</span> — {v.brief}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
