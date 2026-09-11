package com.voiceengine.visual;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class SpeechFeedbackHandlerTest {
    private SpeechFeedbackHandler handler;
    private final UUID player1 = UUID.randomUUID();
    private final UUID player2 = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        handler = new SpeechFeedbackHandler();
    }

    @Test
    void testSpeechStateTransition() {
        assertFalse(handler.isSpeaking(player1));
        assertFalse(handler.isSpeaking(player2));

        handler.setSpeaking(player1, true);
        assertTrue(handler.isSpeaking(player1));
        assertFalse(handler.isSpeaking(player2));

        handler.setSpeaking(player2, true);
        assertTrue(handler.isSpeaking(player1));
        assertTrue(handler.isSpeaking(player2));

        handler.setSpeaking(player1, false);
        assertFalse(handler.isSpeaking(player1));
        assertTrue(handler.isSpeaking(player2));
    }

    @Test
    void testClear() {
        handler.setSpeaking(player1, true);
        handler.setSpeaking(player2, true);

        handler.clear();

        assertFalse(handler.isSpeaking(player1));
        assertFalse(handler.isSpeaking(player2));
    }
}
