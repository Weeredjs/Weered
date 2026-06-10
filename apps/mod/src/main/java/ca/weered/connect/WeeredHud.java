package ca.weered.connect;

import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.text.Text;

// Small HUD overlay (top-left, below F3 if F3 is open). Lists the up-to-5
// other Weered users on the same server. Visible only when:
//   - mod is linked
//   - player is on a server (not main menu / single-player)
//   - there is at least 1 fellow OR pairing is in progress
//   - HUD toggle is on (default ON; toggle with /weered hud)
//
// API note: HudRenderCallback was replaced by HudLayerRegistrationCallback
// in the 1.20.x era. We register a named layer that draws above the chat layer.
public class WeeredHud {
    public static void register() {
        HudRenderCallback.EVENT.register(WeeredHud::draw);
    }

    private static void draw(DrawContext ctx, RenderTickCounter tickCounter) {
        try {
            MinecraftClient mc = MinecraftClient.getInstance();
            if (mc == null || mc.player == null) return;
            if (mc.options.hudHidden) return;

            WeeredConfig c = WeeredConnectClient.CONFIG;
            if (!c.hudEnabled) return;

            WeeredState s = WeeredConnectClient.STATE;

            // Pairing-in-progress banner
            if (s.pairingCode != null) {
                int x = 8, y = 8;
                ctx.fill(x - 2, y - 2, x + 200, y + 22, 0x99000000);
                ctx.drawText(mc.textRenderer, Text.literal("Weered code: " + s.pairingCode).formatted(net.minecraft.util.Formatting.LIGHT_PURPLE), x, y, 0xFFFFFFFF, false);
                ctx.drawText(mc.textRenderer, Text.literal("Confirm at weered.ca/connect/minecraft"), x, y + 11, 0xCCAAAAAA, false);
                return;
            }

            if (!c.isLinked()) return;
            if (s.currentServerAddress == null) return;
            if (s.fellows.isEmpty()) return;

            // Fellows panel
            int max = Math.min(5, s.fellows.size());
            int panelW = 160;
            int rowH = 11;
            int panelH = 14 + max * rowH + 4;
            int x = 8, y = 8;

            ctx.fill(x - 2, y - 2, x + panelW, y + panelH, 0x99000000);
            ctx.drawText(mc.textRenderer,
                Text.literal("Weered · " + s.fellows.size() + " here").formatted(net.minecraft.util.Formatting.LIGHT_PURPLE),
                x, y, 0xFFFFFFFF, false);

            for (int i = 0; i < max; i++) {
                WeeredState.Fellow f = s.fellows.get(i);
                String line = (f.weeredName != null ? f.weeredName : f.mcUsername != null ? f.mcUsername : "(unknown)");
                if (f.mcUsername != null && f.weeredName != null && !f.mcUsername.equals(f.weeredName)) {
                    line = line + " (" + f.mcUsername + ")";
                }
                if (line.length() > 24) line = line.substring(0, 23) + "…";
                ctx.drawText(mc.textRenderer, Text.literal(line), x, y + 14 + i * rowH, 0xFFE0E0E0, false);
            }

            if (s.fellows.size() > max) {
                int extra = s.fellows.size() - max;
                ctx.drawText(mc.textRenderer,
                    Text.literal("+ " + extra + " more"),
                    x, y + 14 + max * rowH - 2, 0xCC888888, false);
            }
        } catch (Throwable t) {
            // Never let the HUD crash the game.
            WeeredConnectClient.LOG.debug("[Weered] HUD draw error", t);
        }
    }
}
