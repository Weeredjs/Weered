"use client";

// Admin → Pages: the lobby's own pages (James 2026-10-31: "clan wiki, build
// guide, merch page"), in markdown. Describe one and it's written, with blanks
// in [brackets] for what only you know; edit, preview, save. Members read them
// in the lobby's Pages tab (components/LobbyPages.tsx).
import React, { useCallback, useEffect, useState } from "react";
import { LobbyData, S, apiFetch } from "./shared";
import DescribeBox from "../../../../components/build/DescribeBox";
import Markdown from "../../../../components/forum/Markdown";
import { describeJob } from "../../../../lib/aiBuild";
import { extrasErrorText, pages as api, type LobbyPageMeta } from "../../../../lib/lobbyExtras";
import { sanitizeLayout } from "../../../../lib/lobbyLayout";

type Draft = { id: string | null; title: string; body: string };
const BLANK: Draft = { id: null, title: "", body: "" };

export function PagesTab({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const accent = lobby.accentColor || "#7c3aed";
  const [list, setList] = useState<LobbyPageMeta[]>([]);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [saved, setSaved] = useState<string>(JSON.stringify(BLANK));
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api
      .list(lobby.id)
      .then(setList)
      .catch(() => {});
  }, [lobby.id]);
  useEffect(() => load(), [load]);

  const dirty = JSON.stringify(draft) !== saved;

  async function open(p: LobbyPageMeta) {
    if (dirty && !confirm("Drop the unsaved changes to this page?")) return;
    try {
      const full = await api.get(lobby.id, p.slug);
      const d = { id: full.id, title: full.title, body: full.body };
      setDraft(d);
      setSaved(JSON.stringify(d));
      setMsg("");
      setPreview(false);
    } catch (e) {
      setMsg(extrasErrorText(e));
    }
  }

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const p = draft.id
        ? await api.update(lobby.id, draft.id, { title: draft.title, body: draft.body })
        : await api.add(lobby.id, { title: draft.title, body: draft.body });
      const d = { id: p.id, title: p.title, body: p.body };
      const first = !draft.id && list.length === 0;
      setDraft(d);
      setSaved(JSON.stringify(d));
      setMsg("Saved.");
      load();
      // The first page puts the Pages tab on a designed lobby (hide it again
      // with the switch above).
      if (first && layout && !tabShown) await showTab(true);
    } catch (e) {
      setMsg(extrasErrorText(e));
    }
    setBusy(false);
  }

  async function remove() {
    if (!draft.id || !confirm(`Delete "${draft.title}"?`)) return;
    try {
      await api.remove(lobby.id, draft.id);
      setDraft(BLANK);
      setSaved(JSON.stringify(BLANK));
      setMsg("Deleted.");
      load();
    } catch (e) {
      setMsg(extrasErrorText(e));
    }
  }

  async function move(p: LobbyPageMeta, dir: -1 | 1) {
    const i = list.findIndex((x) => x.id === p.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    await Promise.all(
      next.map((x, k) => (x.order !== k ? api.update(lobby.id, x.id, { order: k }) : null)),
    ).catch(() => {});
    load();
  }

  // The Pages tab on the lobby: shown automatically on a lobby nobody has
  // designed, once it has pages; a designed lobby shows it when its layout does.
  const layout = sanitizeLayout(lobby.layout);
  const tab = layout?.tabs.find((t) => t.id === "pages");
  const tabShown = layout ? !!tab && !tab.hidden : list.length > 0;
  async function showTab(show: boolean) {
    if (!layout) return;
    const next = {
      ...layout,
      tabs: layout.tabs.map((t) => (t.id === "pages" ? { ...t, hidden: !show } : t)),
    };
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/design`, {
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify({ layout: next }),
    });
    setMsg(
      j.ok
        ? show
          ? "The Pages tab is on your lobby."
          : "The Pages tab is hidden."
        : "Couldn't change the tab.",
    );
    if (j.ok) onRefresh();
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={S.sectionTitle}>Pages</div>
      <div style={{ fontSize: 12, opacity: 0.6, margin: "-4px 0 12px", lineHeight: 1.5 }}>
        Your lobby&apos;s own pages: a wiki, a build guide, house rules, a merch page. Members read
        them in the Pages tab.{" "}
        {layout ? (
          <>
            The tab is {tabShown ? "showing" : "hidden"}.{" "}
            <button
              type="button"
              style={{ ...S.btn, padding: "2px 10px" }}
              onClick={() => showTab(!tabShown)}
            >
              {tabShown ? "Hide it" : "Show it"}
            </button>
          </>
        ) : (
          "The tab shows once there's a page."
        )}
      </div>

      <DescribeBox
        kind="page"
        accent={accent}
        className="db-in-tab"
        label={draft.id ? "Change this page by describing it" : "Describe a page"}
        placeholder={
          draft.id
            ? "Add a section on raid roles, shorter intro"
            : "A build guide for new players: best weapons, armor, where to farm"
        }
        onBuild={async (prompt) => {
          const j = await describeJob<{ title: string; body: string }>("page", prompt, {
            lobbyId: lobby.id,
            extra: draft.id || draft.body ? { title: draft.title, body: draft.body } : {},
          });
          const before = draft;
          setDraft({
            id: draft.id,
            title: draft.id ? draft.title || j.result.title : j.result.title,
            body: j.result.body,
          });
          setPreview(true);
          setMsg("");
          return {
            summary: `${j.summary || "Here it is."} Fill in anything in [brackets], then save.`,
            undo: () => setDraft(before),
          };
        }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "200px minmax(0,1fr)", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            type="button"
            style={{ ...S.btnPri, textAlign: "left" }}
            onClick={() => {
              if (dirty && !confirm("Drop the unsaved changes to this page?")) return;
              setDraft(BLANK);
              setSaved(JSON.stringify(BLANK));
              setPreview(false);
            }}
          >
            + New page
          </button>
          {list.map((p, i) => (
            <div key={p.id} style={{ display: "flex", gap: 2, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => open(p)}
                style={{
                  ...S.btn,
                  flex: 1,
                  textAlign: "left",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  border: `1px solid ${draft.id === p.id ? `${accent}88` : "rgba(255,255,255,.10)"}`,
                  background: draft.id === p.id ? `${accent}22` : undefined,
                }}
              >
                {p.title}
              </button>
              <button
                type="button"
                style={{ ...S.btn, padding: "6px 6px" }}
                disabled={i === 0}
                onClick={() => move(p, -1)}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                style={{ ...S.btn, padding: "6px 6px" }}
                disabled={i === list.length - 1}
                onClick={() => move(p, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
          ))}
        </div>

        <div>
          <div style={S.label}>Title</div>
          <input
            style={S.input}
            value={draft.title}
            maxLength={80}
            placeholder="Build guide"
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <div style={{ display: "flex", gap: 6, margin: "12px 0 6px" }}>
            <button
              type="button"
              style={!preview ? S.btnPri : S.btn}
              onClick={() => setPreview(false)}
            >
              Write
            </button>
            <button
              type="button"
              style={preview ? S.btnPri : S.btn}
              onClick={() => setPreview(true)}
            >
              Preview
            </button>
            <span style={{ fontSize: 11, opacity: 0.45, alignSelf: "center" }}>
              # Heading · **bold** · - list · [text](https://link)
            </span>
          </div>
          {preview ? (
            <div style={{ ...S.card, minHeight: 260 }}>
              <Markdown text={draft.body || "_Nothing yet._"} style={{ fontSize: 14 }} />
            </div>
          ) : (
            <textarea
              style={{
                ...S.input,
                minHeight: 320,
                resize: "vertical",
                fontFamily: "ui-monospace, monospace",
              }}
              value={draft.body}
              maxLength={20000}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            />
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
            <button
              style={{ ...S.btnPri, padding: "8px 20px" }}
              onClick={save}
              disabled={busy || !dirty || !draft.title.trim()}
            >
              {busy ? "Saving…" : draft.id ? "Save the page" : "Publish the page"}
            </button>
            {draft.id && (
              <button style={S.danger} onClick={remove}>
                Delete
              </button>
            )}
            {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
