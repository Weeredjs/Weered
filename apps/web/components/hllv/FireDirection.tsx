"use client";
// Fire Direction — the Vietnam mortar table as a tool.
//
// Vietnam mortars are laid in DEGREES of elevation, not the mils WWII
// artillery uses, and the envelope is short: 100 m at 85° down to 450 m flat.
// The observer measures the range on the map, the gunner needs an angle, and
// nobody wants to do the interpolation in their head while the sector timer
// runs. Both directions are here (range → angle for the call, angle → range
// for reading a dial back) and the whole card fits on a phone next to the
// game.
import React, { useMemo, useState } from "react";
import { S } from "./shared";
import {
  MORTAR_TABLE,
  MORTAR_MIN,
  MORTAR_MAX,
  mortarAngle,
  mortarRange,
} from "../../lib/hllv/data";

export default function FireDirection({ accent }: { accent: string }) {
  const [range, setRange] = useState(250);
  const [dial, setDial] = useState("");

  const angle = useMemo(() => mortarAngle(range), [range]);
  // Slope at this range, for walking fire: "+25 m is about −6°" is what a
  // gunner actually says; the table's slope changes, so read it locally.
  const per25 = useMemo(() => {
    const a = mortarAngle(Math.min(MORTAR_MAX, range + 25));
    const b = mortarAngle(Math.max(MORTAR_MIN, range - 25));
    const span = Math.min(MORTAR_MAX, range + 25) - Math.max(MORTAR_MIN, range - 25);
    return span > 0 ? Math.abs(((a - b) / span) * 25).toFixed(1) : "—";
  }, [range]);
  const dialNum = Number(dial);
  const dialRange = dial.trim() && Number.isFinite(dialNum) ? mortarRange(dialNum) : null;

  const outside = range < MORTAR_MIN || range > MORTAR_MAX;

  return (
    <div>
      <div style={{ ...S.card, marginTop: 12 }}>
        <div style={S.kick}>Range to target (metres)</div>
        <div style={S.row}>
          <input
            type="range"
            min={MORTAR_MIN}
            max={MORTAR_MAX}
            step={5}
            value={Math.min(MORTAR_MAX, Math.max(MORTAR_MIN, range))}
            onChange={(e) => setRange(Number(e.target.value))}
            style={{ flex: 1, accentColor: accent }}
          />
          <input
            type="number"
            min={0}
            max={999}
            value={range}
            onChange={(e) => setRange(Number(e.target.value) || 0)}
            style={{ ...S.input, width: 90, textAlign: "right" }}
          />
        </div>
        <div style={{ textAlign: "center", padding: "18px 0 8px" }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              color: outside ? "#e8a08c" : "var(--weered-accent-2, #E3D3AC)",
              lineHeight: 1,
            }}
          >
            {outside ? (range < MORTAR_MIN ? "TOO CLOSE" : "OUT OF RANGE") : `${angle}°`}
          </div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            {outside
              ? `The tube reaches ${MORTAR_MIN}–${MORTAR_MAX} m. Move the tube, not the dial.`
              : "elevation · same table for US and NVA"}
          </div>
        </div>
        {!outside && (
          <div style={{ ...S.muted, textAlign: "center" }}>
            Walking fire: ±25 m ≈ {per25}° here. Lower the barrel to reach farther.
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={S.kick}>Read a dial back</div>
        <div style={S.row}>
          <input
            type="number"
            min={0}
            max={85}
            placeholder="angle °"
            value={dial}
            onChange={(e) => setDial(e.target.value)}
            style={{ ...S.input, width: 110 }}
          />
          <div style={{ ...S.muted, flex: 1 }}>
            {dialRange != null ? (
              <>
                A tube at{" "}
                <b style={{ color: "rgba(236,242,250,.9)" }}>
                  {Math.min(85, Math.max(0, dialNum))}°
                </b>{" "}
                is landing at about <b style={{ color: "rgba(236,242,250,.9)" }}>{dialRange} m</b>.
              </>
            ) : (
              "Type the elevation the gunner has set and get the range it is hitting."
            )}
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.kick}>Range card</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
            gap: 6,
          }}
        >
          {MORTAR_TABLE.map(([r, a]) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                ...S.muted,
                fontVariantNumeric: "tabular-nums",
                background:
                  r === range ? "var(--weered-accent-bg, rgba(255,255,255,.06))" : "transparent",
                border: `1px solid ${r === range ? "var(--weered-border2, rgba(255,255,255,.2))" : "rgba(255,255,255,.06)"}`,
                borderRadius: 6,
                padding: "5px 8px",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {r} m → <b style={{ color: "rgba(236,242,250,.9)" }}>{a}°</b>
            </button>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.kick}>The call</div>
        <div style={S.muted}>
          Observer measures grid range to the target on the map. Gunner lays the tube on the
          bearing, sets the elevation from this card, and the support carries the rounds. First
          round is the ranging round: watch the splash, correct by 25 m steps, then fire for effect.
          Above 300 m the table flattens — small dial changes move the round a long way, so correct
          in single degrees out there.
        </div>
      </div>
    </div>
  );
}
