package com.voiceengine.command;

import com.voiceengine.audio.AudioManager;
import com.voiceengine.audio.MediaFileInfo;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.speaker.SpeakerBlock;
import com.voiceengine.speaker.SpeakerManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SpeakerCommandsSuggestionsTest {
    private SpeakerManager speakerManager;
    private TranslationService translationService;
    private AudioManager audioManager;
    private SpeakerCommands speakerCommands;

    @BeforeEach
    void setUp() {
        speakerManager = mock(SpeakerManager.class);
        translationService = mock(TranslationService.class);
        audioManager = mock(AudioManager.class);
        speakerCommands = new SpeakerCommands(speakerManager, translationService, audioManager);
    }

    @Test
    void testSuggestSpeakers() {
        SpeakerBlock s1 = new SpeakerBlock("speaker_spawn", "world", 100.0, 64.0, 100.0, 25.0, null, false, false);
        SpeakerBlock s2 = new SpeakerBlock("speaker_arena", "world", -50.0, 70.0, 200.0, 40.0, null, true, true, "lobby.mp3", true);

        when(speakerManager.getAllSpeakers()).thenReturn(List.of(s1, s2));

        List<String> suggestions = speakerCommands.suggestSpeakers(null, "");
        assertEquals(List.of("speaker_spawn", "speaker_arena"), suggestions);
    }

    @Test
    void testSuggestBooleans() {
        List<String> suggestions = speakerCommands.suggestBooleans(null, "");
        assertEquals(List.of("true", "false"), suggestions);
    }

    @Test
    void testSuggestMediaFiles() {
        MediaFileInfo m1 = new MediaFileInfo("track.mp3", "track.mp3", 1024L);
        when(audioManager.getAvailableMediaFiles()).thenReturn(List.of(m1));

        List<String> suggestions = speakerCommands.suggestMediaFiles(null, "");
        assertEquals(List.of("track.mp3"), suggestions);
    }

    @Test
    void testSuggestMediaFilesNullAudioManager() {
        SpeakerCommands commandsNoAudio = new SpeakerCommands(speakerManager, translationService);
        List<String> suggestions = commandsNoAudio.suggestMediaFiles(null, "");
        assertTrue(suggestions.isEmpty());
    }

    @Test
    void testSuggestOnlinePlayersNoServer() {
        List<String> suggestions = speakerCommands.suggestOnlinePlayers(null, "");
        assertNotNull(suggestions);
    }
}
