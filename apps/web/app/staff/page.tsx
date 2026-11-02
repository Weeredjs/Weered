"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useWeered } from "../../components/WeeredProvider";
import LobbyChatPanel from "../../components/LobbyChatPanel";
import AnalyticsTab from "../../components/AnalyticsTab";
import { GlobalRole, NAV_GROUPS, NAV_ITEMS, NavId, apiFetch, canSeeNav } from "./shared";
import { TodayTab, type TodayData } from "./TodayTab";
import { PermissionsTab } from "./PermissionsTab";
import { OpsPresence } from "./OpsPresence";
import { UsersTab } from "./UsersTab";
import { SubsTab } from "./SubsTab";
import { RoomsTab } from "./RoomsTab";
import { LobbiesTab } from "./LobbiesTab";
import { AppealsTab } from "./AppealsTab";
import { BugsTab } from "./BugsTab";
import { ReportsTab } from "./ReportsTab";
import { AuditTab } from "./AuditTab";
import { BroadcastTab } from "./BroadcastTab";
import { RosterTab } from "./RosterTab";
import { BoardTab } from "./BoardTab";
import { ModsAdminTab } from "./ModsAdminTab";
import { ConfigTab } from "./ConfigTab";
import { OutreachTab } from "./OutreachTab";

/** Per viewer: is the ops chat column open ("off" closes it). */
const CHAT_KEY = "weered:ops:chat";
const NARROW = "(max-width: 900px)";
type Item = (typeof NAV_ITEMS)[number];

function tabFromUrl(): NavId | null {
  try {
    const t = new URLSearchParams(window.location.search).get("tab");
    return NAV_ITEMS.some((n) => n.id === t) ? (t as NavId) : null;
  } catch {
    return null;
  }
}

