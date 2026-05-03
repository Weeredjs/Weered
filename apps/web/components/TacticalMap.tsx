"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "./WeeredProvider";
import TacticalMapToolbar from "./TacticalMapToolbar";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#C4A55A";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || localStorage.getItem("token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}

export type MapData = {
  id: string;
  roomId: string;
  name: string;
  imageUrl: string;
  widthPx: number;
  heightPx: number;
  gridSize: number;
  gridColor: string;
  gridOpacity: number;
  gridEnabled: boolean;
  fogEnabled: boolean;
};

export type TokenData = {
  id: string;
  mapId: string;
  name: string;
  color: string;
  imageUrl: string | null;
  sizeCells: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  hpMax: number;
  hpVisible: boolean;
  ownerId: string | null;
  hidden: boolean;
  kind: "PC" | "NPC" | "MONSTER";
  combatantId: string | null;
};

export type FogCell = { x: number; y: number };

type Tool = "select" | "addToken" | "addHidden" | "fogReveal" | "fogClear" | "measure";

type Props = { roomId: string };

export default function TacticalMap({ roomId }: Props) {
  const { me } = useWeered() as any;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [map, setMap] = useState<MapData | null>(null);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [fog, setFog] = useState<Set<string>>(new Set());
  const [isDM, setIsDM] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [activeCombatantId, setActiveCombatantId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);

  const [tool, setTool] = useState<Tool>("select");
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [measureA, setMeasureA] = useState<{ x: number; y: number } | null>(null);
  const [measureB, setMeasureB] = useState<{ x: number; y: number } | null>(null);

  const dragRef = useRef<{ tokenId: string; offsetCx: number; offsetCy: number; lastX: number; lastY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const fogPaintRef = useRef<Set<string> | null>(null);

  const fogKey = (x: number, y: number) => `${x},${y}`;

  // Hydrate map state on mount + when roomId changes
  const reload = useCallback(async () => {
    try {
      const r = await fetch(`${API}/maps/${encodeURIComponent(roomId)}`, { headers: authHeaders() });
      const j = await r.json();
      if (!j?.ok) return;
      setIsDM(Boolean(j.isDM));
      if (!j.map) {
        setMap(null); setTokens([]); setFog(new Set()); setImgLoaded(false);
        return;
      }
      setMap(j.map);
      setTokens(j.tokens || []);
      const f = new Set<string>();
      for (const c of (j.fogReveals || [])) f.add(fogKey(c.x, c.y));
      setFog(f);
    } catch {}
  }, [roomId]);

  useEffect(() => { reload(); }, [reload]);

  // Load image when map.imageUrl changes
  useEffect(() => {
    if (!map?.imageUrl) { setImgLoaded(false); return; }
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.onerror = () => { setImgLoaded(false); };
    img.src = map.imageUrl.startsWith("http") || map.imageUrl.startsWith("/") ? map.imageUrl : `/${map.imageUrl}`;
    return () => { /* nothing */ };
  }, [map?.imageUrl]);

  // ── WS event listeners ────────────────────────────────────────────────────
  useEffect(() => {
    function onCreated(ev: any) {
      const d = ev?.detail; if (!d || d.roomId !== roomId) return;
      reload();
    }
    function onUpdated(ev: any) {
      const d = ev?.detail; if (!d || d.roomId !== roomId || !d.map) return;
      setMap(prev => prev && prev.id === d.map.id ? { ...prev, ...d.map } : d.map);
    }
    function onDeleted(ev: any) {
      const d = ev?.detail; if (!d || d.roomId !== roomId) return;
      setMap(null); setTokens([]); setFog(new Set());
    }
    function onTokenAdd(ev: any) {
      const d = ev?.detail; if (!d || d.roomId !== roomId || !d.token) return;
      setTokens(prev => prev.find(t => t.id === d.token.id) ? prev : [...prev, d.token]);
    }
    function onTokenUpdate(ev: any) {
      const d = ev?.detail; if (!d || d.roomId !== roomId || !d.token) return;
      setTokens(prev => prev.map(t => t.id === d.token.id ? { ...t, ...d.token } : t));
    }
    function onTokenRemove(ev: any) {
      const d = ev?.detail; if (!d || d.roomId !== roomId || !d.tokenId) return;
      setTokens(prev => prev.filter(t => t.id !== d.tokenId));
    }
    function onTokenMove(ev: any) {
      // WS-direct fast path; used between drag-end and REST confirmation
      const d = ev?.detail; if (!d || d.roomId !== roomId || !d.tokenId) return;
      setTokens(prev => prev.map(t => t.id === d.tokenId ? { ...t, x: Number(d.x), y: Number(d.y) } : t));
    }
    function onFogReveal(ev: any) {
      const d = ev?.detail; if (!d || d.roomId !== roomId || !Array.isArray(d.cells)) return;
      setFog(prev => { const next = new Set(prev); for (const c of d.cells) next.add(fogKey(c.x, c.y)); return next; });
    }
    function onFogClear(ev: any) {
      const d = ev?.detail; if (!d || d.roomId !== roomId) return;
      if (d.all) { setFog(new Set()); return; }
      if (Array.isArray(d.cells)) {
        setFog(prev => { const next = new Set(prev); for (const c of d.cells) next.delete(fogKey(c.x, c.y)); return next; });
      }
    }
    function onInitiative(ev: any) {
      const d = ev?.detail; if (!d || d.roomId !== roomId) return;
      const list = d.combatants || [];
      const turn = typeof d.currentTurn === "number" ? d.currentTurn : 0;
      const sorted = [...list].sort((a: any, b: any) => b.initiative - a.initiative);
      const cur = sorted[turn];
      setActiveCombatantId(cur?.id || null);
    }
    window.addEventListener("weered:map:created", onCreated as any);
    window.addEventListener("weered:map:updated", onUpdated as any);
    window.addEventListener("weered:map:deleted", onDeleted as any);
    window.addEventListener("weered:map:token-add", onTokenAdd as any);
    window.addEventListener("weered:map:token-update", onTokenUpdate as any);
    window.addEventListener("weered:map:token-remove", onTokenRemove as any);
    window.addEventListener("weered:map:token-move", onTokenMove as any);
    window.addEventListener("weered:map:fog-reveal", onFogReveal as any);
    window.addEventListener("weered:map:fog-clear", onFogClear as any);
    window.addEventListener("weered:dnd:initiative", onInitiative as any);
    return () => {
      window.removeEventListener("weered:map:created", onCreated as any);
      window.removeEventListener("weered:map:updated", onUpdated as any);
      window.removeEventListener("weered:map:deleted", onDeleted as any);
      window.removeEventListener("weered:map:token-add", onTokenAdd as any);
      window.removeEventListener("weered:map:token-update", onTokenUpdate as any);
      window.removeEventListener("weered:map:token-remove", onTokenRemove as any);
      window.removeEventListener("weered:map:token-move", onTokenMove as any);
      window.removeEventListener("weered:map:fog-reveal", onFogReveal as any);
      window.removeEventListener("weered:map:fog-clear", onFogClear as any);
      window.removeEventListener("weered:dnd:initiative", onInitiative as any);
    };
  }, [roomId, reload]);

  // Active-token pulse animation
  useEffect(() => {
    if (!activeCombatantId) return;
    let raf = 0;
    const tick = () => { setPulse(p => (p + 1) % 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeCombatantId]);

  // ── Coordinate conversions ────────────────────────────────────────────────
  const pxToCell = useCallback((px: number, py: number) => {
    if (!map) return { x: 0, y: 0 };
    return { x: px / map.gridSize, y: py / map.gridSize };
  }, [map]);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const c = canvasRef.current; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    const cx = (sx - r.left - pan.x) / zoom;
    const cy = (sy - r.top - pan.y) / zoom;
    return { x: cx, y: cy };
  }, [zoom, pan]);

  // ── Render ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const wrap = wrapRef.current; if (!wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    if (c.width !== Math.floor(rect.width * dpr) || c.height !== Math.floor(rect.height * dpr)) {
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      c.style.width = `${rect.width}px`;
      c.style.height = `${rect.height}px`;
    }
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Parchment background fallback
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (!map) return;

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Map image
    const img = imgRef.current;
    if (img && imgLoaded) {
      ctx.drawImage(img, 0, 0, map.widthPx, map.heightPx);
    } else {
      ctx.fillStyle = "rgba(60,40,20,0.4)";
      ctx.fillRect(0, 0, map.widthPx, map.heightPx);
    }

    const cellsX = Math.ceil(map.widthPx / map.gridSize);
    const cellsY = Math.ceil(map.heightPx / map.gridSize);

    // Fog of war
    if (map.fogEnabled) {
      if (isDM) {
        // DM sees revealed area highlighted, unrevealed dimmed
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, map.widthPx, map.heightPx);
        ctx.globalCompositeOperation = "destination-out";
        for (const k of fog) {
          const [xs, ys] = k.split(",");
          const x = parseInt(xs, 10), y = parseInt(ys, 10);
          ctx.fillRect(x * map.gridSize, y * map.gridSize, map.gridSize, map.gridSize);
        }
        ctx.restore();
      } else {
        // Players see only revealed cells; rest is opaque black
        ctx.save();
        ctx.fillStyle = "#0a0806";
        for (let cy = 0; cy < cellsY; cy++) {
          for (let cx = 0; cx < cellsX; cx++) {
            if (!fog.has(fogKey(cx, cy))) {
              ctx.fillRect(cx * map.gridSize, cy * map.gridSize, map.gridSize, map.gridSize);
            }
          }
        }
        ctx.restore();
      }
    }

    // Grid
    if (map.gridEnabled) {
      ctx.save();
      ctx.strokeStyle = map.gridColor;
      ctx.globalAlpha = map.gridOpacity;
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      for (let i = 0; i <= cellsX; i++) {
        const x = i * map.gridSize;
        ctx.moveTo(x, 0); ctx.lineTo(x, map.heightPx);
      }
      for (let j = 0; j <= cellsY; j++) {
        const y = j * map.gridSize;
        ctx.moveTo(0, y); ctx.lineTo(map.widthPx, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Tokens (sorted by z; PCs on top)
    const drawTokens = [...tokens]
      .filter(t => isDM || !t.hidden)
      .filter(t => {
        // Players: only draw tokens whose cells are in revealed fog (or fog disabled)
        if (isDM || !map.fogEnabled) return true;
        const tx = Math.floor(t.x), ty = Math.floor(t.y);
        for (let dy = 0; dy < t.sizeCells; dy++) {
          for (let dx = 0; dx < t.sizeCells; dx++) {
            if (fog.has(fogKey(tx + dx, ty + dy))) return true;
          }
        }
        return false;
      })
      .sort((a, b) => a.z - b.z);

    for (const t of drawTokens) {
      const cx = (t.x + t.sizeCells / 2) * map.gridSize;
      const cy = (t.y + t.sizeCells / 2) * map.gridSize;
      const r = (t.sizeCells * map.gridSize) / 2 - 2;

      // Pulse ring for active combatant
      if (t.combatantId && activeCombatantId && t.combatantId === activeCombatantId) {
        const ph = (Math.sin(pulse / 8) + 1) / 2;
        ctx.save();
        ctx.strokeStyle = ACCENT;
        ctx.globalAlpha = 0.55 + ph * 0.45;
        ctx.lineWidth = 4 / zoom;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4 + ph * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Selection ring
      if (t.id === selectedTokenId) {
        ctx.save();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Body
      ctx.save();
      if (t.hidden) ctx.globalAlpha = 0.6;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2 / zoom;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.stroke();
      ctx.restore();

      // Name
      ctx.save();
      ctx.font = `${Math.max(10, 12 / zoom)}px sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(t.name, cx, cy + r + 2);
      ctx.restore();

      // HP bar (if visible & has max)
      if (t.hpVisible && t.hpMax > 0) {
        const ratio = Math.max(0, Math.min(1, t.hp / t.hpMax));
        const barW = r * 2;
        const barH = 4 / zoom + 2;
        const bx = cx - barW / 2;
        const by = cy - r - barH - 2;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#eab308" : "#ef4444";
        ctx.fillRect(bx, by, barW * ratio, barH);
        ctx.restore();
      }

      // Hidden marker (DM-only)
      if (t.hidden && isDM) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.font = `bold ${Math.max(11, 14 / zoom)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("👁", cx, cy);
        ctx.restore();
      }
    }

    // Measurement
    if (measureA && measureB) {
      const ax = (measureA.x + 0.5) * map.gridSize;
      const ay = (measureA.y + 0.5) * map.gridSize;
      const bx = (measureB.x + 0.5) * map.gridSize;
      const by = (measureB.y + 0.5) * map.gridSize;
      ctx.save();
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([8 / zoom, 4 / zoom]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();
      // 5e diagonal: every other diagonal counts as 10ft
      const dx = Math.abs(measureB.x - measureA.x);
      const dy = Math.abs(measureB.y - measureA.y);
      const diag = Math.min(dx, dy);
      const straight = Math.abs(dx - dy);
      const cells = diag + straight + Math.floor(diag / 2);
      const ft = cells * 5;
      ctx.save();
      ctx.font = `bold ${Math.max(13, 16 / zoom)}px serif`;
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = 4 / zoom;
      const mx = (ax + bx) / 2, my = (ay + by) / 2 - 8;
      ctx.textAlign = "center";
      ctx.strokeText(`${ft} ft`, mx, my);
      ctx.fillText(`${ft} ft`, mx, my);
      ctx.restore();
    }

    ctx.restore();
  });

  // Resize observer to redraw on container size changes
  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const ro = new ResizeObserver(() => {
      // force a state nudge by toggling pulse — render runs every frame anyway when active
      setPulse(p => (p + 1) % 1000);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ── Pointer interactions ──────────────────────────────────────────────────
  function tokenAtCell(cellX: number, cellY: number, sortedTokens: TokenData[]): TokenData | null {
    // top-down hit test (highest z first)
    for (let i = sortedTokens.length - 1; i >= 0; i--) {
      const t = sortedTokens[i];
      if (cellX >= t.x && cellX < t.x + t.sizeCells && cellY >= t.y && cellY < t.y + t.sizeCells) {
        if (!isDM && t.hidden) continue;
        return t;
      }
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!map) return;
    const w = screenToWorld(e.clientX, e.clientY);
    const cell = pxToCell(w.x, w.y);
    const cellX = Math.floor(cell.x);
    const cellY = Math.floor(cell.y);

    // Right click or middle = pan
    if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
      panRef.current = { startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }

    const sortedTokens = [...tokens].filter(t => isDM || !t.hidden).sort((a, b) => a.z - b.z);

    if (tool === "fogReveal" || tool === "fogClear") {
      if (!isDM) return;
      fogPaintRef.current = new Set([fogKey(cellX, cellY)]);
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (tool === "measure") {
      if (!measureA) { setMeasureA({ x: cellX, y: cellY }); setMeasureB({ x: cellX, y: cellY }); }
      else if (!measureB || (measureB.x === measureA.x && measureB.y === measureA.y)) { setMeasureB({ x: cellX, y: cellY }); }
      else { setMeasureA({ x: cellX, y: cellY }); setMeasureB({ x: cellX, y: cellY }); }
      return;
    }

    if (tool === "addToken" || tool === "addHidden") {
      if (!isDM) return;
      const hidden = tool === "addHidden";
      const name = window.prompt("Token name?", hidden ? "Hidden" : "Token") || (hidden ? "Hidden" : "Token");
      const colorIn = window.prompt("Color (hex like #C4A55A) — leave blank for default", "#C4A55A") || "#C4A55A";
      const sizeIn = parseInt(window.prompt("Size (1, 2, or 3 cells)", "1") || "1", 10);
      const sizeCells = [1, 2, 3].includes(sizeIn) ? sizeIn : 1;
      fetch(`${API}/maps/${map.id}/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name, color: /^#[0-9a-fA-F]{6}$/.test(colorIn) ? colorIn : "#C4A55A",
          sizeCells, x: cellX, y: cellY, hidden, kind: hidden ? "MONSTER" : "NPC",
        }),
      }).catch(() => {});
      setTool("select");
      return;
    }

    // Default: select. If there's a token under cursor, start drag (if movable)
    const hit = tokenAtCell(cellX + (cell.x - cellX), cellY + (cell.y - cellY), sortedTokens);
    if (hit) {
      const movable = isDM || hit.ownerId === me?.id;
      setSelectedTokenId(hit.id);
      if (movable) {
        const offCx = cell.x - hit.x;
        const offCy = cell.y - hit.y;
        dragRef.current = { tokenId: hit.id, offsetCx: offCx, offsetCy: offCy, lastX: hit.x, lastY: hit.y };
        (e.target as Element).setPointerCapture(e.pointerId);
      }
    } else {
      setSelectedTokenId(null);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!map) return;
    const w = screenToWorld(e.clientX, e.clientY);
    const cell = pxToCell(w.x, w.y);
    const cellX = Math.floor(cell.x);
    const cellY = Math.floor(cell.y);

    if (panRef.current) {
      setPan({ x: panRef.current.origX + (e.clientX - panRef.current.startX), y: panRef.current.origY + (e.clientY - panRef.current.startY) });
      return;
    }

    if (fogPaintRef.current) {
      fogPaintRef.current.add(fogKey(cellX, cellY));
      // Optimistic local update
      setFog(prev => {
        const next = new Set(prev);
        if (tool === "fogReveal") next.add(fogKey(cellX, cellY));
        else if (tool === "fogClear") next.delete(fogKey(cellX, cellY));
        return next;
      });
      return;
    }

    if (dragRef.current) {
      const drag = dragRef.current;
      const newX = cell.x - drag.offsetCx;
      const newY = cell.y - drag.offsetCy;
      // snap to grid as it moves
      const snapX = Math.round(newX);
      const snapY = Math.round(newY);
      setTokens(prev => prev.map(t => t.id === drag.tokenId ? { ...t, x: snapX, y: snapY } : t));
      drag.lastX = snapX;
      drag.lastY = snapY;
      return;
    }

    if (tool === "measure" && measureA) {
      setMeasureB({ x: cellX, y: cellY });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (panRef.current) { panRef.current = null; return; }

    if (fogPaintRef.current && map) {
      const cells = Array.from(fogPaintRef.current).map(k => { const [x, y] = k.split(","); return { x: parseInt(x, 10), y: parseInt(y, 10) }; });
      fogPaintRef.current = null;
      const endpoint = tool === "fogReveal" ? "reveal" : "clear";
      fetch(`${API}/maps/${map.id}/fog/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ cells }),
      }).catch(() => {});
      return;
    }

    if (dragRef.current && map) {
      const drag = dragRef.current;
      dragRef.current = null;
      fetch(`${API}/maps/tokens/${drag.tokenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ x: drag.lastX, y: drag.lastY }),
      }).catch(() => {});
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (!canvasRef.current) return;
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 1 / 1.1;
    const r = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const wx = (sx - pan.x) / zoom, wy = (sy - pan.y) / zoom;
    const newZoom = Math.max(0.25, Math.min(4, zoom * factor));
    setPan({ x: sx - wx * newZoom, y: sy - wy * newZoom });
    setZoom(newZoom);
  }

  // Center map on first load / when image loads
  useEffect(() => {
    if (!map || !wrapRef.current || !imgLoaded) return;
    const r = wrapRef.current.getBoundingClientRect();
    const z = Math.min(r.width / map.widthPx, r.height / map.heightPx, 1);
    setZoom(z);
    setPan({ x: (r.width - map.widthPx * z) / 2, y: (r.height - map.heightPx * z) / 2 });
  }, [map?.id, imgLoaded]);

  const onUploaded = useCallback(() => { reload(); }, [reload]);

  return (
    <div className="weered-dnd-modules" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#0a0806" }}>
      <TacticalMapToolbar
        roomId={roomId}
        map={map}
        isDM={isDM}
        tool={tool}
        setTool={setTool}
        selectedToken={tokens.find(t => t.id === selectedTokenId) || null}
        onUploaded={onUploaded}
        onClearSelection={() => setSelectedTokenId(null)}
        onClearMeasure={() => { setMeasureA(null); setMeasureB(null); }}
      />
      <div
        ref={wrapRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: tool === "select" ? "default" : tool === "measure" ? "crosshair" : "cell", touchAction: "none" }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      >
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />
        {!map && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "rgba(243,236,220,0.55)", fontFamily: "var(--font-cormorant), serif", fontSize: 18, textAlign: "center", padding: 24 }}>
            <div style={{ fontFamily: "var(--font-pirata), serif", fontSize: 28, color: ACCENT, letterSpacing: ".5px" }}>The Battle Map</div>
            <div>{isDM ? "Upload a map to begin." : "The Dungeon Master has not yet unfurled a map."}</div>
          </div>
        )}
      </div>
    </div>
  );
}
