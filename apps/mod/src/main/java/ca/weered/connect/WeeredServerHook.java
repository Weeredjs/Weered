package ca.weered.connect;

import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ServerInfo;

// Hooks into ClientPlayConnectionEvents to detect when the player joins a
// server. Populates WeeredState.currentServerAddress and friends.
//
// Server-key conventions:
//   - Direct/public:  "host:port" (literal address the user typed)
//   - Realm:          "REALM:<owner-uuid>:<realm-name>"
//   - LAN:            we skip (no auto-registration on LAN)
//   - Single-player:  we skip (nothing to do)
public class WeeredServerHook {
    public static void register() {
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> onJoin(client));
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> onDisconnect(client));
    }

    private static void onJoin(MinecraftClient client) {
        try {
            ServerInfo info = client.getCurrentServerEntry();
            WeeredState s = WeeredConnectClient.STATE;

            if (info == null) {
                // Single-player or unknown context — clear server state.
                s.currentServerAddress = null;
                s.currentServerName = null;
                s.currentIsRealm = false;
                s.currentWorldName = null;
                return;
            }

            boolean isRealm = info.isRealm();
            boolean isLan = info.isLocal();
            if (isLan) {
                // Explicitly skip LAN games — no auto-registration.
                s.currentServerAddress = null;
                return;
            }

            String address = info.address;
            String name = info.name;

            if (isRealm) {
                // Realms expose an opaque address. We can't reliably get the
                // Realm ID from ServerInfo alone, so we synthesize a key from
                // owner UUID + name. For v1 we use just the name — collisions
                // are possible but rare for casual users with one or two Realms.
                // TODO Phase 2: pull RealmsServer from RealmsScreen state to
                // get the real Realm ID for canonical keying.
                String safeName = (name == null ? "unnamed" : name).replaceAll("[^A-Za-z0-9_-]", "_");
                address = "REALM:" + safeName;
            }

            s.currentServerAddress = address;
            s.currentServerName = name;
            s.currentIsRealm = isRealm;
            s.currentWorldName = null;
            s.nextHeartbeatAt = System.currentTimeMillis() + 2_000L; // first heartbeat in 2s
            s.fellows.clear();
            s.lastFellowsFetchAt = 0L;

            WeeredConnectClient.LOG.info("[Weered] joined server: {} ({}realm={})", address, isRealm ? "" : "not ", isRealm);
        } catch (Exception e) {
            WeeredConnectClient.LOG.warn("[Weered] onJoin failed", e);
        }
    }

    private static void onDisconnect(MinecraftClient client) {
        WeeredState s = WeeredConnectClient.STATE;
        if (s.currentServerAddress != null && WeeredConnectClient.CONFIG.isLinked()) {
            String addr = s.currentServerAddress;
            WeeredConnectClient.API.presenceLeave(addr).whenComplete((res, err) -> {
                if (err != null) WeeredConnectClient.LOG.debug("[Weered] presenceLeave failed (non-fatal)", err);
            });
        }
        s.currentServerAddress = null;
        s.currentServerName = null;
        s.currentIsRealm = false;
        s.currentWorldName = null;
        s.fellows.clear();
    }
}
