"use client";

// Design your Weered, the inspector: where the selected section or block
// lives, its order, its settings, and remove / switch off.
import React, { useEffect, useMemo, useState } from "react";
import { IconBtn, chip, input, label } from "../lobby-design/designerKit";
import {
  BLOCK_META,
  CORE_META,
  SHELL_MAX_BLOCKS,
  blockCount,
  REGION_LABEL,
  canPlace,
  entryIndex,
  findItem,
  hideItem,
  isCore,
  newShellBlock,
  nudgeItem,
  patchBlock,
  placeItem,
  type ShellBlock,
  type ShellLayout,
  type ShellRegion,
} from "../../lib/shellLayout";
import { SIZE_LABEL, type BlockSize } from "../../lib/lobbyLayout";
import { editLayout, selectItem } from "../../lib/shellDesign";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";

/** Lobbies to read a block from: the viewer's favourites first, then the
 *  directory. Empty value = Weered's own (The Lobby, or the site-wide board). */
function LobbyPicker({
  value,
  onChange,
  none,
}: {
  value: string;
  onChange: (id: string) => void;
  none: string;
}) {
  const [all, setAll] = useState<{ id: string; name: string }[]>([]);
  const favs = useMemo(() => {
    try {
      const v = JSON.parse(localStorage.getItem("weered:favs:v1") || "[]");
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }, []);
  useEffect(() => {
    fetch(`${API}/lobbies`)
      .then((r) => r.json())
      .then((j) =>
        setAll(
          (Array.isArray(j?.lobbies) ? j.lobbies : [])
            .filter((l: any) => l?.id && !String(l.id).startsWith("r/"))
            .map((l: any) => ({ id: String(l.id), name: String(l.name || l.id) })),
        ),
      )
      .catch(() => {});
  }, []);
  const byId = new Map(all.map((l) => [l.id, l]));
  const mine = favs.map((id) => byId.get(id)).filter(Boolean) as { id: string; name: string }[];
  const rest = all.filter((l) => !favs.includes(l.id));
  const known = !value || byId.has(value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={input}
      aria-label="Which lobby"
    >
      <option value="">{none}</option>
      {!known && <option value={value}>{value}</option>}
      {mine.length > 0 && (
        <optgroup label="Your favourites">
          {mine.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="All lobbies">
        {rest.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function BlockFields({ block, accent }: { block: ShellBlock; accent: string }) {
  const pr = block.props;
  const setProp = (k: string, v: any) =>
    editLayout(
      (l) => patchBlock(l, block.id, (b) => ({ ...b, props: { ...b.props, [k]: v } })),
      `${block.id}:${k}`,
    );
  const field = (k: string, lbl: string, ph = "", multiline = false) => (
    <div>
      <div style={label}>{lbl}</div>
      {multiline ? (
        <textarea
          value={pr[k] ?? ""}
          placeholder={ph}
          rows={4}
          onChange={(e) => setProp(k, e.target.value)}
          style={{ ...input, resize: "vertical" }}
          aria-label={lbl}
        />
      ) : (
        <input
          value={pr[k] ?? ""}
          placeholder={ph}
          onChange={(e) => setProp(k, e.target.value)}
          style={input}
          aria-label={lbl}
        />
      )}
    </div>
  );
  const limit = (
    <>
      <div style={label}>Show up to · {pr.limit || 4}</div>
      <input
        type="range"
        min={1}
        max={12}
        value={pr.limit || 4}
        onChange={(e) => setProp("limit", Number(e.target.value))}
        style={{ width: "100%", accentColor: accent }}
        aria-label="How many to show"
      />
    </>
  );

  switch (block.type) {
    case "welcome":
      return (
        <>
          {field("title", "Headline", "Welcome back")}
          {field("body", "A line or two", "", true)}
          {field("cta", "Button (optional)", "Jump in")}
          {field("href", "Button goes to", "https://… or /lobby/your-lobby")}
          <div style={label}>Align</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["left", "center"] as const).map((a) => (
              <button
                key={a}
                type="button"
                style={{ ...chip((pr.align || "left") === a, accent), flex: 1 }}
                onClick={() => setProp("align", a)}
              >
                {a === "left" ? "Left" : "Centre"}
              </button>
            ))}
          </div>
        </>
      );
    case "rules":
      return (
        <>
          {field("title", "Title", "This week")}
          {field("body", "One per line", "", true)}
        </>
      );
    case "countdown":
      return (
        <>
          {field("label", "What's coming", "Season finale")}
          <div style={label}>When</div>
          <input
            type="datetime-local"
            value={pr.at ? toLocalInput(pr.at) : ""}
            onChange={(e) =>
              setProp("at", e.target.value ? new Date(e.target.value).toISOString() : "")
            }
            style={input}
            aria-label="When"
          />
        </>
      );
    case "image":
      return (
        <>
          {field("url", "Image link (https)", "https://")}
          {field("caption", "Caption")}
          {field("link", "Clicking it opens (optional)", "https://")}
        </>
      );
    case "stream":
      return field("channel", "Twitch channel", "e.g. timbosdojo");
    case "video":
    case "music":
      return (
        <>
          {field(
            "url",
            block.type === "music" ? "Spotify or YouTube playlist link" : "YouTube link",
            "https://",
          )}
          {field("title", "Title (optional)")}
        </>
      );
    case "links":
      return (
        <>
          {field("title", "Title", "Links")}
          <div style={label}>Links</div>
          <div style={{ display: "grid", gap: 6 }}>
            {(pr.items || []).map((it: any, i: number) => (
              <div
                key={i}
                style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 4 }}
              >
                <input
                  value={it.label}
                  placeholder="Label"
                  onChange={(e) =>
                    setProp(
                      "items",
                      pr.items.map((x: any, j: number) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                  style={{ ...input, padding: "6px 8px" }}
                  aria-label="Link label"
                />
                <input
                  value={it.url}
                  placeholder="https://"
                  onChange={(e) =>
                    setProp(
                      "items",
                      pr.items.map((x: any, j: number) =>
                        j === i ? { ...x, url: e.target.value } : x,
                      ),
                    )
                  }
                  style={{ ...input, padding: "6px 8px" }}
                  aria-label="Link address"
                />
                <button
                  type="button"
                  onClick={() =>
                    setProp(
                      "items",
                      pr.items.filter((_: any, j: number) => j !== i),
                    )
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                  aria-label="Remove link"
                >
                  ✕
                </button>
              </div>
            ))}
            {(pr.items || []).length < 12 && (
              <button
                type="button"
                style={chip(false, accent)}
                onClick={() =>
                  setProp("items", [...(pr.items || []), { label: "", url: "https://" }])
                }
              >
                + Add link
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>
            Links need https:// to show.
          </div>
        </>
      );
    case "rooms":
    case "events":
    case "stats":
    case "feed":
      return (
        <>
          <div style={label}>From</div>
          <LobbyPicker
            value={pr.lobbyId || ""}
            onChange={(id) => setProp("lobbyId", id)}
            none={block.type === "feed" ? "All of Weered" : "The Lobby (Weered's own)"}
          />
          {field("title", "Heading (optional)")}
          {block.type !== "stats" && limit}
        </>
      );
    case "requests":
      return (
        <>
          <div style={label}>Board</div>
          <LobbyPicker
            value={pr.lobbyId || ""}
            onChange={(id) => setProp("lobbyId", id)}
            none="Weered's request board"
          />
          {field("title", "Heading (optional)")}
          {limit}
        </>
      );
  }
  return null;
}

export default function ShellInspector({
  accent,
  layout,
  selected,
}: {
  accent: string;
  layout: ShellLayout;
  selected: string;
}) {
  const found = findItem(layout, selected);
  if (!found || found.region === "hidden") return null;
  const { item, region, index } = found;
  const core = isCore(item);
  const meta = core
    ? CORE_META[item]
    : {
        name: BLOCK_META[item.type].name,
        blurb: BLOCK_META[item.type].blurb,
        icon: BLOCK_META[item.type].icon,
      };
  const locked = core && !!CORE_META[item].locked;
  const count = layout[region].length;

  return (
    <div>
      <div
        style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8 }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            {core ? "Section" : "Block"} · {REGION_LABEL[region]}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>
            {meta.icon} {meta.name}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{meta.blurb}</div>
        </div>
        <IconBtn title="Done" onClick={() => selectItem(null)}>
          ✕
        </IconBtn>
      </div>

      <div style={label}>Lives in</div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["left", "home", "right"] as ShellRegion[]).map((r) => {
          const ok = canPlace(item, r);
          return (
            <button
              key={r}
              type="button"
              disabled={!ok}
              title={ok ? `Move to the ${REGION_LABEL[r].toLowerCase()}` : "Can't go there"}
              style={{
                ...chip(region === r, accent),
                flex: 1,
                padding: "7px 4px",
                opacity: ok ? 1 : 0.3,
                cursor: ok ? "pointer" : "not-allowed",
              }}
              onClick={() => {
                if (ok && r !== region) editLayout((l) => placeItem(l, item, r, entryIndex(l, r)));
              }}
            >
              {r === "left" ? "Left" : r === "home" ? "Home" : "Right"}
            </button>
          );
        })}
      </div>
      {core && CORE_META[item].regions.length === 1 && CORE_META[item].regions[0] === "left" && (
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>
          Built into the left sidebar. Move it up or down there.
        </div>
      )}

      {!core && region === "home" && (
        <>
          <div style={label}>Width</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["s", "m", "l", "full"] as BlockSize[]).map((sz) => (
              <button
                key={sz}
                type="button"
                style={{ ...chip(item.size === sz, accent), flex: 1, padding: "7px 2px" }}
                onClick={() =>
                  editLayout((l) => patchBlock(l, item.id, (b) => ({ ...b, size: sz })))
                }
              >
                {SIZE_LABEL[sz]}
              </button>
            ))}
          </div>
        </>
      )}

      {!core && <BlockFields block={item} accent={accent} />}

      <div style={{ display: "flex", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
        <button
          type="button"
          style={chip(false, accent)}
          disabled={index <= 0}
          onClick={() => editLayout((l) => nudgeItem(l, selected, -1))}
        >
          ↑ Earlier
        </button>
        <button
          type="button"
          style={chip(false, accent)}
          disabled={index >= count - 1}
          onClick={() => editLayout((l) => nudgeItem(l, selected, 1))}
        >
          ↓ Later
        </button>
        {!core && (
          <button
            type="button"
            style={chip(false, accent)}
            disabled={blockCount(layout) >= SHELL_MAX_BLOCKS}
            title={
              blockCount(layout) >= SHELL_MAX_BLOCKS
                ? `A layout holds ${SHELL_MAX_BLOCKS} blocks`
                : "Add a copy right after this one"
            }
            onClick={() => {
              if (blockCount(layout) >= SHELL_MAX_BLOCKS) return;
              const copy = newShellBlock(item.type, { ...item.props });
              copy.size = item.size;
              editLayout((l) => placeItem(l, copy, region, index + 1));
              selectItem(copy.id);
            }}
          >
            Duplicate
          </button>
        )}
        {!locked && (
          <button
            type="button"
            style={{ ...chip(false, accent), borderColor: "rgba(239,68,68,.4)", color: "#fca5a5" }}
            onClick={() => {
              editLayout((l) => hideItem(l, selected));
              selectItem(null);
            }}
          >
            {core ? "Switch off" : "Remove"}
          </button>
        )}
      </div>
      {locked && (
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>
          {item === "upgrade" ? "Shown to free accounts; it can move but not go." : "Always on."}
        </div>
      )}
      {core && !locked && (
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>
          Switched-off sections wait under Sections to come back.
        </div>
      )}
    </div>
  );
}
