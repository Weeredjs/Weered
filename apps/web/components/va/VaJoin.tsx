"use client";

import React from "react";
import { VA, HEAD_FONT, Card, Country, type Hub, type VaLink } from "./vaShared";

/**
 * The public, recruitment-facing page. The headline, the three values and the
 * fleet lines are vOCN's own wording from virtualocn.de (they asked us to use
 * their public material), so a visitor reads the airline, not Weered. Anything
 * that would be a claim about how vOCN runs (review times, rules) is left out:
 * that is theirs to say. The call to action is their vAMSYS
 * registration: the hub never takes an application itself.
 */

const VALUES = [
  { title: "Authentic", body: "Published routes and careful planning. A recognisable operation." },
  { title: "Relaxed", body: "Professional standards without turning a hobby into a second job." },
  {
    title: "Connected",
    body: "Events, VATSIM and the alliance: flying with other people, not just next to them.",
  },
];

const FLEET = [
  {
    type: "A320-200",
    count: 18,
    img: "/brand/vocn/rooms/dispatch-banner.webp",
    line: "The narrowbody backbone for sun routes, island airports and fast turnarounds.",
  },
  {
    type: "A330-200",
    count: 2,
    img: "/brand/vocn/banner-a330-night.webp",
    line: "A versatile widebody that remains part of the current operation during the 2026 transition.",
  },
  {
    type: "A330-300",
    count: 13,
    img: "/brand/vocn/banner-a330.webp",
    line: "Capacity and range for the core long-haul network and the future harmonised A330 fleet.",
  },
];

const REGION_LABEL: Record<string, string> = {
  MED: "Mediterranean",
  ATLANTIC: "Atlantic islands",
  NORTH_AMERICA: "North America",
  AFRICA_INDIAN_OCEAN: "Africa & Indian Ocean",
};

