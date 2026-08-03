// Allow only http(s)/relative/hash URLs at href/src/window.open sinks; blocks
// javascript:/data:/vbscript: (XSS + open-redirect hardening; CodeQL js/xss,
// js/client-side-unvalidated-url-redirection).
export function safeUrl(url: string): string {
  const u = String(url || "").trim();
  if (/^(https?:|\/|#)/i.test(u)) return u;
  return "#";
}

// Stricter barrier for <img src> / media URLs fed a user-controlled value.
// Parses via URL() and emits ONLY the normalized http(s) href (a value
// derived from the URL object, not the raw input — which is what CodeQL
// recognizes as a sanitizer), else "". Blocks javascript:/data:/vbscript:.
// Relative paths resolve against the site origin.
export function safeImgSrc(url: string | null | undefined): string {
  try {
    const u = new URL(String(url || "").trim(), "https://weered.ca");
    if (u.protocol === "https:" || u.protocol === "http:") return u.href;
  } catch {}
  return "";
}
