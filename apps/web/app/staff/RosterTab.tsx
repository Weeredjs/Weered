"use client";
import { useState, useEffect } from "react";
import { Avatar } from "../../components/dock/shellHelpers";
import { apiFetch } from "./shared";

type StaffMember = {
  id: string;
  name: string;
  usernameKey: string;
  globalRole: string;
  avatar?: string | null;
  avatarColor?: string | null;
  createdAt: string;
};

const RUNGS: { title: string; roles: string[] }[] = [
  { title: "God", roles: ["GOD"] },
  { title: "Staff and Admin", roles: ["ADMIN", "STAFF"] },
  { title: "Medics (Support)", roles: ["SUPPORT"] },
];

// Who can do what, as the server enforces it (lib/roleLadder.ts and the staff
// routes). The Permissions tab said the paid tier was earned through notoriety,
// left out what Support does, and missed that STAFF could make ADMIN (ops
// audit 2026-11-01); folded in here and corrected 2026-11-02.
const LADDER: [string, string][] = [
  ["Member", "Lobbies, chat, voice, DMs, crews."],
  [
    "Medic (Support)",
    "Moderates everywhere: kicks members, locks and clears lobby chat, works reports, ban appeals, bug reports and mods, removes reported messages. Can't ban, give roles or change settings.",
  ],
  [
    "Staff · Admin",
    "One rung. Everything Support does, plus: ban and unban, give or remove Support, lobbies, rooms, tiers, broadcast, outreach, analytics and the audit log.",
  ],
  [
    "God",
    "Everything, plus making or removing staff and the site switches in Config. Can't be kicked or banned.",
  ],
];
const LOBBY: [string, string][] = [
  ["1 · Member", "Takes part in the lobby and its rooms."],
  ["2 · Trusted", "Reads the lobby's admin pages."],
  ["3 · Moderator", "Kicks, mutes and clears chat in the lobby; joins its admin chat."],
  ["4 · Admin", "Runs the lobby: name, settings, rooms, events, modules."],
  ["5 · Owner", "Everything, including paid tiers, transfer and deleting."],
];

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="wops-card" style={{ padding: "6px 16px" }}>
      <div className="wops-feed">
        {rows.map(([who, can]) => (
          <div key={who} className="wops-feed-row" style={{ alignItems: "flex-start" }}>
            <b style={{ flex: "0 0 120px" }}>{who}</b>
            <span style={{ whiteSpace: "normal" }}>{can}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RosterTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/staff/roster")
      .then((j) => setStaff(j.staff || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 880 }}>
      {loading ? (
        <div className="wops-muted">Loading…</div>
      ) : (
        RUNGS.map((rung) => {
          const people = staff.filter((s) => rung.roles.includes(s.globalRole));
          if (!people.length) return null;
          return (
            <section key={rung.title} className="wops-section">
              <h2 className="wops-section-title">
                {rung.title} <small>{people.length}</small>
              </h2>
              <div
                className="wops-grid"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
              >
                {people.map((s) => (
                  <a
                    key={s.id}
                    className="wops-card"
                    href={`/staff?tab=users&q=${encodeURIComponent(s.usernameKey)}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <Avatar
                      name={s.name}
                      size={40}
                      src={s.avatar}
                      chosenColor={s.avatarColor || undefined}
                    />
                    <div style={{ minWidth: 0 }}>
                      <b style={{ display: "block", fontSize: 15 }}>{s.name}</b>
                      <span className="wops-note">
                        @{s.usernameKey} · {s.globalRole === "ADMIN" ? "Admin · " : ""}since{" "}
                        {new Date(s.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          );
        })
      )}

      <section className="wops-section">
        <h2 className="wops-section-title">
          Who can do what <small>you act only on people below you</small>
        </h2>
        <Rows rows={LADDER} />
      </section>
      <section className="wops-section">
        <h2 className="wops-section-title">
          In a lobby <small>each lobby&apos;s own ladder, separate from Weered&apos;s</small>
        </h2>
        <Rows rows={LOBBY} />
      </section>
      <section className="wops-section">
        <h2 className="wops-section-title">Tiers and notoriety</h2>
        <div className="wops-card wops-muted" style={{ lineHeight: 1.55 }}>
          Two separate things that share crime names. The <b>tier</b> is paid: Free, Indicted ($6 a
          month), Felon ($14), Condemned ($25), or Kingpin, which only staff give (Subscriptions).{" "}
          <b>Notoriety</b> is earned by taking part and climbs from Street Rat to Kingpin. One never
          changes the other.
        </div>
      </section>
    </div>
  );
}
