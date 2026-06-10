"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

function authHeaders(): Record<string, string> {
  try { const t = localStorage.getItem("weered_token") || ""; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}
async function api(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...authHeaders() } });
  return r.json();
}

type TNode = { h: number; x: number; y: number; k: number; n: string; st: string[]; o: number[]; ic?: string; asc?: string; cls?: number };
type Coord = { x: number; y: number; w: number; h: number };
type Sheet = { url: string; coords: Record<string, Coord> };
type Sprites = { zoom: number; active: Sheet; inactive: Sheet; masteryActive: Sheet; masteryInactive: Sheet };
type Tree = { nodes: TNode[]; bounds: { minX: number; minY: number; maxX: number; maxY: number }; sprites?: Sprites; ver?: string };

// module cache so the 419KB tree is fetched once per session
let _tree: Tree | null = null;

const KIND = {
  NORMAL: 0, NOTABLE: 1, KEYSTONE: 2, MASTERY: 3, ASCEND: 4, START: 5, JEWEL: 6,
};

export default function PassiveTree({ accent = "#AF6025" }: { accent?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tree, setTree] = useState<Tree | null>(_tree);
  const [loading, setLoading] = useState(!_tree);
  const [chars, setChars] = useState<any[]>([]);
  const [linked, setLinked] = useState(false);
  const [sel, setSel] = useState<string>("");
  const [allocated, setAllocated] = useState<Set<number>>(new Set());
  const [hover, setHover] = useState<{ node: TNode; sx: number; sy: number } | null>(null);

  // view transform (world -> screen): screen = world*scale + offset
  const view = useRef({ scale: 0.05, ox: 0, oy: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const raf = useRef<number | null>(null);
  const sheets = useRef<{ active?: HTMLImageElement; inactive?: HTMLImageElement; mA?: HTMLImageElement; mI?: HTMLImageElement }>({});
  const [spriteTick, setTick] = useState(0);

  const byId = useMemo(() => {
    const m = new Map<number, TNode>();
    if (tree) for (const n of tree.nodes) m.set(n.h, n);
    return m;
  }, [tree]);

  const edges = useMemo(() => {
    const out: [TNode, TNode][] = [];
    if (tree) for (const n of tree.nodes) for (const o of n.o) {
      if (n.h < o) { const t = byId.get(o); if (t) out.push([n, t]); }
    }
    return out;
  }, [tree, byId]);

  // ── load sprite sheets (cross-origin draw is fine; we never read the canvas back) ──
  useEffect(() => {
    if (!tree?.sprites) return;
    const sp = tree.sprites;
    const mk = (url: string) => { const im = new Image(); im.onload = () => setTick((t) => t + 1); im.src = url; return im; };
    sheets.current = { active: mk(sp.active.url), inactive: mk(sp.inactive.url), mA: mk(sp.masteryActive.url), mI: mk(sp.masteryInactive.url) };
  }, [tree]);

  // ── load tree + characters ──
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!_tree) {
        try { const j = await api("/poe/tree?v=2"); if (j?.ok) { _tree = j as Tree; } } catch { }
      }
      if (alive) { setTree(_tree); setLoading(false); }
    })();
    (async () => {
      try {
        const j = await api("/poe/me/characters");
        if (alive && j?.ok) { setLinked(!!j.linked); setChars(j.characters || []); }
      } catch { }
    })();
    return () => { alive = false; };
  }, []);

  // ── load allocation for selected character ──
  useEffect(() => {
    if (!sel) { setAllocated(new Set()); return; }
    const c = chars.find((x) => x.name === sel);
    const realm = c?.realm || "pc";
    let alive = true;
    (async () => {
      try {
        const j = await api(`/poe/tree/character?name=${encodeURIComponent(sel)}&realm=${encodeURIComponent(realm)}`);
        if (alive && j?.ok) {
          setAllocated(new Set<number>((j.hashes || []).map((x: any) => Number(x))));
          // recenter on the allocated cluster
          if (tree && j.hashes?.length) centerOnAllocated(new Set<number>(j.hashes.map((x: any) => Number(x))));
        }
      } catch { }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const fit = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current; if (!cv || !wrap || !tree) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const b = tree.bounds;
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    const s = Math.min(w / bw, h / bh) * 0.92;
    view.current.scale = s;
    view.current.ox = w / 2 - ((b.minX + b.maxX) / 2) * s;
    view.current.oy = h / 2 - ((b.minY + b.maxY) / 2) * s;
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  const centerOnAllocated = useCallback((set: Set<number>) => {
    const cv = canvasRef.current, wrap = wrapRef.current; if (!cv || !wrap || !_tree) return;
    let sx = 0, sy = 0, n = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of _tree.nodes) if (set.has(node.h)) {
      sx += node.x; sy += node.y; n++;
      if (node.x < minX) minX = node.x; if (node.y < minY) minY = node.y;
      if (node.x > maxX) maxX = node.x; if (node.y > maxY) maxY = node.y;
    }
    if (!n) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const bw = Math.max(800, maxX - minX), bh = Math.max(800, maxY - minY);
    const s = Math.min(w / bw, h / bh) * 0.55;
    view.current.scale = Math.max(0.02, Math.min(0.6, s));
    view.current.ox = w / 2 - (sx / n) * view.current.scale;
    view.current.oy = h / 2 - (sy / n) * view.current.scale;
    requestDraw();
  }, []);

  // ── draw ──
  const draw = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current; if (!cv || !wrap || !tree) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px"; }
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const { scale: s, ox, oy } = view.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0b0b0e";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    const hasBuild = allocated.size > 0;

    // edges
    ctx.lineCap = "round";
    for (const [a, b] of edges) {
      if (a.k === KIND.ASCEND || b.k === KIND.ASCEND) continue; // ascendancy drawn separately/skipped for clarity
      const both = allocated.has(a.h) && allocated.has(b.h);
      ctx.strokeStyle = both ? accent : (hasBuild ? "rgba(120,120,135,.10)" : "rgba(150,150,165,.16)");
      ctx.lineWidth = both ? 7 : 4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // nodes — draw GGG sprite art, fall back to styled shapes if a sheet/coord is missing
    const sp = tree.sprites;
    const z = sp?.zoom || 0.5;
    for (const n of tree.nodes) {
      if (n.k === KIND.ASCEND || n.k === KIND.START) continue;
      const on = allocated.has(n.h);
      const isMast = n.k === KIND.MASTERY;
      const sheet = isMast ? (on ? sheets.current.mA : sheets.current.mI) : (on ? sheets.current.active : sheets.current.inactive);
      const cmap = sp ? (isMast ? (on ? sp.masteryActive : sp.masteryInactive) : (on ? sp.active : sp.inactive)).coords : null;
      const co = cmap && n.ic ? cmap[n.ic] : null;

      if (sheet && sheet.complete && sheet.naturalWidth > 0 && co) {
        const rw = co.w / z, rh = co.h / z;
        ctx.globalAlpha = on ? 1 : (hasBuild ? 0.6 : 0.92);
        if (on) { ctx.shadowColor = accent; ctx.shadowBlur = n.k === KIND.KEYSTONE ? 42 : n.k === KIND.NOTABLE ? 26 : 14; }
        ctx.drawImage(sheet, co.x, co.y, co.w, co.h, n.x - rw / 2, n.y - rh / 2, rw, rh);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        if (on && (n.k === KIND.NOTABLE || n.k === KIND.KEYSTONE)) {
          ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(rw, rh) / 2 + 5, 0, Math.PI * 2);
          ctx.lineWidth = 4; ctx.strokeStyle = accent; ctx.stroke();
        }
      } else {
        const rad = n.k === KIND.KEYSTONE ? 60 : n.k === KIND.NOTABLE ? 40 : n.k === KIND.MASTERY ? 34 : n.k === KIND.JEWEL ? 30 : 22;
        if (on) { ctx.shadowColor = accent; ctx.shadowBlur = n.k === KIND.KEYSTONE ? 34 : 18; }
        ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, Math.PI * 2); ctx.fillStyle = on ? accent : (hasBuild ? "#2a2a31" : "#3c3c45"); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // hover ring
    if (hover) {
      const n = hover.node;
      const rad = n.k === KIND.KEYSTONE ? 64 : n.k === KIND.NOTABLE ? 44 : n.k === KIND.MASTERY ? 38 : 26;
      ctx.beginPath(); ctx.arc(n.x, n.y, rad + 6, 0, Math.PI * 2);
      ctx.lineWidth = 5; ctx.strokeStyle = "#ffffff"; ctx.stroke();
    }
    ctx.restore();
  }, [tree, edges, allocated, accent, hover]);

  const requestDraw = useCallback(() => {
    if (raf.current != null) return;
    raf.current = requestAnimationFrame(() => { raf.current = null; draw(); });
  }, [draw]);

  useEffect(() => { requestDraw(); }, [requestDraw, tree, allocated, hover, spriteTick]);
  useEffect(() => { if (tree && !loading && view.current.scale === 0.05) fit(); }, [tree, loading, fit]);

  // resize
  useEffect(() => {
    const ro = new ResizeObserver(() => requestDraw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [requestDraw]);

  // ── interaction ──
  const screenToWorld = (sx: number, sy: number) => {
    const { scale, ox, oy } = view.current;
    return { x: (sx - ox) / scale, y: (sy - oy) / scale };
  };
  const hitTest = (sx: number, sy: number): TNode | null => {
    if (!tree) return null;
    const wpt = screenToWorld(sx, sy);
    const tol = 60 / view.current.scale;
    let best: TNode | null = null, bestD = tol * tol;
    for (const n of tree.nodes) {
      if (n.k === KIND.START || n.k === KIND.ASCEND) continue;
      const dx = n.x - wpt.x, dy = n.y - wpt.y, d = dx * dx + dy * dy;
      const r = (n.k === KIND.KEYSTONE ? 64 : n.k === KIND.NOTABLE ? 44 : n.k === KIND.MASTERY ? 38 : 28);
      if (d < r * r && d < bestD) { bestD = d; best = n; }
    }
    return best;
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = canvasRef.current!.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY, ox: view.current.ox, oy: view.current.oy };
    void rect;
  };
  const onMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (drag.current) {
      view.current.ox = drag.current.ox + (e.clientX - drag.current.x);
      view.current.oy = drag.current.oy + (e.clientY - drag.current.y);
      requestDraw();
      if (hover) setHover(null);
      return;
    }
    const n = hitTest(sx, sy);
    if (n) setHover({ node: n, sx, sy }); else if (hover) setHover(null);
  };
  const onUp = (e: React.PointerEvent) => { drag.current = null; (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); };
  const onWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const before = screenToWorld(sx, sy);
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    view.current.scale = Math.max(0.012, Math.min(1.2, view.current.scale * factor));
    // keep cursor anchored
    view.current.ox = sx - before.x * view.current.scale;
    view.current.oy = sy - before.y * view.current.scale;
    requestDraw();
    if (hover) setHover(null);
  };

  return (
    <div style={{ position: "relative" }}>
      {/* controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {linked && chars.length > 0 ? (
          <select value={sel} onChange={(e) => setSel(e.target.value)} style={{
            padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(0,0,0,.35)", color: "rgba(243,244,246,.92)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", outline: "none",
          }}>
            <option value="">Browse full tree</option>
            {chars.map((c: any) => <option key={c.name} value={c.name}>{c.name} — Lv{c.level} {c.class}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 11, color: "rgba(148,163,184,.55)" }}>
            {linked ? "No characters found." : "Link your PoE account (My Account) to overlay your build."}
          </span>
        )}
        {allocated.size > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: accent, fontFamily: "monospace" }}>
            {allocated.size} points allocated
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={() => { view.current.scale = Math.min(1.2, view.current.scale * 1.3); requestDraw(); }} style={btn}>+</button>
          <button onClick={() => { view.current.scale = Math.max(0.012, view.current.scale / 1.3); requestDraw(); }} style={btn}>−</button>
          <button onClick={() => (allocated.size ? centerOnAllocated(allocated) : fit())} style={btn}>Fit</button>
        </div>
      </div>

      {/* canvas */}
      <div ref={wrapRef} style={{
        position: "relative", width: "100%", height: "min(70vh, 620px)",
        borderRadius: 12, overflow: "hidden", border: `1px solid ${accent}22`,
        background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,.02), #0b0b0e 70%)", cursor: drag.current ? "grabbing" : "grab",
      }}>
        {loading ? (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(148,163,184,.5)", fontSize: 13 }}>
            Loading passive tree…
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
            onWheel={onWheel}
            style={{ display: "block", touchAction: "none" }}
          />
        )}

        {/* tooltip */}
        {hover && (
          <div style={{
            position: "absolute", left: Math.min(hover.sx + 14, (wrapRef.current?.clientWidth || 400) - 240),
            top: Math.min(hover.sy + 14, (wrapRef.current?.clientHeight || 400) - 120),
            maxWidth: 240, pointerEvents: "none", zIndex: 5,
            background: "rgba(12,12,16,.96)", border: `1px solid ${accent}55`, borderRadius: 9, padding: "9px 11px",
            boxShadow: "0 10px 30px rgba(0,0,0,.5)",
          }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: hover.node.k === KIND.KEYSTONE ? "#ff9d5c" : hover.node.k === KIND.NOTABLE ? accent : "rgba(243,244,246,.95)", marginBottom: hover.node.st?.length ? 5 : 0 }}>
              {hover.node.n || (hover.node.k === KIND.MASTERY ? "Mastery" : "Passive")}
            </div>
            {(hover.node.st || []).map((line, i) => (
              <div key={i} style={{ fontSize: 11, color: "rgba(148,180,220,.9)", lineHeight: 1.35 }}>{line}</div>
            ))}
            {allocated.size > 0 && (
              <div style={{ fontSize: 9, marginTop: 5, color: allocated.has(hover.node.h) ? accent : "rgba(148,163,184,.45)", fontWeight: 700, letterSpacing: ".4px" }}>
                {allocated.has(hover.node.h) ? "● ALLOCATED" : "○ not taken"}
              </div>
            )}
          </div>
        )}

        {/* legend */}
        <div style={{ position: "absolute", left: 10, bottom: 10, display: "flex", gap: 12, fontSize: 9, color: "rgba(148,163,184,.5)", pointerEvents: "none", letterSpacing: ".4px" }}>
          <span><span style={{ color: accent }}>●</span> Keystone/Notable</span>
          <span>scroll to zoom · drag to pan</span>
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  width: 30, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.05)", color: "rgba(243,244,246,.85)", fontSize: 14, cursor: "pointer", fontFamily: "inherit", lineHeight: 1,
};
