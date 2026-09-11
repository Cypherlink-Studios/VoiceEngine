package com.voiceengine.net;

import com.voiceengine.visual.SpeechFeedbackHandler;
import org.junit.jupiter.api.Test;

import java.net.URI;
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
}
