package ca.weered.connect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.client.MinecraftClient;
import net.minecraft.text.ClickEvent;
import net.minecraft.text.HoverEvent;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.util.ArrayList;
import java.util.List;

// Per-tick driver. Runs on the client tick callback. Does NOT do network
// work inline — schedules CompletableFutures whose completion handlers
// marshal results back here via MinecraftClient.execute().
//
// Two background jobs:
//   1. Pairing poll — every 3s while a code is active and unconsumed
//   2. Presence heartbeat — every 60s while on a server AND linked
//   3. Fellows refresh — every 30s while on a server AND linked
public class WeeredDriver {
    private static final long HEARTBEAT_INTERVAL_MS = 60_000L;
    private static final long FELLOWS_INTERVAL_MS = 30_000L;
    private static final long PAIRING_POLL_INTERVAL_MS = 3_000L;

    private static boolean pairPollInFlight = false;
    private static boolean heartbeatInFlight = false;
    private static boolean fellowsInFlight = false;

    public static void onTick(MinecraftClient client) {
        long now = System.currentTimeMillis();
        WeeredState s = WeeredConnectClient.STATE;
        WeeredConfig c = WeeredConnectClient.CONFIG;

        // Pairing poll
        if (s.pairingCode != null && !pairPollInFlight) {
            if (now > s.pairingExpiresAt) {
                s.pairingCode = null;
                tellPlayer(client, Text.literal("[Weered] Pairing code expired. Use /weered link to try again.").formatted(Formatting.YELLOW));
            } else if (now >= s.pairingNextPollAt) {
                pairPollInFlight = true;
                s.pairingNextPollAt = now + PAIRING_POLL_INTERVAL_MS;
                final String code = s.pairingCode;
                WeeredConnectClient.API.pairPoll(code).whenComplete((res, err) ->
                    MinecraftClient.getInstance().execute(() -> {
                        pairPollInFlight = false;
                        if (err != null || res == null) return;
                        if (res.has("confirmed") && res.get("confirmed").getAsBoolean()) {
                            c.token = res.get("token").getAsString();
                            c.userId = res.has("userId") && !res.get("userId").isJsonNull() ? res.get("userId").getAsString() : "";
                            c.displayName = res.has("displayName") && !res.get("displayName").isJsonNull() ? res.get("displayName").getAsString() : "";
                            c.save();
                            s.pairingCode = null;
                            tellPlayer(client, Text.literal("[Weered] ")
                                .append(Text.literal("Linked.").formatted(Formatting.GREEN, Formatting.BOLD))
                                .append(Text.literal(" Welcome, " + c.displayName + ". HUD will appear when you're on a server.")));
                        }
                    }));
            }
        }

        // Presence heartbeat
        if (c.isLinked() && s.currentServerAddress != null && !heartbeatInFlight && now >= s.nextHeartbeatAt) {
            heartbeatInFlight = true;
            s.nextHeartbeatAt = now + HEARTBEAT_INTERVAL_MS;
            String mcUuid = client.getSession() != null && client.getSession().getUuidOrNull() != null
                ? client.getSession().getUuidOrNull().toString() : null;
            String mcUsername = client.getSession() != null ? client.getSession().getUsername() : null;
            WeeredConnectClient.API.presence(
                s.currentServerAddress, s.currentServerName,
                s.currentIsRealm, s.currentWorldName,
                mcUuid, mcUsername
            ).whenComplete((res, err) -> MinecraftClient.getInstance().execute(() -> {
                heartbeatInFlight = false;
                if (err != null) WeeredConnectClient.LOG.debug("[Weered] heartbeat failed", err);
            }));
        }

        // Fellows refresh
        if (c.isLinked() && s.currentServerAddress != null && !fellowsInFlight
                && now - s.lastFellowsFetchAt >= FELLOWS_INTERVAL_MS) {
            fellowsInFlight = true;
            s.lastFellowsFetchAt = now;
            final String addr = s.currentServerAddress;
            WeeredConnectClient.API.presenceServer(addr).whenComplete((res, err) ->
                MinecraftClient.getInstance().execute(() -> {
                    fellowsInFlight = false;
                    if (err != null || res == null || !res.has("players")) return;
                    JsonArray arr = res.getAsJsonArray("players");
                    List<WeeredState.Fellow> out = new ArrayList<>();
                    for (JsonElement el : arr) {
                        if (!el.isJsonObject()) continue;
                        JsonObject p = el.getAsJsonObject();
                        String userId = optString(p, "userId");
                        // Don't include self in the list.
                        if (userId != null && userId.equals(c.userId)) continue;
                        out.add(new WeeredState.Fellow(
                            optString(p, "weeredName"),
                            optString(p, "mcUsername"),
                            optString(p, "mcUuid"),
                            optString(p, "worldName")
                        ));
                    }
                    s.fellows = out;
                }));
        }
    }

    private static String optString(JsonObject o, String key) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : null;
    }

    private static void tellPlayer(MinecraftClient client, Text msg) {
        if (client.player != null) client.player.sendMessage(msg, false);
    }
}
