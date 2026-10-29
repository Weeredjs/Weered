"use client";

// State for Design mode: the published layout, the working draft with undo and
// redo, and publish/discard. The draft survives a refresh (per lobby, in this
// browser) so a half-finished design isn't lost.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeLayout, stockLayout, type LobbyLayout } from "../../lib/lobbyLayout";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const draftKey = (id: string) => `weered:design-draft:${id}`;

export type DesignState = ReturnType<typeof useLobbyDesign>;

export function useLobbyDesign(
  lobbyId: string,
  serverLayout: unknown,
  canDesign: boolean,
  loaded: boolean,
) {
  const published = useMemo(() => sanitizeLayout(serverLayout), [serverLayout]);
  const [designing, setDesigning] = useState(false);
  const [draft, setDraftRaw] = useState<LobbyLayout>(() => published ?? stockLayout());
  const past = useRef<LobbyLayout[]>([]);
  const future = useRef<LobbyLayout[]>([]);
  const [, bump] = useState(0);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedLayout, setSavedLayout] = useState<LobbyLayout | null>(null);

  // What members see: the last thing published this session, else the server's.
  const live = savedLayout ?? published;

  // Enter Design mode from ?design=1 (the composer lands here) once we know the
  // viewer may design.
  useEffect(() => {
    if (!loaded || !canDesign) return;
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("design") === "1") setDesigning(true);
    } catch {}
  }, [loaded, canDesign]);

  // Starting a session: resume a saved local draft, else start from what's live.
  useEffect(() => {
    if (!designing) return;
    let start: LobbyLayout | null = null;
    try {
      const raw = localStorage.getItem(draftKey(lobbyId));
      if (raw) start = sanitizeLayout(JSON.parse(raw));
    } catch {}
    setDraftRaw(start ?? live ?? stockLayout());
    past.current = [];
    future.current = [];
    bump((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designing, lobbyId]);

  useEffect(() => {
    if (!designing) return;
    try {
      localStorage.setItem(draftKey(lobbyId), JSON.stringify(draft));
    } catch {}
  }, [draft, designing, lobbyId]);

  const setDraft = useCallback((fn: (d: LobbyLayout) => LobbyLayout) => {
    setDraftRaw((d) => {
      const next = fn(d);
      if (next === d) return d;
      past.current.push(d);
      if (past.current.length > 80) past.current.shift();
      future.current = [];
      return next;
    });
    setSaving("idle");
    bump((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setDraftRaw((d) => {
      future.current.push(d);
      return prev;
    });
    bump((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    setDraftRaw((d) => {
      past.current.push(d);
      return next;
    });
    bump((n) => n + 1);
  }, []);

  const dirty = designing && JSON.stringify(draft) !== JSON.stringify(live ?? stockLayout());

  const publish = useCallback(
    async (extra?: { name?: string; description?: string }) => {
      setSaving("saving");
      try {
        const r = await fetch(`${API}/lobbies/${encodeURIComponent(lobbyId)}/admin/design`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            layout: draft,
            ...(draft.theme.accent ? { accentColor: draft.theme.accent } : {}),
            ...(extra || {}),
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || "publish_failed");
        setSavedLayout(draft);
        setSaving("saved");
        try {
          localStorage.removeItem(draftKey(lobbyId));
        } catch {}
        return true;
      } catch {
        setSaving("error");
        return false;
      }
    },
    [draft, lobbyId],
  );

  const discard = useCallback(() => {
    try {
      localStorage.removeItem(draftKey(lobbyId));
    } catch {}
    setDraftRaw(live ?? stockLayout());
    past.current = [];
    future.current = [];
    setSaving("idle");
    bump((n) => n + 1);
  }, [live, lobbyId]);

  // Keyboard: Ctrl/Cmd+Z, Shift+Ctrl+Z / Ctrl+Y, Esc leaves.
  useEffect(() => {
    if (!designing) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [designing, undo, redo]);

  // Flag the document so global CSS can make room for the design panels.
  useEffect(() => {
    const d = document.documentElement;
    if (designing) d.setAttribute("data-weered-designing", "1");
    else d.removeAttribute("data-weered-designing");
    return () => d.removeAttribute("data-weered-designing");
  }, [designing]);

  return {
    designing,
    setDesigning,
    draft,
    setDraft,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    dirty,
    publish,
    discard,
    saving,
    /** The layout to render: the draft while designing, else what's live (null = stock). */
    effective: designing ? draft : live,
  };
}
