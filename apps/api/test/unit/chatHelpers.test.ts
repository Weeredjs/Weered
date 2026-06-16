import { describe, it, expect } from "vitest";
import {
  checkUrlSpam,
  checkChatRateLimit,
  URL_RE,
  MENTION_RE,
  CHAT_RATE_MAX,
} from "../../src/lib/chatHelpers";

describe("chatHelpers", () => {
  it("checkUrlSpam allows up to 3 links, rejects more", () => {
    expect(checkUrlSpam("no links").ok).toBe(true);
    expect(checkUrlSpam("https://a.com https://b.com https://c.com").ok).toBe(true);
    expect(checkUrlSpam("https://a.com https://b.com https://c.com https://d.com").ok).toBe(false);
  });
  it("checkChatRateLimit blocks after the burst limit", () => {
    const uid = "rate-" + Math.random().toString(36).slice(2);
    for (let i = 0; i < CHAT_RATE_MAX; i++) expect(checkChatRateLimit(uid).ok).toBe(true);
    const blocked = checkChatRateLimit(uid);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryInMs).toBeGreaterThan(0);
  });
  it("regexes match expected patterns", () => {
    expect("see https://x.com/y".match(URL_RE)?.length).toBe(1);
    expect("hi @alice and @bob_1".match(MENTION_RE)?.length).toBe(2);
  });
});
