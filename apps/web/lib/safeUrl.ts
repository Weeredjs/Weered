// Allow only http(s)/relative/hash URLs at href/src/window.open sinks; blocks
// javascript:/data:/vbscript: (XSS + open-redirect hardening; CodeQL js/xss,
// js/client-side-unvalidated-url-redirection).
export function safeUrl(url: string): string {
  const u = String(url || "").trim();
  if (/^(https?:|\/|#)/i.test(u)) return u;
  return "#";
}
