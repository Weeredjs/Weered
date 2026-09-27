// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../components/forum/Markdown";

// The renderer's output goes into dangerouslySetInnerHTML, so its guarantee is
// structural: whatever the input, the parsed result holds only the elements and
// attributes the renderer means to emit, and links only point where safeUrl
// allows. Formatting characters inside URLs used to be rewritten into markup
// inside the attribute (audit 2026-09-27); these inputs pin that down.
const TAGS = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "PRE",
  "CODE",
  "STRONG",
  "EM",
  "A",
  "IMG",
]);
const ATTRS = new Set(["style", "href", "target", "rel", "src", "alt"]);
const SAFE_URL = /^(https?:|\/|#)/i;

function parse(md: string) {
  const host = document.createElement("div");
  host.innerHTML = renderMarkdown(md);
  const problems: string[] = [];
  for (const el of Array.from(host.querySelectorAll("*"))) {
    if (!TAGS.has(el.tagName)) problems.push(`tag ${el.tagName}`);
    for (const a of Array.from(el.attributes)) {
      if (!ATTRS.has(a.name)) problems.push(`${el.tagName} has attribute ${a.name}`);
    }
    for (const name of ["href", "src"]) {
      const v = el.getAttribute(name);
      if (v !== null && !SAFE_URL.test(v)) problems.push(`${el.tagName} ${name}=${v}`);
    }
  }
  return { host, problems };
}

const MIXED = [
  "[docs](https://example.com/a`b`c)",
  "![pic](https://example.com/x*y*z.png) and *real emphasis*",
  '[q](https://example.com/"quoted) `code` __bold__',
  "`[not](a link)` [link](/forum)",
  "[u](https://example.com/_a_b_) and **strong**",
  "# heading with [a](https://example.com/`x`) link",
  "> quote ![i](https://example.com/`i`.png)",
  "- item [l](https://example.com/**z**)",
];

describe("forum markdown", () => {
  it("emits only its own elements and attributes, whatever sits inside a URL", () => {
    for (const md of MIXED) {
      expect(parse(md).problems, md).toEqual([]);
    }
  });

  it("keeps formatting characters inside URLs literal", () => {
    expect(
      parse("[docs](https://example.com/a`b`c)").host.querySelector("a")?.getAttribute("href"),
    ).toBe("https://example.com/a`b`c");
    const img = parse("![pic](https://example.com/x*y*z.png) and *real emphasis*").host;
    expect(img.querySelector("img")?.getAttribute("src")).toBe("https://example.com/x*y*z.png");
    expect(img.querySelector("em")?.textContent).toBe("real emphasis");
    expect(
      parse('[q](https://example.com/"quoted)').host.querySelector("a")?.getAttribute("href"),
    ).toBe('https://example.com/"quoted');
  });

  it("leaves a code span as text", () => {
    const { host } = parse("`[not](a link)` and `**x** <b>`");
    const codes = host.querySelectorAll("code");
    expect(codes[0].textContent).toBe("[not](a link)");
    expect(codes[1].textContent).toBe("**x** <b>");
    expect(host.querySelector("a")).toBeNull();
    expect(host.querySelector("strong")).toBeNull();
  });

  it("points links with other schemes nowhere", () => {
    const { host } = parse("[x](javascript:void(0)) ![y](data:image/png,zz)");
    expect(host.querySelector("a")?.getAttribute("href")).toBe("#");
    expect(host.querySelector("img")?.getAttribute("src")).toBe("#");
  });

  it("still renders ordinary formatting", () => {
    const { host, problems } = parse("**bold** and _it_ and [link](https://weered.ca) and `code`");
    expect(problems).toEqual([]);
    expect(host.querySelector("strong")?.textContent).toBe("bold");
    expect(host.querySelector("em")?.textContent).toBe("it");
    expect(host.querySelector("a")?.getAttribute("href")).toBe("https://weered.ca");
    expect(host.querySelector("code")?.textContent).toBe("code");
  });
});
