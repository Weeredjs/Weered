// The office's note board (James 2026-11-12: "Make my office even more
// versatile... Add a note board"). Notes James pins are on the wall for every
// visitor; a note a visitor leaves is for James alone (a client's phone number
// or renewal date must never sit on the wall for the next visitor). Kept in a
// small JSON file beside the office's hours (routes/office.ts), as the rest of
// the office's state is.
import { readFileSync, writeFileSync } from "fs";

export type Note = {
  id: string;
  body: string;
  by: string;
  byId: string;
  /** Left by a visitor: only the host (and its writer) sees it. */
  private: boolean;
  at: number;
};

export type Viewer = { host: boolean; id: string; name: string };

export const MAX_NOTES = 60;
export const MAX_BODY = 400;
/** Visitors' notes the board will hold at once, so a flood can't fill it. */
export const MAX_VISITOR_NOTES = 30;

export const BOARD_FILE = () => process.env.OFFICE_BOARD_FILE || "/opt/weered/office-board.json";

export function readBoard(file = BOARD_FILE()): Note[] {
  try {
    const arr = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(arr)
      ? arr.filter((n: any) => n && typeof n.id === "string" && typeof n.body === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeBoard(notes: Note[], file = BOARD_FILE()): void {
  writeFileSync(file, JSON.stringify(notes.slice(-MAX_NOTES)));
}

/** Trimmed, no runs of blank lines, at most MAX_BODY characters. */
export function cleanBody(s: unknown): string {
  return String(s ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_BODY);
}

/** The host sees every note; a visitor sees the wall and their own notes. */
export function visibleTo(notes: Note[], viewer: Viewer): Note[] {
  return viewer.host ? notes : notes.filter((n) => !n.private || n.byId === viewer.id);
}

export function addNote(
  notes: Note[],
  viewer: Viewer,
  body: unknown,
  now: number,
  id: string,
): { notes: Note[]; note: Note } | { error: "empty" | "board_full" } {
  const text = cleanBody(body);
  if (!text) return { error: "empty" };
  if (notes.length >= MAX_NOTES) return { error: "board_full" };
  if (!viewer.host && notes.filter((n) => n.private).length >= MAX_VISITOR_NOTES)
    return { error: "board_full" };
  const note: Note = {
    id,
    body: text,
    by: (viewer.name || (viewer.host ? "James" : "Visitor")).slice(0, 40),
    byId: viewer.id,
    private: !viewer.host,
    at: now,
  };
  return { notes: [...notes, note], note };
}

/** The host takes down any note; a visitor only their own. */
export function removeNote(
  notes: Note[],
  noteId: string,
  viewer: Viewer,
): { notes: Note[]; removed: boolean } {
  const n = notes.find((x) => x.id === noteId);
  if (!n || (!viewer.host && n.byId !== viewer.id)) return { notes, removed: false };
  return { notes: notes.filter((x) => x.id !== noteId), removed: true };
}