// The ops area (rebuilt 2026-11-02): Today first, then grouped tabs, with ops
// chat beside them. The tab lives in the address (?tab=), so a reload keeps
// your place and Back walks the tabs. The queue counts badge the navigation.
export default function StaffPage() {
  const router = useRouter();
  const ctx = useWeered();

  const [myRole, setMyRole] = useState<GlobalRole | null>(null);
  const [nav, setNav] = useState<NavId>("today");
  const [today, setToday] = useState<TodayData | null>(null);
  const [todayErr, setTodayErr] = useState("");
  const [todayAt, setTodayAt] = useState(0);
  const [chatOn, setChatOn] = useState(true);
  const [narrow, setNarrow] = useState(false);
  // On a narrow screen chat has no column; it takes the page instead.
  const [chatView, setChatView] = useState(false);

  useEffect(() => {
    try {
      ctx?.setActiveRoomId?.("@ops");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiFetch("/staff/me")
      .then((j) => {
        if (!j.ok || !["SUPPORT", "STAFF", "ADMIN", "GOD"].includes(j.globalRole)) {
          router.replace("/lobby");
          return;
        }
        setMyRole(j.globalRole);
      })
      .catch(() => router.replace("/lobby"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = tabFromUrl();
    if (t) setNav(t);
    const onPop = () => setNav(tabFromUrl() || "today");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(CHAT_KEY) === "off") setChatOn(false);
    } catch {}
    const mq = window.matchMedia(NARROW);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const loadToday = useCallback(async () => {
    const j = await apiFetch("/staff/today").catch(() => null);
    if (j?.ok) {
      setToday(j);
      setTodayErr("");
      setTodayAt(Date.now());
    } else setTodayErr("Couldn't load today's summary.");
  }, []);

  useEffect(() => {
    if (!myRole) return;
    void loadToday();
    const t = window.setInterval(() => void loadToday(), 60_000);
    return () => window.clearInterval(t);
  }, [myRole, loadToday]);

  const visible = myRole ? NAV_ITEMS.filter((n) => canSeeNav(myRole, n.minRole)) : [];
  const current = visible.find((n) => n.id === nav) || visible[0];

  // After the site's own title has settled, or it wins on a first load.
  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => (document.title = `${current.label} · Weered ops`), 300);
    return () => window.clearTimeout(t);
  }, [current]);

  if (!myRole || !current)
    return (
      <div className="wops" style={{ display: "grid", placeItems: "center" }}>
        <span className="wops-muted">Checking access…</span>
      </div>
    );

  function open(id: NavId) {
    setChatView(false);
    if (id === current.id) return;
    setNav(id);
    if (id === "today") void loadToday();
    try {
      const u = new URL(window.location.href);
      if (id === "today") u.searchParams.delete("tab");
      else u.searchParams.set("tab", id);
      window.history.pushState(null, "", u);
    } catch {}
  }

  function toggleChat() {
    if (narrow) {
      setChatView((v) => !v);
      return;
    }
    setChatOn((v) => {
      try {
        localStorage.setItem(CHAT_KEY, v ? "off" : "on");
      } catch {}
      return !v;
    });
  }

  const counts: Partial<Record<NavId, number>> = today
    ? {
        reports: today.queue.reports.open,
        appeals: today.queue.appeals.pending,
        bugs: today.queue.bugs.open,
        outreach: today.outreach?.due ?? 0,
      }
    : {};
  const waiting = visible.reduce((n, i) => n + (counts[i.id] || 0), 0);

  const navButton = (item: Item) => {
    const Icon = item.icon;
    const c = item.id === "today" ? waiting : counts[item.id];
    return (
      <button
        key={item.id}
        type="button"
        className="wops-nav-item"
        aria-current={current.id === item.id && !chatView ? "page" : undefined}
        onClick={() => open(item.id)}
      >
        <Icon size={16} aria-hidden />
        {item.label}
        {c ? <span className="wops-count">{c}</span> : null}
      </button>
    );
  };

  const chat = (
    <section className="wops-chat" aria-label="Ops chat">
      <div className="wops-chat-head">
        <b>Ops chat</b>
        <span>Staff only</span>
      </div>
      <div className="wops-chat-body">
        <LobbyChatPanel
          roomId="@ops"
          embedded
          style={{ height: "100%", display: "flex", flexDirection: "column" }}
        />
      </div>
    </section>
  );

  const id = current.id;
  return (
    <div className="wops">
      <header className="wops-top">
        <div className="wops-brand">
          <span className="wops-mark" aria-hidden>
            W
          </span>
          <div>
            <div className="wops-title">Weered ops</div>
            <div className="wops-sub">Staff only</div>
          </div>
        </div>
        <div className="wops-top-actions">
          <span className="wops-role">{myRole}</span>
          <button
            type="button"
            className="wops-btn"
            aria-pressed={narrow ? chatView : chatOn}
            onClick={toggleChat}
          >
            <MessageSquare size={14} aria-hidden /> Chat
          </button>
          <button
            type="button"
            className="wops-btn wops-hide-narrow"
            onClick={() => window.dispatchEvent(new CustomEvent("weered:dock:toggle"))}
          >
            DMs
          </button>
          <a className="wops-btn" href="/lobby">
            <ArrowLeft size={14} aria-hidden /> Weered
          </a>
        </div>
      </header>

      <nav className="wops-strip" aria-label="Ops sections">
        {visible.map((item, i) => (
          <Fragment key={item.id}>
            {item.group && item.group !== visible[i - 1]?.group && (
              <span className="wops-strip-sep">{item.group}</span>
            )}
            {navButton(item)}
          </Fragment>
        ))}
      </nav>

      <div className="wops-body" data-chat={!narrow && chatOn ? "on" : "off"}>
        <nav className="wops-nav" aria-label="Ops sections">
          {NAV_GROUPS.map((g) => {
            const items = visible.filter((i) => i.group === g);
            if (!items.length) return null;
            return (
              <div key={g || "top"}>
                {g && <div className="wops-nav-group">{g}</div>}
                {items.map(navButton)}
              </div>
            );
          })}
          <div className="wops-nav-foot">
            <OpsPresence />
          </div>
        </nav>

        <main className="wops-main">
          {narrow && chatView ? (
            chat
          ) : (
            <>
              <div className="wops-head">
                <h1>{current.label}</h1>
                <p>{current.blurb}</p>
              </div>
              <div className="wops-page">
                {id === "today" && (
                  <TodayTab
                    data={today}
                    error={todayErr}
                    onOpen={open}
                    onRefresh={() => void loadToday()}
                    updatedAt={todayAt}
                  />
                )}
                {id === "users" && <UsersTab myRole={myRole} />}
                {id === "board" && <BoardTab myRole={myRole} />}
                {id === "analytics" && <AnalyticsTab />}
                {id === "roster" && <RosterTab />}
                {id === "subs" && <SubsTab />}
                {id === "rooms" && <RoomsTab myRole={myRole} />}
                {id === "lobbies" && <LobbiesTab myRole={myRole} />}
                {id === "audit" && <AuditTab />}
                {id === "broadcast" && <BroadcastTab />}
                {id === "reports" && <ReportsTab />}
                {id === "appeals" && <AppealsTab />}
                {id === "bugs" && <BugsTab />}
                {id === "outreach" && <OutreachTab />}
                {id === "mods" && <ModsAdminTab />}
                {id === "permissions" && <PermissionsTab />}
                {id === "config" && <ConfigTab />}
              </div>
            </>
          )}
        </main>

        {!narrow && chatOn && chat}
      </div>
    </div>
  );
}
