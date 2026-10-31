// The walled-off box custom blocks and games run in (the "real code" step,
// James 2026-10-31: "Do everything."). The AI writes a small page; it runs in
// an <iframe sandbox="allow-scripts"> with no same-origin, so it can't read
// Weered's cookies, storage or pages, and a Content-Security-Policy with no
// network at all (connect-src 'none', no external scripts, images or frames),
// so it can't send anything anywhere. The only way out is the bridge below,
// which the host page (components/lobby-design/CustomBlockFrame.tsx) answers:
//
//   weered.me()               -> {id, name} of the viewer, or null
//   weered.get(key)           -> the block's shared value for key, or null
//   weered.set(key, value)    -> saves it for everyone (signed-in viewers)
//   weered.list(prefix)       -> [{key, value, by, at}] under prefix
//   weered.send(data)         -> to everyone viewing this block right now
//   weered.on(fn)             -> fn(data, from) for what others send
//   weered.resize(px)         -> asks for a taller or shorter frame
//
// MySpace let people paste raw code into profiles; the Samy worm (2005) went
// through a million of them in a day. That's the lesson this box is built on.

export const BLOCK_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

/** Runs inside the box: window.weered, talking to the host by postMessage. */
const BRIDGE = `(function(){
  var seq = 0, waiting = {}, fns = [];
  function post(m){ try { parent.postMessage(Object.assign({ weered: 1 }, m), "*"); } catch (e) {} }
  function call(t, a){ return new Promise(function(res, rej){ var id = ++seq; waiting[id] = [res, rej]; post({ t: t, id: id, a: a || {} }); setTimeout(function(){ if (waiting[id]) { delete waiting[id]; rej(new Error("timeout")); } }, 10000); }); }
  window.addEventListener("message", function(e){
    var m = e.data; if (!m || m.weered !== 2) return;
    if (m.t === "reply" && waiting[m.id]) { var w = waiting[m.id]; delete waiting[m.id]; m.ok ? w[0](m.value) : w[1](new Error(m.error || "error")); }
    if (m.t === "event") fns.forEach(function(f){ try { f(m.data, m.from); } catch (err) {} });
  });
  window.weered = {
    me: function(){ return call("me"); },
    get: function(k){ return call("get", { key: String(k) }); },
    set: function(k, v){ return call("set", { key: String(k), value: v }); },
    list: function(p){ return call("list", { prefix: String(p || "") }); },
    send: function(d){ post({ t: "send", a: { data: d } }); },
    on: function(f){ if (typeof f === "function") fns.push(f); },
    resize: function(px){ post({ t: "resize", a: { px: Number(px) || 0 } }); }
  };
  window.addEventListener("load", function(){ post({ t: "resize", a: { px: document.documentElement.scrollHeight } }); });
})();`;

/** The whole document for a block: the CSP, base styles in Weered's colours,
 *  the bridge, then the code (the inner HTML of <body>). */
export function sandboxDoc(code: string, look: { accent: string; font?: string }): string {
  const accent = /^#[0-9a-f]{6}$/i.test(look.accent) ? look.accent : "#7c3aed";
  const font = (look.font || "system-ui, -apple-system, 'Segoe UI', sans-serif").replace(
    /[<>"]/g,
    "",
  );
  return [
    "<!doctype html><html><head><meta charset='utf-8'>",
    `<meta http-equiv="Content-Security-Policy" content="${BLOCK_CSP}">`,
    "<meta name='viewport' content='width=device-width,initial-scale=1'>",
    `<style>:root{--accent:${accent};--text:#f3f4f6;--muted:rgba(226,232,240,.7);--card:rgba(255,255,255,.06);--line:rgba(255,255,255,.12)}`,
    `html,body{margin:0;padding:0;background:transparent;color:var(--text);font-family:${font};font-size:14px}`,
    "*{box-sizing:border-box}button{font:inherit;cursor:pointer}</style>",
    `<script>${BRIDGE}</script>`,
    "</head><body>",
    code,
    "</body></html>",
  ].join("");
}

/** What the bridge asks for. */
export type BridgeMsg =
  | { weered: 1; t: "me" | "get" | "set" | "list"; id: number; a: Record<string, unknown> }
  | { weered: 1; t: "send"; a: { data: unknown } }
  | { weered: 1; t: "resize"; a: { px: number } };
