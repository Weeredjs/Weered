"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import {
  BrassDivider,
  PAL,
  S,
  SkullIcon,
  WR_FONT_DISPLAY,
  WR_FONT_MONO,
  WR_FONT_SERIF,
  apiFetch,
} from "./WrShared";
import {
  CommunityServer,
  PortRow,
  PublicServer,
  WR_FRAMEWORKS,
  WR_REGIONS_LIST,
} from "./WrBounties";
import { Labeled } from "./WrStreams";

export function PortsOfCallTab() {
  const [registered, setRegistered] = useState<CommunityServer[] | null>(null);
  const [publicServers, setPublicServers] = useState<PublicServer[] | null>(null);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterSlots, setFilterSlots] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        apiFetch("/windrose/servers").catch(() => ({ ok: false })),
        apiFetch("/windrose/public-servers").catch(() => ({ ok: false })),
      ]);
      setRegistered(Array.isArray(r1?.servers) ? r1.servers : []);
      if (r2?.ok) {
        setPublicServers(Array.isArray(r2.servers) ? r2.servers : []);
        setPublicError(null);
      } else {
        setPublicServers([]);
        setPublicError(
          r2?.error === "steam_key_missing"
            ? "Steam discovery disabled"
            : "Steam discovery unavailable",
        );
      }
    } catch {
      setRegistered([]);
      setPublicServers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [reload]);

  const rows: PortRow[] = useMemo(() => {
    const reg = registered || [];
    const pub = publicServers || [];
    const byAddr = new Map<string, PortRow>();

    for (const p of pub) {
      byAddr.set(p.addr.toLowerCase(), {
        key: `pub:${p.addr}`,
        source: "public",
        name: p.name || p.addr,
        addr: p.addr,
        players: p.players,
        maxPlayers: p.maxPlayers,
        passworded: p.passworded,
        secure: p.secure,
      });
    }
    for (const r of reg) {
      const host = String(r.host || "").toLowerCase();
      const existing = host ? byAddr.get(host) : undefined;
      const regLive = Number(
        r.lastState?.players?.length ?? r.lastState?.online ?? r.lastState?.count ?? 0,
      );
      const maxRegistered = Number(r.maxSlots ?? 8);
      if (existing) {
        byAddr.set(host, {
          ...existing,
          source: "both",
          name: r.name || existing.name,
          description: r.description ?? existing.description,
          region: r.region ?? existing.region,
          framework: r.framework ?? existing.framework,
          tags: r.tags && r.tags.length ? r.tags : existing.tags,
          owner: r.owner,
          dashboardUrl: r.dashboardUrl,
          status: r.status,
        });
      } else {
        byAddr.set(`reg:${r.id}`, {
          key: `reg:${r.id}`,
          source: "registered",
          name: r.name,
          addr: r.host,
          description: r.description,
          region: r.region,
          framework: r.framework,
          tags: r.tags,
          players: regLive,
          maxPlayers: maxRegistered,
          owner: r.owner,
          dashboardUrl: r.dashboardUrl,
          status: r.status,
        });
      }
    }
    return Array.from(byAddr.values()).sort((a, b) => {
      const aPin = a.source === "both" || a.source === "registered" ? 1 : 0;
      const bPin = b.source === "both" || b.source === "registered" ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      if ((b.players || 0) !== (a.players || 0)) return (b.players || 0) - (a.players || 0);
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [registered, publicServers]);

  const filtered = rows.filter((s) => {
    if (filterRegion && s.region !== filterRegion) return false;
    if (filterSlots && s.maxPlayers > 0 && s.players >= s.maxPlayers) return false;
    if (query) {
      const q = query.trim().toLowerCase();
      if (q && !`${s.name} ${s.addr} ${(s.tags || []).join(" ")}`.toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  const publicCount = (publicServers || []).length;
  const registeredCount = (registered || []).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...S.card, padding: "18px 22px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...S.label, marginBottom: 4 }}>Community Servers</div>
            <h3
              style={{
                fontFamily: WR_FONT_DISPLAY,
                fontSize: 22,
                color: PAL.brassHi,
                margin: 0,
                letterSpacing: "0.3px",
              }}
            >
              Ports of Call
            </h3>
            <div style={{ fontSize: 13, color: PAL.parchDim, marginTop: 4, fontStyle: "italic" }}>
              Every public Windrose server, auto-discovered from Steam. Owners can list their port
              for richer details — description, tags, dashboard links.
            </div>
          </div>
          <button type="button" style={S.btnPrimary} onClick={() => setShowForm(true)}>
            List Your Port
          </button>
        </div>

        <BrassDivider />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, address, or tag..."
            style={{ ...S.input, width: 260, flex: "0 1 260px" }}
          />
          <span style={{ ...S.label, fontSize: 9 }}>Region</span>
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            style={{ ...S.input, width: "auto" }}
          >
            <option value="">Any</option>
            {WR_REGIONS_LIST.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              color: PAL.parchDim,
              fontSize: 12,
            }}
          >
            <input
              type="checkbox"
              checked={filterSlots}
              onChange={(e) => setFilterSlots(e.target.checked)}
            />
            slots available only
          </label>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: WR_FONT_MONO, fontSize: 10, color: PAL.parchDim }}>
            {filtered.length} of {rows.length}
            {publicError ? (
              <span style={{ color: PAL.blood, marginLeft: 8, opacity: 0.85 }}>
                · {publicError}
              </span>
            ) : (
              <>
                {" "}
                · {publicCount} public · {registeredCount} listed
              </>
            )}
          </span>
        </div>
      </div>

      {showForm && (
        <LinkServerForm
          onClose={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}

      {loading ? (
        <LoadingState label="Scanning the open seas..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="⚓"
          title={rows.length === 0 ? "No ports flying colors yet" : "No ports match that filter"}
          hint={
            rows.length === 0
              ? "No public Windrose servers advertising right now. Run one? Be the first port of call."
              : "Try loosening the filters, or clear the search."
          }
          action={
            <button type="button" style={S.btnPrimary} onClick={() => setShowForm(true)}>
              List Your Port
            </button>
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          {filtered.map((s) => (
            <PortCard key={s.key} row={s} />
          ))}
        </div>
      )}

      <div
        style={{
          ...S.card,
          padding: "14px 18px",
          background: `linear-gradient(180deg, ${PAL.stormMid}50 0%, ${PAL.stormDeep}70 100%)`,
        }}
      >
        <div style={{ ...S.label, marginBottom: 6, fontSize: 9 }}>Running a server?</div>
        <div style={{ fontSize: 13, color: PAL.parchment, lineHeight: 1.55, fontStyle: "italic" }}>
          If you&apos;re on{" "}
          <strong style={{ color: PAL.brassHi, fontStyle: "normal" }}>WindrosePlus</strong>, you can
          drop your query endpoint below and we&apos;ll keep the listing live — player count,
          multipliers, uptime. Never logged in as admin, just read-only polling. Deeper event
          integration (join/leave broadcasts to your lobby) coming as the ecosystem matures.
        </div>
      </div>
    </div>
  );
}

export function PortCard({ row }: { row: PortRow }) {
  const online = row.players || 0;
  const max = row.maxPlayers || 8;
  const pct = max > 0 ? Math.min(100, (online / max) * 100) : 0;
  const full = max > 0 && online >= max;

  const srcPill =
    row.source === "both"
      ? { label: "LISTED · LIVE", color: PAL.brassHi }
      : row.source === "registered"
        ? { label: "LISTED", color: PAL.brass }
        : { label: "PUBLIC", color: "#5db765" };

  const heat = full ? "#a54848" : pct > 75 ? PAL.brassHi : pct > 30 ? PAL.brass : "#5db765";

  return (
    <div
      style={{ ...S.card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 2,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: WR_FONT_DISPLAY,
                fontSize: 17,
                color: PAL.brassHi,
                letterSpacing: "0.3px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {row.name}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 9,
                fontFamily: WR_FONT_MONO,
                color: srcPill.color,
                letterSpacing: "1px",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: srcPill.color,
                  boxShadow: `0 0 6px ${srcPill.color}`,
                }}
              />
              {srcPill.label}
            </span>
            {row.passworded && (
              <span
                style={{
                  fontSize: 9,
                  fontFamily: WR_FONT_MONO,
                  color: PAL.parchDim,
                  letterSpacing: "1px",
                }}
              >
                · LOCKED
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: WR_FONT_MONO,
              fontSize: 11,
              color: PAL.parchDim,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.addr}
          </div>
        </div>
      </div>

      {row.description && (
        <div
          style={{
            fontSize: 12,
            color: PAL.parchment,
            lineHeight: 1.5,
            fontStyle: "italic",
            opacity: 0.88,
          }}
        >
          {row.description.length > 140 ? `${row.description.slice(0, 140)}…` : row.description}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            flex: 1,
            height: 4,
            background: `${PAL.brass}18`,
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${heat}, ${PAL.brassHi})`,
              transition: "width 400ms ease",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: WR_FONT_MONO,
            fontSize: 11,
            color: heat,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {online}
          <span style={{ color: PAL.parchDim }}>/</span>
          {max || "?"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {row.region && (
          <span style={{ ...S.label, fontSize: 9 }}>
            <SkullIcon size={10} /> {row.region}
          </span>
        )}
        {row.framework && (
          <span style={{ ...S.label, fontSize: 9, color: PAL.brass }}>· {row.framework}</span>
        )}
        {(row.tags || []).slice(0, 3).map((t) => (
          <span
            key={t}
            style={{
              fontSize: 10,
              color: PAL.brass,
              fontFamily: WR_FONT_MONO,
              letterSpacing: "0.5px",
            }}
          >
            #{t}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        {row.owner && (
          <span style={{ fontSize: 10, color: PAL.parchDim, fontStyle: "italic" }}>
            listed by {row.owner.name}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
        <a
          href={`steam://connect/${row.addr}`}
          title="Launches Windrose and connects you to this server"
          style={{
            ...S.btnPrimary,
            textDecoration: "none",
            fontSize: 10,
            padding: "6px 14px",
            letterSpacing: "1.5px",
          }}
        >
          Set Sail
        </a>
        {row.dashboardUrl && (
          <a
            href={row.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...S.btn, textDecoration: "none", fontSize: 10, padding: "6px 12px" }}
          >
            Dashboard
          </a>
        )}
        <button
          type="button"
          style={{ ...S.btn, fontSize: 10, padding: "6px 12px" }}
          onClick={() => {
            navigator.clipboard?.writeText?.(row.addr)?.catch(() => {});
          }}
        >
          Copy Address
        </button>
      </div>
    </div>
  );
}

export function LinkServerForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [queryUrl, setQueryUrl] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [framework, setFramework] = useState("WindrosePlus");
  const [maxSlots, setMaxSlots] = useState(8);
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !host.trim() || busy) return;
    setErr(null);
    setBusy(true);
    const tagList = tags
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 10);
    const j = await apiFetch("/windrose/servers", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        host: host.trim(),
        dashboardUrl: dashboardUrl.trim() || undefined,
        queryUrl: queryUrl.trim() || undefined,
        region: region || undefined,
        description: description.trim() || undefined,
        framework: framework || undefined,
        maxSlots,
        tags: tagList,
      }),
    });
    setBusy(false);
    if (j?.ok) onClose();
    else setErr(j?.message || j?.error || "Couldn't list your port. Try again.");
  }

  return (
    <div style={{ ...S.card, padding: "20px 24px", borderColor: PAL.brass }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ ...S.label, marginBottom: 2 }}>Register a server</div>
          <h3
            style={{
              fontFamily: WR_FONT_DISPLAY,
              fontSize: 20,
              color: PAL.brassHi,
              margin: 0,
              letterSpacing: "0.3px",
            }}
          >
            List Your Port
          </h3>
        </div>
        <button
          type="button"
          style={{ ...S.btn, padding: "6px 12px", fontSize: 10 }}
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Labeled label="Server name *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="Kraken's Fury"
            style={S.input}
          />
        </Labeled>
        <Labeled label="Server address *">
          <input
            value={host}
            onChange={(e) => setHost(e.target.value.slice(0, 120))}
            placeholder="play.myserver.com:28000"
            style={S.input}
          />
        </Labeled>
        <Labeled label="Region">
          <select value={region} onChange={(e) => setRegion(e.target.value)} style={S.input}>
            <option value="">Choose...</option>
            {WR_REGIONS_LIST.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Framework">
          <select value={framework} onChange={(e) => setFramework(e.target.value)} style={S.input}>
            {WR_FRAMEWORKS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Max slots">
          <input
            type="number"
            min={1}
            max={64}
            value={maxSlots}
            onChange={(e) => setMaxSlots(Math.max(1, Math.min(64, Number(e.target.value) || 8)))}
            style={S.input}
          />
        </Labeled>
        <Labeled label="Tags (comma-separated)">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="chill, 2xloot, pve-only"
            style={S.input}
          />
        </Labeled>
        <Labeled label="Public dashboard URL (optional)" span={2}>
          <input
            value={dashboardUrl}
            onChange={(e) => setDashboardUrl(e.target.value.slice(0, 300))}
            placeholder="https://play.myserver.com:8080"
            style={S.input}
          />
        </Labeled>
        <Labeled label="Public query/status URL (optional — live polling)" span={2}>
          <input
            value={queryUrl}
            onChange={(e) => setQueryUrl(e.target.value.slice(0, 300))}
            placeholder="https://play.myserver.com:8080/status.json"
            style={S.input}
          />
        </Labeled>
        <Labeled label="Description" span={2}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="Casual PvE, 2x loot weekends, active crew, no-wipe policy for a year. All welcome."
            style={{
              ...S.input,
              minHeight: 70,
              fontFamily: WR_FONT_SERIF,
              fontStyle: "italic",
            }}
          />
        </Labeled>
      </div>

      {err && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            background: "rgba(163,61,61,0.12)",
            border: "1px solid rgba(163,61,61,0.35)",
            borderRadius: 3,
            color: "rgba(232,196,138,0.9)",
            fontSize: 12,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
        <button type="button" style={S.btn} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          style={S.btnPrimary}
          onClick={submit}
          disabled={busy || !name.trim() || !host.trim()}
        >
          {busy ? "Listing…" : "Raise Your Colors"}
        </button>
      </div>
    </div>
  );
}
