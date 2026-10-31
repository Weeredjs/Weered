import { VOICE, obj } from "../common";
import { DOOR_SCHEMA, cleanDoor, type PlanDoor } from "../../buildPlan";
import type { BuildJob } from "../job";

// The front door, described (Admin → Front door): the rules people agree to,
// the questions they answer, 18+, before they get in.

const SYSTEM = `You write the front door of a lobby on Weered: what someone sees before they get in. Call the set_door tool exactly once. Do not reply with text.

title: short, welcoming. body: one or two sentences. button: a short call to action ("Come in", "Let me in").
rules: short lines, one rule each, in their words. questions: short; "choice" questions need 2 to 8 options; mark a question required only if they said it must be answered. age18: only if they said adults only.
If you are given the current door, change what they ask for and keep the rest.
summary: one short plain sentence (20 words at most) saying what you changed.

${VOICE}`;

export const doorJob: BuildJob<{ door: PlanDoor | null }> = {
  id: "door",
  scope: "lobby",
  minLevel: 4,
  perm: "edit_branding",
  system: SYSTEM,
  tool: {
    name: "set_door",
    description: "The lobby's front door.",
    input_schema: {
      type: "object",
      properties: { door: DOOR_SCHEMA, summary: { type: "string" } },
      required: ["door", "summary"],
    },
  },
  maxTokens: 3000,
  context: (c) => {
    // The tab's draft when it sends one (unsaved edits count), else the saved door.
    const draft = obj(c.body?.door);
    const door = Object.keys(draft).length ? draft : obj(obj(c.lobby?.layout).door);
    const said = !!(door.title || door.body || (door.rules || []).length || (door.questions || []).length);
    return said ? `The current door:\n${JSON.stringify(door).slice(0, 4000)}` : "";
  },
  clean: (raw) => ({ door: cleanDoor(obj(raw).door) }),
};
