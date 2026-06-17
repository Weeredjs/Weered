"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useOverlay } from "../../components/overlays/OverlayProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

interface HexCell {
  h3: string;
  count: number;
  boundary: [number, number][];
}
interface NearbyUser {
  id: string;
  usernameKey: string;
  name: string;
  avatar?: string;
  avatarColor?: string;
  tier: string;
  locationH3: string;
  lobbyId?: string;
  lobbyName?: string;
}
interface LobbyPin {
  id: string;
  name: string;
  logoUrl?: string;
  accentColor?: string;
  moduleType: string;
  memberCount: number;
  lat: number;
  lng: number;
}

export default function MapContent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const hexLayer = useRef<any>(null);
  const lobbyLayer = useRef<any>(null);
  const { replaceTop } = useOverlay();

  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hexes, setHexes] = useState<HexCell[]>([]);
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [clickToPlace, setClickToPlace] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [lobbyPins, setLobbyPins] = useState<LobbyPin[]>([]);
  const [showLobbyPins, setShowLobbyPins] = useState(true);

  const [gameFilter, setGameFilter] = useState<string>("all");
  const [availableGames, setAvailableGames] = useState<
    { id: string; name: string; count: number }[]
  >([]);

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const h = authHeaders();
    if (!h.Authorization) {
      setOptIn(false);
      return;
    }
    fetch(`${API}/me/location`, { headers: h })
      .then((r) => r.json())
      .then((j) => {
        setOptIn(j.optIn || false);
        if (j.optIn && j.latitude && j.longitude) {
          setUserPos([j.latitude, j.longitude]);
        }
      })
      .catch(() => setOptIn(false));
  }, []);

  const loadHexes = useCallback(() => {
    const params = gameFilter !== "all" ? `?game=${encodeURIComponent(gameFilter)}` : "";
    fetch(`${API}/map/hexes${params}`)
      .then((r) => r.json())
      .then((j) => {
        setHexes(j.hexes || []);
        setTotalUsers((j.hexes || []).reduce((s: number, h: HexCell) => s + h.count, 0));
        if (j.games) setAvailableGames(j.games);
      })
      .catch(() => {});
    setLastRefresh(new Date());
  }, [gameFilter]);

  useEffect(() => {
    loadHexes();
  }, [loadHexes]);

  useEffect(() => {
    const iv = setInterval(loadHexes, 30000);
    return () => clearInterval(iv);
  }, [loadHexes]);

  useEffect(() => {
    if (!userPos) return;
    const h = authHeaders();
    if (!h.Authorization) return;
    fetch(`${API}/map/nearby?lat=${userPos[0]}&lng=${userPos[1]}`, { headers: h })
      .then((r) => r.json())
      .then((j) => setNearby(j.users || []))
      .catch(() => {});
  }, [userPos]);

  useEffect(() => {
    fetch(`${API}/map/lobbies`)
      .then((r) => r.json())
      .then((j) => setLobbyPins(j.lobbies || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

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

      L.control.zoom({ position: "topright" }).addTo(map);
      L.control
        .attribution({ position: "bottomright", prefix: false })
        .addAttribution(
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/" target="_blank">CARTO</a>',
        )
        .addTo(map);

      hexLayer.current = L.layerGroup().addTo(map);
      lobbyLayer.current = L.layerGroup().addTo(map);
      leafletMap.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !userPos || !leafletMap.current) return;
    leafletMap.current.setView(userPos, Math.max(leafletMap.current.getZoom(), 8), {
      animate: true,
    });
  }, [mapReady, userPos]);

  useEffect(() => {
    if (!mapReady || !hexLayer.current) return;
    import("leaflet").then((L) => {
      hexLayer.current.clearLayers();
      const maxCount = Math.max(1, ...hexes.map((h) => h.count));

      for (const hex of hexes) {
        const intensity = Math.min(
          1,
          Math.log(1 + hex.count) / Math.log(1 + Math.max(maxCount, 10)),
        );
        const color = intensityColor(intensity);
        const fillOpacity = 0.08 + intensity * 0.3;
        const borderOpacity = 0.15 + intensity * 0.35;

        const polygon = L.polygon(hex.boundary, {
          color,
          weight: 1,
          fillColor: color,
          fillOpacity,
          opacity: borderOpacity,
        });

        polygon.bindPopup(
          `<div style="font-family:monospace;font-size:13px;color:#e2e8f0;background:#0a0a12;padding:8px 12px;border-radius:8px;border:1px solid rgba(212,146,10,0.3)">` +
            `<strong style="color:#d4920a">${hex.count}</strong> user${hex.count !== 1 ? "s" : ""} in this area</div>`,
          { className: "weered-popup", closeButton: false },
        );

        hexLayer.current.addLayer(polygon);
      }

      if (userPos) {
        const marker = L.circleMarker(userPos, {
          radius: 8,
          color: "#d4920a",
          fillColor: "#f5a623",
          fillOpacity: 0.9,
          weight: 2,
        });
        marker.bindPopup(
          `<div style="font-family:monospace;font-size:12px;color:#e2e8f0;background:#0a0a12;padding:6px 10px;border-radius:6px;border:1px solid rgba(212,146,10,0.3)">Your location</div>`,
          { className: "weered-popup", closeButton: false },
        );
        hexLayer.current.addLayer(marker);
      }
    });
  }, [hexes, mapReady, userPos]);

  useEffect(() => {
    if (!mapReady || !lobbyLayer.current) return;
    import("leaflet").then((L) => {
      lobbyLayer.current.clearLayers();
      if (!showLobbyPins) return;

      for (const lobby of lobbyPins) {
        if (gameFilter !== "all" && lobby.moduleType.toLowerCase() !== gameFilter.toLowerCase())
          continue;
        const accent = lobby.accentColor || "#d4920a";

        const icon = L.divIcon({
          className: "lobby-pin-icon",
          html: `<div style="
            width:32px;height:32px;border-radius:10px;
            background:${lobby.logoUrl ? `url(${lobby.logoUrl}) center/cover` : accent + "33"};
            border:2px solid ${accent}88;
            box-shadow:0 0 12px ${accent}44;
            display:flex;align-items:center;justify-content:center;
            font-size:14px;font-weight:900;color:${accent};
          ">${lobby.logoUrl ? "" : lobby.name.charAt(0).toUpperCase()}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lobby.lat, lobby.lng], { icon });
        marker.bindPopup(
          `<div style="font-family:monospace;font-size:12px;color:#e2e8f0;background:#0a0a12;padding:10px 14px;border-radius:8px;border:1px solid ${accent}44;min-width:140px">` +
            `<div style="font-weight:800;font-size:13px;margin-bottom:4px;color:${accent}">${lobby.name}</div>` +
            `<div style="color:rgba(148,163,184,0.6);font-size:10px">${lobby.moduleType} · ${lobby.memberCount} member${lobby.memberCount !== 1 ? "s" : ""}</div>` +
            `</div>`,
          { className: "weered-popup", closeButton: false },
        );

        lobbyLayer.current.addLayer(marker);
      }
    });
  }, [lobbyPins, mapReady, showLobbyPins, gameFilter]);

  const flyToMe = () => {
    if (userPos && leafletMap.current) {
      leafletMap.current.flyTo(userPos, 10, { duration: 1.2 });
    }
  };

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
        setGpsError(reasons[err.code] || `Unknown error (code ${err.code})`);
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 15000 },
    );
  };

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
    return () => {
      map.off("click", handler);
      container.classList.remove("click-to-place");
    };
  }, [mapReady, clickToPlace]);

  const disableLocation = async () => {
    try {
      await fetch(`${API}/me/location`, { method: "DELETE", headers: authHeaders() });
    } catch {}
    setOptIn(false);
    setUserPos(null);
    setNearby([]);
    loadHexes();
  };

  const timeSince = (d: Date) => {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  };

  return (
    <>
      <style>{`
        .weered-map-root { height: 100%; width: 100%; position: relative; background: #050810; overflow: hidden; }
        .weered-map-container { height: 100%; width: 100%; }
        .leaflet-container { background: #050810 !important; }
        .leaflet-container.click-to-place { cursor: crosshair !important; }
        .leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
        .leaflet-popup-content { margin: 0 !important; }
        .leaflet-popup-tip { display: none !important; }
        .leaflet-control-zoom a { background: rgba(10,8,6,0.90) !important; color: #d4920a !important; border-color: rgba(212,146,10,0.25) !important; }
        .leaflet-control-zoom a:hover { background: rgba(212,146,10,0.15) !important; }
        .leaflet-control-attribution { background: rgba(10,8,6,0.6) !important; color: rgba(255,255,255,0.25) !important; font-size: 10px !important; }
        .leaflet-control-attribution a { color: rgba(212,146,10,0.4) !important; }
        .lobby-pin-icon { background: none !important; border: none !important; }
        .map-hud { position: absolute; top: 16px; left: 16px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; pointer-events: none; max-width: 280px; }
        .map-hud > * { pointer-events: auto; }
        .map-panel {
          background: linear-gradient(rgba(10,8,6,0.92), rgba(10,8,6,0.92)), url('/themes/ishimura/rail-panel.png') center/cover no-repeat;
          border: 1px solid rgba(212,146,10,0.22);
          border-radius: 12px; padding: 14px 18px; backdrop-filter: blur(12px); font-family: 'DM Mono', monospace;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        }
        .map-title { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; background: linear-gradient(135deg, #f5deb3, #d4920a); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 4px; }
        .map-stat { font-size: 12px; color: rgba(180,165,140,0.6); }
        .map-stat strong { color: #d4920a; font-weight: 700; }
        .map-btn { border: none; border-radius: 8px; padding: 8px 16px; font-size: 12px; font-weight: 700; cursor: pointer; letter-spacing: 0.04em; transition: all 0.15s; font-family: inherit; }
        .map-btn-primary { background: linear-gradient(135deg, #d4920a, #b87a08); color: #fff; }
        .map-btn-primary:hover { background: linear-gradient(135deg, #e5a31b, #d4920a); transform: translateY(-1px); }
        .map-btn-ghost { background: rgba(212,146,10,0.08); color: rgba(212,146,10,0.6); border: 1px solid rgba(212,146,10,0.15); }
        .map-btn-ghost:hover { background: rgba(212,146,10,0.15); color: rgba(212,146,10,0.85); }
        .map-btn-danger { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.18); }
        .map-btn-danger:hover { background: rgba(239,68,68,0.22); }
        .map-btn-icon { width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
        .nearby-list { display: flex; flex-direction: column; gap: 4px; max-height: 240px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(212,146,10,0.15) transparent; }
        .nearby-user { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: rgba(212,146,10,0.04); cursor: pointer; transition: background 0.12s; border: 1px solid transparent; }
        .nearby-user:hover { background: rgba(212,146,10,0.10); border-color: rgba(212,146,10,0.18); }
        .nearby-avatar { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex-shrink: 0; }
        .nearby-name { font-size: 12px; color: rgba(243,234,220,0.85); font-weight: 600; }
        .nearby-meta { font-size: 9px; color: rgba(212,146,10,0.5); text-transform: uppercase; letter-spacing: 0.08em; }
        .map-filter { display: flex; gap: 4px; flex-wrap: wrap; }
        .map-filter-btn { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer; border: 1px solid rgba(212,146,10,0.15); background: rgba(212,146,10,0.06); color: rgba(212,146,10,0.5); transition: all 0.12s; font-family: inherit; text-transform: uppercase; letter-spacing: 0.04em; }
        .map-filter-btn:hover { background: rgba(212,146,10,0.12); color: rgba(212,146,10,0.75); }
        .map-filter-btn-active { background: rgba(212,146,10,0.18) !important; border-color: rgba(212,146,10,0.35) !important; color: #d4920a !important; }
        .map-toggle { display: flex; align-items: center; gap: 8px; font-size: 11px; color: rgba(180,165,140,0.6); cursor: pointer; }
        .map-toggle input { accent-color: #d4920a; }
        .consent-overlay { position: absolute; inset: 0; z-index: 2000; background: rgba(5,8,16,0.92); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; }
        .consent-card { background: rgba(15,12,10,0.95); border: 1px solid rgba(212,146,10,0.25); border-radius: 16px; padding: 32px; max-width: 420px; width: 90%; text-align: center; }
        .consent-icon { font-size: 36px; margin-bottom: 16px; }
        .consent-title { font-size: 18px; font-weight: 800; color: #e2e8f0; margin-bottom: 8px; }
        .consent-text { font-size: 13px; color: rgba(180,165,140,0.7); line-height: 1.7; margin-bottom: 20px; }
        .consent-text em { color: #d4920a; font-style: normal; font-weight: 600; }
        .consent-buttons { display: flex; gap: 10px; justify-content: center; }
        @media (max-width: 640px) {
          .map-hud { top: 10px; left: 10px; right: 10px; max-width: none; }
          .map-panel { padding: 10px 14px; }
          .map-title { font-size: 15px; }
        }
      `}</style>

      <link rel="stylesheet" href="/leaflet.css" />

      <div className="weered-map-root">
        <div ref={mapRef} className="weered-map-container" />

        <div className="map-hud">
          <div className="map-panel">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="map-title">Locator</div>
              <div style={{ display: "flex", gap: 4 }}>
                {userPos && (
                  <button
                    className="map-btn map-btn-ghost map-btn-icon"
                    onClick={flyToMe}
                    title="Fly to my location"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                  </button>
                )}
                <button
                  className="map-btn map-btn-ghost map-btn-icon"
                  onClick={loadHexes}
                  title="Refresh map data"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 2v6h-6" />
                    <path d="M3 12a9 9 0 0115.36-6.36L21 8" />
                    <path d="M3 22v-6h6" />
                    <path d="M21 12a9 9 0 01-15.36 6.36L3 16" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="map-stat">
              <strong>{totalUsers}</strong> user{totalUsers !== 1 ? "s" : ""} sharing location
              {hexes.length > 0 && (
                <>
                  {" "}
                  across <strong>{hexes.length}</strong> zone{hexes.length !== 1 ? "s" : ""}
                </>
              )}
            </div>
            <div style={{ fontSize: 9, color: "rgba(180,165,140,0.3)", marginTop: 4 }}>
              updated {timeSince(lastRefresh)} · auto-refresh 30s
            </div>
          </div>

          {availableGames.length > 1 && (
            <div className="map-panel" style={{ padding: "10px 14px" }}>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(212,146,10,0.45)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Filter by game
              </div>
              <div className="map-filter">
                <button
                  className={`map-filter-btn ${gameFilter === "all" ? "map-filter-btn-active" : ""}`}
                  onClick={() => setGameFilter("all")}
                >
                  All ({totalUsers})
                </button>
                {availableGames.map((g) => (
                  <button
                    key={g.id}
                    className={`map-filter-btn ${gameFilter === g.id ? "map-filter-btn-active" : ""}`}
                    onClick={() => setGameFilter(g.id)}
                  >
                    {g.name} ({g.count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {optIn !== null && (
            <div className="map-panel" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {optIn ? (
                <>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(212,146,10,0.7)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#22c55e",
                        display: "inline-block",
                      }}
                    />
                    Location sharing ON
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="map-btn map-btn-ghost"
                      onClick={enableLocation}
                      disabled={locating}
                    >
                      {locating ? "Updating..." : "Update"}
                    </button>
                    <button className="map-btn map-btn-danger" onClick={disableLocation}>
                      Disable
                    </button>
                  </div>
                  <label className="map-toggle">
                    <input
                      type="checkbox"
                      checked={showLobbyPins}
                      onChange={(e) => setShowLobbyPins(e.target.checked)}
                    />
                    Show lobby pins ({lobbyPins.length})
                  </label>
                </>
              ) : (
                <button className="map-btn map-btn-primary" onClick={() => setShowConsent(true)}>
                  Share My Location
                </button>
              )}
            </div>
          )}

          {nearby.length > 0 && (
            <div className="map-panel">
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(212,146,10,0.5)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Nearby ({nearby.length})
              </div>
              <div className="nearby-list">
                {nearby.map((u) => (
                  <div
                    key={u.id}
                    className="nearby-user"
                    onClick={() => replaceTop("profile", { userId: u.id })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") replaceTop("profile", { userId: u.id });
                    }}
                  >
                    <div
                      className="nearby-avatar"
                      style={{
                        background: u.avatarColor ? `${u.avatarColor}22` : "rgba(212,146,10,0.1)",
                        color: u.avatarColor || "#d4920a",
                      }}
                    >
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: 8,
                          }}
                          alt={`${u.name || u.usernameKey || "User"} avatar`}
                        />
                      ) : (
                        (u.name || u.usernameKey || "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="nearby-name">{u.name || u.usernameKey}</div>
                      <div className="nearby-meta">
                        {u.tier}
                        {u.lobbyName && <> · {u.lobbyName}</>}
                      </div>
                    </div>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(212,146,10,0.3)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {clickToPlace && (
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1500,
              background: "rgba(10,8,6,0.92)",
              border: "1px solid rgba(212,146,10,0.3)",
              borderRadius: 12,
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              backdropFilter: "blur(12px)",
              fontFamily: "'DM Mono', monospace",
              cursor: "crosshair",
            }}
          >
            <span style={{ fontSize: 20 }}>📍</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                Click the map to set your location
              </div>
              <div style={{ fontSize: 11, color: gpsError ? "#f87171" : "rgba(180,165,140,0.5)" }}>
                {gpsError || "GPS unavailable — drop your pin manually instead"}
              </div>
            </div>
            <button
              className="map-btn map-btn-primary"
              style={{ marginLeft: 8, fontSize: 11 }}
              onClick={() => {
                setClickToPlace(false);
                setGpsError(null);
                enableLocation();
              }}
            >
              Try GPS
            </button>
            <button
              className="map-btn map-btn-ghost"
              style={{ marginLeft: 4 }}
              onClick={() => {
                setClickToPlace(false);
                setGpsError(null);
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {showConsent && (
          <div className="consent-overlay">
            <div className="consent-card">
              <div className="consent-icon">📍</div>
              <div className="consent-title">Share Your Location</div>
              <div className="consent-text">
                Weered uses your <em>approximate location</em> to show you on the Locator and help
                you find nearby users.
                <br />
                <br />
                Your position is snapped to a <em>~5 km grid cell</em> — your exact coordinates are{" "}
                <em>never</em> shared with other users.
                <br />
                <br />
                You can disable this at any time from this page or your profile settings.
              </div>
              <div className="consent-buttons">
                <button className="map-btn map-btn-ghost" onClick={() => setShowConsent(false)}>
                  Cancel
                </button>
                <button
                  className="map-btn map-btn-primary"
                  onClick={enableLocation}
                  disabled={locating}
                >
                  {locating ? "Locating..." : "Enable Location"}
                </button>
              </div>
              <div
                style={{
                  marginTop: 12,
                  borderTop: "1px solid rgba(212,146,10,0.12)",
                  paddingTop: 12,
                }}
              >
                <button
                  className="map-btn map-btn-ghost"
                  style={{ fontSize: 11, width: "100%" }}
                  onClick={() => {
                    setShowConsent(false);
                    setClickToPlace(true);
                  }}
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

function intensityColor(t: number): string {
  const r = Math.round(180 + t * 32);
  const g = Math.round(100 + t * 46);
  const b = Math.round(5 + t * 5);
  return `rgb(${r},${g},${b})`;
}
