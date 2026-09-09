// Hell Let Loose RCON, second-generation protocol. Shared by base HLL and
// HLL: Vietnam; Vietnam is the only reason it exists here.
//
// Vietnam publishes nothing to Steam's master list, so there is no top-down
// server browser to build. What there is: every rented Vietnam server ships
// with an RCON port and password, and the protocol is public (timraay/hllrcon
// documents it; this is a port of that wire format, not a wrapper around it).
// A unit that hands us its RCON details gets live match state, a live roster
// and a population history for its own box — which is the only box it cares
// about anyway.
//
// Wire format, both directions:
//   header  12 bytes little-endian: magic 0xDE450508, request id, body length
//   body    JSON, XOR'd with a per-connection key once one has been issued
//
// Handshake: ServerConnect (plaintext) returns the base64 XOR key; Login
// (XOR'd, body = the password) returns an auth token that rides in every later
// request. Reads go through GetServerInformation with a {Name, Value} body.
//
// Connections are single-use on purpose: open, log in, ask two or three
// questions, close. A unit's server is polled every ten minutes and on page
// load; a pooled socket would be complexity in service of nothing.
import net from "node:net";
import { resolveSafeHost } from "./ssrfGuard";

const MAGIC = 0xde450508;
const MAGIC_BYTES = Buffer.from([0x08, 0x05, 0x45, 0xde]);
const HEADER_LEN = 12;
/** A response larger than this is not a game server talking to us. */
const MAX_BODY = 4 * 1024 * 1024;

export type RconResponse = {
  name: string;
  version: number;
  statusCode: number;
  statusMessage: string;
  contentBody: string;
};

export class HllvRconError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

