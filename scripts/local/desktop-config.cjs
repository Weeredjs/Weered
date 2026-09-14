// Builds a Tauri config override for a LOCAL desktop build that loads the local
// stack instead of weered.ca. Nothing in src-tauri/ is edited: the override is
// passed with `tauri dev --config`, which merge-patches tauri.conf.json.
//
//   node scripts/local/desktop-config.cjs > %TEMP%\weered-desktop-local.json
//   cd apps/desktop && npx tauri dev --config %TEMP%\weered-desktop-local.json
//
// Merge-patch replaces arrays wholesale, so the window list is copied from the
// real config and only its URL and title change.

const fs = require("fs");
const path = require("path");

const LOCAL = process.env.WEERED_LOCAL_ORIGIN || "http://bar.localhost:8080";
const conf = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../apps/desktop/src-tauri/tauri.conf.json"), "utf8"),
);

const windows = conf.app.windows.map((w) =>
  w.label === "main" ? { ...w, url: LOCAL, title: "Weered (local)" } : w,
);

const override = {
  // Own identity: its own settings folder and single-instance lock, so it runs
  // beside an installed Weered desktop without either touching the other.
  identifier: "ca.weered.desktop.local",
  productName: "Weered Local",
  // The CLI waits for devUrl using the OS resolver, which (like Node) cannot
  // resolve *.localhost. WebView2 can, and the window loads LOCAL, so the CLI
  // only needs an address it can reach.
  build: { devUrl: LOCAL.replace(/\/\/[^/:]+/, "//127.0.0.1") },
  app: {
    windows,
    security: {
      capabilities: [
        "default",
        {
          identifier: "local-stack",
          description: "Lets the local stack's pages reach the app commands (BAR launcher).",
          windows: ["main"],
          // Same grants the shipped app gives weered.ca. core:default alone leaves
          // out window control, so the custom title bar can't minimise, close or drag.
          permissions: JSON.parse(
            fs.readFileSync(
              path.join(__dirname, "../../apps/desktop/src-tauri/capabilities/default.json"),
              "utf8",
            ),
          ).permissions,
          remote: { urls: [`${LOCAL}/*`] },
        },
      ],
    },
  },
  // Debug builds register URL schemes at startup; a local copy must not claim
  // weered:// from the real app.
  plugins: { "deep-link": { desktop: { schemes: [] } } },
};

process.stdout.write(JSON.stringify(override, null, 2));
