package com.voiceengine.net;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.voiceengine.auth.SessionToken;
import com.voiceengine.visual.SpeechFeedbackHandler;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class VoiceBackendClientTest {

    @Test
    void testMessageProcessingUpdatesSpeechFeedback() {
        SpeechFeedbackHandler feedbackHandler = new SpeechFeedbackHandler();
        VoiceBackendClient client = new VoiceBackendClient(
            URI.create("ws://localhost:9999"),
            "test-secret",
            feedbackHandler
        );

        UUID playerUuid = UUID.randomUUID();
        String json = "{\"type\":\"speech_status\",\"uuid\":\"" + playerUuid + "\",\"speaking\":true}";

        client.onMessage(json);
        assertTrue(feedbackHandler.isSpeaking(playerUuid));

        String stopJson = "{\"type\":\"speech_status\",\"uuid\":\"" + playerUuid + "\",\"speaking\":false}";
        client.onMessage(stopJson);
        assertFalse(feedbackHandler.isSpeaking(playerUuid));
    }

    @Test
    void testRegisterTokenIncludesServerId() {
        SpeechFeedbackHandler feedbackHandler = new SpeechFeedbackHandler();
        List<String> sent = new ArrayList<>();
        VoiceBackendClient client = new VoiceBackendClient(
            URI.create("ws://localhost:9999"),
            "test-secret",
            "survival-1",
            feedbackHandler,
            null
        ) {
            @Override
            public boolean isOpen() {
                return true;
            }

            @Override
            public void send(String text) {
                sent.add(text);
            }
        };

        UUID playerUuid = UUID.randomUUID();
        SessionToken token = new SessionToken("TEST12", playerUuid, "Steve", Instant.now(), Instant.now().plusSeconds(300), false, false);
        client.registerToken(token, "192.168.1.50");

        assertEquals(1, sent.size());
        JsonObject json = JsonParser.parseString(sent.get(0)).getAsJsonObject();
        assertEquals("register_token", json.get("type").getAsString());
        assertEquals("TEST12", json.get("token").getAsString());
        assertEquals(playerUuid.toString(), json.get("playerUuid").getAsString());
        assertEquals("Steve", json.get("playerName").getAsString());
        assertEquals("survival-1", json.get("serverId").getAsString());
        assertEquals("192.168.1.50", json.get("clientIp").getAsString());
    }
}
