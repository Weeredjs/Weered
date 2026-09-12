"use client";
import React from "react";
import { ConfigBoard } from "./ConfigBoards";
import SlippiBoard from "./SlippiBoard";
import LangToggle from "./LangToggle";
import ModuleTabBar from "./ModuleTabBar";
import { useLobbyLang, pick } from "../lib/lobbyLang";
import { TIMBOS_UI, TIMBOS_SAMPLE_BOARDS } from "../lib/timbosCopy";

/**
 * The Timbo's lobby panel.
 *
 * Built for a Smash community, which shapes it in two ways worth stating,
 * because they are the opposite of the assumptions the other lobbies make.
 *
 * 1. The game is on a CONSOLE. There is no PC client to overlay and no
 *    Nintendo API to read, so nothing here pretends to know the state of a
 *    match. What the room does is everything AROUND the match: who is bringing
 *    a CRT, who has a seat in a car, who is on the stream. That is what this
 *    community actually coordinates in Discord today.
 * 2. Their event is IN PERSON. So the room's job is the weeks between events,
 *    and the stream on the day for everyone not at the venue.
 *
 * The sections sit behind a ModuleTabBar like every other lobby's module area.
 * Stream Room and Rides share the last tab: each is a short brief rather than a
 * board, and alone on a tab either one reads as an empty screen.
 *
 * Layout is owned here — a fixed header and tab bar, then ONE bounded scroll
 * region — rather than in a wrapper in page.tsx, which is near the file-size
 * tripwire. That also makes the scroll correct no matter what the wrapper does.
 *
 * The Slippi board is live (components/SlippiBoard.tsx): members volunteer
 * their own connect code and the API keeps that code's public ranked profile,
 * read once an hour. Nothing is crawled; a code is only read because its
 * owner put it here. The setups board is still a SAMPLE shelf.
 */
export default function TimbosPanel({
  lobbyId,
  accent = "#7b5cff",
}: {
  lobbyId: string;
  accent?: string;
}) {
  const lang = useLobbyLang();
  const t = (k: string) => (TIMBOS_UI[k] ? pick(TIMBOS_UI[k], lang) : k);
  const sampleText = t("sampleNotice");
  const [tab, setTab] = React.useState<"slippi" | "setups" | "day">("slippi");

  // Tab labels come from the same copy file as the headings they open, so a tab
  // and its section can never drift apart or fall back to English.
  const tabs = [
    { id: "slippi", label: t("slippiTitle") },
    { id: "setups", label: t("setupsTitle") },
    { id: "day", label: t("dayTitle") },
  ];

  // Column headers are part of the room's chrome, so they translate too. The
  // cell VALUES do not: a connect code, a console name and a scoreline read the
  // same in both languages, and inventing French for them would be noise.
  const board = (b: {
    columns: { en: readonly string[]; fr: readonly string[] };
    rows: readonly (readonly string[])[];
  }) => ({
    columns: [...(lang === "fr" ? b.columns.fr : b.columns.en)],
    rows: b.rows.map((r) => [...r]),
  });

  return (
    <div
      className="weered-timbos-panel"
      lang={lang}
      style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      <header className="weered-timbos-head">
        <div>
          <h2 className="weered-timbos-title">{t("bracketTitle")}</h2>
          <p className="weered-timbos-sub">17.10.2026</p>
        </div>
        <LangToggle />
      </header>

      <ModuleTabBar
        tabs={tabs}
        active={tab}
        onSelect={(id) => setTab(id as "slippi" | "setups" | "day")}
        accent={accent}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "10px 2px 4px" }}>
        {tab === "slippi" && (
          <section className="weered-timbos-card">
            <h3 className="weered-timbos-h3">{t("slippiTitle")}</h3>
            <p className="weered-timbos-blurb">{t("slippiBlurb")}</p>
            <SlippiBoard lobbyId={lobbyId} accent={accent} />
          </section>
        )}

        {tab === "setups" && (
          <section className="weered-timbos-card">
            <h3 className="weered-timbos-h3">{t("setupsTitle")}</h3>
            <p className="weered-timbos-blurb">{t("setupsBlurb")}</p>
            <ConfigBoard
              board={board(TIMBOS_SAMPLE_BOARDS.setups)}
              accent={accent}
              sample
              sampleText={sampleText}
            />
          </section>
        )}

        {tab === "day" && (
          <div className="weered-timbos-split">
            <section className="weered-timbos-card">
              <h3 className="weered-timbos-h3">{t("streamRoom")}</h3>
              <p className="weered-timbos-blurb">{t("streamBlurb")}</p>
            </section>
            <section className="weered-timbos-card">
              <h3 className="weered-timbos-h3">{t("ridesTitle")}</h3>
              <p className="weered-timbos-blurb">{t("ridesBlurb")}</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
