"use client";

// Admin → Automations (James 2026-10-31): scheduled posts in the lobby's chat
// ("every Tuesday, post the reset and ping the raid team") and hookups to other
// sites ("post here when our YouTube uploads, or when one of us goes live").
// Described, then confirmed; the API runs them every minute
// (api lib/lobbyAutomations.ts) in the host's voice, or Weered's.
import React, { useCallback, useEffect, useState } from "react";
import { LobbyData, S } from "./shared";
import DescribeBox from "../../../../components/build/DescribeBox";
import Proposal from "../../../../components/build/Proposal";
import { describeJob } from "../../../../lib/aiBuild";
import {
  automations as api,
  cadenceText,
  extrasErrorText,
  type Automation,
  type FeedSpec,
  type PostSpec,
} from "../../../../lib/lobbyExtras";

const PING: Record<number, string> = {
  0: "No ping",
  1: "Pings every member",
  2: "Pings trusted and up",
  3: "Pings moderators and up",
  4: "Pings admins",
  5: "Pings the owner",
};
const SOURCE: Record<string, string> = {
  youtube: "YouTube uploads",
  twitch: "Twitch goes live",
  rss: "A site's feed",
};

const when = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export function AutomationsTab({ lobby }: { lobby: LobbyData }) {
  const accent = lobby.accentColor || "#7c3aed";
  const [rows, setRows] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<PostSpec | null>(null);
  const [feed, setFeed] = useState<FeedSpec | null>(null);
  const [feedNeed, setFeedNeed] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api
      .list(lobby.id)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lobby.id]);
  useEffect(() => load(), [load]);

  async function add(kind: "post" | "feed", spec: PostSpec | FeedSpec) {
    setBusy(true);
    setErr("");
    try {
      await api.add(lobby.id, kind, spec);
      if (kind === "post") setPost(null);
      else setFeed(null);
      setMsg(kind === "post" ? "Scheduled." : "Hooked up. It checks every few minutes.");
      load();
    } catch (e) {
      setErr(extrasErrorText(e));
    }
    setBusy(false);
  }

  async function toggle(a: Automation) {
    try {
      await api.update(lobby.id, a.id, { active: !a.active });
      load();
    } catch (e) {
      setMsg(extrasErrorText(e));
    }
  }

  async function remove(a: Automation) {
    try {
      await api.remove(lobby.id, a.id);
      load();
    } catch (e) {
      setMsg(extrasErrorText(e));
    }
  }

  const posts = rows.filter((r) => r.kind === "post");
  const feeds = rows.filter((r) => r.kind === "feed");

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={S.sectionTitle}>Scheduled posts</div>
      <div style={{ fontSize: 12, opacity: 0.6, margin: "-4px 0 12px", lineHeight: 1.5 }}>
        Messages the lobby&apos;s chat gets on a schedule, from your host (Admin → Host) or from
        Weered. They can ping members too.
      </div>
      <DescribeBox
        kind="post"
        accent={accent}
        className="db-in-tab"
        label="Describe a scheduled post"
        placeholder="Every Tuesday at 1pm, post the weekly reset and ping the raid team"
        onBuild={async (prompt) => {
          const j = await describeJob<PostSpec>("post", prompt, { lobbyId: lobby.id });
          setPost(j.result);
          setErr("");
          return { summary: j.summary || "Here it is." };
        }}
      />
      {post && (
        <Proposal
          accent={accent}
          title="Scheduled post"
          action="Schedule it"
          busy={busy}
          error={err}
          onAction={() => add("post", post)}
          onDismiss={() => setPost(null)}
        >
          <dl>
            <dt>When</dt>
            <dd>
              {cadenceText(post)} ({post.tz})
            </dd>
            <dt>Posts</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{post.message}</dd>
            <dt>Ping</dt>
            <dd>{PING[post.pingLevel] || PING[0]}</dd>
          </dl>
        </Proposal>
      )}
      {!loading && posts.length === 0 && (
        <div style={{ fontSize: 12.5, opacity: 0.45, padding: "6px 0 14px" }}>
          Nothing scheduled yet.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
        {posts.map((a) => {
          const s = a.spec as PostSpec;
          return (
            <div key={a.id} style={{ ...S.card, opacity: a.active ? 1 : 0.55 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{cadenceText(s)}</div>
                  <div
                    style={{ fontSize: 12.5, opacity: 0.8, marginTop: 3, whiteSpace: "pre-wrap" }}
                  >
                    {s.message}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 5 }}>
                    {PING[s.pingLevel] || PING[0]}
                    {a.active && a.nextRunAt
                      ? ` · next ${when(a.nextRunAt)}`
                      : a.active
                        ? ""
                        : " · paused"}
                    {a.lastResult ? ` · last: ${a.lastResult}` : ""}
                  </div>
                </div>
                <button style={S.btn} onClick={() => toggle(a)}>
                  {a.active ? "Pause" : "Resume"}
                </button>
                <button style={S.danger} onClick={() => remove(a)}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={S.sectionTitle}>Hookups</div>
      <div style={{ fontSize: 12, opacity: 0.6, margin: "-4px 0 12px", lineHeight: 1.5 }}>
        Post in the lobby&apos;s chat when a YouTube channel uploads, a Twitch channel goes live, or
        a site&apos;s feed has something new. Give the channel or the feed&apos;s address.
      </div>
      <DescribeBox
        kind="feed"
        accent={accent}
        className="db-in-tab"
        label="Describe a hookup"
        placeholder="Post here when youtube.com/@ourclan uploads"
        onBuild={async (prompt) => {
          const j = await describeJob<FeedSpec | null>("feed", prompt, { lobbyId: lobby.id });
          setFeed(j.result);
          setFeedNeed(
            j.result
              ? ""
              : j.summary || "Give the channel's link, the Twitch name or the feed's address.",
          );
          setErr("");
          return { summary: j.result ? j.summary || "Here it is." : "Need one more thing." };
        }}
      />
      {feedNeed && !feed && (
        <div style={{ fontSize: 12.5, color: "rgb(253,230,138)", margin: "-6px 0 14px" }}>
          {feedNeed}
        </div>
      )}
      {feed && (
        <Proposal
          accent={accent}
          title={SOURCE[feed.source] || "Hookup"}
          action="Hook it up"
          busy={busy}
          error={err}
          note="The first check only notes what's already there, so nothing old floods the chat."
          onAction={() => add("feed", feed)}
          onDismiss={() => setFeed(null)}
        >
          <dl>
            <dt>Watches</dt>
            <dd>{feed.target}</dd>
            <dt>Posts</dt>
            <dd>{feed.message}</dd>
          </dl>
        </Proposal>
      )}
      {!loading && feeds.length === 0 && (
        <div style={{ fontSize: 12.5, opacity: 0.45, padding: "6px 0 14px" }}>No hookups yet.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {feeds.map((a) => {
          const s = a.spec as FeedSpec;
          return (
            <div key={a.id} style={{ ...S.card, opacity: a.active ? 1 : 0.55 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {SOURCE[s.source] || s.source}
                  </div>
                  <div
                    style={{ fontSize: 12.5, opacity: 0.8, marginTop: 3, overflowWrap: "anywhere" }}
                  >
                    {s.target}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 5 }}>
                    {s.message}
                    {a.lastResult
                      ? ` · last: ${a.lastResult}`
                      : a.active
                        ? " · first check soon"
                        : ""}
                    {a.active ? "" : " · paused"}
                  </div>
                </div>
                <button style={S.btn} onClick={() => toggle(a)}>
                  {a.active ? "Pause" : "Resume"}
                </button>
                <button style={S.danger} onClick={() => remove(a)}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {msg && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>{msg}</div>}
    </div>
  );
}
