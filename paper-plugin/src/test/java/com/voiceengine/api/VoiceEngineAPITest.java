package com.voiceengine.api;

import com.voiceengine.auth.SessionToken;
import com.voiceengine.auth.TokenManager;
import com.voiceengine.visual.SpeechFeedbackHandler;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class VoiceEngineAPITest {

    @Test
    void testApiQueries() {
        TokenManager tokenManager = new TokenManager(Duration.ofMinutes(5), 6);
        SpeechFeedbackHandler feedbackHandler = new SpeechFeedbackHandler();

        VoiceEngineAPI api = new VoiceEngineAPIImpl(tokenManager, feedbackHandler, () -> null);

        UUID playerUuid = UUID.randomUUID();

        assertFalse(api.isConnected(playerUuid));
        assertFalse(api.isSpeaking(playerUuid));
        assertFalse(api.isBackendConnected());
        assertTrue(api.getActiveToken(playerUuid).isEmpty());

        SessionToken token = tokenManager.generateToken(playerUuid, "TestPlayer", false);
        assertTrue(api.isConnected(playerUuid));
        Optional<SessionToken> retrieved = api.getActiveToken(playerUuid);
        assertTrue(retrieved.isPresent());
        assertEquals(token.token(), retrieved.get().token());

        feedbackHandler.setSpeaking(playerUuid, true);
        assertTrue(api.isSpeaking(playerUuid));

        feedbackHandler.setSpeaking(playerUuid, false);
        assertFalse(api.isSpeaking(playerUuid));
    }
}
