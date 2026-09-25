"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  VA,
  HEAD_FONT,
  greatCircle,
  positionAt,
  hhmm,
  cetTime,
  Country,
  type Airport,
  type Hub,
  type LiveFlight,
} from "./vaShared";

/**
 * The airline's traffic picture. vOCN's own live map sends X-Frame-Options:
 * SAMEORIGIN, so it cannot be framed into the hub; this one is drawn here.
 *
 * Planes move every second between polls using the same great-circle maths
 * as the server (positionAt), from wheels-up to touchdown, so the picture is
 * smooth without asking the API for positions more than twice a minute.
 */

type Props = {
  hub: Hub;
  height?: number | string;
  compact?: boolean; // the small map on the front page: no side list
};

function unwrap(points: { lat: number; lon: number }[]): [number, number][] {
  // Keep a route continuous across the antimeridian instead of a line wrapping the world.
  const out: [number, number][] = [];
  let prev: number | null = null;
  let shift = 0;
  for (const p of points) {
    let lon = p.lon + shift;
    if (prev !== null && Math.abs(lon - prev) > 180) {
      shift += lon > prev ? -360 : 360;
      lon = p.lon + shift;
    }
    out.push([p.lat, lon]);
    prev = lon;
  }
  return out;
}

function arc(a: Airport, b: Airport, from = 0, to = 1, n = 64) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(greatCircle(a, b, from + ((to - from) * i) / n));
  return unwrap(pts);
}

