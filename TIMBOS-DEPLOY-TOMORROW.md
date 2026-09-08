# Timbo's — done. Start here tomorrow.

**Status: live.** `weered.ca/lobby/timbos` — deployed, theme forced, EN/FR toggle
working, both boards badged SAMPLE, no overflow in either language. Five commits
on `feat/timbos-bilingual-lobby`, all shipped, smoke 58 pass / 0 fail.

Three bugs were caught only by loading the live page logged-out, not by the build:
the join wall covering everything, landing on the empty Rooms tab, and the
lobby-load handler overwriting the default view. All fixed. **Check preview
lobbies as a logged-out visitor — the build passing means nothing here.**

## Loose ends (small)

- `ownerId` is null — the seeder creates the row unowned. Join and claim it so
  the admin panel works.
- The "Early access build — things may break" banner is the first thing a
  prospect reads, above the room.
- Cookie consent covers the Setups board on first load.
- Nav label renders "TO DESK" — reads oddly for Tournament Organiser.
- The French is mine, not a native speaker's. `apps/web/lib/timbosCopy.ts` is one
  file — hand it to Timbo's crew to correct. Good excuse for a second contact.

## Tomorrow's actual problem: the left rail

The tension, stated so it is crisp on a cold start:

- Global users **should** see the rail. Cross-lobby discovery is how Weered grows.
- A community paying for a branded room does **not** want Weered's nav walking
  their members out to other communities. That is the thing they are leaving
  Discord to escape — someone else's product surrounding theirs.
- But if every paid lobby hides the rail, discovery dies and so does growth.

It is a policy question before it is a code question. Worth deciding first:

1. Is nav visibility **per-lobby, owner-configurable**, or a **tier** (paid rooms
   get to hide it, free rooms don't)?
2. Does hiding it apply to **everyone**, or only to that lobby's **members** —
   a visitor who wandered in still being able to leave is different from a
   member being funnelled out.
3. Is there a middle setting: rail stays, but shows only _their_ scenes and a
   single small Weered mark, rather than the full communities list?

Option 3 is probably the commercial answer — it keeps the room feeling theirs
without cutting the network. But that is a business call, not a technical one.

The mechanism already exists either way: `data-weered-lobby` on `<html>`, which
LeftRail already observes. Whatever the policy, the wiring is a few lines.

## Elsewhere

- **Timbo**: reply with specific evening slots. His crew works 9–5 Eastern,
  you are Atlantic, so after 5 theirs is after 6 yours. Ask if they run Melee as
  well as Ultimate — Melee is on PC via Slippi, which is a real play surface.
- **Slippi**: your note. The line worth using — you keep their name away from
  Nintendo IP. Their own site is scrubbed bare; that is the thing they need most
  from anyone building on them.
- **Outreach**: 19 verified communities in `Desktop/weered-outreach/20-...md`,
  61 sim racing ones in `21-...md`. Both Discord-contact only.
- **milsimunits.com** — 1,157 units, each with its own domain. Biggest pool
  found, needs the Playwright harvester pointed at it. Not started.
