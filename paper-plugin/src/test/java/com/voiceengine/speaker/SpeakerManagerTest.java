package com.voiceengine.speaker;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class SpeakerManagerTest {

    @TempDir
    Path tempDir;

    private SpeakerManager speakerManager;

    @BeforeEach
    void setUp() {
        speakerManager = new SpeakerManager(tempDir.toFile());
    }

    @Test
    void testCreateAndGetSpeaker() {
        boolean created = speakerManager.createSpeaker("auditorium", "world", 100.5, 64.0, 200.5, 45.0);
        assertTrue(created);

        // Duplicate creation must fail
        assertFalse(speakerManager.createSpeaker("auditorium", "world", 100.5, 64.0, 200.5, 45.0));

        Optional<SpeakerBlock> speaker = speakerManager.getSpeaker("auditorium");
        assertTrue(speaker.isPresent());
        assertEquals("auditorium", speaker.get().id());
        assertEquals("world", speaker.get().world());
        assertEquals(100.5, speaker.get().x());
        assertEquals(64.0, speaker.get().y());
        assertEquals(200.5, speaker.get().z());
        assertEquals(45.0, speaker.get().radius());
        assertNull(speaker.get().linkedPlayerUuid());
        assertFalse(speaker.get().requireRedstone());
    }

    @Test
    void testLinkAndUnlinkPlayer() {
        speakerManager.createSpeaker("spawn_stage", "world", 0.0, 70.0, 0.0, 30.0);
        UUID playerUuid = UUID.randomUUID();

        boolean linked = speakerManager.linkSpeaker("spawn_stage", playerUuid);
        assertTrue(linked);

        Optional<SpeakerBlock> speaker = speakerManager.getSpeaker("spawn_stage");
        assertTrue(speaker.isPresent());
        assertEquals(playerUuid, speaker.get().linkedPlayerUuid());

        boolean unlinked = speakerManager.unlinkSpeaker("spawn_stage");
        assertTrue(unlinked);

        speaker = speakerManager.getSpeaker("spawn_stage");
        assertTrue(speaker.isPresent());
        assertNull(speaker.get().linkedPlayerUuid());
    }

    @Test
    void testRequireRedstoneToggle() {
        speakerManager.createSpeaker("bell_tower", "world", 10.0, 100.0, 10.0, 25.0);
        assertFalse(speakerManager.getSpeaker("bell_tower").orElseThrow().requireRedstone());

        boolean toggled = speakerManager.setRequireRedstone("bell_tower", true);
        assertTrue(toggled);
        assertTrue(speakerManager.getSpeaker("bell_tower").orElseThrow().requireRedstone());
    }

    @Test
    void testSaveAndLoadPersistence() {
        speakerManager.createSpeaker("hall", "world_nether", 50.0, 120.0, -30.0, 60.0);
        UUID djUuid = UUID.randomUUID();
        speakerManager.linkSpeaker("hall", djUuid);
        speakerManager.setRequireRedstone("hall", true);

        // Instantiate new manager pointing to the same data folder
        SpeakerManager loadedManager = new SpeakerManager(tempDir.toFile());
        loadedManager.load();

        Optional<SpeakerBlock> loaded = loadedManager.getSpeaker("hall");
        assertTrue(loaded.isPresent());
        assertEquals("hall", loaded.get().id());
        assertEquals("world_nether", loaded.get().world());
        assertEquals(50.0, loaded.get().x());
        assertEquals(120.0, loaded.get().y());
        assertEquals(-30.0, loaded.get().z());
        assertEquals(60.0, loaded.get().radius());
        assertEquals(djUuid, loaded.get().linkedPlayerUuid());
        assertTrue(loaded.get().requireRedstone());
    }

    @Test
    void testRemoveSpeaker() {
        speakerManager.createSpeaker("plaza", "world", 10.0, 64.0, 10.0, 20.0);
        assertTrue(speakerManager.getSpeaker("plaza").isPresent());

        assertTrue(speakerManager.removeSpeaker("plaza"));
        assertFalse(speakerManager.getSpeaker("plaza").isPresent());
        assertFalse(speakerManager.removeSpeaker("plaza"));
    }

    @Test
    void testTelemetryStateExport() {
        speakerManager.createSpeaker("arena", "world", 5.0, 65.0, 5.0, 50.0);
        UUID hostUuid = UUID.randomUUID();
        speakerManager.linkSpeaker("arena", hostUuid);

        List<SpeakerBlockState> states = speakerManager.getActiveSpeakerStates("survival-1");
        assertEquals(1, states.size());

        SpeakerBlockState state = states.get(0);
        assertEquals("arena", state.id());
        assertEquals("world", state.world());
        assertEquals("survival-1", state.serverId());
        assertEquals(5.0, state.x());
        assertEquals(hostUuid.toString(), state.linkedPlayerUuid());
        assertTrue(state.active());
    }

    @Test
    void testBindAndUnbindAudio() {
        com.voiceengine.audio.AudioManager mockAudio = org.mockito.Mockito.mock(com.voiceengine.audio.AudioManager.class);
        SpeakerManager managerWithAudio = new SpeakerManager(tempDir.toFile(), () -> mockAudio);

        managerWithAudio.createSpeaker("park_stage", "world", 20.0, 64.0, 30.0, 25.0);
        assertTrue(managerWithAudio.bindAudio("park_stage", "ambient_birds.mp3", true));

        SpeakerBlock speaker = managerWithAudio.getSpeaker("park_stage").orElseThrow();
        assertEquals("ambient_birds.mp3", speaker.audioSource());
        assertTrue(speaker.loopMedia());

        org.mockito.Mockito.verify(mockAudio).playSpatial(
            org.mockito.ArgumentMatchers.eq("speaker-park_stage"),
            org.mockito.ArgumentMatchers.eq("ambient_birds.mp3"),
            org.mockito.ArgumentMatchers.eq("world"),
            org.mockito.ArgumentMatchers.eq(20.0),
            org.mockito.ArgumentMatchers.eq(64.0),
            org.mockito.ArgumentMatchers.eq(30.0),
            org.mockito.ArgumentMatchers.eq(25.0),
            org.mockito.ArgumentMatchers.eq(true),
            org.mockito.ArgumentMatchers.eq(1.0),
            org.mockito.ArgumentMatchers.eq("park_stage")
        );

        assertTrue(managerWithAudio.unbindAudio("park_stage"));
        SpeakerBlock unlinked = managerWithAudio.getSpeaker("park_stage").orElseThrow();
        assertNull(unlinked.audioSource());
        assertFalse(unlinked.loopMedia());

        org.mockito.Mockito.verify(mockAudio).stop("speaker-park_stage");
    }

    @Test
    void testSpeakerMediaPersistence() {
        speakerManager.createSpeaker("fountain", "world", 0, 64, 0, 15);
        speakerManager.bindAudio("fountain", "water.wav", false);

        SpeakerManager loadedManager = new SpeakerManager(tempDir.toFile());
        loadedManager.load();

        SpeakerBlock loaded = loadedManager.getSpeaker("fountain").orElseThrow();
        assertEquals("water.wav", loaded.audioSource());
        assertFalse(loaded.loopMedia());
    }
}
