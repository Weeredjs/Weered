import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  addNote,
  cleanBody,
  MAX_BODY,
  MAX_NOTES,
  MAX_VISITOR_NOTES,
  readBoard,
  removeNote,
  visibleTo,
  writeBoard,
  type Note,
} from "../../src/lib/officeBoard";

// The office note board (2026-11-12): James's notes are on the wall for every
// visitor; a visitor's note is for James alone.
const james = { host: true, id: "eceb-host", name: "James Stirling" };
const pat = { host: false, id: "guest_pat", name: "Pat" };
const sam = { host: false, id: "guest_sam", name: "Sam" };

function add(notes: Note[], v: typeof james, body: string, i: number): Note[] {
  const r = addNote(notes, v, body, 1000 + i, `n${i}`);
  if ("error" in r) throw new Error(r.error);
  return r.notes;
}

describe("office board", () => {
  let dir = "";
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it("puts James's notes on the wall and keeps a visitor's note between them and James", () => {
    let notes: Note[] = [];
    notes = add(notes, james, "Drop-in hours today until 4.", 1);
    notes = add(notes, pat, "Call me about the April renewal: 902-555-0100", 2);
    expect(notes[0].private).toBe(false);
    expect(notes[1].private).toBe(true);
    expect(visibleTo(notes, james).map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(visibleTo(notes, pat).map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(visibleTo(notes, sam).map((n) => n.id)).toEqual(["n1"]);
  });

  it("lets James take down any note, and a visitor only their own", () => {
    let notes: Note[] = [];
    notes = add(notes, james, "Wall note", 1);
    notes = add(notes, pat, "Pat's note", 2);
    expect(removeNote(notes, "n1", pat).removed).toBe(false);
    expect(removeNote(notes, "n2", sam).removed).toBe(false);
    expect(removeNote(notes, "n2", pat).notes.map((n) => n.id)).toEqual(["n1"]);
    expect(removeNote(notes, "n2", james).notes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("refuses empty notes, trims long ones, and stops a flood", () => {
    expect(addNote([], pat, "   \n\n ", 1, "x")).toEqual({ error: "empty" });
    expect(cleanBody("a\n\n\n\nb")).toBe("a\n\nb");
    expect(cleanBody("x".repeat(MAX_BODY + 50)).length).toBe(MAX_BODY);
    let notes: Note[] = [];
    for (let i = 0; i < MAX_VISITOR_NOTES; i++) notes = add(notes, pat, `spam ${i}`, i);
    expect(addNote(notes, sam, "one more", 99, "y")).toEqual({ error: "board_full" });
    // James can still pin to the wall until the board itself is full.
    expect("note" in addNote(notes, james, "still mine", 99, "z")).toBe(true);
    const full = Array.from({ length: MAX_NOTES }, (_, i) => ({ ...notes[0], id: `f${i}` }));
    expect(addNote(full, james, "no room", 99, "w")).toEqual({ error: "board_full" });
  });

  it("reads back what it wrote, and an unreadable file is an empty board", () => {
    dir = mkdtempSync(join(tmpdir(), "board-"));
    const file = join(dir, "board.json");
    expect(readBoard(file)).toEqual([]);
    const notes = add([], james, "Persisted", 1);
    writeBoard(notes, file);
    expect(readBoard(file)).toEqual(notes);
    writeFileSync(file, "{not json");
    expect(readBoard(file)).toEqual([]);
  });
});
