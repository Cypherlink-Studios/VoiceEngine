package com.voiceengine.command;

import com.voiceengine.audio.AudioManager;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.speaker.SpeakerManager;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.*;

class SpeakerCommandsTest {
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
    void testCreateSpeakerWithConsoleSenderFails() {
        CommandSender sender = mock(CommandSender.class);
        speakerCommands.onCreate(sender, "speaker1", 30.0);

        verify(translationService).send(sender, "command.connect.only_players");
        verifyNoInteractions(speakerManager);
    }

    @Test
    void testRemoveSpeakerWithConsoleSender() {
        CommandSender sender = mock(CommandSender.class);
        when(speakerManager.removeSpeaker("speaker1")).thenReturn(true);

        speakerCommands.onRemove(sender, "speaker1");

        verify(speakerManager).removeSpeaker("speaker1");
        verify(translationService).send(eq(sender), eq("command.speaker.removed"), any());
    }

    @Test
    void testUnlinkSpeaker() {
        CommandSender sender = mock(CommandSender.class);
        when(speakerManager.unlinkSpeaker("speaker1")).thenReturn(true);

        speakerCommands.onUnlink(sender, "speaker1");

        verify(speakerManager).unlinkSpeaker("speaker1");
        verify(translationService).send(eq(sender), eq("command.speaker.unlinked"), any());
    }

    @Test
    void testRedstoneToggle() {
        CommandSender sender = mock(CommandSender.class);
        when(speakerManager.setRequireRedstone("speaker1", true)).thenReturn(true);

        speakerCommands.onRedstone(sender, "speaker1", true);

        verify(speakerManager).setRequireRedstone("speaker1", true);
        verify(translationService).send(eq(sender), eq("command.speaker.redstone_set"), any(), any());
    }

    @Test
    void testSpeakerPlayAndStop() {
        CommandSender sender = mock(CommandSender.class);
        when(speakerManager.bindAudio("speaker1", "track.mp3", true)).thenReturn(true);
        when(speakerManager.unbindAudio("speaker1")).thenReturn(true);

        speakerCommands.onSpeakerPlay(sender, "speaker1", "track.mp3", true);
        verify(speakerManager).bindAudio("speaker1", "track.mp3", true);
        verify(translationService).send(eq(sender), eq("command.speaker.play_started"), any(), any(), any());

        speakerCommands.onSpeakerStop(sender, "speaker1");
        verify(speakerManager).unbindAudio("speaker1");
        verify(translationService).send(eq(sender), eq("command.speaker.play_stopped"), any());
    }
}
