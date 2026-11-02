"use client";

// Design mode's inspector for a custom block or game (James 2026-10-31: "Custom
// blocks: jukebox, guestbook, poll, tier list, loot tracker, raid planner,
// scoreboard" and "Mini-games in a room: trivia night, bingo, dice, party
// game"). Describe it, try it right here (its data stays in memory until it's
// saved), then save it to the lobby; Publish puts it live like any other block.
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import DescribeBox from "../build/DescribeBox";
import { describeJob } from "../../lib/aiBuild";
import { blocks as api, extrasErrorText, type CodeResult } from "../../lib/lobbyExtras";
import type { Block } from "../../lib/lobbyLayout";
import CustomBlockFrame from "./CustomBlockFrame";
import { chip, input, label } from "./designerKit";

const PLAN_NOTE =
  "AI-built blocks and games come with the lobby owner's Felon plan ($14 a month) and up.";

type Built = { title: string; height: "s" | "m" | "l"; code: string };

const EXAMPLES = {
  block: [
    "A poll: best raid boss, one vote each",
    "A guestbook people sign",
    "A loot tracker for our raid",
  ],
  game: [
    "Trivia night: 20 questions about our game",
    "Bingo with callouts from our streams",
    "A dice duel",
  ],
};

export default function CustomBlockBuilder({
  lobbyId,
  accent,
  block,
  onPatch,
}: {
  lobbyId: string;
  accent: string;
  block: Block;
  onPatch: (fn: (b: Block) => Block) => void;
}) {
  const pr = block.props || {};
  const kind: "block" | "game" = pr.kind === "game" ? "game" : "block";
  const [built, setBuilt] = useState<Built | null>(null);
  const [savedCode, setSavedCode] = useState("");
  const [canWrite, setCanWrite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [big, setBig] = useState(false);

  useEffect(() => {
    api
      .list(lobbyId)
      .then((j) => setCanWrite(!!j.canWrite))
      .catch(() => {});
  }, [lobbyId]);

  useEffect(() => {
    setBuilt(null);
    setMsg("");
    if (!pr.customId) {
      setSavedCode("");
      return;
    }
    api
      .get(lobbyId, pr.customId)
      .then((b) => setSavedCode(b.code))
      .catch(() => setSavedCode(""));
    // A different block selected, or this one saved under a new id.
  }, [lobbyId, block.id, pr.customId]);

  const setProp = (k: string, v: unknown) =>
    onPatch((b) => ({ ...b, props: { ...b.props, [k]: v } }));

  async function save() {
    if (!built) return;
    setBusy(true);
    setMsg("");
    try {
      const saved = pr.customId
        ? await api.update(lobbyId, pr.customId, built)
        : await api.add(lobbyId, { kind, ...built });
      onPatch((b) => ({
        ...b,
        size: kind === "game" ? "full" : b.size,
        props: { ...b.props, customId: saved.id, title: saved.title, height: saved.height, kind },
      }));
      setSavedCode(saved.code);
      setBuilt(null);
      setMsg("Saved. Publish to put it live.");
    } catch (e) {
      setMsg(extrasErrorText(e));
    }
    setBusy(false);
  }

  const showing = built?.code || "";
  const frameHeight = (built?.height || pr.height || "m") as "s" | "m" | "l";

  return (
    <div>
      <div style={label}>It&apos;s a</div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["block", "game"] as const).map((k) => (
          <button
            key={k}
            style={{ ...chip(kind === k, accent), flex: 1 }}
            disabled={!!pr.customId && kind !== k}
            onClick={() => setProp("kind", k)}
          >
            {k === "block" ? "Block" : "Game for everyone here"}
          </button>
        ))}
      </div>

      {/* AI-built blocks and games are custom modules: the lobby owner's Felon
          plan and up (api lib/moduleGate.ts, 2026-11-02). */}
      {!canWrite && !pr.customId && (
        <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 12, lineHeight: 1.5 }}>
          {PLAN_NOTE}
        </div>
      )}
      <div style={{ marginTop: 12, display: canWrite || pr.customId ? undefined : "none" }}>
        <DescribeBox
          kind={kind}
          accent={accent}
          label={pr.customId ? "Change it" : "Describe it"}
          placeholder={kind === "game" ? EXAMPLES.game[0] : EXAMPLES.block[0]}
          examples={pr.customId ? undefined : EXAMPLES[kind].slice(1)}
          onBuild={async (prompt) => {
            const j = await describeJob<CodeResult>(kind, prompt, {
              lobbyId,
              extra: { code: built?.code || savedCode || "" },
            });
            const r = j.result;
            if (!r || !r.ok)
              return { summary: r && !r.ok ? r.reason : "That one didn't come out. Try again." };
            setBuilt({ title: r.title, height: r.height, code: r.code });
            setMsg("");
            return { summary: `${j.summary || "Here it is."} Try it below, then save it.` };
          }}
        />
      </div>

      {showing && (
        <>
          <div style={label}>Try it</div>
          <div
            style={{
              borderRadius: 12,
              border: `1px solid ${accent}55`,
              background: "rgba(10,10,16,.7)",
              overflow: "hidden",
            }}
          >
            <CustomBlockFrame
              lobbyId={lobbyId}
              code={showing}
              height={frameHeight}
              accent={accent}
            />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <button
              style={{ ...chip(true, accent), flex: 1 }}
              onClick={save}
              disabled={busy || !canWrite}
              title={canWrite ? "Save it to this lobby" : PLAN_NOTE}
            >
              {busy ? "Saving…" : pr.customId ? "Save the change" : "Save it to the lobby"}
            </button>
            <button style={chip(false, accent)} onClick={() => setBig(true)}>
              Bigger
            </button>
            <button style={chip(false, accent)} onClick={() => setBuilt(null)}>
              Not this
            </button>
          </div>
          {!canWrite && (
            <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 6 }}>{PLAN_NOTE}</div>
          )}
        </>
      )}
      {msg && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>{msg}</div>}

      {pr.customId && (
        <>
          <div style={label}>Title</div>
          <input
            value={pr.title || ""}
            maxLength={60}
            onChange={(e) => setProp("title", e.target.value)}
            style={input}
            aria-label="Title"
          />
          <div style={label}>Height</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["s", "m", "l"] as const).map((h) => (
              <button
                key={h}
                style={{ ...chip((pr.height || "m") === h, accent), flex: 1 }}
                onClick={() => setProp("height", h)}
              >
                {h === "s" ? "Short" : h === "m" ? "Medium" : "Tall"}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 11, opacity: 0.55, marginTop: 10, lineHeight: 1.45 }}>
        It runs in a sealed box: no outside links, no network, nothing that can reach anyone&apos;s
        account. What it saves (votes, scores, entries) is kept for everyone.
      </div>

      {big &&
        showing &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) setBig(false);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              e.stopPropagation();
              setBig(false);
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100000,
              background: "rgba(0,0,0,.6)",
              display: "grid",
              placeItems: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                width: "min(820px, 100%)",
                maxHeight: "90vh",
                overflow: "auto",
                borderRadius: 16,
                border: `1px solid ${accent}66`,
                background: "rgba(12,11,20,.98)",
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px" }}
              >
                <b>{built?.title || pr.title || "Preview"}</b>
                <button style={chip(false, accent)} onClick={() => setBig(false)}>
                  Close
                </button>
              </div>
              <CustomBlockFrame
                lobbyId={lobbyId}
                code={showing}
                height={frameHeight === "s" ? "m" : frameHeight}
                accent={accent}
              />
              <div style={{ height: 8 }} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
