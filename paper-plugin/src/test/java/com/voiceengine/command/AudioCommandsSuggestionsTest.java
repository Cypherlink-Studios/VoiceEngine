package com.voiceengine.command;

import com.voiceengine.audio.AudioEmitter;
import com.voiceengine.audio.AudioManager;
import com.voiceengine.i18n.TranslationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AudioCommandsSuggestionsTest {
    private AudioManager audioManager;
    private TranslationService translationService;
    private AudioCommands audioCommands;

    @BeforeEach
    void setUp() {
        audioManager = mock(AudioManager.class);
        translationService = mock(TranslationService.class);
        audioCommands = new AudioCommands(audioManager, translationService);
    }

    @Test
    void testSuggestActiveEmitters() {
        AudioEmitter e1 = new AudioEmitter("music1", "track1.mp3", true, "world", 0, 0, 0, 30.0, true, 1.0, "PLAYING", 0L);
        AudioEmitter e2 = new AudioEmitter("sfx_door", "door.wav", true, "world", 5, 0, 5, 10.0, false, 0.8, "PLAYING", 0L);

        when(audioManager.getAllEmitters()).thenReturn(List.of(e1, e2));

        List<String> suggestions = audioCommands.suggestActiveEmitters(null, "");
        assertEquals(List.of("music1", "sfx_door"), suggestions);
    }

    @Test
    void testSuggestStoppableEmittersIncludesAll() {
        AudioEmitter e1 = new AudioEmitter("ambient", "wind.ogg", true, "world", 0, 0, 0, 50.0, true, 0.5, "PLAYING", 0L);
        when(audioManager.getAllEmitters()).thenReturn(List.of(e1));

        List<String> suggestions = audioCommands.suggestStoppableEmitters(null, "");
        assertTrue(suggestions.contains("all"));
        assertTrue(suggestions.contains("ambient"));
        assertEquals(2, suggestions.size());
    }

    @Test
    void testSuggestVolumePresets() {
        List<String> suggestions = audioCommands.suggestVolumePresets(null, "");
        assertEquals(List.of("0.25", "0.5", "0.75", "1.0"), suggestions);
    }

    @Test
    void testSuggestPurgeDurations() {
        List<String> suggestions = audioCommands.suggestPurgeDurations(null, "");
        assertEquals(List.of("all", "24h", "7d", "30d"), suggestions);
    }

    @Test
    void testSuggestParticleStates() {
        List<String> suggestions = audioCommands.suggestParticleStates(null, "");
        assertEquals(List.of("on", "off", "toggle"), suggestions);
    }
}
