import { describe, it, expect } from "vitest";
import {
  isPublicHost,
  readConfiguredServers,
  prettyTrack,
  prettyCar,
} from "../../src/routes/assetto";

// The server board fetches whatever host a lobby admin configured. If that list
// could name an internal address, the endpoint becomes a probe of the droplet's
// own network — including the cloud metadata service. These are the guard rails.
describe("isPublicHost — the SSRF guard", () => {
  it("accepts ordinary public hosts", () => {
    for (const h of ["fastfox.racing", "ac.example.com", "203.0.113.10", "8.8.8.8"]) {
      expect(isPublicHost(h), h).toBe(true);
    }
  });

  it("rejects loopback in every spelling", () => {
    for (const h of ["localhost", "LOCALHOST", "app.localhost", "127.0.0.1", "127.1.2.3", "::1"]) {
      expect(isPublicHost(h), h).toBe(false);
    }
  });

  it("rejects RFC1918 private ranges", () => {
    for (const h of ["10.0.0.5", "192.168.1.1", "172.16.0.1", "172.31.255.254"]) {
      expect(isPublicHost(h), h).toBe(false);
    }
  });

  it("allows 172.x outside the private block", () => {
    expect(isPublicHost("172.15.0.1")).toBe(true);
    expect(isPublicHost("172.32.0.1")).toBe(true);
  });

  it("rejects link-local — this is the cloud metadata address", () => {
    expect(isPublicHost("169.254.169.254")).toBe(false);
  });

  it("rejects 0.0.0.0, multicast and reserved space", () => {
    for (const h of ["0.0.0.0", "224.0.0.1", "255.255.255.255"]) {
      expect(isPublicHost(h), h).toBe(false);
    }
  });

  it("rejects .local mDNS names and bracketed IPv6", () => {
    expect(isPublicHost("nas.local")).toBe(false);
    expect(isPublicHost("[::1]")).toBe(false);
  });

  it("rejects anything with credentials, paths, ports or spaces smuggled in", () => {
    for (const h of [
      "evil.com/path",
      "user@evil.com",
      "evil.com:8080",
      "evil com",
      "evil.com?x=1",
      "",
      "  ",
    ]) {
      expect(isPublicHost(h), JSON.stringify(h)).toBe(false);
    }
  });

  it("rejects octets above 255 rather than treating them as a hostname", () => {
    expect(isPublicHost("999.1.1.1")).toBe(false);
  });
});

describe("readConfiguredServers — operator JSON is untrusted too", () => {
  const cfg = (acServers: unknown) => ({ acServers });

  it("reads a well-formed list", () => {
    const out = readConfiguredServers(
      cfg([{ host: "fastfox.racing", httpPort: 8084, label: "GT3" }]),
    );
    expect(out).toEqual([{ host: "fastfox.racing", httpPort: 8084, label: "GT3" }]);
  });

  it("drops entries pointing at internal addresses", () => {
    const out = readConfiguredServers(
      cfg([
        { host: "127.0.0.1", httpPort: 8084 },
        { host: "169.254.169.254", httpPort: 80 },
        { host: "fastfox.racing", httpPort: 8092 },
      ]),
    );
    expect(out).toHaveLength(1);
    expect(out[0].host).toBe("fastfox.racing");
  });

  it("drops entries with an unusable port", () => {
    const out = readConfiguredServers(
      cfg([
        { host: "a.com", httpPort: 0 },
        { host: "b.com", httpPort: 70000 },
        { host: "d.com", httpPort: 8084.5 },
        { host: "f.com", httpPort: "not-a-port" },
        { host: "e.com", httpPort: 8084 },
      ]),
    );
    expect(out.map((s) => s.host)).toEqual(["e.com"]);
  });

  it("accepts a numeric string port — config is hand-edited, and this is safe", () => {
    // Coercion only affects the port number, never the host check, and a
    // non-numeric string still fails. Being forgiving here saves an operator a
    // baffling empty board over a pair of quotes.
    const out = readConfiguredServers(cfg([{ host: "c.com", httpPort: "8084" }]));
    expect(out).toEqual([{ host: "c.com", httpPort: 8084, label: null }]);
  });

  it("caps the list so one lobby cannot fan out endlessly", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ host: `s${i}.com`, httpPort: 9000 + i }));
    expect(readConfiguredServers(cfg(many)).length).toBeLessThanOrEqual(12);
  });

  it("survives junk config without throwing", () => {
    for (const bad of [undefined, null, {}, { acServers: "nope" }, { acServers: [null, 5, "x"] }]) {
      expect(readConfiguredServers(bad)).toEqual([]);
    }
  });
});

describe("display names off AC asset paths", () => {
  it("unwraps a CSP-prefixed track path", () => {
    expect(prettyTrack("csp/2651/../H/../ks_vallelunga-extended_circuit")).toBe(
      "Vallelunga Extended Circuit",
    );
  });

  it("handles a plain track id", () => {
    expect(prettyTrack("csp/2651/../H/../spa")).toBe("Spa");
    expect(prettyTrack("ks_nordschleife")).toBe("Nordschleife");
  });

  it("returns null when there is nothing to show", () => {
    expect(prettyTrack(null)).toBeNull();
    expect(prettyTrack("")).toBeNull();
  });

  it("keeps racing acronyms upper-case in car names", () => {
    expect(prettyCar("bmw_z4_gt3")).toBe("BMW Z4 GT3");
    expect(prettyCar("mercedes_sls_gt3")).toBe("Mercedes SLS GT3");
    expect(prettyCar("lotus_exos_125_s1")).toBe("Lotus Exos 125 S1");
    expect(prettyCar("ferrari_458_gt2")).toBe("Ferrari 458 GT2");
  });

  // Sim racers notice these. Getting them wrong signals software that has never
  // seen the game.
  it("spells the awkward names the way the paddock does", () => {
    expect(prettyCar("mclaren_mp412c_gt3")).toBe("McLaren MP4-12C GT3");
    expect(prettyCar("ks_nissan_gtr_gt3")).toBe("Nissan GT-R GT3");
    expect(prettyCar("ks_porsche_911_gt3_rsr")).toBe("Porsche 911 GT3 RSR");
    expect(prettyCar("ks_mclaren_650s_gt3")).toBe("McLaren 650S GT3");
  });
});
