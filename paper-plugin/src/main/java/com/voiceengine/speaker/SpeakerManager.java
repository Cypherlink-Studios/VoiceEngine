package com.voiceengine.speaker;

import com.voiceengine.visual.SpeechFeedbackHandler;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;

public class SpeakerManager {
    private static final Logger LOGGER = Logger.getLogger(SpeakerManager.class.getName());

    private final File speakersFile;
    private final Map<String, SpeakerBlock> speakers = new ConcurrentHashMap<>();

    public SpeakerManager(File dataFolder) {
        this.speakersFile = new File(dataFolder, "speakers.yml");
    }

    public synchronized void load() {
        speakers.clear();
        if (!speakersFile.exists()) {
            return;
        }

        try {
            YamlConfiguration config = YamlConfiguration.loadConfiguration(speakersFile);
            ConfigurationSection section = config.getConfigurationSection("speakers");
            if (section == null) {
                return;
            }

            for (String key : section.getKeys(false)) {
                ConfigurationSection s = section.getConfigurationSection(key);
                if (s == null) continue;

                String world = s.getString("world", "world");
                double x = s.getDouble("x");
                double y = s.getDouble("y");
                double z = s.getDouble("z");
                double radius = s.getDouble("radius", 30.0);
                String uuidStr = s.getString("linked-player");
                UUID linkedUuid = (uuidStr != null && !uuidStr.isBlank()) ? UUID.fromString(uuidStr) : null;
                boolean requireRedstone = s.getBoolean("require-redstone", false);

                SpeakerBlock block = new SpeakerBlock(
                    key,
                    world,
                    x,
                    y,
                    z,
                    radius,
                    linkedUuid,
                    requireRedstone,
                    !requireRedstone
                );
                speakers.put(key.toLowerCase(), block);
            }
            LOGGER.info("[VoiceEngine] Loaded " + speakers.size() + " speaker blocks from speakers.yml.");
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "[VoiceEngine] Failed to load speakers.yml: " + e.getMessage(), e);
        }
    }

    public synchronized void save() {
        try {
            YamlConfiguration config = new YamlConfiguration();
            ConfigurationSection section = config.createSection("speakers");

            for (SpeakerBlock block : speakers.values()) {
                ConfigurationSection s = section.createSection(block.id());
                s.set("world", block.world());
                s.set("x", block.x());
                s.set("y", block.y());
                s.set("z", block.z());
                s.set("radius", block.radius());
                if (block.linkedPlayerUuid() != null) {
                    s.set("linked-player", block.linkedPlayerUuid().toString());
                }
                s.set("require-redstone", block.requireRedstone());
            }

            if (!speakersFile.getParentFile().exists()) {
                speakersFile.getParentFile().mkdirs();
            }
            config.save(speakersFile);
        } catch (IOException e) {
            LOGGER.log(Level.SEVERE, "[VoiceEngine] Could not save speakers.yml: " + e.getMessage(), e);
        }
    }

    public boolean createSpeaker(String id, String world, double x, double y, double z, double radius) {
        if (id == null || id.isBlank()) return false;
        String normalizedId = id.toLowerCase().trim();
        if (speakers.containsKey(normalizedId)) {
            return false;
        }

        SpeakerBlock block = new SpeakerBlock(
            normalizedId,
            world,
            x,
            y,
            z,
            radius > 0 ? radius : 30.0,
            null,
            false,
            true
        );
        speakers.put(normalizedId, block);
        save();
        return true;
    }

    public boolean removeSpeaker(String id) {
        if (id == null) return false;
        SpeakerBlock removed = speakers.remove(id.toLowerCase().trim());
        if (removed != null) {
            save();
            return true;
        }
        return false;
    }

    public boolean linkSpeaker(String id, UUID playerUuid) {
        if (id == null) return false;
        String key = id.toLowerCase().trim();
        SpeakerBlock existing = speakers.get(key);
        if (existing == null) return false;

        speakers.put(key, existing.withLinkedPlayer(playerUuid));
        save();
        return true;
    }

    public boolean unlinkSpeaker(String id) {
        if (id == null) return false;
        String key = id.toLowerCase().trim();
        SpeakerBlock existing = speakers.get(key);
        if (existing == null) return false;

        speakers.put(key, existing.withLinkedPlayer(null));
        save();
        return true;
    }

    public boolean setRequireRedstone(String id, boolean requireRedstone) {
        if (id == null) return false;
        String key = id.toLowerCase().trim();
        SpeakerBlock existing = speakers.get(key);
        if (existing == null) return false;

        speakers.put(key, existing.withRequireRedstone(requireRedstone));
        save();
        return true;
    }

    public Optional<SpeakerBlock> getSpeaker(String id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(speakers.get(id.toLowerCase().trim()));
    }

    public Collection<SpeakerBlock> getAllSpeakers() {
        return Collections.unmodifiableCollection(speakers.values());
    }

    public List<SpeakerBlockState> getActiveSpeakerStates(String serverId) {
        List<SpeakerBlockState> states = new ArrayList<>();
        for (SpeakerBlock speaker : speakers.values()) {
            boolean active = isSpeakerActive(speaker);
            states.add(speaker.withActive(active).toState(serverId));
        }
        return states;
    }

    public boolean isSpeakerActive(SpeakerBlock speaker) {
        if (!speaker.requireRedstone()) {
            return true;
        }

        try {
            World world = Bukkit.getWorld(speaker.world());
            if (world == null) {
                return false;
            }
            int bx = (int) Math.floor(speaker.x());
            int by = (int) Math.floor(speaker.y());
            int bz = (int) Math.floor(speaker.z());
            Block block = world.getBlockAt(bx, by, bz);
            return block.isBlockPowered() || block.isBlockIndirectlyPowered();
        } catch (Throwable t) {
            return false;
        }
    }

    public void renderVisualIndicators(SpeechFeedbackHandler feedbackHandler) {
        if (feedbackHandler == null || speakers.isEmpty()) {
            return;
        }

        for (SpeakerBlock speaker : speakers.values()) {
            UUID linkedUuid = speaker.linkedPlayerUuid();
            if (linkedUuid != null && feedbackHandler.isSpeaking(linkedUuid)) {
                if (isSpeakerActive(speaker)) {
                    World world = Bukkit.getWorld(speaker.world());
                    if (world != null) {
                        Location loc = new Location(world, speaker.x() + 0.5, speaker.y() + 1.2, speaker.z() + 0.5);
                        world.spawnParticle(Particle.NOTE, loc, 1, 0.15, 0.1, 0.15, 0.5);
                    }
                }
            }
        }
    }
}
