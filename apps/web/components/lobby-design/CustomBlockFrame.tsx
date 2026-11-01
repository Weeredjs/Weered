"use client";

// A custom block or game on a lobby's Home (James 2026-10-31: "a jukebox,
// guestbook, poll, tier list… trivia night, bingo"): the code the builder wrote,
// running in the walled-off box (lib/blockSandbox.ts), and this frame answering
// its bridge. Saved blocks keep their data on Weered (api routes/lobbyExtras.ts)
// and talk live through the lobby's socket (api sockets/blockRelay.ts); the
// Design-mode preview keeps its data in memory, so it can be tried before it's
// saved.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWeered } from "../WeeredProvider";
import { sandboxDoc, type BridgeMsg } from "../../lib/blockSandbox";
import { ExtrasError, blockData, blocks } from "../../lib/lobbyExtras";

export const BLOCK_HEIGHT = { s: 220, m: 380, l: 600 } as const;
const MIN_H = 120;
const MAX_H = 1200;

type Item = { key: string; value: unknown; by: { id: string; name: string } | null; at: string };

export default function CustomBlockFrame({
  lobbyId,
  blockId,
  code: givenCode,
  height = "m",
  accent,
  font,
  title,
}: {
  lobbyId: string;
  /** A saved block: its code is fetched and its data lives on Weered. */
  blockId?: string;
  /** Code to run as a preview (Design mode, before saving). */
  code?: string;
  height?: "s" | "m" | "l";
  accent: string;
  font?: string;
  title?: string;
}) {
  const ctx: any = useWeered();
  const me = ctx?.me?.id ? { id: String(ctx.me.id), name: String(ctx.me.name || "") } : null;
  const meRef = useRef(me);
  meRef.current = me;
  const sendRaw: ((m: object) => void) | undefined = ctx?.sendRaw;
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [code, setCode] = useState<string | null>(givenCode ?? null);
  const [missing, setMissing] = useState(false);
  const [px, setPx] = useState<number>(BLOCK_HEIGHT[height] || BLOCK_HEIGHT.m);
  // The preview's own store: what weered.set saves before the block exists.
  const local = useRef(new Map<string, Item>());
  // Navigation guard (see onLoad below): loads of the current frame, how many
  // times it has been put back, and whether it was stopped.
  const loads = useRef(0);
  const [mount, setMount] = useState(0);
  const [stopped, setStopped] = useState(false);

  useEffect(() => setPx(BLOCK_HEIGHT[height] || BLOCK_HEIGHT.m), [height]);

  useEffect(() => {
    if (givenCode !== undefined) {
      setCode(givenCode);
      local.current = new Map();
      return;
    }
    if (!blockId) return;
    let dead = false;
    blocks
      .get(lobbyId, blockId)
      .then((b) => !dead && setCode(b.code))
      .catch(() => !dead && setMissing(true));
    return () => {
      dead = true;
    };
  }, [lobbyId, blockId, givenCode]);

  const doc = useMemo(() => (code ? sandboxDoc(code, { accent, font }) : ""), [code, accent, font]);
  // New code is a new page, not a navigation.
  useEffect(() => {
    loads.current = 0;
  }, [doc]);

  useEffect(() => {
    if (!doc) return;
    const win = () => frame.current?.contentWindow || null;
    const reply = (id: number, ok: boolean, value?: unknown, error?: string) =>
      win()?.postMessage({ weered: 2, t: "reply", id, ok, value, error }, "*");
    const saved = !!blockId && givenCode === undefined;

    const mineKey = (key: string) =>
      key.startsWith("mine:") ? `${key}@${meRef.current?.id || "you"}` : key;
    const shown = (key: string) => (key.startsWith("mine:") ? key.replace(/@[^@]*$/, "") : key);

    async function answer(m: Extract<BridgeMsg, { id: number }>) {
      const a = (m.a || {}) as Record<string, any>;
      try {
        if (m.t === "me") return reply(m.id, true, meRef.current);
        if (m.t === "get") {
          if (saved) {
            const it = await blockData.get(blockId!, String(a.key));
            return reply(m.id, true, it ? it.value : null);
          }
          const it = local.current.get(mineKey(String(a.key)));
          return reply(m.id, true, it ? it.value : null);
        }
        if (m.t === "set") {
          if (!meRef.current) return reply(m.id, false, undefined, "Sign in to join in");
          if (saved) {
            await blockData.set(blockId!, String(a.key), a.value ?? null);
            return reply(m.id, true, true);
          }
          const key = mineKey(String(a.key));
          if (a.value === null || a.value === undefined) local.current.delete(key);
          else
            local.current.set(key, {
              key: shown(key),
              value: JSON.parse(JSON.stringify(a.value)),
              by: meRef.current,
              at: new Date().toISOString(),
            });
          return reply(m.id, true, true);
        }
        if (m.t === "list") {
          const prefix = String(a.prefix || "");
          if (saved) {
            const items = await blockData.list(blockId!, prefix);
            return reply(m.id, true, items);
          }
          const items = Array.from(local.current.entries())
            .filter(([k]) => k.startsWith(prefix))
            .map(([, v]) => v);
          return reply(m.id, true, items);
        }
      } catch (e) {
        const why =
          e instanceof ExtrasError
            ? e.code === "sign_in"
              ? "Sign in to join in"
              : e.code === "staff_only"
                ? "Only the lobby's staff can change that"
                : e.code
            : "error";
        return reply(m.id, false, undefined, why);
      }
    }

    function onMessage(e: MessageEvent) {
      // Only this frame's own page; its origin is opaque ("null"), so the
      // window itself is the check.
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const m = e.data as BridgeMsg;
      if (!m || (m as any).weered !== 1) return;
      if (m.t === "resize") {
        const h = Math.round(Number(m.a?.px) || 0);
        if (h > 0) setPx(Math.max(MIN_H, Math.min(MAX_H, h)));
        return;
      }
      if (m.t === "send") {
        if (saved && sendRaw) sendRaw({ type: "block:send", blockId, data: m.a?.data ?? null });
        else if (!saved)
          // The preview hears itself, so a game can be tried alone.
          win()?.postMessage(
            { weered: 2, t: "event", data: m.a?.data ?? null, from: meRef.current },
            "*",
          );
        return;
      }
      if (typeof (m as any).id === "number") void answer(m as any);
    }

    function onEvent(e: Event) {
      const d = (e as CustomEvent).detail;
      if (!saved || !d || d.blockId !== blockId) return;
      win()?.postMessage({ weered: 2, t: "event", data: d.data, from: d.from }, "*");
    }

    window.addEventListener("message", onMessage);
    window.addEventListener("weered:block:event", onEvent);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("weered:block:event", onEvent);
    };
  }, [doc, blockId, givenCode, sendRaw]);

  if (missing)
    return (
      <div style={{ padding: 18, fontSize: 13, opacity: 0.6 }}>This block was taken down.</div>
    );
  if (stopped)
    return (
      <div style={{ padding: 18, fontSize: 13, opacity: 0.6 }}>
        This block was stopped: it tried to open another page.
      </div>
    );
  if (!doc)
    return <div style={{ height: px, display: "grid", placeItems: "center", opacity: 0.4 }}>…</div>;

  // Who made it, always on show: a block is this lobby's own code, and while
  // the frame can't reach Weered, nothing can stop it sending itself (and what
  // someone typed into it) to another site (red team 2026-11-01, finding 19).
  return (
    <div>
      <iframe
        key={mount}
        ref={frame}
        title={title || "Custom block"}
        // Scripts only: no same-origin (no cookies, storage or Weered pages), no
        // forms, popups, top navigation or downloads.
        sandbox="allow-scripts"
        allow=""
        referrerPolicy="no-referrer"
        srcDoc={doc}
        onLoad={() => {
          // The box's own page loads once. A second load means it sent itself
          // somewhere else: put the block back, and after twice, stop it.
          loads.current += 1;
          if (loads.current < 2) return;
          loads.current = 0;
          if (mount >= 2) setStopped(true);
          else setMount((n) => n + 1);
        }}
        style={{
          display: "block",
          width: "100%",
          height: px,
          border: 0,
          background: "transparent",
        }}
      />
      <div
        title="Weered didn't write this block. Never type a password into one."
        style={{ fontSize: 10, letterSpacing: ".04em", opacity: 0.5, padding: "4px 2px 0" }}
      >
        Made by this lobby, not Weered
      </div>
    </div>
  );
}