const PLANE_SVG = (color: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" style="display:block;filter:drop-shadow(0 0 4px rgba(0,0,0,.8))"><path fill="${color}" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`;

export default function VaLiveMap({ hub, height = 520, compact = false }: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const layers = useRef<{
    routes: any;
    planes: Map<string, { marker: any; flown: any }>;
    airports: any;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const airports = useMemo(() => new Map(hub.airports.map((a) => [a.iata, a])), [hub.airports]);
  const flights = hub.live;
  const sel = flights.find((f) => f.id === selected) || null;

  // Map once.
  useEffect(() => {
    let dead = false;
    import("leaflet").then((L) => {
      if (dead || !el.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(el.current, {
        center: [38, -12],
        zoom: compact ? 2 : 3,
        minZoom: 2,
        maxZoom: 8,
        zoomControl: false,
        attributionControl: false,
        worldCopyJump: true,
        scrollWheelZoom: !compact,
      });
      // No tile service. CARTO's basemaps started answering keyless requests
      // with an "API KEY REQUIRED" image (found 2026-09-25), so the world is
      // drawn from Natural Earth outlines served by Weered itself: public
      // domain, no key, no rate limit, and styled in the airline's navy.
      map.createPane("va-land").style.zIndex = "200";
      const grat: [number, number][][] = [];
      for (let lon = -180; lon <= 180; lon += 15)
        grat.push([
          [-85, lon],
          [85, lon],
        ]);
      for (let lat = -75; lat <= 75; lat += 15)
        grat.push([
          [lat, -180],
          [lat, 180],
        ]);
      L.polyline(grat, {
        color: "#12305a",
        weight: 0.6,
        opacity: 0.55,
        interactive: false,
        pane: "va-land",
      }).addTo(map);
      Promise.all([
        fetch("/brand/vocn/world-land.json").then((r) => r.json()),
        fetch("/brand/vocn/world-borders.json").then((r) => r.json()),
      ])
        .then(([land, borders]) => {
          if (dead) return;
          L.geoJSON(land, {
            pane: "va-land",
            interactive: false,
            style: { color: "#24497a", weight: 0.8, fillColor: "#0a2247", fillOpacity: 1 },
          }).addTo(map);
          L.geoJSON(borders, {
            pane: "va-land",
            interactive: false,
            style: { color: "#1d3d68", weight: 0.6, dashArray: "2 3" },
          }).addTo(map);
        })
        .catch(() => undefined);
      L.control
        .attribution({ position: "bottomright", prefix: false })
        .addAttribution(
          '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>',
        )
        .addTo(map);
      // Bottom-left: top-left is where the traffic count sits.
      if (!compact) L.control.zoom({ position: "bottomleft" }).addTo(map);
      const airportsLayer = L.layerGroup().addTo(map);
      for (const a of hub.airports) {
        const isHub = a.region === "HUB";
        L.marker([a.lat, a.lon], {
          interactive: false,
          icon: L.divIcon({
            className: "va-apt",
            iconSize: [0, 0],
            // FRA and MUC are 300 km apart: at network zoom their codes collide, so
            // Munich's sits below its dot.
            html: `<div class="va-apt-dot${isHub ? " hub" : ""}"></div><div class="va-apt-code${isHub ? " hub" : ""}${a.iata === "MUC" ? " below" : ""}">${a.iata}</div>`,
          }),
        }).addTo(airportsLayer);
      }
      layers.current = {
        routes: L.layerGroup().addTo(map),
        planes: new Map(),
        airports: airportsLayer,
      };
      mapRef.current = map;
      // Europe to North America and down to the Cape: the whole network.
      map.fitBounds(
        [
          [-34, -120],
          [62, 58],
        ],
        { padding: compact ? [4, 4] : [20, 20] },
      );
      setReady(true);
    });
    return () => {
      dead = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Routes and planes whenever the flight list changes.
  useEffect(() => {
    const L = LRef.current;
    const lay = layers.current;
    if (!ready || !L || !lay) return;
    lay.routes.clearLayers();
    for (const [, p] of lay.planes) p.marker.remove();
    lay.planes.clear();
    const now = Date.now();
    for (const f of flights) {
      const dep = airports.get(f.dep);
      const arr = airports.get(f.arr);
      if (!dep || !arr) continue;
      const pos = positionAt(f, dep, arr, now);
      const isSel = f.id === selected;
      L.polyline(arc(dep, arr), {
        color: isSel ? VA.sun : "#7fa7cf",
        weight: isSel ? 1.6 : 1,
        opacity: isSel ? 0.7 : 0.28,
        dashArray: "3 5",
        interactive: false,
      }).addTo(lay.routes);
      const flown = L.polyline(arc(dep, arr, 0, Math.max(0.001, pos.air)), {
        color: VA.sun,
        weight: isSel ? 2.6 : 1.6,
        opacity: isSel ? 0.95 : 0.6,
        interactive: false,
      }).addTo(lay.routes);
      const marker = L.marker([pos.lat, pos.lon], {
        icon: L.divIcon({
          className: "va-plane",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          html: `<div class="va-plane-rot" style="transform:rotate(${pos.heading}deg)">${PLANE_SVG(isSel ? VA.sun : "#ffffff")}</div>${
            compact ? "" : `<div class="va-plane-tag${isSel ? " sel" : ""}">${f.callsign}</div>`
          }`,
        }),
        zIndexOffset: isSel ? 1000 : 0,
      })
        .on("click", () => setSelected((s) => (s === f.id ? null : f.id)))
        .addTo(mapRef.current);
      lay.planes.set(f.id, { marker, flown });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, flights, selected]);

  // Move every second.
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      const lay = layers.current;
      if (!lay) return;
      const now = Date.now();
      for (const f of flights) {
        const p = lay.planes.get(f.id);
        const dep = airports.get(f.dep);
        const arr = airports.get(f.arr);
        if (!p || !dep || !arr) continue;
        const pos = positionAt(f, dep, arr, now);
        p.marker.setLatLng([pos.lat, pos.lon]);
        const rot = p.marker.getElement()?.querySelector(".va-plane-rot") as HTMLElement | null;
        if (rot) rot.style.transform = `rotate(${pos.heading}deg)`;
        p.flown.setLatLngs(arc(dep, arr, 0, Math.max(0.001, pos.air), 40));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [ready, flights, airports]);

  return (
    <div style={{ display: "flex", gap: 14, minHeight: 0, height }}>
      <style>{MAP_CSS}</style>
      <div
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          borderRadius: 14,
          overflow: "hidden",
          border: `1px solid ${VA.line}`,
        }}
      >
        <link rel="stylesheet" href="/leaflet.css" />
        <div ref={el} style={{ position: "absolute", inset: 0, background: VA.night }} />
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            zIndex: 500,
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(0,12,29,.78)",
            border: `1px solid ${VA.line}`,
            fontFamily: HEAD_FONT,
            letterSpacing: ".12em",
            fontSize: 13,
            color: VA.ice,
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          <span style={{ color: VA.sun, marginRight: 8 }}>●</span>
          {flights.length} airborne or taxiing
        </div>
        {sel && (
          <FlightCard
            flight={sel}
            dep={airports.get(sel.dep)}
            arr={airports.get(sel.arr)}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
      {!compact && (
        <aside
          style={{
            width: 280,
            flexShrink: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {flights.length === 0 && (
            <div style={{ color: VA.muted, fontSize: 13, padding: 12 }}>
              Nobody is flying right now. Evenings CET are busiest.
            </div>
          )}
          {flights.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelected((s) => (s === f.id ? null : f.id))}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 10,
                cursor: "pointer",
                background: f.id === selected ? `${VA.sun}18` : VA.card,
                border: `1px solid ${f.id === selected ? `${VA.sun}66` : VA.line}`,
                color: VA.text,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: HEAD_FONT,
                  fontSize: 17,
                  letterSpacing: ".05em",
                }}
              >
                <span>{f.callsign}</span>
                <span style={{ color: VA.sun }}>
                  {f.dep} → {f.arr}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: VA.muted,
                  marginTop: 3,
                }}
              >
                <span>{f.pilotName || f.fleet}</span>
                <span>{f.phase}</span>
              </div>
              <Progress value={f.progress} />
            </button>
          ))}
        </aside>
      )}
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div
      style={{
        height: 3,
        borderRadius: 2,
        background: "rgba(255,255,255,.08)",
        marginTop: 8,
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${Math.round(value * 100)}%`, height: "100%", background: VA.sun }} />
    </div>
  );
}

function FlightCard({
  flight: f,
  dep,
  arr,
  onClose,
}: {
  flight: LiveFlight;
  dep?: Airport;
  arr?: Airport;
  onClose: () => void;
}) {
  const remaining = Math.max(0, (Date.parse(f.arrivesAt) - Date.now()) / 60000);
  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        bottom: 12,
        zIndex: 600,
        width: 300,
        maxWidth: "calc(100% - 24px)",
        padding: 14,
        borderRadius: 12,
        background: "rgba(0,16,40,.94)",
        border: `1px solid ${VA.sun}55`,
        boxShadow: "0 12px 40px rgba(0,0,0,.5)",
        color: VA.text,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: HEAD_FONT, fontSize: 24, letterSpacing: ".04em" }}>
          {f.callsign}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "none",
            border: 0,
            color: VA.muted,
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 12, color: VA.muted }}>
        {f.flightNumber} · {f.fleet} · {f.reg} · {f.network}
      </div>
      {f.pilotName && <div style={{ marginTop: 6, fontSize: 13 }}>{f.pilotName}</div>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
        }}
      >
        <div>
          <div style={{ fontFamily: HEAD_FONT, fontSize: 26, color: VA.sun }}>{f.dep}</div>
          <div style={{ fontSize: 11, color: VA.muted }}>
            <Country cc={dep?.country || ""} />
            {dep?.city} · {cetTime(f.departedAt)}
          </div>
        </div>
        <div style={{ color: VA.faint }}>✈</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: HEAD_FONT, fontSize: 26, color: VA.sun }}>{f.arr}</div>
          <div style={{ fontSize: 11, color: VA.muted }}>
            {arr?.city} <Country cc={arr?.country || ""} />· {cetTime(f.arrivesAt)}
          </div>
        </div>
      </div>
      <Progress value={f.progress} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 8,
          marginTop: 12,
          fontSize: 12,
        }}
      >
        <Mini label="Phase" value={f.phase} />
        <Mini
          label="Altitude"
          value={
            f.altitudeFt ? `FL${String(Math.round(f.altitudeFt / 100)).padStart(3, "0")}` : "GND"
          }
        />
        <Mini label="Ground spd" value={`${f.groundSpeedKt} kt`} />
      </div>
      <div style={{ fontSize: 12, color: VA.muted, marginTop: 10 }}>
        {hhmm(remaining)} to block-in
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: VA.faint }}
      >
        {label}
      </div>
      <div style={{ fontFamily: HEAD_FONT, fontSize: 17 }}>{value}</div>
    </div>
  );
}

const MAP_CSS = `
.va-apt { position: relative; }
.va-apt-dot { position:absolute; left:-3px; top:-3px; width:6px; height:6px; border-radius:50%; background:#7fa7cf; box-shadow:0 0 6px rgba(127,167,207,.8); }
.va-apt-dot.hub { left:-6px; top:-6px; width:12px; height:12px; background:${VA.sun}; box-shadow:0 0 0 4px rgba(255,205,0,.18), 0 0 18px rgba(255,205,0,.8); animation: vaHub 2.4s ease-in-out infinite; }
.va-apt-code { position:absolute; left:8px; top:-7px; font: 700 10px/1 ${HEAD_FONT}; letter-spacing:.08em; color:#9db8d3; text-shadow:0 1px 2px #000; white-space:nowrap; }
.va-apt-code.hub { left:12px; top:-8px; font-size:13px; color:${VA.sun}; }
.va-apt-code.hub.below { left:6px; top:8px; }
.va-plane { position: relative; }
.va-plane-rot { width:22px; height:22px; transition: transform .9s linear; }
.va-plane-tag { position:absolute; left:20px; top:-2px; font: 700 11px/1 ${HEAD_FONT}; letter-spacing:.06em; color:#dfe9f4; background:rgba(0,12,29,.72); padding:2px 5px; border-radius:4px; white-space:nowrap; pointer-events:none; }
.va-plane-tag.sel { color:${VA.navy}; background:${VA.sun}; }
@keyframes vaHub { 0%,100% { box-shadow:0 0 0 3px rgba(255,205,0,.14), 0 0 14px rgba(255,205,0,.7); } 50% { box-shadow:0 0 0 8px rgba(255,205,0,.06), 0 0 26px rgba(255,205,0,.95); } }
.leaflet-container { background: ${VA.night} !important; font-family: inherit; }
.leaflet-control-zoom a { background: rgba(0,16,40,.9) !important; color: ${VA.sun} !important; border-color: ${VA.line} !important; }
.leaflet-control-attribution { background: rgba(0,12,29,.6) !important; color: #6d86a0 !important; }
.leaflet-control-attribution a { color: #8ea5be !important; }
`;
