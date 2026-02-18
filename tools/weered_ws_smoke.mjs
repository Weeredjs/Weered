const API = "http://127.0.0.1:4000";
const WS_URL = "ws://127.0.0.1:4001";
const ROOM = "abc123";

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // 1) dev-login
  const r = await fetch(`${API}/auth/dev-login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: "WS-Smoke" }),
  });

  if (!r.ok) {
    console.error("dev-login failed:", r.status, await r.text());
    process.exit(1);
  }
  const { token } = await r.json();
  if (!token) { console.error("No token returned"); process.exit(1); }
  console.log("Got token:", token.slice(0, 20) + "...");

  // 2) WS connect
  const ws = new WebSocket(WS_URL);

  const timer = setTimeout(() => {
    console.error("Timed out waiting for auth:ok");
    try { ws.close(); } catch {}
    process.exit(2);
  }, 4000);

  ws.onopen = () => {
    console.log("WS open");
    ws.send(JSON.stringify({ type: "auth:hello", token, client: { ua: "weered_ws_smoke" } }));
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    console.log("WS <-", msg);

    if (msg.type === "auth:ok") {
      ws.send(JSON.stringify({ type: "presence:join", roomId: ROOM }));
      return;
    }

    if (msg.type === "presence:state") {
      clearTimeout(timer);
      console.log("OK: got presence:state for room", msg.roomId);
      ws.close();
      process.exit(0);
    }

    if (msg.type === "auth:fail") {
      clearTimeout(timer);
      console.error("auth:fail");
      ws.close();
      process.exit(3);
    }
  };

  ws.onerror = (e) => console.error("WS error", e);
  ws.onclose = () => console.log("WS closed");
}

main().catch(err => { console.error(err); process.exit(9); });
