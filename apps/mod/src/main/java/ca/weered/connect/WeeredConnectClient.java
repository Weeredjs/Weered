package ca.weered.connect;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WeeredConnectClient implements ClientModInitializer {
    public static final String MOD_ID = "weered_connect";
    public static final Logger LOG = LoggerFactory.getLogger(MOD_ID);

    // Singletons. Created lazily so init order is predictable.
    public static WeeredConfig CONFIG;
    public static WeeredApi   API;
    public static WeeredState STATE;

    @Override
    public void onInitializeClient() {
        LOG.info("[Weered] Initializing client mod {} on {}",
                 WeeredConfig.MOD_VERSION, System.getProperty("os.name"));

        CONFIG = WeeredConfig.load();
        API    = new WeeredApi(CONFIG);
        STATE  = new WeeredState();

        // Register /weered command tree
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) ->
            WeeredCommand.register(dispatcher));

        // Per-tick driver: handles pairing poll + presence heartbeat scheduling.
        // We don't actually do network work in this callback; the driver schedules
        // CompletableFutures and the callbacks marshal results back via
        // MinecraftClient.execute().
        ClientTickEvents.END_CLIENT_TICK.register(WeeredDriver::onTick);

        // Server-join hook so we know what server the player is on. Registered
        // separately to keep concerns clean.
        WeeredServerHook.register();

        // HUD overlay
        WeeredHud.register();
    }
}
