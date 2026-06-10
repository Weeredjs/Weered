package ca.weered.connect;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonElement;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

// All HTTP calls live here. Uses JDK java.net.http.HttpClient — no bundled deps.
// Methods return CompletableFuture<JsonObject> so callers can chain off the
// main thread; the on-completion handlers are responsible for marshaling
// back to the MC main thread via MinecraftClient.getInstance().execute().
public class WeeredApi {
    private static final Gson GSON = new Gson();
    private final HttpClient http;
    private final WeeredConfig config;

    public WeeredApi(WeeredConfig config) {
        this.config = config;
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }

    public CompletableFuture<JsonObject> pairStart() {
        return postJson("/mc/pair/start", new HashMap<>(), false);
    }

    public CompletableFuture<JsonObject> pairPoll(String code) {
        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        return postJson("/mc/pair/poll", body, false);
    }

    public CompletableFuture<JsonObject> presence(String serverAddress, String serverName,
                                                  boolean isRealm, String worldName,
                                                  String mcUuid, String mcUsername) {
        Map<String, Object> body = new HashMap<>();
        body.put("serverAddress", serverAddress);
        if (serverName != null) body.put("serverName", serverName);
        body.put("isRealm", isRealm);
        if (worldName != null) body.put("worldName", worldName);
        if (mcUuid != null)    body.put("mcUuid", mcUuid);
        if (mcUsername != null) body.put("mcUsername", mcUsername);
        return postJson("/mc/presence", body, true);
    }

    public CompletableFuture<JsonObject> presenceServer(String serverAddress) {
        String enc = java.net.URLEncoder.encode(serverAddress, java.nio.charset.StandardCharsets.UTF_8);
        return get("/mc/presence/server?serverAddress=" + enc, true);
    }

    public CompletableFuture<JsonObject> presenceLeave(String serverAddress) {
        Map<String, Object> body = new HashMap<>();
        body.put("serverAddress", serverAddress);
        return postJson("/mc/presence/leave", body, true);
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private CompletableFuture<JsonObject> postJson(String path, Object body, boolean auth) {
        String json = GSON.toJson(body);
        HttpRequest.Builder b = HttpRequest.newBuilder()
            .uri(URI.create(config.apiBase + path))
            .timeout(Duration.ofSeconds(15))
            .header("Content-Type", "application/json")
            .header("User-Agent", "WeeredConnect/" + WeeredConfig.MOD_VERSION)
            .POST(HttpRequest.BodyPublishers.ofString(json));
        if (auth && config.isLinked()) {
            b.header("Authorization", "Bearer " + config.token);
        }
        return http.sendAsync(b.build(), HttpResponse.BodyHandlers.ofString())
            .thenApply(WeeredApi::parseBody);
    }

    private CompletableFuture<JsonObject> get(String path, boolean auth) {
        HttpRequest.Builder b = HttpRequest.newBuilder()
            .uri(URI.create(config.apiBase + path))
            .timeout(Duration.ofSeconds(15))
            .header("User-Agent", "WeeredConnect/" + WeeredConfig.MOD_VERSION)
            .GET();
        if (auth && config.isLinked()) {
            b.header("Authorization", "Bearer " + config.token);
        }
        return http.sendAsync(b.build(), HttpResponse.BodyHandlers.ofString())
            .thenApply(WeeredApi::parseBody);
    }

    private static JsonObject parseBody(HttpResponse<String> resp) {
        try {
            JsonElement el = JsonParser.parseString(resp.body());
            if (el != null && el.isJsonObject()) return el.getAsJsonObject();
        } catch (Exception ignored) {}
        JsonObject err = new JsonObject();
        err.addProperty("ok", false);
        err.addProperty("error", "bad_response_" + resp.statusCode());
        return err;
    }
}
