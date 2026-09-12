package com.voiceengine.velocity.net;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
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
    }

    @Override
    public void onMessage(String message) {
        // Voice server can send back ACKs or proxy directives if needed
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

    public void registerToken(VelocitySessionToken token) {
        if (isOpen()) {
            JsonObject json = new JsonObject();
            json.addProperty("type", "register_token");
            json.addProperty("token", token.token());
            json.addProperty("playerUuid", token.playerUuid().toString());
            json.addProperty("playerName", token.playerName());
            json.addProperty("expiresAt", token.expiresAt().toEpochMilli());
            json.addProperty("isAdmin", token.isAdmin());
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
