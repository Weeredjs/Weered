"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

interface HexCell { h3: string; count: number; boundary: [number, number][] }
interface NearbyUser { id: string; usernameKey: string; name: string; avatar?: string; avatarColor?: string; tier: string; locationH3: string }

export default function MapContent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const hexLayer = useRef<any>(null);

  const [optIn, setOptIn] = useState<boolean | null>(null); // null = loading
  const [showConsent, setShowConsent] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hexes, setHexes] = useState<HexCell[]>([]);
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [clickToPlace, setClickToPlace] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Check opt-in status on mount + restore saved position
  useEffect(() => {
    const h = authHeaders();
    if (!h.Authorization) { setOptIn(false); return; }
    fetch(`${API}/me/location`, { headers: h })
      .then(r => r.json())
      .then(j => {
        setOptIn(j.optIn || false);
        if (j.optIn && j.latitude && j.longitude) {
          setUserPos([j.latitude, j.longitude]);
        }
      })
      .catch(() => setOptIn(false));
  }, []);

  // Load hex data
  const loadHexes = useCallback(() => {
    fetch(`${API}/map/hexes`)
      .then(r => r.json())
      .then(j => {
        setHexes(j.hexes || []);
        setTotalUsers((j.hexes || []).reduce((s: number, h: HexCell) => s + h.count, 0));
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadHexes(); }, [loadHexes]);

  // Load nearby users when position available
  useEffect(() => {
    if (!userPos) return;
    const h = authHeaders();
    if (!h.Authorization) return;
    fetch(`${API}/map/nearby?lat=${userPos[0]}&lng=${userPos[1]}`, { headers: h })
      .then(r => r.json())
      .then(j => setNearby(j.users || []))
      .catch(() => {});
  }, [userPos]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    let cancelled = false;

    import("leaflet").then(L => {
      if (cancelled || !mapRef.current) return;

      // Dark tile layer (no API key needed)
      const map = L.map(mapRef.current, {
        center: [30, 0],
        zoom: 3,
        minZoom: 2,
        maxZoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Zoom control top-right
      L.control.zoom({ position: "topright" }).addTo(map);

      // Attribution bottom-right
      L.control.attribution({ position: "bottomright", prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/" target="_blank">CARTO</a>')
        .addTo(map);

      hexLayer.current = L.layerGroup().addTo(map);
      leafletMap.current = map;
      setMapReady(true);
    });

    return () => { cancelled = true; };
  }, []);

  // Pan to saved position once map + position are both ready
  useEffect(() => {
    if (!mapReady || !userPos || !leafletMap.current) return;
    leafletMap.current.setView(userPos, Math.max(leafletMap.current.getZoom(), 8), { animate: true });
  }, [mapReady, userPos]);

  // Draw hex polygons when data or map changes
  useEffect(() => {
    if (!mapReady || !hexLayer.current) return;
    import("leaflet").then(L => {
      hexLayer.current.clearLayers();

      // Scale intensity logarithmically so 1 user isn't a solid block
      const maxCount = Math.max(1, ...hexes.map(h => h.count));

      for (const hex of hexes) {
        // Log scale: 1 user = subtle, 10+ users = vivid
        const raw = hex.count / Math.max(maxCount, 10);
        const intensity = Math.min(1, Math.log(1 + hex.count) / Math.log(1 + Math.max(maxCount, 10)));
        const color = intensityColor(intensity);
        const fillOpacity = 0.08 + intensity * 0.30; // 0.08 to 0.38 range
        const borderOpacity = 0.15 + intensity * 0.35;

        // h3 boundary is [[lat,lng],...] — Leaflet wants [lat,lng]
        const polygon = L.polygon(hex.boundary as [number, number][], {
          color: color,
          weight: 1,
          fillColor: color,
          fillOpacity,
          opacity: borderOpacity,
        });

        polygon.bindPopup(
          `<div style="font-family:monospace;font-size:13px;color:#e2e8f0;background:#0a0a12;padding:8px 12px;border-radius:8px;border:1px solid rgba(124,58,237,0.3)">` +
          `<strong style="color:#a78bfa">${hex.count}</strong> user${hex.count !== 1 ? "s" : ""} in this area</div>`,
          { className: "weered-popup", closeButton: false }
        );

        hexLayer.current.addLayer(polygon);
      }

      // Add user marker if opted in
      if (userPos) {
        const marker = L.circleMarker(userPos, {
          radius: 8,
          color: "#7C3AED",
          fillColor: "#a78bfa",
          fillOpacity: 0.9,
          weight: 2,
        });
        marker.bindPopup(
          `<div style="font-family:monospace;font-size:12px;color:#e2e8f0;background:#0a0a12;padding:6px 10px;border-radius:6px;border:1px solid rgba(124,58,237,0.3)">Your location</div>`,
          { className: "weered-popup", closeButton: false }
        );
        hexLayer.current.addLayer(marker);
      }
    });
  }, [hexes, mapReady, userPos]);

  // Enable location — always attempt GPS directly
  const enableLocation = () => {
    setLocating(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setLocating(false);
      setShowConsent(false);
      setClickToPlace(true);
      setGpsError("Your browser does not support geolocation.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserPos([lat, lng]);
        try {
          await fetch(`${API}/me/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          });
          setOptIn(true);
          loadHexes();
        } catch {}
        setLocating(false);
        setShowConsent(false);
        setGpsError(null);
        if (leafletMap.current) {
          leafletMap.current.setView([lat, lng], 10, { animate: true });
        }
      },
      (err) => {
        setLocating(false);
        setShowConsent(false);
        setClickToPlace(true);
        const reasons: Record<number, string> = {
          1: "Permission denied — check browser AND device location settings",
          2: "Position unavailable — turn on Location Services in your device settings",
          3: "GPS timed out — try again or place manually",
        };
        const msg = reasons[err.code] || `Unknown error (code ${err.code})`;
        setGpsError(msg);
        console.log(`[map] GPS failed: code=${err.code} msg=${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 15000 }
    );
  };

  // Save a manually picked location
  const saveManualLocation = async (lat: number, lng: number) => {
    setUserPos([lat, lng]);
    setClickToPlace(false);
    try {
      await fetch(`${API}/me/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });
      setOptIn(true);
      loadHexes();
    } catch {}
  };

  // Map click handler for manual placement
  useEffect(() => {
    if (!mapReady || !leafletMap.current) return;
    const map = leafletMap.current;
    const container = map.getContainer();
    if (clickToPlace) container.classList.add("click-to-place");
    else container.classList.remove("click-to-place");
    const handler = (e: any) => {
      if (!clickToPlace) return;
      saveManualLocation(e.latlng.lat, e.latlng.lng);
    };
    map.on("click", handler);
    return () => { map.off("click", handler); container.classList.remove("click-to-place"); };
  }, [mapReady, clickToPlace]);

  // Disable location
  const disableLocation = async () => {
    try {
      await fetch(`${API}/me/location`, { method: "DELETE", headers: authHeaders() });
    } catch {}
    setOptIn(false);
    setUserPos(null);
    setNearby([]);
    loadHexes();
  };

  return (
    <>
      <style>{`
        .weered-map-root {
          height: 100%; width: 100%; position: relative; background: #050810; overflow: hidden;
        }
        .weered-map-container { height: 100%; width: 100%; }
        .leaflet-container { background: #050810 !important; }
        .leaflet-container.click-to-place { cursor: crosshair !important; }
        .leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
        .leaflet-popup-content { margin: 0 !important; }
        .leaflet-popup-tip { display: none !important; }
        .leaflet-control-zoom a { background: rgba(10,10,18,0.85) !important; color: #a78bfa !important; border-color: rgba(124,58,237,0.3) !important; }
        .leaflet-control-zoom a:hover { background: rgba(124,58,237,0.2) !important; }
        .leaflet-control-attribution { background: rgba(10,10,18,0.6) !important; color: rgba(255,255,255,0.25) !important; font-size: 10px !important; }
        .leaflet-control-attribution a { color: rgba(167,139,250,0.4) !important; }
        .map-hud { position: absolute; top: 16px; left: 16px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; pointer-events: none; }
        .map-hud > * { pointer-events: auto; }
        .map-panel { background: rgba(10,10,18,0.88); border: 1px solid rgba(124,58,237,0.25); border-radius: 12px; padding: 14px 18px; backdrop-filter: blur(12px); font-family: 'DM Mono', monospace; }
        .map-title { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; background: linear-gradient(135deg, #fff, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 4px; }
        .map-stat { font-size: 12px; color: rgba(148,163,184,0.6); }
        .map-stat strong { color: #a78bfa; font-weight: 700; }
        .map-btn { border: none; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer; letter-spacing: 0.04em; transition: all 0.15s; font-family: inherit; }
        .map-btn-primary { background: linear-gradient(135deg, #7C3AED, #6D28D9); color: #fff; }
        .map-btn-primary:hover { background: linear-gradient(135deg, #8B5CF6, #7C3AED); transform: translateY(-1px); }
        .map-btn-ghost { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.08); }
        .map-btn-ghost:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
        .map-btn-danger { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
        .map-btn-danger:hover { background: rgba(239,68,68,0.25); }
        .nearby-list { display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; }
        .nearby-user { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,0.04); }
        .nearby-avatar { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex-shrink: 0; }
        .nearby-name { font-size: 12px; color: rgba(243,244,246,0.85); font-weight: 600; }
        .nearby-tier { font-size: 9px; color: rgba(124,58,237,0.6); text-transform: uppercase; letter-spacing: 0.08em; }
        .consent-overlay { position: absolute; inset: 0; z-index: 2000; background: rgba(5,8,16,0.92); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; }
        .consent-card { background: rgba(15,15,25,0.95); border: 1px solid rgba(124,58,237,0.3); border-radius: 16px; padding: 32px; max-width: 420px; width: 90%; text-align: center; }
        .consent-icon { font-size: 36px; margin-bottom: 16px; }
        .consent-title { font-size: 18px; font-weight: 800; color: #e2e8f0; margin-bottom: 8px; }
        .consent-text { font-size: 13px; color: rgba(148,163,184,0.7); line-height: 1.7; margin-bottom: 20px; }
        .consent-text em { color: #a78bfa; font-style: normal; font-weight: 600; }
        .consent-buttons { display: flex; gap: 10px; justify-content: center; }
        @media (max-width: 640px) {
          .map-hud { top: 10px; left: 10px; right: 10px; }
          .map-panel { padding: 10px 14px; }
          .map-title { font-size: 15px; }
        }
      `}</style>

      <link rel="stylesheet" href="/leaflet.css" />

      <div className="weered-map-root">
        <div ref={mapRef} className="weered-map-container" />

        {/* HUD overlay */}
        <div className="map-hud">
          {/* Title + stats */}
          <div className="map-panel">
            <div className="map-title">Live Map</div>
            <div className="map-stat">
              <strong>{totalUsers}</strong> user{totalUsers !== 1 ? "s" : ""} sharing location
              {hexes.length > 0 && <> across <strong>{hexes.length}</strong> zone{hexes.length !== 1 ? "s" : ""}</>}
            </div>
          </div>

          {/* Opt-in / opt-out controls */}
          {optIn !== null && (
            <div className="map-panel" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {optIn ? (
                <>
                  <div style={{ fontSize: 11, color: "rgba(167,139,250,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                    Location sharing ON
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="map-btn map-btn-ghost" onClick={enableLocation} disabled={locating}>
                      {locating ? "Updating..." : "Update"}
                    </button>
                    <button className="map-btn map-btn-danger" onClick={disableLocation}>
                      Disable
                    </button>
                  </div>
                </>
              ) : (
                <button className="map-btn map-btn-primary" onClick={() => setShowConsent(true)}>
                  Share My Location
                </button>
              )}
            </div>
          )}

          {/* Nearby users panel */}
          {nearby.length > 0 && (
            <div className="map-panel">
              <div style={{ fontSize: 11, color: "rgba(124,58,237,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Nearby ({nearby.length})
              </div>
              <div className="nearby-list">
                {nearby.map(u => (
                  <div key={u.id} className="nearby-user">
                    <div className="nearby-avatar" style={{ background: u.avatarColor || "#7C3AED22", color: u.avatarColor || "#a78bfa" }}>
                      {u.avatar
                        ? <img src={u.avatar} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} alt={`${u.name || u.usernameKey || "User"} avatar`} />
                        : (u.name || u.usernameKey || "?").charAt(0).toUpperCase()
                      }
                    </div>
                    <div>
                      <div className="nearby-name">{u.name || u.usernameKey}</div>
                      <div className="nearby-tier">{u.tier}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Click-to-place banner */}
        {clickToPlace && (
          <div style={{
            position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1500,
            background: "rgba(10,10,18,0.92)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 12,
            padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, backdropFilter: "blur(12px)",
            fontFamily: "'DM Mono', monospace", cursor: "crosshair",
          }}>
            <span style={{ fontSize: 20 }}>📍</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Click the map to set your location</div>
              <div style={{ fontSize: 11, color: gpsError ? "#f87171" : "rgba(148,163,184,0.5)" }}>
                {gpsError || "GPS unavailable — drop your pin manually instead"}
              </div>
            </div>
            <button className="map-btn map-btn-primary" style={{ marginLeft: 8, fontSize: 11 }} onClick={() => { setClickToPlace(false); setGpsError(null); enableLocation(); }}>Try GPS</button>
            <button className="map-btn map-btn-ghost" style={{ marginLeft: 4 }} onClick={() => { setClickToPlace(false); setGpsError(null); }}>Cancel</button>
          </div>
        )}

        {/* Consent modal */}
        {showConsent && (
          <div className="consent-overlay">
            <div className="consent-card">
              <div className="consent-icon">📍</div>
              <div className="consent-title">Share Your Location</div>
              <div className="consent-text">
                Weered uses your <em>approximate location</em> to show you on the Live Map
                and help you find nearby users.<br /><br />
                Your position is snapped to a <em>~5 km grid cell</em> — your exact coordinates
                are <em>never</em> shared with other users.<br /><br />
                You can disable this at any time from this page or your profile settings.
              </div>
              <div className="consent-buttons">
                <button className="map-btn map-btn-ghost" onClick={() => setShowConsent(false)}>Cancel</button>
                <button className="map-btn map-btn-primary" onClick={enableLocation} disabled={locating}>
                  {locating ? "Locating..." : "Enable Location"}
                </button>
              </div>
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                <button
                  className="map-btn map-btn-ghost"
                  style={{ fontSize: 11, width: "100%" }}
                  onClick={() => { setShowConsent(false); setClickToPlace(true); }}
                >
                  Or click the map to set your location manually
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Map intensity 0-1 to a purple gradient color */
function intensityColor(t: number): string {
  // From dim purple to bright violet
  const r = Math.round(88 + t * 51);   // 88 → 139
  const g = Math.round(28 + t * 30);   // 28 → 58
  const b = Math.round(135 + t * 102); // 135 → 237
  return `rgb(${r},${g},${b})`;
}
