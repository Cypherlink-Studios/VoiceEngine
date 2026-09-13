package com.voiceengine.audio;

import com.google.gson.JsonObject;
import com.voiceengine.net.VoiceBackendClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AudioManagerTest {

    @TempDir
    Path tempDir;

    private AudioManager audioManager;
    private VoiceBackendClient mockClient;
    private final List<JsonObject> sentCommands = new ArrayList<>();

    @BeforeEach
    void setUp() {
        mockClient = mock(VoiceBackendClient.class);
        when(mockClient.isOpen()).thenReturn(true);
        doAnswer(invocation -> {
            JsonObject cmd = invocation.getArgument(0);
            sentCommands.add(cmd);
            return null;
        }).when(mockClient).sendAudioCommand(any(JsonObject.class));

        audioManager = new AudioManager(
            tempDir.toFile(),
            () -> mockClient,
            true,
            true
        );
    }

    @Test
    void testPlaySpatialAndBackendDispatch() {
        AudioEmitter emitter = audioManager.playSpatial(
            "tavern_music",
            "tavern.mp3",
            "world",
            10.0,
            64.0,
            20.0,
            25.0,
            true,
            0.8,
            null
        );

        assertNotNull(emitter);
        assertEquals("tavern_music", emitter.id());
        assertEquals("tavern.mp3", emitter.source());
        assertTrue(emitter.spatial());
        assertEquals("world", emitter.world());
        assertEquals(10.0, emitter.x());
        assertEquals(64.0, emitter.y());
        assertEquals(20.0, emitter.z());
        assertEquals(25.0, emitter.radius());
        assertTrue(emitter.loop());
        assertEquals(0.8, emitter.volume());
        assertEquals("PLAYING", emitter.state());

        // Verify sent command
        assertFalse(sentCommands.isEmpty());
        JsonObject lastCmd = sentCommands.get(sentCommands.size() - 1);
        assertEquals("play", lastCmd.get("action").getAsString());
        assertEquals("tavern_music", lastCmd.get("id").getAsString());
        assertTrue(lastCmd.get("loop").getAsBoolean());
    }

    @Test
    void testPlayBroadcast() {
        AudioEmitter emitter = audioManager.playBroadcast(
            "announcement",
            "alert.wav",
            false,
            1.0
        );

        assertNotNull(emitter);
        assertEquals("announcement", emitter.id());
        assertFalse(emitter.spatial());
        assertFalse(emitter.loop());
        assertEquals("PLAYING", emitter.state());

        JsonObject lastCmd = sentCommands.get(sentCommands.size() - 1);
        assertEquals("broadcast", lastCmd.get("action").getAsString());
        assertEquals("announcement", lastCmd.get("id").getAsString());
    }

    @Test
    void testPlaySfxEphemeral() {
        String sfxId = audioManager.playSfx("hit.ogg", "world", 5.0, 70.0, 5.0, 15.0);
        assertNotNull(sfxId);
        assertTrue(sfxId.startsWith("sfx-"));

        // SFX is not stored in persistent emitters map
        assertFalse(audioManager.getEmitter(sfxId).isPresent());

        JsonObject lastCmd = sentCommands.get(sentCommands.size() - 1);
        assertEquals("sfx", lastCmd.get("action").getAsString());
        assertEquals(sfxId, lastCmd.get("id").getAsString());
        assertTrue(lastCmd.get("spatial").getAsBoolean());
    }

    @Test
    void testPauseResumeStop() {
        audioManager.playSpatial("ambient", "wind.ogg", "world", 0, 0, 0, 30, true, 0.5, null);

        assertTrue(audioManager.pause("ambient"));
        assertEquals("PAUSED", audioManager.getEmitter("ambient").orElseThrow().state());

        assertTrue(audioManager.resume("ambient"));
        assertEquals("PLAYING", audioManager.getEmitter("ambient").orElseThrow().state());

        assertTrue(audioManager.setVolume("ambient", 0.3));
        assertEquals(0.3, audioManager.getEmitter("ambient").orElseThrow().volume(), 0.001);

        assertTrue(audioManager.stop("ambient"));
        assertFalse(audioManager.getEmitter("ambient").isPresent());

        assertFalse(audioManager.pause("nonexistent"));
        assertFalse(audioManager.resume("nonexistent"));
        assertFalse(audioManager.stop("nonexistent"));
    }

    @Test
    void testStopAll() {
        audioManager.playSpatial("track1", "1.mp3", "world", 0, 0, 0, 30, false, 1.0, null);
        audioManager.playBroadcast("track2", "2.mp3", true, 1.0);

        assertEquals(2, audioManager.getAllEmitters().size());
        int stopped = audioManager.stopAll();
        assertEquals(2, stopped);
        assertTrue(audioManager.getAllEmitters().isEmpty());
    }

    @Test
    void testPersistenceSaveAndLoad() {
        audioManager.playSpatial("saved_emitter", "song.mp3", "world_nether", 50, 80, -20, 40, true, 0.9, null);

        // Create new AudioManager with same folder
        AudioManager reloadedManager = new AudioManager(
            tempDir.toFile(),
            () -> mockClient,
            true,
            true
        );
        reloadedManager.load();

        Optional<AudioEmitter> loaded = reloadedManager.getEmitter("saved_emitter");
        assertTrue(loaded.isPresent());
        assertEquals("saved_emitter", loaded.get().id());
        assertEquals("song.mp3", loaded.get().source());
        assertEquals("world_nether", loaded.get().world());
        assertEquals(50.0, loaded.get().x());
        assertEquals(80.0, loaded.get().y());
        assertEquals(-20.0, loaded.get().z());
        assertEquals(40.0, loaded.get().radius());
        assertTrue(loaded.get().loop());
        assertEquals(0.9, loaded.get().volume());
    }

    @Test
    void testMediaFileDiscovery() throws IOException {
        File mediaDir = audioManager.getMediaFolder();
        File subDir = new File(mediaDir, "music");
        subDir.mkdirs();

        Files.writeString(new File(mediaDir, "intro.mp3").toPath(), "audio-dummy-data");
        Files.writeString(new File(subDir, "boss.ogg").toPath(), "audio-dummy-data-2");
        Files.writeString(new File(mediaDir, "ignore.txt").toPath(), "not-audio");

        // Files inside cache/ folder must be ignored
        File cacheDir = new File(mediaDir, "cache");
        cacheDir.mkdirs();
        Files.writeString(new File(cacheDir, "cached123.mp3").toPath(), "cached-data");

        List<MediaFileInfo> files = audioManager.getAvailableMediaFiles();
        assertEquals(2, files.size());
        assertTrue(files.stream().anyMatch(f -> f.relativePath().equals("intro.mp3")));
        assertTrue(files.stream().anyMatch(f -> f.relativePath().replace('\\', '/').equals("music/boss.ogg")));
    }

    @Test
    void testParticlesToggle() {
        assertTrue(audioManager.isParticlesEnabled());
        audioManager.setParticlesEnabled(false);
        assertFalse(audioManager.isParticlesEnabled());
    }
}
