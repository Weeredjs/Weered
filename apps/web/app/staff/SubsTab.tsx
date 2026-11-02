"use client";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { UserTier, apiFetch } from "./shared";

/** GET /staff/subscriptions: everyone who holds a tier, or ?q= any account. */
type Member = {
  id: string;
  name: string;
  usernameKey: string;
  tier: UserTier;
  paying: boolean;
  status: string | null;
  renews: string | null;
  cancelAtPeriodEnd: boolean;
  stripeUrl: string | null;
};

const TIERS: UserTier[] = ["INNOCENT", "INDICTED", "FELON", "KINGPIN"];
const TIER_LABEL: Record<UserTier, string> = {
  INNOCENT: "Free",
  INDICTED: "Indicted",
  FELON: "Felon",
  KINGPIN: "Kingpin",
};
const ERRORS: Record<string, string> = {
  paid_through_stripe: "They pay through Stripe. Change the plan in Stripe and the tier follows.",
  user_not_found: "That account is gone.",
  forbidden: "Your role can't change tiers.",
};

// The tier list for every account (ops audit 2026-11-01: it read a key the
// server never sent, so it had never shown anyone; it listed Stripe rows only;
// its buttons sent the subscription's id, not the person's). A paying member's
// tier is Stripe's to change: Stripe's next update would undo a hand change.
export function SubsTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [searched, setSearched] = useState("");
  const [flash, setFlash] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async (query: string) => {
    setLoading(true);
    const j = await apiFetch(
      `/staff/subscriptions${query ? `?q=${encodeURIComponent(query)}` : ""}`,
    );
    if (j.ok) setMembers(j.members || []);
    else setFlash({ text: ERRORS[j.error] || j.error || "Couldn't load.", bad: true });
    setSearched(query);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  async function setTier(m: Member, tier: UserTier) {
    if (tier === m.tier || busy) return;
    setBusy(m.id);
    setFlash(null);
    const j = await apiFetch(`/staff/users/${encodeURIComponent(m.id)}/tier`, {
      method: "POST",
      body: JSON.stringify({ tier }),
    });
    setBusy("");
    if (!j.ok) {
      setFlash({ text: ERRORS[j.error] || j.error || "That didn't save.", bad: true });
      return;
    }
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, tier } : x)));
    setFlash({ text: `${m.name || m.usernameKey} is now ${TIER_LABEL[tier]}.` });
  }

  const paying = members.filter((m) => m.paying).length;
  const given = members.filter((m) => !m.paying && m.tier !== "INNOCENT").length;

  return (
    <div style={{ maxWidth: 920 }}>
      <form
        className="wops-tool"
        onSubmit={(e) => {
          e.preventDefault();
          void load(q.trim());
        }}
      >
        <input
          className="wops-input"
          placeholder="Find anyone by name to give them a tier"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Find an account"
        />
        <button type="submit" className="wops-btn">
          <Search size={14} /> Find
        </button>
        {searched && (
          <button
            type="button"
            className="wops-btn"
            onClick={() => {
              setQ("");
              void load("");
            }}
          >
            Show tier holders
          </button>
        )}
      </form>

      <div className="wops-note" style={{ marginBottom: 12 }}>
        {searched
          ? `Accounts matching “${searched}”.`
          : `${paying} paying through Stripe · ${given} given a tier by staff.`}{" "}
        A paying member&apos;s tier changes in Stripe.
      </div>

      {flash && (
        <div className="wops-flash" data-tone={flash.bad ? "bad" : undefined} role="status">
          {flash.text}
        </div>
      )}

      {loading ? (
        <div className="wops-muted">Loading…</div>
      ) : members.length === 0 ? (
        <div className="wops-muted">
          {searched ? "No one by that name." : "No one holds a tier yet."}
        </div>
      ) : (
        <div className="wops-rows">
          {members.map((m) => (
            <div key={m.id} className="wops-row">
              <div className="wops-row-who">
                <b>{m.name || m.usernameKey}</b>
                <span>@{m.usernameKey}</span>
              </div>
              {m.paying ? (
                <>
                  <span className="wops-tag">Pays · {TIER_LABEL[m.tier]}</span>
                  <span className="wops-note">
                    {m.status !== "active" && `${m.status} · `}
                    {m.renews &&
                      `${m.cancelAtPeriodEnd ? "ends" : "renews"} ${new Date(m.renews).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
                  </span>
                  {m.stripeUrl && (
                    <a
                      className="wops-btn"
                      href={m.stripeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Stripe <ExternalLink size={13} />
                    </a>
                  )}
                </>
              ) : (
                <>
                  {m.tier !== "INNOCENT" && (
                    <span className="wops-tag" data-tone="staff">
                      Given by staff
                    </span>
                  )}
                  <div className="wops-seg" role="group" aria-label={`Tier for ${m.name}`}>
                    {TIERS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={m.tier === t}
                        disabled={busy === m.id}
                        onClick={() => void setTier(m, t)}
                      >
                        {TIER_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
