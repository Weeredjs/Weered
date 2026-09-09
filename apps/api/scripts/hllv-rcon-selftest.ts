// Self-test for the Hell Let Loose RCON client against a wire-accurate
// stand-in server (scripts/hllv-fake-server.mjs). No real server needed.
//
//   npx tsx scripts/hllv-rcon-selftest.ts
//
// Run it after touching src/lib/hllvRcon.ts. It proves the handshake, the
// XOR'd command path, split-frame reassembly, the wrong-password path, the
// SSRF guard on the RCON path, and the parsed shapes.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { HllvRcon, HllvRconError } from "../src/lib/hllvRcon";
import { parseLayer } from "../src/lib/hllVocab";

const PORT = 27299;
const SERVER = fileURLToPath(new URL("./hllv-fake-server.mjs", import.meta.url));

function startServer(): Promise<ReturnType<typeof spawn>> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [SERVER], {
      env: { ...process.env, FAKE_PORT: String(PORT) },
    });
    p.stdout.on("data", (d) => {
      if (String(d).includes("fake hllv rcon")) resolve(p);
    });
    p.stderr.on("data", (d) => console.error("[server]", String(d)));
    p.on("exit", (code) => reject(new Error("server exited " + code)));
  });
}

function vocabChecks() {
  const cases: [
    "hll" | "hllv",
    string,
    string | null,
    string | null,
    string | null,
    string | null,
  ][] = [
    ["hll", "carentan_warfare_night", "Carentan", "Warfare", null, "Night"],
    ["hll", "elsenbornridge_offensiveUS_day", "Elsenborn Ridge", "Offensive", "US", "Day"],
    ["hll", "REM_L_1945_OffensiveGER", "Remagen", "Offensive", "GER", "Day"],
    ["hll", "SME_S_1944_Day_P_Skirmish", "Ste. Mère Église", "Skirmish", null, "Day"],
    ["hll", "PHL_L_1944_Warfare_Night", "Purple Heart Lane", "Warfare", null, "Night"],
    ["hll", "STA_L_1942_OffensiveRUS", "Stalingrad", "Offensive", "SOV", "Day"],
    ["hll", "elalamein_offensive_CW", "El Alamein", "Offensive", "CW", "Day"],
    ["hll", "REM_L_1945_WarfareNight", "Remagen", "Warfare", null, "Night"],
    ["hllv", "wdeva_offensivenva_day", "Vạn Tường", "Offensive", "NVA", "Day"],
    ["hllv", "/Game/Maps/wdevc_warfare_day", "Huế Outskirts", "Warfare", null, "Day"],
    ["hll", "totally_new_map_warfare", null, "Warfare", null, null],
  ];
  for (const [game, id, map, mode, attacker, tod] of cases) {
    const l = parseLayer(game, id);
    assert.deepEqual([l.map, l.mode, l.attacker, l.timeOfDay], [map, mode, attacker, tod], id);
  }
  console.log(`ok  ${cases.length} layer ids parsed across both grammars and both games`);
}

async function main() {
  vocabChecks();
  const server = await startServer();
  try {
    // 1. wrong password → bad_password, socket closed
    await assert.rejects(
      () => HllvRcon.dial("127.0.0.1", PORT, "nope", 3000),
      (e: any) => e instanceof HllvRconError && e.code === "bad_password",
    );
    console.log("ok  wrong password refused with code bad_password");

    // 2. right password → session / players / rotation / config parse
    const c = await HllvRcon.dial("127.0.0.1", PORT, "hunter2", 3000);
    try {
      const [session, players, rotation, config] = await Promise.all([
        c.info("session"),
        c.info("players"),
        c.info("maprotation"),
        c.info("serverconfig"),
      ]);
      assert.equal(session.mapId, "wdeva_warfare_day");
      assert.equal(session.playerCount, 3);
      assert.equal(session.alliedFaction, 1);
      assert.equal(players.players.length, 3);
      assert.equal(players.players[2].role, 14);
      assert.equal(players.players[0].scoreData.cOMBAT, 120);
      assert.equal(rotation.mAPS.length, 2);
      assert.equal(config.buildNumber, 1042);
      console.log(
        "ok  four concurrent GetServerInformation reads, ids matched, split frames reassembled",
      );

      // 3. unknown info name → command error, connection still usable
      await assert.rejects(
        () => c.info("nonsense"),
        (e: any) => e instanceof HllvRconError && e.code === "command",
      );
      const again = await c.info("session");
      assert.equal(again.serverName, "16th IR | Vietnam | Realism");
      console.log("ok  bad command is an error, not a dead socket");
    } finally {
      c.close();
    }

    // 4. private address through the front door is refused before any socket
    await assert.rejects(
      () => HllvRcon.connect("127.0.0.1", PORT, "hunter2", 3000),
      (e: any) => e instanceof HllvRconError && e.code === "private_host",
    );
    console.log("ok  connect() refuses a private address (SSRF guard on the RCON path)");

    // 5. nothing listening → connect_failed quickly
    await assert.rejects(
      () => HllvRcon.dial("127.0.0.1", PORT + 1, "hunter2", 3000),
      (e: any) => e instanceof HllvRconError && /^connect_/.test(e.code),
    );
    console.log("ok  closed port → connect_failed");

    console.log("ALL PASS");
  } finally {
    server.kill();
  }
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
