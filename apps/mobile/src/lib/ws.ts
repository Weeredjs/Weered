import { WS_URL } from "./config";
import { getAuthToken } from "./storage";

type Handler = (msg: any) => void;

export class WeeredSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  connect() {
    this.intentionallyClosed = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      // Already connected/connecting — re-auth in case the token changed.
      if (this.ws.readyState === WebSocket.OPEN) {
        const token = getAuthToken();
        if (token) this.ws.send(JSON.stringify({ type: "auth:hello", token }));
      }
      return;
    }
    this.open();
  }

  reauth() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const token = getAuthToken();
      if (token) this.ws.send(JSON.stringify({ type: "auth:hello", token }));
    }
  }

  // Force-close and reopen the socket. Use when a stale/zombied connection is
  // suspected (e.g. silent send failures, long network changes).
  forceReconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.intentionallyClosed = false;
    this.open();
  }

  private open() {
    const ws = new WebSocket(WS_URL);
    this.ws = ws;
    ws.onopen = () => {
      const token = getAuthToken();
      if (token) ws.send(JSON.stringify({ type: "auth:hello", token }));
    };
    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      for (const h of this.handlers) h(msg);
    };
    ws.onclose = () => {
      this.ws = null;
      if (!this.intentionallyClosed) this.scheduleReconnect();
    };
    ws.onerror = () => {};
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, 2000);
  }

  send(msg: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(handler: Handler) {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  close() {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }
}

export const wsClient = new WeeredSocket();
