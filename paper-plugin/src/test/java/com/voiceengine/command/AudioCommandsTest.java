package com.voiceengine.command;

import com.voiceengine.audio.AudioEmitter;
import com.voiceengine.audio.AudioManager;
import com.voiceengine.i18n.TranslationService;
import org.bukkit.World;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AudioCommandsTest {
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
    void testOnPlayWithPlayer() {
        Player player = mock(Player.class);
        World world = mock(World.class);
        when(player.getWorld()).thenReturn(world);
        when(world.getName()).thenReturn("custom_world");

        AudioEmitter emitter = new AudioEmitter(
            "test_emitter",
            "music.mp3",
            true,
            "custom_world",
            10.0,
            64.0,
            20.0,
            30.0,
            false,
            1.0,
            "PLAYING",
            System.currentTimeMillis()
        );

        when(audioManager.playSpatial(
            eq("test_emitter"),
            eq("music.mp3"),
            eq("custom_world"),
            eq(10.0),
            eq(64.0),
            eq(20.0),
            eq(30.0),
            eq(false),
            eq(1.0),
            isNull()
        )).thenReturn(emitter);

        audioCommands.onPlay(player, "test_emitter", "music.mp3", 10.0, 64.0, 20.0, 30.0, false);

        verify(audioManager).playSpatial("test_emitter", "music.mp3", "custom_world", 10.0, 64.0, 20.0, 30.0, false, 1.0, null);
        verify(translationService).send(eq(player), eq("command.audio.play_started"), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void testOnBroadcastWithConsoleSender() {
        CommandSender sender = mock(CommandSender.class);
        AudioEmitter emitter = new AudioEmitter(
            "global_bgm",
            "bgm.ogg",
            false,
            "world",
            0.0,
            0.0,
            0.0,
            0.0,
            true,
            1.0,
            "PLAYING",
            System.currentTimeMillis()
        );

        when(audioManager.playBroadcast("global_bgm", "bgm.ogg", true, 1.0)).thenReturn(emitter);

        audioCommands.onBroadcast(sender, "global_bgm", "bgm.ogg", true);

        verify(audioManager).playBroadcast("global_bgm", "bgm.ogg", true, 1.0);
        verify(translationService).send(eq(sender), eq("command.audio.broadcast_started"), any(), any(), any());
    }

    @Test
    void testOnStopSingleAndAll() {
        CommandSender sender = mock(CommandSender.class);
        when(audioManager.stop("emitter1")).thenReturn(true);
        when(audioManager.stopAll()).thenReturn(3);

        audioCommands.onStop(sender, "emitter1");
        verify(audioManager).stop("emitter1");
        verify(translationService).send(eq(sender), eq("command.audio.stopped"), any());

        audioCommands.onStop(sender, "all");
        verify(audioManager).stopAll();
        verify(translationService).send(eq(sender), eq("command.audio.stopped_all"), any());
    }

    @Test
    void testOnPauseAndResume() {
        CommandSender sender = mock(CommandSender.class);
        when(audioManager.pause("emitter1")).thenReturn(true);
        when(audioManager.resume("emitter1")).thenReturn(true);

        audioCommands.onPause(sender, "emitter1");
        verify(audioManager).pause("emitter1");
        verify(translationService).send(eq(sender), eq("command.audio.paused"), any());

        audioCommands.onResume(sender, "emitter1");
        verify(audioManager).resume("emitter1");
        verify(translationService).send(eq(sender), eq("command.audio.resumed"), any());
    }

    @Test
    void testOnVolume() {
        CommandSender sender = mock(CommandSender.class);
        when(audioManager.setVolume("emitter1", 0.5)).thenReturn(true);

        audioCommands.onVolume(sender, "emitter1", 0.5);
        verify(audioManager).setVolume("emitter1", 0.5);
        verify(translationService).send(eq(sender), eq("command.audio.volume_set"), any(), any());
    }
}
