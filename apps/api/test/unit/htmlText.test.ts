import { describe, expect, it } from "vitest";
import { htmlToText, stripTags } from "../../src/lib/htmlText";

describe("stripTags", () => {
  it("drops tags and whole script/style blocks", () => {
    expect(htmlToText("<p>Hi <b>there</b></p><script>alert(1)</script><STYLE>p{}</STYLE>!")).toBe(
      "Hi there !",
    );
  });

  it("does not let a tag rebuilt from pieces survive", () => {
    expect(stripTags("<scr<script>x</script>ipt>alert(1)")).not.toContain("<");
  });

  it("keeps text after an unclosed script opener, minus the tag", () => {
    expect(htmlToText("a <script>b")).toBe("a b");
    expect(htmlToText("a < b")).toBe("a < b");
  });

  it("stays fast on hostile input", () => {
    const hostile = "<script".repeat(20000) + "<".repeat(20000);
    const t0 = Date.now();
    stripTags(hostile);
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
