import type { Bi } from "./lobbyLang";

/**
 * Every word of chrome copy for the Timbo's lobby, in both languages, in one
 * file so it can be handed to the community to correct.
 *
 * The French is Quebec French, not France French, because that is who runs and
 * attends this event ("Le Gros Timbo"). Where the two differ the Quebec form
 * wins — "régie" for the production/TO desk, "inscrit" for a registered
 * entrant, "manette" for controller.
 *
 * NOTHING here uses a Nintendo or Super Smash Bros. name, logo, character or
 * trademark. The room evokes the SCENE — dojo, CRT, setups, brackets — which is
 * the community's own culture and not anyone's intellectual property. Keep it
 * that way: this URL is public and goes in front of a prospect.
 */

export const TIMBOS_LOBBY_ID = "timbos";

/** Left rail navigation. Keys match LeftRail's existing navLabels shape. */
export const TIMBOS_NAV: Record<string, Bi> = {
  lobby: { en: "The Dojo", fr: "Le Dojo" },
  home: { en: "Home", fr: "Accueil" },
  forum: { en: "Notice Board", fr: "Babillard" },
  paper: { en: "Tokens", fr: "Jetons" },
  locator: { en: "Radar", fr: "Radar" },
  ops: { en: "TO Desk", fr: "Régie" },
  communities: { en: "Scenes", fr: "Scènes" },
};

/**
 * Sections of THIS lobby, for the scoped rail.
 *
 * A branded lobby's rail carries the community's own destinations, not the
 * platform's. The four below map to the lobby's own tabs, so every link keeps
 * the member inside the room they came for.
 */
export const TIMBOS_SECTIONS: Record<string, Bi> = {
  rooms: { en: "The Dojo", fr: "Le Dojo" },
  modules: { en: "The Big One", fr: "Le Gros Timbo" },
  feed: { en: "Notice Board", fr: "Babillard" },
  events: { en: "Schedule", fr: "Horaire" },
};

export const TIMBOS_SECTION_ICONS: Record<string, string> = {
  rooms: "🥋",
  modules: "🏆",
  feed: "📋",
  events: "🗓",
};

export const TIMBOS_NAV_ICONS: Record<string, string> = {
  lobby: "🥋",
  home: "🏮",
  forum: "📋",
  paper: "🎫",
  locator: "📺",
  ops: "🎛",
};

/** Role names. A Smash local's actual hierarchy: head TO, crew, refs, entrants. */
export const TIMBOS_ROLES: Record<string, Bi> = {
  GOD: { en: "GRAND MASTER", fr: "GRAND MAÎTRE" },
  ADMIN: { en: "SENSEI", fr: "SENSEI" },
  STAFF: { en: "CREW", fr: "ÉQUIPE" },
  SUPPORT: { en: "HELP DESK", fr: "SOUTIEN" },
  MOD: { en: "REFEREE", fr: "ARBITRE" },
  OWNER: { en: "HEAD TO", fr: "TO PRINCIPAL" },
  MEMBER: { en: "ENTRANT", fr: "INSCRIT" },
};

