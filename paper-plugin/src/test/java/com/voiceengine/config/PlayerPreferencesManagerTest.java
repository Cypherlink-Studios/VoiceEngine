package com.voiceengine.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class PlayerPreferencesManagerTest {

    @Test
    void testDefaultsAndPersistenceRoundTrip(@TempDir Path tempDir) {
        File dataFolder = tempDir.toFile();
        UUID playerUuid = UUID.randomUUID();

        PlayerPreferencesManager manager = new PlayerPreferencesManager(dataFolder);
        manager.load();

        assertFalse(manager.hasExplicitPreference(playerUuid));
        assertFalse(manager.isStreamerMode(playerUuid));

        boolean toggled = manager.toggleStreamerMode(playerUuid);
        assertTrue(toggled);
        assertTrue(manager.hasExplicitPreference(playerUuid));
        assertTrue(manager.isStreamerMode(playerUuid));

        File savedFile = new File(dataFolder, "player-preferences.yml");
        assertTrue(savedFile.exists());

        PlayerPreferencesManager reloaded = new PlayerPreferencesManager(dataFolder);
        reloaded.load();

        assertTrue(reloaded.hasExplicitPreference(playerUuid));
        assertTrue(reloaded.isStreamerMode(playerUuid));

        reloaded.setStreamerMode(playerUuid, false);
        assertFalse(reloaded.isStreamerMode(playerUuid));
        assertTrue(reloaded.hasExplicitPreference(playerUuid));
    }
}
