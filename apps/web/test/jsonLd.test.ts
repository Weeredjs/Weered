import { describe, expect, it } from "vitest";
import { safeJsonLd } from "../lib/jsonLd";

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

describe("safeJsonLd", () => {
  it("cannot be closed early by a </script> inside a value", () => {
    const out = safeJsonLd({ headline: "Audit probe </script><script>alert(1)</script>" });
    expect(out).not.toContain("</script");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("also neutralises an HTML comment opener and entities", () => {
    const out = safeJsonLd({ a: "<!-- x", b: "&lt;" });
    expect(out).not.toContain("<!--");
    expect(out).not.toContain("&");
  });

  it("escapes the line and paragraph separators", () => {
    const out = safeJsonLd({ t: "a" + LS + "b" + PS + "c" });
    expect(out).not.toContain(LS);
    expect(out).not.toContain(PS);
  });

  it("parses back to exactly the same data", () => {
    const data = {
      "@type": "DiscussionForumPosting",
      headline: "Tips & tricks </script> <b>bold</b>",
      text: "line" + LS + "sep" + PS + "para",
      n: 3,
      nested: [{ name: "a > b" }],
    };
    expect(JSON.parse(safeJsonLd(data))).toEqual(data);
  });
});
