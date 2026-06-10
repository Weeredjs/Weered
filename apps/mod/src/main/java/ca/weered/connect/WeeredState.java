package ca.weered.connect;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

// Runtime state. Everything mutable goes here so it's easy to reset on
// disconnect/relink.
public class WeeredState {
    // Pairing in progress
    public String  pairingCode = null;
    public long    pairingExpiresAt = 0L;
    public long    pairingNextPollAt = 0L;

    // Current server (null when on main menu / single-player)
    public String  currentServerAddress = null;
    public String  currentServerName = null;
    public boolean currentIsRealm = false;
    public String  currentWorldName = null;
    public long    nextHeartbeatAt = 0L;

    // Cached fellow Weered users on the current server. Refreshed alongside
    // presence heartbeats. Empty list = nobody else here (or not linked yet).
    public List<Fellow> fellows = new ArrayList<>();
    public long    lastFellowsFetchAt = 0L;

    public static class Fellow {
        public final String weeredName;
        public final String mcUsername;
        public final UUID   mcUuid;
        public final String worldName;
        public Fellow(String weeredName, String mcUsername, String mcUuid, String worldName) {
            this.weeredName = weeredName;
            this.mcUsername = mcUsername;
            UUID u;
            try { u = mcUuid != null ? UUID.fromString(mcUuid) : null; } catch (Exception e) { u = null; }
            this.mcUuid = u;
            this.worldName = worldName;
        }
    }
}
