import { weeredToast } from "../../lib/toast";
import { API } from "./chatShared";

export function runSlashCommand(
  raw: string,
  opts: {
    me?: any;
    send: (body: string) => void;
    openGif: (query?: string) => void;
    clear: () => void;
    tip: (toUsername: string, amount: number, note: string) => void;
  },
): boolean {
  if (!raw.startsWith("/")) return false;
  const [cmdRaw, ...rest] = raw.slice(1).split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const args = rest.join(" ").trim();
  const meName = String(opts.me?.name || "someone");
  switch (cmd) {
    case "me":
      if (!args) {
        weeredToast.error("Usage: /me does something");
        return true;
      }
      opts.send(`*${meName} ${args}*`);
      opts.clear();
      return true;
    case "tip": {
      const m = args.match(/^@?([a-zA-Z0-9][a-zA-Z0-9_-]{0,31})\s+(\d[\d,]*)(?:\s+(.+))?$/);
      if (!m) {
        weeredToast.error("Usage: /tip @user <amount> [note]");
        return true;
      }
      const toUsername = m[1];
      const amount = parseInt(m[2].replace(/,/g, ""), 10);
      const note = (m[3] || "").trim();
      if (!Number.isFinite(amount) || amount < 1) {
        weeredToast.error("Tip amount must be at least 1 Paper.");
        return true;
      }
      opts.tip(toUsername, amount, note);
      opts.clear();
      return true;
    }
    case "shrug":
      opts.send(`${args ? args + " " : ""}¯\\_(ツ)_/¯`);
      opts.clear();
      return true;
    case "tableflip":
      opts.send(`${args ? args + " " : ""}(╯°□°)╯︵ ┻━┻`);
      opts.clear();
      return true;
    case "unflip":
      opts.send(`${args ? args + " " : ""}┬─┬ ノ( ゜-゜ノ)`);
      opts.clear();
      return true;
    case "flip":
      opts.send(`${args ? args + " " : ""}（ノಠ益ಠ）ノ彡┻━┻`);
      opts.clear();
      return true;
    case "roll": {
      const m = args.match(/^(\d*)d(\d+)(?:\s*([+\-]\s*\d+))?$/i) || ["", "1", "20"];
      const n = Math.max(1, Math.min(20, parseInt(m[1] || "1", 10) || 1));
      const sides = Math.max(2, Math.min(1000, parseInt(m[2] || "20", 10) || 20));
      const mod = m[3] ? parseInt(m[3].replace(/\s+/g, ""), 10) : 0;
      const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
      const sum = rolls.reduce((a, b) => a + b, 0) + mod;
      const breakdown =
        n === 1
          ? `${rolls[0]}`
          : `${rolls.join(" + ")}${mod ? ` ${mod >= 0 ? "+" : "-"} ${Math.abs(mod)}` : ""} = ${sum}`;
      opts.send(`🎲 \`${n}d${sides}${mod ? (mod >= 0 ? `+${mod}` : mod) : ""}\` → ${breakdown}`);
      opts.clear();
      return true;
    }
    case "giphy":
      opts.openGif(args || undefined);
      opts.clear();
      return true;
    case "mod":
    case "mods": {
      const query = args;
      void (async () => {
        try {
          if (!query) {
            weeredToast("/mod <name> — drop a Windrose mod into chat. Try: /mod qol plus");
            return;
          }
          const token =
            (typeof window !== "undefined" ? localStorage.getItem("weered_token") : "") || "";
          const r = await fetch(
            `${API}/mods?search=${encodeURIComponent(query)}&limit=1&gameSlug=windrose`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
          );
          const j = await r.json();
          const hit = (j?.mods || [])[0];
          if (!hit?.sourceUrl) {
            weeredToast.error(`No mod matched "${query}".`);
            return;
          }
          opts.send(hit.sourceUrl);
        } catch {
          weeredToast.error("Mod lookup failed.");
        }
      })();
      opts.clear();
      return true;
    }
    case "help":
    case "commands": {
      const help = [
        "Slash commands:",
        "/me <action> — action emote",
        "/tip @user <amount> [note] — send Paper",
        "/shrug · /tableflip · /unflip · /flip — classics",
        "/roll 2d20 — dice roll (modifiers: /roll 1d20+3)",
        "/giphy <query> — opens GIF picker",
      ].join("\n");
      weeredToast(help);
      opts.clear();
      return true;
    }
    default:
      weeredToast.error(`Unknown command: /${cmdRaw}`);
      return true;
  }
}