type Waiter = {
  resolve: (r: RconResponse) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class HllvRcon {
  private sock: net.Socket | null = null;
  private buf: Buffer = Buffer.alloc(0);
  private xorKey: Buffer | null = null;
  private authToken = "";
  private seq = 0;
  private waiters = new Map<number, Waiter>();
  private readonly timeoutMs: number;

  private constructor(timeoutMs: number) {
    this.timeoutMs = timeoutMs;
  }

  /** Resolve, dial the verified address, log in. Throws HllvRconError with a
   *  stable `code` a route can turn into a message: private_host, connect_*,
   *  bad_password, protocol. */
  static async connect(
    host: string,
    port: number,
    password: string,
    timeoutMs = 8000,
  ): Promise<HllvRcon> {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new HllvRconError("bad_port");
    let ip: string;
    try {
      ip = await resolveSafeHost(host);
    } catch (e: any) {
      throw new HllvRconError(String(e?.message || "private_host"));
    }
    return HllvRcon.dial(ip, port, password, timeoutMs);
  }

  /** Dial an address the caller has ALREADY vetted. `connect` is the front
   *  door; this exists so the wire code can be exercised against a local
   *  stand-in server, which the SSRF guard would (rightly) refuse. */
  static async dial(
    ip: string,
    port: number,
    password: string,
    timeoutMs = 8000,
  ): Promise<HllvRcon> {
    const c = new HllvRcon(timeoutMs);
    await c.open(ip, port);
    try {
      await c.login(password);
    } catch (e) {
      c.close();
      throw e;
    }
    return c;
  }

  private open(ip: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = net.createConnection({ host: ip, port });
      s.setNoDelay(true);
      const timer = setTimeout(() => {
        s.destroy();
        reject(new HllvRconError("connect_timeout"));
      }, this.timeoutMs);
      const onError = (e: Error) => {
        clearTimeout(timer);
        reject(new HllvRconError("connect_failed", e.message));
      };
      s.once("error", onError);
      s.once("connect", () => {
        clearTimeout(timer);
        s.off("error", onError);
        this.sock = s;
        s.on("data", (d: Buffer) => this.onData(d));
        s.on("error", (e: Error) => this.failAll(new HllvRconError("socket_error", e.message)));
        s.on("close", () => this.failAll(new HllvRconError("closed")));
        resolve();
      });
    });
  }

  close(): void {
    const s = this.sock;
    this.sock = null;
    if (s) s.destroy();
    this.failAll(new HllvRconError("closed"));
  }

  private failAll(err: Error): void {
    for (const [id, w] of this.waiters) {
      clearTimeout(w.timer);
      this.waiters.delete(id);
      w.reject(err);
    }
  }

  private crypt(b: Buffer): Buffer {
    const k = this.xorKey;
    if (!k || !k.length) return b;
    const out = Buffer.allocUnsafe(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b[i] ^ k[i % k.length];
    return out;
  }

  private onData(chunk: Buffer): void {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    // Loop: several complete packets can arrive in one read.
    for (;;) {
      if (this.buf.length < HEADER_LEN) return;
      const at = this.buf.indexOf(MAGIC_BYTES);
      if (at < 0) {
        // Nothing frame-shaped in here. Keep the last three bytes in case the
        // magic straddles two reads; drop the rest.
        this.buf = this.buf.subarray(Math.max(0, this.buf.length - 3));
        return;
      }
      if (at > 0) this.buf = this.buf.subarray(at);
      if (this.buf.length < HEADER_LEN) return;
      const magic = this.buf.readUInt32LE(0);
      const id = this.buf.readUInt32LE(4);
      const len = this.buf.readUInt32LE(8);
      if (magic !== MAGIC) {
        this.buf = this.buf.subarray(4);
        continue;
      }
      if (len > MAX_BODY) {
        this.failAll(new HllvRconError("protocol", "oversized frame"));
        this.close();
        return;
      }
      if (this.buf.length < HEADER_LEN + len) return;
      const body = this.crypt(this.buf.subarray(HEADER_LEN, HEADER_LEN + len));
      this.buf = this.buf.subarray(HEADER_LEN + len);
      const w = this.waiters.get(id);
      if (!w) continue; // late reply to a call that already timed out
      this.waiters.delete(id);
      clearTimeout(w.timer);
      try {
        const j = JSON.parse(body.toString("utf8"));
        w.resolve({
          name: String(j?.name ?? ""),
          version: Number(j?.version) || 0,
          statusCode: Number(j?.statusCode) || 0,
          statusMessage: String(j?.statusMessage ?? ""),
          contentBody:
            typeof j?.contentBody === "string"
              ? j.contentBody
              : JSON.stringify(j?.contentBody ?? ""),
        });
      } catch (e: any) {
        w.reject(new HllvRconError("protocol", `bad frame: ${e?.message || e}`));
      }
    }
  }

  execute(name: string, version: number, contentBody: string | object = ""): Promise<RconResponse> {
    const s = this.sock;
    if (!s) return Promise.reject(new HllvRconError("closed"));
    const id = this.seq++;
    const body = Buffer.from(
      JSON.stringify({
        authToken: this.authToken,
        version,
        name,
        contentBody: typeof contentBody === "string" ? contentBody : JSON.stringify(contentBody),
      }),
      "utf8",
    );
    const header = Buffer.allocUnsafe(HEADER_LEN);
    header.writeUInt32LE(MAGIC, 0);
    header.writeUInt32LE(id, 4);
    header.writeUInt32LE(body.length, 8);
    return new Promise<RconResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(id);
        reject(new HllvRconError("timeout", `${name} timed out`));
      }, this.timeoutMs);
      this.waiters.set(id, { resolve, reject, timer });
      s.write(Buffer.concat([header, this.crypt(body)]));
    });
  }

  private async login(password: string): Promise<void> {
    const hello = await this.execute("ServerConnect", 2, "");
    if (hello.statusCode !== 200) throw new HllvRconError("protocol", hello.statusMessage);
    const key = Buffer.from(hello.contentBody, "base64");
    if (!key.length) throw new HllvRconError("protocol", "empty xor key");
    this.xorKey = key;
    const auth = await this.execute("Login", 2, password);
    if (auth.statusCode === 401) throw new HllvRconError("bad_password");
    if (auth.statusCode !== 200) throw new HllvRconError("protocol", auth.statusMessage);
    this.authToken = auth.contentBody;
  }

  /** One GetServerInformation read, parsed. `name` is the server's own
   *  vocabulary: session, players, maprotation, mapsequence, serverconfig. */
  async info<T = any>(name: string, value = ""): Promise<T> {
    const r = await this.execute("GetServerInformation", 2, { Name: name, Value: value });
    if (r.statusCode !== 200)
      throw new HllvRconError(r.statusCode === 401 ? "unauthorized" : "command", r.statusMessage);
    try {
      return JSON.parse(r.contentBody) as T;
    } catch {
      throw new HllvRconError("protocol", `${name}: body is not JSON`);
    }
  }
}

/**
 * The common shape of one visit: connect, read what was asked for, close.
 * Errors bubble as HllvRconError so a route can say WHY the link failed.
 */
export async function rconRead<T>(
  host: string,
  port: number,
  password: string,
  fn: (c: HllvRcon) => Promise<T>,
  timeoutMs = 8000,
): Promise<T> {
  const c = await HllvRcon.connect(host, port, password, timeoutMs);
  try {
    return await fn(c);
  } finally {
    c.close();
  }
}
