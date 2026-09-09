// A stand-in Hell Let Loose (Vietnam) RCON server, wire-accurate to
// timraay/hllrcon's protocol: 12-byte LE header (magic, id, len), JSON body,
// XOR'd with a per-connection key after ServerConnect. Enough to prove the
// client's framing, XOR, login and GetServerInformation end to end.
import net from "node:net";
import crypto from "node:crypto";

const MAGIC = 0xde450508;
const PASSWORD = process.env.FAKE_PW || "hunter2";
const PORT = Number(process.env.FAKE_PORT || 27299);

const SESSION = {
  serverName: "16th IR | Vietnam | Realism",
  mapName: "VẠN TƯỜNG WARFARE",
  mapId: "wdeva_warfare_day",
  gameMode: "Warfare",
  remainingMatchTime: 2712,
  matchTime: 5400,
  alliedScore: 3,
  axisScore: 2,
  playerCount: 3,
  alliedPlayerCount: 2,
  axisPlayerCount: 1,
  maxPlayerCount: 100,
  queueCount: 0,
  maxQueueCount: 6,
  vipQueueCount: 0,
  maxVipQueueCount: 2,
  alliedFaction: 1,
  axisFaction: 6,
  alliedMorale: 850,
  axisMorale: 900,
  initialMorale: 1000,
};

const player = (name, team, role, platoon, idx, level) => ({
  name,
  clanTag: "16IR",
  iD: "eos-" + name,
  platform: "EPlatformFamily::Steam",
  eosId: "eos-" + name,
  steamId: null,
  level,
  team,
  role,
  platoon,
  platoonIndex: idx,
  loadout: "Standard",
  stats: { deaths: 3, infantryKills: 11, vehicleKills: 0, teamKills: 0, vehiclesDestroyed: 0 },
  scoreData: { cOMBAT: 120, offense: 60, defense: 40, support: 20 },
  worldPosition: { x: 1, y: 2, z: 3 },
});

const PLAYERS = {
  players: [
    player("Sgt.Miller", 1, 9, "ABLE", 0, 44),
    player("Doc", 1, 3, "ABLE", 0, 12),
    player("Nguyen", 6, 14, "MORTAR", 2, 80),
  ],
};

const ROTATION = {
  currentIndex: 0,
  mAPS: [
    {
      name: "VẠN TƯỜNG WARFARE",
      gameMode: "Warfare",
      timeOfDay: "Day",
      iD: "/Game/Maps/wdeva_warfare_day",
      position: 0,
    },
    {
      name: "HUẾ OUTSKIRTS US OFFENSIVE",
      gameMode: "US Offensive",
      timeOfDay: "Day",
      iD: "wdevc_offensiveus_day",
      position: 1,
    },
  ],
};

const CONFIG = {
  serverName: SESSION.serverName,
  buildNumber: 1042,
  buildRevision: 7,
  supportedPlatforms: ["EPlatform::PC_Steam", "EPlatform::PS5", "EPlatform::Xbox_SeriesX"],
  passwordProtected: false,
};

function xor(buf, key) {
  if (!key) return buf;
  const out = Buffer.allocUnsafe(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return out;
}

const server = net.createServer((sock) => {
  let key = null;
  let token = null;
  let buf = Buffer.alloc(0);

  const send = (id, obj) => {
    const body = xor(Buffer.from(JSON.stringify(obj), "utf8"), key);
    const h = Buffer.allocUnsafe(12);
    h.writeUInt32LE(MAGIC, 0);
    h.writeUInt32LE(id, 4);
    h.writeUInt32LE(body.length, 8);
    // Split the write so the client has to reassemble a frame — but keep the
    // three pieces contiguous on the socket, as a real server would. (An
    // earlier version spread them over timers, which interleaved concurrent
    // replies: a fault no TCP server has, and one the client rightly refused.)
    sock.write(h);
    sock.write(body.subarray(0, 5));
    sock.write(body.subarray(5));
  };

  const reply = (id, req, statusCode, contentBody, statusMessage = "OK") =>
    send(id, { name: req.name, version: req.version, statusCode, statusMessage, contentBody });

  sock.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 12) return;
      if (buf.readUInt32LE(0) !== MAGIC) {
        sock.destroy();
        return;
      }
      const id = buf.readUInt32LE(4);
      const len = buf.readUInt32LE(8);
      if (buf.length < 12 + len) return;
      const raw = xor(buf.subarray(12, 12 + len), key);
      buf = buf.subarray(12 + len);
      let req;
      try {
        req = JSON.parse(raw.toString("utf8"));
      } catch {
        sock.destroy();
        return;
      }
      if (req.name === "ServerConnect") {
        key = crypto.randomBytes(16);
        // Key goes out in the clear; everything after is XOR'd.
        const body = Buffer.from(
          JSON.stringify({
            name: "ServerConnect",
            version: 2,
            statusCode: 200,
            statusMessage: "OK",
            contentBody: key.toString("base64"),
          }),
        );
        const h = Buffer.allocUnsafe(12);
        h.writeUInt32LE(MAGIC, 0);
        h.writeUInt32LE(id, 4);
        h.writeUInt32LE(body.length, 8);
        sock.write(Buffer.concat([h, body]));
        continue;
      }
      if (req.name === "Login") {
        if (req.contentBody !== PASSWORD) {
          reply(id, req, 401, "", "Unauthorized");
          continue;
        }
        token = crypto.randomBytes(12).toString("hex");
        reply(id, req, 200, token);
        continue;
      }
      if (req.authToken !== token) {
        reply(id, req, 401, "", "Unauthorized");
        continue;
      }
      if (req.name === "GetServerInformation") {
        const q = JSON.parse(req.contentBody);
        const table = {
          session: SESSION,
          players: PLAYERS,
          maprotation: ROTATION,
          serverconfig: CONFIG,
        };
        const v = table[q.Name];
        if (!v) reply(id, req, 400, "", "Bad Request");
        else reply(id, req, 200, JSON.stringify(v));
        continue;
      }
      reply(id, req, 400, "", "Unknown command");
    }
  });
  sock.on("error", () => {});
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`fake hllv rcon on 127.0.0.1:${PORT} pw=${PASSWORD}`);
});
