package ca.weered.connect;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.minecraft.client.MinecraftClient;
import net.minecraft.text.ClickEvent;
import net.minecraft.text.HoverEvent;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.net.URI;

// /weered [link | status | unlink | hud]
public class WeeredCommand {
    public static void register(CommandDispatcher<FabricClientCommandSource> dispatcher) {
        dispatcher.register(ClientCommandManager.literal("weered")
            .executes(WeeredCommand::status)
            .then(ClientCommandManager.literal("status").executes(WeeredCommand::status))
            .then(ClientCommandManager.literal("link").executes(WeeredCommand::link))
            .then(ClientCommandManager.literal("unlink").executes(WeeredCommand::unlink))
            .then(ClientCommandManager.literal("hud").executes(WeeredCommand::toggleHud))
        );
    }

    private static int status(com.mojang.brigadier.context.CommandContext<FabricClientCommandSource> ctx) {
        WeeredConfig c = WeeredConnectClient.CONFIG;
        FabricClientCommandSource src = ctx.getSource();
        if (c.isLinked()) {
            src.sendFeedback(Text.literal("[Weered] Linked as ")
                .append(Text.literal(c.displayName).formatted(Formatting.LIGHT_PURPLE))
                .append(Text.literal(". Use /weered unlink to disconnect.")));
        } else {
            src.sendFeedback(Text.literal("[Weered] Not linked. Use /weered link to pair this Minecraft client to your Weered account.")
                .formatted(Formatting.GRAY));
        }
        return 1;
    }

    private static int link(com.mojang.brigadier.context.CommandContext<FabricClientCommandSource> ctx) {
        FabricClientCommandSource src = ctx.getSource();
        if (WeeredConnectClient.CONFIG.isLinked()) {
            src.sendFeedback(Text.literal("[Weered] Already linked. Use /weered unlink first if you want to switch accounts.").formatted(Formatting.YELLOW));
            return 1;
        }

        src.sendFeedback(Text.literal("[Weered] Requesting pairing code...").formatted(Formatting.GRAY));

        WeeredConnectClient.API.pairStart().whenComplete((res, err) -> {
            MinecraftClient.getInstance().execute(() -> {
                if (err != null || res == null || !res.has("ok") || !res.get("ok").getAsBoolean()) {
                    src.sendError(Text.literal("[Weered] Failed to get pairing code: " + (err != null ? err.getMessage() : "unknown error")));
                    return;
                }
                String code = res.get("code").getAsString();
                WeeredConnectClient.STATE.pairingCode = code;
                WeeredConnectClient.STATE.pairingExpiresAt = System.currentTimeMillis() + 5 * 60_000L;
                WeeredConnectClient.STATE.pairingNextPollAt = System.currentTimeMillis() + 3_000L;

                String url = WeeredConnectClient.CONFIG.webBase + "/connect/minecraft?code=" + code;

                src.sendFeedback(Text.literal(""));
                src.sendFeedback(Text.literal("[Weered] Pairing code: ")
                    .append(Text.literal(code).formatted(Formatting.LIGHT_PURPLE, Formatting.BOLD)));
                Text clickable = Text.literal("[Click here to confirm in browser]")
                    .setStyle(Style.EMPTY
                        .withColor(Formatting.AQUA)
                        .withUnderline(true)
                        .withClickEvent(new ClickEvent(ClickEvent.Action.OPEN_URL, url))
                        .withHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, Text.literal("Open " + url))));
                src.sendFeedback(clickable);
                src.sendFeedback(Text.literal("Code expires in 5 minutes. Sign in to Weered if you aren't already.").formatted(Formatting.GRAY));
            });
        });
        return 1;
    }

    private static int unlink(com.mojang.brigadier.context.CommandContext<FabricClientCommandSource> ctx) {
        WeeredConnectClient.CONFIG.unlink();
        ctx.getSource().sendFeedback(Text.literal("[Weered] Unlinked. Run /weered link to pair again.").formatted(Formatting.GRAY));
        return 1;
    }

    private static int toggleHud(com.mojang.brigadier.context.CommandContext<FabricClientCommandSource> ctx) {
        WeeredConfig c = WeeredConnectClient.CONFIG;
        c.hudEnabled = !c.hudEnabled;
        c.save();
        ctx.getSource().sendFeedback(Text.literal("[Weered] HUD " + (c.hudEnabled ? "ON" : "OFF")).formatted(Formatting.GRAY));
        return 1;
    }
}
