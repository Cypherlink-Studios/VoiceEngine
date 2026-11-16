package com.voiceengine.velocity.net;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.voiceengine.velocity.auth.VelocitySessionToken;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.slf4j.Logger;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class VelocityBackendClient extends WebSocketClient {
    private static final Gson GSON = new Gson();

    private final String secretKey;
    private final Logger logger;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    private volatile boolean intentionalClose = false;
    private int reconnectAttempts = 0;

    public VelocityBackendClient(URI serverUri, String secretKey, Logger logger) {
        super(serverUri, createHeaders(secretKey));
        this.secretKey = secretKey;
        this.logger = logger;
    }

    private static Map<String, String> createHeaders(String secretKey) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Authorization", "Bearer " + secretKey);
        headers.put("X-Role", "velocity");
        headers.put("X-Server-Id", "proxy");
        return headers;
    }

    @Override
    public void onOpen(ServerHandshake handshakedata) {
        if (logger != null) {
            logger.info("Connected to VoiceEngine server at {}", getURI());
        }
        reconnectAttempts = 0;

        // Send handshake authentication frame
        JsonObject auth = new JsonObject();
        auth.addProperty("type", "plugin_handshake");
        auth.addProperty("secret", secretKey);
        auth.addProperty("role", "velocity");
        auth.addProperty("serverId", "proxy");
        send(GSON.toJson(auth));

        if (onConnected != null) {
            onConnected.run();
        }
    }

    @Override
    public void onMessage(String message) {
        try {
            JsonObject json = JsonParser.parseString(message).getAsJsonObject();
            String type = json.has("type") ? json.get("type").getAsString() : "";
            if ("streamer_mode_sync".equals(type)) {
                if (streamerModeSyncConsumer != null && json.has("playerUuid") && json.has("enabled")) {
                    UUID uuid = UUID.fromString(json.get("playerUuid").getAsString());
                    boolean enabled = json.get("enabled").getAsBoolean();
                    streamerModeSyncConsumer.accept(uuid, enabled);
                }
            }
        } catch (Exception e) {
            if (logger != null) {
                logger.warn("Failed to parse message from VoiceEngine server: {}", e.getMessage());
            }
        }
    }

    @Override
    public void onClose(int code, String reason, boolean remote) {
        if (logger != null) {
            logger.warn("Disconnected from VoiceEngine server (code={}, reason={})", code, reason);
        }

        if (!intentionalClose) {
            scheduleReconnect();
        }
    }

    @Override
    public void onError(Exception ex) {
        if (logger != null) {
            logger.warn("WebSocket error: {}", ex.getMessage());
        }
    }

    private Runnable onConnected;
    private volatile java.util.function.BiConsumer<UUID, Boolean> streamerModeSyncConsumer;

    public void setOnConnected(Runnable onConnected) {
        this.onConnected = onConnected;
    }

    public void setStreamerModeSyncConsumer(java.util.function.BiConsumer<UUID, Boolean> streamerModeSyncConsumer) {
        this.streamerModeSyncConsumer = streamerModeSyncConsumer;
    }

    public void sendStreamerModeSync(UUID playerUuid, boolean enabled) {
        if (isOpen() && playerUuid != null) {
            JsonObject json = new JsonObject();
            json.addProperty("type", "streamer_mode_sync");
            json.addProperty("playerUuid", playerUuid.toString());
            json.addProperty("enabled", enabled);
            send(GSON.toJson(json));
        }
    }

    public void registerToken(VelocitySessionToken token) {
        registerToken(token, null, false);
    }

    public void registerToken(VelocitySessionToken token, String clientIp, boolean isMuted) {
        if (isOpen()) {
            JsonObject json = new JsonObject();
            json.addProperty("type", "register_token");
            json.addProperty("token", token.token());
            json.addProperty("playerUuid", token.playerUuid().toString());
            json.addProperty("playerName", token.playerName());
            json.addProperty("expiresAt", token.expiresAt().toEpochMilli());
            json.addProperty("isAdmin", token.isAdmin());
            json.addProperty("streamerMode", token.streamerMode());
            json.addProperty("streamerModeExplicit", token.streamerModeExplicit());
            if (clientIp != null) {
                json.addProperty("clientIp", clientIp);
            }
            if (isMuted) {
                json.addProperty("isMuted", true);
            }
            send(GSON.toJson(json));
        }
    }

    public void sendPlayerQuit(UUID playerUuid) {
        if (isOpen() && playerUuid != null) {
            JsonObject json = new JsonObject();
            json.addProperty("type", "player_quit");
            json.addProperty("playerUuid", playerUuid.toString());
            send(GSON.toJson(json));
        }
    }

    public void sendModerationAction(UUID targetUuid, String action, boolean active, String reason, Long expiresAt, String clientIp) {
        if (isOpen() && targetUuid != null) {
            JsonObject json = new JsonObject();
            json.addProperty("type", "moderation_action");
            json.addProperty("targetUuid", targetUuid.toString());
            json.addProperty("action", action);
            json.addProperty("active", active);
            if (reason != null) {
                json.addProperty("reason", reason);
            }
            if (expiresAt != null && expiresAt > 0) {
                json.addProperty("expiresAt", expiresAt);
            }
            if (clientIp != null) {
                json.addProperty("clientIp", clientIp);
            }
            send(GSON.toJson(json));
        }
    }

    public void sendActivePunishmentsSync(java.util.List<com.voiceengine.velocity.moderation.PunishmentRecord> punishments) {
        if (isOpen() && punishments != null) {
            JsonObject json = new JsonObject();
            json.addProperty("type", "active_punishments_sync");
            com.google.gson.JsonArray array = new com.google.gson.JsonArray();
            for (com.voiceengine.velocity.moderation.PunishmentRecord r : punishments) {
                JsonObject item = new JsonObject();
                item.addProperty("targetUuid", r.playerUuid().toString());
                item.addProperty("action", r.punishmentType().name().toLowerCase());
                item.addProperty("reason", r.reason());
                if (r.expiresAt() != null) {
                    item.addProperty("expiresAt", r.expiresAt());
                }
                if (r.clientIp() != null) {
                    item.addProperty("clientIp", r.clientIp());
                }
                array.add(item);
            }
            json.add("punishments", array);
            send(GSON.toJson(json));
        }
    }

    public void notifyServerSwitch(UUID playerUuid, String fromServer, String toServer) {
        if (isOpen()) {
            JsonObject json = new JsonObject();
            json.addProperty("type", "player_server_switch");
            json.addProperty("playerUuid", playerUuid.toString());
            json.addProperty("fromServer", fromServer);
            json.addProperty("toServer", toServer);
            send(GSON.toJson(json));
        }
    }

    private void scheduleReconnect() {
        reconnectAttempts++;
        long delaySeconds = Math.min(30, (long) Math.pow(2, Math.min(reconnectAttempts, 5)));
        if (logger != null) {
            logger.info("Reconnecting to VoiceEngine server in {}s (attempt {})...", delaySeconds, reconnectAttempts);
        }

        scheduler.schedule(() -> {
            if (!intentionalClose && !isOpen()) {
                try {
                    reconnect();
                } catch (Exception e) {
                    if (logger != null) {
                        logger.warn("Reconnection attempt failed: {}", e.getMessage());
                    }
                }
            }
        }, delaySeconds, TimeUnit.SECONDS);
    }

    public int getReconnectAttempts() {
        return reconnectAttempts;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void shutdown() {
        intentionalClose = true;
        scheduler.shutdownNow();
        close();
    }
}
