import { describe, expect, it } from "vitest";
import { diskLeftPct, makeDiskWatch } from "../../src/lib/pressure";

// The disk watch (lib/pressure.ts): one mail when less than 20% of the disk is
// left, another under 10%, and nothing more until it has been back over 25%.

function watching() {
  const mails: string[] = [];
  const watch = makeDiskWatch(async (subject) => {
    mails.push(subject);
  });
  return { mails, watch };
}

describe("the disk watch", () => {
  it("says nothing while there is room", async () => {
    const { mails, watch } = watching();
    for (const left of [69, 40, 26, 21, 20]) await watch(left);
    expect(mails).toEqual([]);
  });

  it("mails once under 20%, however long it stays there", async () => {
    const { mails, watch } = watching();
    for (const left of [19, 18, 15, 19, 12]) await watch(left);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toContain("19% free");
  });

  it("mails again under 10%, once", async () => {
    const { mails, watch } = watching();
    for (const left of [18, 9, 7, 3]) await watch(left);
    expect(mails).toHaveLength(2);
    expect(mails[1]).toContain("9% free");
  });

  it("does not go back to the first mail after the second", async () => {
    const { mails, watch } = watching();
    for (const left of [8, 15, 19, 9]) await watch(left);
    expect(mails).toHaveLength(1);
  });

  it("starts over once the disk has been back over 25%", async () => {
    const { mails, watch } = watching();
    for (const left of [18, 22, 24]) await watch(left); // not over 25 yet
    expect(mails).toHaveLength(1);
    for (const left of [30, 19]) await watch(left);
    expect(mails).toHaveLength(2);
  });

  it("says nothing when the disk can't be read", async () => {
    const { mails, watch } = watching();
    await watch(null);
    expect(mails).toEqual([]);
  });

  it("reads this machine's disk as a percentage", () => {
    const left = diskLeftPct();
    expect(left).not.toBeNull();
    expect(left!).toBeGreaterThanOrEqual(0);
    expect(left!).toBeLessThanOrEqual(100);
    expect(diskLeftPct("/no/such/folder/anywhere")).toBeNull();
  });
});
