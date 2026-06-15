import { log, swallow } from "../lib/logger";
import type { FastifyInstance } from "fastify";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";

// Tauri desktop auto-updater endpoints (extracted from index.ts). Polls the
// GitHub releases of the desktop repo for the latest desktop-v* build and serves
// the Tauri update manifest. Self-contained: GitHub fetch + an in-process cache.
export default async function desktopRoutes(app: FastifyInstance) {
  type DesktopReleaseManifest = {
    version: string;
    notes: string;
    pub_date: string;
    platforms: Record<string, { signature: string; url: string }>;
  };

  const TAURI_TARGET_MATCHERS: Record<string, RegExp> = {
    "windows-x86_64": /Weered.*x64-setup\.exe$/i,
    "darwin-x86_64": /Weered.*x64\.app\.tar\.gz$/i,
    "darwin-aarch64": /Weered.*aarch64\.app\.tar\.gz$/i,
    "linux-x86_64": /weered.*amd64\.AppImage$/i,
  };

  type GhAsset = { name: string; browser_download_url: string };
  type GhRelease = {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    assets: GhAsset[];
    prerelease: boolean;
    draft: boolean;
  };

  let desktopReleaseCache: { manifest: DesktopReleaseManifest | null; expiresAt: number } | null =
    null;
  const DESKTOP_RELEASE_TTL = 5 * 60 * 1000;

  const DESKTOP_RELEASES_REPO = process.env.DESKTOP_RELEASES_REPO || "Weeredjs/Weered";

  async function fetchLatestDesktopRelease(): Promise<DesktopReleaseManifest | null> {
    if (desktopReleaseCache && desktopReleaseCache.expiresAt > Date.now()) {
      return desktopReleaseCache.manifest;
    }

    let manifest: DesktopReleaseManifest | null = null;
    try {
      const url = `https://api.github.com/repos/${DESKTOP_RELEASES_REPO}/releases?per_page=10`;
      const headers: Record<string, string> = {
        "User-Agent": "Weered-API/1.0",
        Accept: "application/vnd.github+json",
      };
      if (process.env.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
      const res = await fetchWithTimeout(url, { headers });
      if (!res.ok) throw new Error(`GitHub releases ${res.status}`);
      const releases = (await res.json()) as GhRelease[];

      const latest = releases.find(
        (r) => !r.draft && !r.prerelease && /^desktop-v/.test(r.tag_name),
      );
      if (!latest) {
        manifest = null;
      } else {
        const version = latest.tag_name.replace(/^desktop-v/, "");

        const platforms: DesktopReleaseManifest["platforms"] = {};
        for (const [target, matcher] of Object.entries(TAURI_TARGET_MATCHERS)) {
          const asset = latest.assets.find((a) => matcher.test(a.name));
          if (!asset) continue;
          const sigAsset = latest.assets.find((a) => a.name === `${asset.name}.sig`);
          let signature = "";
          if (sigAsset) {
            try {
              const sigRes = await fetchWithTimeout(sigAsset.browser_download_url, {
                headers: { "User-Agent": "Weered-API/1.0" },
              });
              if (sigRes.ok) signature = (await sigRes.text()).trim();
            } catch (e) {
              swallow(e);
            }
          }
          platforms[target] = { signature, url: asset.browser_download_url };
        }

        if (Object.keys(platforms).length > 0) {
          manifest = {
            version,
            notes: latest.body || `Weered Desktop ${version}`,
            pub_date: latest.published_at,
            platforms,
          };
        }
      }
    } catch (e) {
      log.warn("[desktop-updater] fetchLatestDesktopRelease failed:", e);
      if (desktopReleaseCache?.manifest) return desktopReleaseCache.manifest;
    }

    desktopReleaseCache = { manifest, expiresAt: Date.now() + DESKTOP_RELEASE_TTL };
    return manifest;
  }

  app.get<{ Params: { target: string; version: string } }>(
    "/desktop/updates/:target/:version",
    async (req, reply) => {
      const manifest = await fetchLatestDesktopRelease();
      if (!manifest) return reply.code(204).send();
      const { version, target } = req.params;
      if (manifest.version === version) return reply.code(204).send();
      const plat = manifest.platforms[target];
      if (!plat || !plat.signature) return reply.code(204).send();
      return reply.send(manifest);
    },
  );

  app.get("/desktop/latest", async (_req, reply) => {
    const manifest = await fetchLatestDesktopRelease();
    if (!manifest) return reply.send({ ok: true, release: null });
    return reply.send({
      ok: true,
      release: {
        version: manifest.version,
        pub_date: manifest.pub_date,
        notes: manifest.notes,
        downloads: Object.fromEntries(
          Object.entries(manifest.platforms).map(([k, v]) => [k, v.url]),
        ),
      },
    });
  });
}
