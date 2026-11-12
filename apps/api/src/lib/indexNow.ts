// IndexNow (James 2026-11-12, "Do everything"): the moment a lobby goes public
// in Downtown, Bing hears about it (and through Bing, ChatGPT's search), along
// with Yandex, Seznam and Naver, instead of waiting for their next crawl.
// The key is public by design: weered.ca serves it at /<key>.txt
// (apps/web/public). Off unless the API's env says INDEXNOW=on, so CI, tests
// and local runs never ping.
import { log } from "./logger";

export const INDEXNOW_KEY = "17432e411215a94c40824a2fb980151b";
const SITE = "https://weered.ca";
const ENDPOINT = "https://api.indexnow.org/indexnow";

export const lobbyUrl = (id: string) => `${SITE}/lobby/${encodeURIComponent(id)}`;

export function indexNowEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.INDEXNOW === "on";
}

/** The request body: weered.ca pages only, each once, at most 10,000. */
export function indexNowBody(urls: string[]) {
  const urlList = [...new Set(urls.map((u) => String(u || "").trim()))]
    .filter((u) => u.startsWith(`${SITE}/`))
    .slice(0, 10_000);
  return {
    host: "weered.ca",
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

/** Fire and forget: returns the HTTP status (200/202 = taken), or 0 if not sent. */
export async function pingIndexNow(urls: string[]): Promise<number> {
  const body = indexNowBody(urls);
  if (!body.urlList.length || !indexNowEnabled()) return 0;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    log.log("[indexnow]", r.status, body.urlList.length, body.urlList[0]);
    return r.status;
  } catch (e: any) {
    log.warn("[indexnow]", e?.message || e);
    return 0;
  } finally {
    clearTimeout(timer);
  }
}
