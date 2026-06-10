package ca.weered.connect;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

// Persistent config. Stored as plain JSON in:
//   <minecraft>/config/weered-connect.json
//
// Holds: API base URL, Bearer token (after pairing), whether HUD is visible.
//
// Security note: this is plaintext on disk and the token grants the mod
// the ability to post presence as the linked Weered user. We accept this
// (standard for client mods; same as Discord rich-presence tokens, etc.)
// and design the backend so a stolen token is low-value: it cannot read
// DMs, post chat, or modify the Weered account — only set MC presence.
public class WeeredConfig {
    public static final String MOD_VERSION = "0.1.0";
    private static final Path CONFIG_PATH =
        FabricLoader.getInstance().getConfigDir().resolve("weered-connect.json");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public String apiBase = "https://api.weered.ca";
    public String webBase = "https://weered.ca";
    public String token   = "";        // Empty until paired
    public String userId  = "";
    public String displayName = "";
    public boolean hudEnabled = true;

    public static WeeredConfig load() {
        try {
            if (Files.exists(CONFIG_PATH)) {
                String raw = Files.readString(CONFIG_PATH);
                WeeredConfig c = GSON.fromJson(raw, WeeredConfig.class);
                if (c != null) return c;
            }
        } catch (Exception e) {
            WeeredConnectClient.LOG.warn("[Weered] config load failed, using defaults", e);
        }
        return new WeeredConfig();
    }

    public void save() {
        try {
            Files.createDirectories(CONFIG_PATH.getParent());
            Files.writeString(CONFIG_PATH, GSON.toJson(this));
        } catch (IOException e) {
            WeeredConnectClient.LOG.warn("[Weered] config save failed", e);
        }
    }

    public boolean isLinked() {
        return token != null && !token.isEmpty();
    }

    public void unlink() {
        this.token = "";
        this.userId = "";
        this.displayName = "";
        save();
    }
}