export default function VaJoin({ hub, publicLinks }: { hub: Hub; publicLinks: VaLink[] }) {
  const a = hub.airline;
  const register = a.registerUrl || publicLinks.find((l) => /register/i.test(l.url))?.url;
  const regions = ["MED", "ATLANTIC", "NORTH_AMERICA", "AFRICA_INDIAN_OCEAN"].map((r) => ({
    r,
    airports: hub.airports.filter((x) => x.region === r),
  }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          position: "relative",
          borderRadius: 18,
          overflow: "hidden",
          minHeight: 300,
          border: `1px solid ${VA.line}`,
          background: `linear-gradient(90deg, rgba(0,12,29,.97) 20%, rgba(0,12,29,.35) 75%), url(/brand/vocn/rooms/arrivals-banner.webp) center/cover`,
          padding: "34px 30px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <img
          src="/brand/vocn/logo-outline.png"
          alt={a.legalName || a.name}
          style={{ width: 220, height: "auto", filter: "drop-shadow(0 2px 10px rgba(0,0,0,.5))" }}
        />
        <h2
          style={{
            margin: "18px 0 6px",
            fontFamily: HEAD_FONT,
            fontSize: 40,
            fontWeight: 800,
            lineHeight: 1.02,
            color: VA.text,
            maxWidth: 560,
          }}
        >
          A recognisable operation with room for every pilot.
        </h2>
        <p style={{ margin: 0, color: VA.ice, fontSize: 15, maxWidth: 520, lineHeight: 1.55 }}>
          {a.tagline || "Leisure routes from Frankfurt and Munich across Europe and the world."}{" "}
          Holiday flying, done properly, with a crew around you.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          {register && (
            <a
              href={register}
              target="_blank"
              rel="noreferrer"
              className="va-btn"
              style={{ textDecoration: "none", padding: "12px 20px", fontSize: 15 }}
            >
              Join the crew
            </a>
          )}
          {a.website && (
            <a
              href={a.website}
              target="_blank"
              rel="noreferrer"
              className="va-btn ghost"
              style={{ textDecoration: "none", padding: "12px 20px", fontSize: 15 }}
            >
              Meet {a.name}
            </a>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        {[
          ["Pilots", hub.stats.pilots.toLocaleString("en-GB")],
          ["Hours this month", hub.stats.hours30d.toLocaleString("en-GB")],
          ["Flights this month", hub.stats.pireps30d.toLocaleString("en-GB")],
          ["Flying now", String(hub.stats.liveNow)],
        ].map(([k, v]) => (
          <div
            key={k}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: VA.card,
              border: `1px solid ${VA.line}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: VA.muted,
              }}
            >
              {k}
            </div>
            <div style={{ fontFamily: HEAD_FONT, fontSize: 32, fontWeight: 800, color: VA.sun }}>
              {v}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {VALUES.map((v) => (
          <Card key={v.title} pad={18}>
            <div
              style={{
                fontFamily: HEAD_FONT,
                fontSize: 24,
                fontWeight: 800,
                color: VA.sun,
                letterSpacing: ".04em",
                textTransform: "uppercase",
              }}
            >
              {v.title}
            </div>
            <p style={{ margin: "6px 0 0", color: VA.ice, lineHeight: 1.55, fontSize: 14 }}>
              {v.body}
            </p>
          </Card>
        ))}
      </div>

      <Card title="Three Airbus types">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {FLEET.map((f) => (
            <div
              key={f.type}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                border: `1px solid ${VA.line}`,
                background: "rgba(0,0,0,.2)",
              }}
            >
              <div style={{ height: 96, background: `url(${f.img}) center/cover` }} />
              <div style={{ padding: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ fontFamily: HEAD_FONT, fontSize: 24, fontWeight: 800 }}>
                    {f.type}
                  </span>
                  <span style={{ color: VA.sun, fontFamily: HEAD_FONT, fontSize: 18 }}>
                    ×{f.count}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: VA.ice, lineHeight: 1.5 }}>
                  {f.line}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: VA.muted, marginTop: 10 }}>
          The A350-900 joins the plan gradually from mid-2027.
        </div>
      </Card>

      <Card title="From Frankfurt and Munich">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
          }}
        >
          {regions.map(({ r, airports }) => (
            <div key={r}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: VA.sun,
                  marginBottom: 6,
                }}
              >
                {REGION_LABEL[r]}
              </div>
              {airports.map((x) => (
                <div key={x.iata} style={{ fontSize: 13.5, padding: "3px 0", color: VA.ice }}>
                  <span
                    style={{ fontFamily: HEAD_FONT, fontSize: 15, color: VA.text, marginRight: 8 }}
                  >
                    {x.iata}
                  </span>
                  <Country cc={x.country} />
                  {x.city}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card title="How you join">
        <ol
          style={{
            margin: 0,
            paddingLeft: 0,
            listStyle: "none",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 12,
          }}
        >
          {[
            [
              "Apply",
              "Register through vAMSYS. That is where your logbook, ranks and bookings live.",
            ],
            ["Get approved", "Staff review your application in vAMSYS."],
            [
              "Come aboard",
              "Sign in here with your vAMSYS account and the crew area opens: roster, bookings, briefings, the flight deck.",
            ],
          ].map(([t, b], i) => (
            <li
              key={t}
              style={{
                padding: 14,
                borderRadius: 12,
                background: "rgba(0,0,0,.2)",
                border: `1px solid ${VA.line}`,
              }}
            >
              <div
                style={{
                  fontFamily: HEAD_FONT,
                  fontSize: 30,
                  fontWeight: 800,
                  color: VA.sun,
                  lineHeight: 1,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontFamily: HEAD_FONT, fontSize: 19, fontWeight: 700, marginTop: 6 }}>
                {t}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: VA.ice, lineHeight: 1.5 }}>{b}</p>
            </li>
          ))}
        </ol>
        <div style={{ fontSize: 12, color: VA.faint, marginTop: 10 }}>
          The crew here fly {hub.stats.hours30d.toLocaleString("en-GB")} hours a month between them.
          Evenings CET are when the bases are busiest.
        </div>
      </Card>
      {a.disclaimer && (
        <div
          style={{ fontSize: 11.5, color: VA.faint, textAlign: "center", padding: "4px 20px 10px" }}
        >
          {a.disclaimer}
        </div>
      )}
    </div>
  );
}
