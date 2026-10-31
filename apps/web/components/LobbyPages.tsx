"use client";

// A lobby's Pages tab (James 2026-10-31: "clan wiki, build guide, merch page"):
// its own pages, in markdown, listed down the side. Read by everyone who can
// see the lobby; written in Admin → Pages (app/lobby/[id]/admin/PagesTab.tsx).
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Markdown from "./forum/Markdown";
import { pages as api, type LobbyPage, type LobbyPageMeta } from "../lib/lobbyExtras";

export default function LobbyPages({
  lobbyId,
  accent,
  canEdit,
}: {
  lobbyId: string;
  accent: string;
  canEdit: boolean;
}) {
  const [list, setList] = useState<LobbyPageMeta[] | null>(null);
  const [slug, setSlug] = useState<string>("");
  const [page, setPage] = useState<LobbyPage | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let dead = false;
    api
      .list(lobbyId)
      .then((l) => {
        if (dead) return;
        setList(l);
        const want =
          typeof window !== "undefined" ? new URLSearchParams(location.search).get("page") : null;
        setSlug((s) => s || (want && l.some((p) => p.slug === want) ? want : l[0]?.slug || ""));
      })
      .catch(() => !dead && setList([]));
    return () => {
      dead = true;
    };
  }, [lobbyId]);

  useEffect(() => {
    if (!slug) {
      setPage(null);
      return;
    }
    let dead = false;
    setErr("");
    api
      .get(lobbyId, slug)
      .then((p) => !dead && setPage(p))
      .catch(() => !dead && setErr("Couldn't open that page."));
    return () => {
      dead = true;
    };
  }, [lobbyId, slug]);

  if (list === null) return <div style={{ padding: 24, opacity: 0.5 }}>Loading…</div>;

  if (!list.length)
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", opacity: 0.75 }}>
        <div style={{ fontSize: 22, color: accent }}>📖</div>
        <div style={{ fontWeight: 800, marginTop: 6 }}>No pages yet.</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
          {canEdit ? (
            <>
              Write a wiki, a build guide or house rules in{" "}
              <Link
                href={`/lobby/${encodeURIComponent(lobbyId)}/admin?tab=pages`}
                style={{ color: accent }}
              >
                Admin → Pages
              </Link>
              .
            </>
          ) : (
            "When this lobby writes some, they'll be here."
          )}
        </div>
      </div>
    );

  return (
    <div
      className="weered-pages"
      style={{ display: "flex", gap: 18, padding: "16px 18px", minHeight: 0, flex: 1 }}
    >
      <nav
        aria-label="Pages"
        style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}
      >
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setSlug(p.slug);
              try {
                const u = new URL(location.href);
                u.searchParams.set("page", p.slug);
                history.replaceState(null, "", u.toString());
              } catch {}
            }}
            style={{
              textAlign: "left",
              padding: "8px 12px",
              borderRadius: 9,
              border: `1px solid ${p.slug === slug ? `${accent}77` : "transparent"}`,
              background: p.slug === slug ? `${accent}1f` : "transparent",
              color: p.slug === slug ? "#fff" : "rgba(226,232,240,.75)",
              font: "inherit",
              fontSize: 13.5,
              fontWeight: p.slug === slug ? 800 : 600,
              cursor: "pointer",
            }}
          >
            {p.title}
          </button>
        ))}
        {canEdit && (
          <Link
            href={`/lobby/${encodeURIComponent(lobbyId)}/admin?tab=pages`}
            style={{ marginTop: 8, fontSize: 12, color: accent, padding: "0 12px" }}
          >
            ✎ Edit pages
          </Link>
        )}
      </nav>
      <article
        style={{
          flex: 1,
          minWidth: 0,
          padding: "18px 22px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,.08)",
          background: "rgba(10,10,16,.55)",
          overflow: "auto",
        }}
      >
        {err && <div style={{ color: "#fca5a5" }}>{err}</div>}
        {page && (
          <>
            <h1 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 900 }}>{page.title}</h1>
            <Markdown text={page.body} style={{ fontSize: 14.5, color: "rgba(229,231,235,.88)" }} />
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 18 }}>
              Updated {new Date(page.updatedAt).toLocaleDateString()}
            </div>
          </>
        )}
      </article>
      <style>{`@media (max-width: 760px) { .weered-pages { flex-direction: column; } .weered-pages > nav { width: auto !important; flex-direction: row !important; flex-wrap: wrap; } }`}</style>
    </div>
  );
}