/** Section headings used by the lobby panels. */
export const TIMBOS_UI: Record<string, Bi> = {
  presence: { en: "At the Setups", fr: "Aux bornes" },
  presenceSearch: { en: "Find an entrant", fr: "Trouver un inscrit" },
  streamRoom: { en: "Stream Room", fr: "Salle de diffusion" },
  streamBlurb: {
    en: "Watch the stream together. Pools you are not in, and everyone who could not travel.",
    fr: "Regardez la diffusion ensemble. Les poules où vous ne jouez pas, et tous ceux qui n'ont pas pu se déplacer.",
  },
  bracketTitle: { en: "The Big One", fr: "Le Gros Timbo" },
  langLabel: { en: "Langue", fr: "Language" },
  langSwitchTo: { en: "Français", fr: "English" },
  sampleNotice: {
    en: "Sample data. Not a real result.",
    fr: "Données d'exemple. Ce n'est pas un vrai résultat.",
  },
  slippiTitle: { en: "Slippi Ranked", fr: "Classement Slippi" },
  slippiBlurb: {
    en: "Melee netplay ratings for the crew, between locals. Add your connect code and the board keeps your rating, record and mains, read from your public Slippi profile once an hour.",
    fr: "Cotes de netplay Melee pour l'équipe, entre les locales. Ajoute ton code de connexion et le tableau garde ta cote, ta fiche et tes persos, lus sur ton profil Slippi public une fois l'heure.",
  },
  slippiEmpty: {
    en: "No connect codes yet. The first one starts the board.",
    fr: "Aucun code de connexion pour l'instant. Le premier lance le tableau.",
  },
  slippiAdd: { en: "Add code", fr: "Ajouter" },
  slippiCodeHint: { en: "Your code, like MANG#0", fr: "Ton code, genre MANG#0" },
  slippiSignIn: {
    en: "Sign in and join the lobby to add your code.",
    fr: "Connecte-toi et rejoins le lobby pour ajouter ton code.",
  },
  slippiUpdated: { en: "Updated", fr: "Mis à jour" },
  slippiStale: {
    en: "Slippi has not answered for a while. Showing the last good read.",
    fr: "Slippi ne répond plus depuis un moment. Voici la dernière lecture réussie.",
  },
  slippiMains: { en: "Mains", fr: "Persos" },
  slippiRemove: { en: "Remove", fr: "Retirer" },
  slippiRefresh: { en: "Re-read now", fr: "Relire" },
  slippiErrBad: {
    en: "That is not a connect code. It looks like MANG#0.",
    fr: "Ce n'est pas un code de connexion. Ça ressemble à MANG#0.",
  },
  slippiErrUnknown: { en: "Slippi does not know that code.", fr: "Slippi ne connaît pas ce code." },
  slippiErrMembers: {
    en: "Members only. Join the lobby first.",
    fr: "Membres seulement. Rejoins le lobby d'abord.",
  },
  slippiErrLimit: {
    en: "You already have three codes on the board.",
    fr: "Tu as déjà trois codes sur le tableau.",
  },
  slippiErrDown: {
    en: "Slippi is not answering right now. Try again in a minute.",
    fr: "Slippi ne répond pas pour l'instant. Réessaie dans une minute.",
  },
  setupsTitle: { en: "Setups & CRTs", fr: "Bornes et téléviseurs" },
  setupsBlurb: {
    en: "Who is bringing what. Fill it in before the event so nobody hauls a spare for nothing.",
    fr: "Qui apporte quoi. À remplir avant l'événement pour que personne ne transporte du matériel inutilement.",
  },
  ridesTitle: { en: "Rides", fr: "Covoiturage" },
  ridesBlurb: {
    en: "Seats to and from the venue.",
    fr: "Places disponibles vers le site et le retour.",
  },
};

/**
 * Board specs rendered by ConfigBoards. Every one carries `sample: true` — the
 * renderer draws a visible notice for those, which is required: a standings
 * table that looks live but is not is exactly the thing someone screenshots.
 *
 * Player names are invented on purpose. Putting real entrants' tags beside
 * invented ratings would fabricate a record about identifiable people, the same
 * rule applied to FastFox's driver boards.
 */
export const TIMBOS_SAMPLE_BOARDS = {
  // Kept for the storybook only; the live board is components/SlippiBoard.tsx.
  slippi: {
    columns: {
      en: ["#", "Connect code", "Rating", "Rank", "W–L"],
      fr: ["#", "Code de connexion", "Cote", "Rang", "V–D"],
    },
    // Rank names are Slippi's own product terms and are not translated, the
    // same way a French-speaking player says "Diamond 3" out loud.
    rows: [
      ["1", "DOJO#001", "1847", "Master 1", "142–61"],
      ["2", "DOJO#002", "1620", "Diamond 3", "98–70"],
      ["3", "DOJO#003", "1544", "Diamond 1", "77–58"],
      ["4", "DOJO#004", "1402", "Platinum 3", "63–59"],
      ["5", "DOJO#005", "1288", "Platinum 1", "51–55"],
    ],
  },
  setups: {
    columns: {
      en: ["Bringing", "Console", "Display", "Controllers"],
      fr: ["Apporté par", "Console", "Écran", "Manettes"],
    },
    rows: [
      ["Entrant A", "GameCube", '20" CRT', "2"],
      ["Entrant B", "GameCube", '13" CRT', "1"],
      ["Entrant C", "Switch", "Monitor", "3"],
      ["Entrant D", "Switch", "—", "2"],
    ],
  },
} as const;
