package com.voiceengine.net;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.voiceengine.auth.SessionToken;
import com.voiceengine.telemetry.SpatialTelemetryBatch;
import com.voiceengine.visual.SpeechFeedbackHandler;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;

public class VoiceBackendClient extends WebSocketClient {
    private static final Logger LOGGER = Logger.getLogger(VoiceBackendClient.class.getName());
    private static final Gson GSON = new Gson();

    private final String secretKey;
    private final SpeechFeedbackHandler speechFeedbackHandler;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    private volatile boolean intentionalClose = false;
    private int reconnectAttempts = 0;

    public VoiceBackendClient(
        URI serverUri,
        String secretKey,
        SpeechFeedbackHandler speechFeedbackHandler
    ) {
        super(serverUri, createHeaders(secretKey));
        this.secretKey = secretKey;
        this.speechFeedbackHandler = speechFeedbackHandler;
    }

    private static Map<String, String> createHeaders(String secretKey) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Authorization", "Bearer " + secretKey);
        return headers;
    }

    @Override
    public void onOpen(ServerHandshake handshakedata) {
        LOGGER.info("[VoiceEngine] Connected to Voice Server at " + getURI());
        reconnectAttempts = 0;

        // Send handshake authentication frame
        JsonObject auth = new JsonObject();
        auth.addProperty("type", "plugin_handshake");
        auth.addProperty("secret", secretKey);
        send(GSON.toJson(auth));
    }

    @Override
    public void onMessage(String message) {
        try {
            JsonObject json = JsonParser.parseString(message).getAsJsonObject();
            String type = json.has("type") ? json.get("type").getAsString() : "";

            if ("speech_status".equals(type)) {
                String uuidStr = json.get("uuid").getAsString();
                boolean speaking = json.get("speaking").getAsBoolean();
                speechFeedbackHandler.setSpeaking(UUID.fromString(uuidStr), speaking);
            }
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "[VoiceEngine] Failed to parse message from voice server: " + message, e);
        }
    }

    @Override
    public void onClose(int code, String reason, boolean remote) {
        LOGGER.warning("[VoiceEngine] Disconnected from Voice Server (code=" + code + ", reason=" + reason + ")");
        speechFeedbackHandler.clear();

        if (!intentionalClose) {
            scheduleReconnect();
        }
    }

    @Override
    public void onError(Exception ex) {
        LOGGER.log(Level.WARNING, "[VoiceEngine] WebSocket error: " + ex.getMessage(), ex);
    }

    public void sendTelemetry(SpatialTelemetryBatch batch) {
        if (isOpen()) {
            send(batch.toJson());
        }
    }

    public void registerToken(SessionToken token) {
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

    private void scheduleReconnect() {
        reconnectAttempts++;
        long delaySeconds = Math.min(30, (long) Math.pow(2, Math.min(reconnectAttempts, 5)));
        LOGGER.info("[VoiceEngine] Reconnecting in " + delaySeconds + "s (attempt " + reconnectAttempts + ")...");

        scheduler.schedule(() -> {
            if (!intentionalClose && !isOpen()) {
                try {
                    reconnect();
                } catch (Exception e) {
                    LOGGER.warning("[VoiceEngine] Reconnection attempt failed: " + e.getMessage());
                }
            }
        }, delaySeconds, TimeUnit.SECONDS);
    }

    public void shutdown() {
        intentionalClose = true;
        scheduler.shutdownNow();
        close();
    }
}
