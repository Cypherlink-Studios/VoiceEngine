package com.voiceengine.config;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;

public class PlayerPreferencesManager {
    private static final Logger LOGGER = Logger.getLogger(PlayerPreferencesManager.class.getName());

    public record PlayerPreference(boolean streamerMode, long updatedAt) {}

    private final File preferencesFile;
    private final Map<UUID, PlayerPreference> preferences = new ConcurrentHashMap<>();

    public PlayerPreferencesManager(File dataFolder) {
        this.preferencesFile = new File(dataFolder, "player-preferences.yml");
    }

    public synchronized void load() {
        preferences.clear();
        if (!preferencesFile.exists()) {
            return;
        }

        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(preferencesFile);
        ConfigurationSection playersSection = yaml.getConfigurationSection("players");
        if (playersSection == null) {
            return;
        }

        for (String key : playersSection.getKeys(false)) {
            try {
                UUID uuid = UUID.fromString(key);
                ConfigurationSection entry = playersSection.getConfigurationSection(key);
                if (entry != null) {
                    boolean streamerMode = entry.getBoolean("streamer-mode", false);
                    long updatedAt = entry.getLong("updated-at", 0L);
                    preferences.put(uuid, new PlayerPreference(streamerMode, updatedAt));
                }
            } catch (IllegalArgumentException ignored) {
                LOGGER.warning("[VoiceEngine] Ignoring invalid UUID key in player-preferences.yml: " + key);
            }
        }
    }

    public synchronized void save() {
        File parent = preferencesFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }

        YamlConfiguration yaml = new YamlConfiguration();
        for (Map.Entry<UUID, PlayerPreference> entry : preferences.entrySet()) {
            String basePath = "players." + entry.getKey().toString();
            yaml.set(basePath + ".streamer-mode", entry.getValue().streamerMode());
            yaml.set(basePath + ".updated-at", entry.getValue().updatedAt());
        }

        try {
            yaml.save(preferencesFile);
        } catch (IOException e) {
            LOGGER.log(Level.WARNING, "[VoiceEngine] Failed to save player-preferences.yml", e);
        }
    }

    public boolean isStreamerMode(UUID playerUuid) {
        if (playerUuid == null) {
            return false;
        }
        PlayerPreference pref = preferences.get(playerUuid);
        return pref != null && pref.streamerMode();
    }

    public boolean hasExplicitPreference(UUID playerUuid) {
        return playerUuid != null && preferences.containsKey(playerUuid);
    }

    public void setStreamerMode(UUID playerUuid, boolean enabled) {
        if (playerUuid == null) {
            return;
        }
        preferences.put(playerUuid, new PlayerPreference(enabled, System.currentTimeMillis()));
        save();
    }

    public boolean toggleStreamerMode(UUID playerUuid) {
        boolean next = !isStreamerMode(playerUuid);
        setStreamerMode(playerUuid, next);
        return next;
    }
}
