// One origin for the local stack, the way the white-label office hosts work.
//
// Why a proxy instead of pointing the web app at a local API: the session is an
// httpOnly Secure SameSite=Lax cookie, and the global fetch patch in
// app/layout.tsx only sends credentials to api.weered.ca. A page on :3000 calling
// an API on :4000 is cross-origin and never carries the cookie, so nothing that
// needs a login works. Browse http://bar.localhost:8080 instead:
//
//   - `*.localhost` is a secure context, so Secure cookies work over plain http.
//   - It is not on the fetch patch's weered.ca/localhost allow-list, so every
//     api.weered.ca call is rewritten to same-origin /api/... — exactly the
//     office-host path — and lands here.
//   - /ws is the same-origin WebSocket path those hosts use.
//
//   /api/*  -> http://127.0.0.1:4000/*   (prefix stripped)
//   /ws     -> ws://127.0.0.1:4001        (rooms, launch pad)
//   else    -> http://127.0.0.1:3000     (Next dev, incl. its HMR socket)
//
// No dependencies: node scripts/local/proxy.mjs

import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.PROXY_PORT || 8080);
const API = { host: "127.0.0.1", port: 4000 };
const WS = { host: "127.0.0.1", port: 4001 };
const WEB = { host: "127.0.0.1", port: 3000 };

function route(url = "/") {
  if (url === "/api" || url.startsWith("/api/")) return { ...API, path: url.slice(4) || "/" };
  if (url === "/ws" || url.startsWith("/ws/") || url.startsWith("/ws?")) {
    return { ...WS, path: url.slice(3) || "/" };
  }
  return { ...WEB, path: url };
}

const server = http.createServer((req, res) => {
  const t = route(req.url);
  const upstream = http.request(
    { host: t.host, port: t.port, method: req.method, path: t.path, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`local proxy: ${t.host}:${t.port} unreachable (${err.code || err.message})`);
  });
  req.pipe(upstream);
});

// WebSocket upgrades: replay the handshake to the right upstream, then splice.
server.on("upgrade", (req, socket, head) => {
  const t = route(req.url);
  const up = net.connect(t.port, t.host, () => {
    const lines = [`${req.method} ${t.path} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    up.write(lines.join("\r\n") + "\r\n\r\n");
    if (head?.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  const close = () => {
    socket.destroy();
    up.destroy();
  };
  up.on("error", close);
  socket.on("error", close);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`local proxy on http://bar.localhost:${PORT}  (api :4000, ws :4001, web :3000)`);
});
