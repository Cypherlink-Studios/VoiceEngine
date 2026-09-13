package com.voiceengine.audio;

import com.google.gson.JsonObject;
import com.voiceengine.net.VoiceBackendClient;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.World;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Stream;

public class AudioManager {
    private static final Logger LOGGER = Logger.getLogger(AudioManager.class.getName());
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(".mp3", ".ogg", ".wav");

    private final File dataFolder;
    private final File audioFile;
    private final File mediaFolder;
    private final Supplier<VoiceBackendClient> clientSupplier;

    private boolean persistenceEnabled;
    private boolean particlesEnabled;

    private final Map<String, AudioEmitter> emitters = new ConcurrentHashMap<>();

    public AudioManager(
        File dataFolder,
        Supplier<VoiceBackendClient> clientSupplier,
        boolean persistenceEnabled,
        boolean particlesEnabled
    ) {
        this.dataFolder = dataFolder;
        this.audioFile = new File(dataFolder, "audio.yml");
        this.mediaFolder = new File(dataFolder, "media");
        this.clientSupplier = clientSupplier;
        this.persistenceEnabled = persistenceEnabled;
        this.particlesEnabled = particlesEnabled;

        ensureDirectories();
    }

    public void ensureDirectories() {
        if (!dataFolder.exists()) {
            dataFolder.mkdirs();
        }
        if (!mediaFolder.exists()) {
            mediaFolder.mkdirs();
        }
    }

    public synchronized void load() {
        emitters.clear();
        if (!persistenceEnabled || !audioFile.exists()) {
            return;
        }

        try {
            YamlConfiguration config = YamlConfiguration.loadConfiguration(audioFile);
            ConfigurationSection section = config.getConfigurationSection("emitters");
            if (section == null) {
                return;
            }

            for (String key : section.getKeys(false)) {
                ConfigurationSection s = section.getConfigurationSection(key);
                if (s == null) continue;

                String source = s.getString("source", "");
                boolean spatial = s.getBoolean("spatial", false);
                String world = s.getString("world", "world");
                double x = s.getDouble("x", 0.0);
                double y = s.getDouble("y", 64.0);
                double z = s.getDouble("z", 0.0);
                double radius = s.getDouble("radius", 30.0);
                boolean loop = s.getBoolean("loop", false);
                double volume = s.getDouble("volume", 1.0);
                String state = s.getString("state", "PLAYING");
                long startedAt = s.getLong("started-at", System.currentTimeMillis());
                String speakerBlockId = s.getString("speaker-block-id", null);

                AudioEmitter emitter = new AudioEmitter(
                    key,
                    source,
                    spatial,
                    world,
                    x,
                    y,
                    z,
                    radius,
                    loop,
                    volume,
                    state,
                    startedAt,
                    speakerBlockId
                );
                emitters.put(key.toLowerCase(), emitter);
            }
            LOGGER.info("[VoiceEngine] Loaded " + emitters.size() + " audio emitters from audio.yml.");
            syncAllToBackend();
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "[VoiceEngine] Failed to load audio.yml: " + e.getMessage(), e);
        }
    }

    public synchronized void save() {
        if (!persistenceEnabled) {
            return;
        }

        try {
            YamlConfiguration config = new YamlConfiguration();
            ConfigurationSection section = config.createSection("emitters");

            for (AudioEmitter e : emitters.values()) {
                // Do not persist ephemeral one-shot sound effects
                if (e.id().startsWith("sfx-")) continue;

                ConfigurationSection s = section.createSection(e.id());
                s.set("source", e.source());
                s.set("spatial", e.spatial());
                s.set("world", e.world());
                s.set("x", e.x());
                s.set("y", e.y());
                s.set("z", e.z());
                s.set("radius", e.radius());
                s.set("loop", e.loop());
                s.set("volume", e.volume());
                s.set("state", e.state());
                s.set("started-at", e.startedAt());
                if (e.speakerBlockId() != null) {
                    s.set("speaker-block-id", e.speakerBlockId());
                }
            }

            if (!audioFile.getParentFile().exists()) {
                audioFile.getParentFile().mkdirs();
            }
            config.save(audioFile);
        } catch (IOException e) {
            LOGGER.log(Level.SEVERE, "[VoiceEngine] Could not save audio.yml: " + e.getMessage(), e);
        }
    }

    public void syncAllToBackend() {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client == null || !client.isOpen()) {
            return;
        }

        for (AudioEmitter emitter : emitters.values()) {
            JsonObject cmd = new JsonObject();
            cmd.addProperty("action", emitter.spatial() ? "play" : "broadcast");
            cmd.addProperty("id", emitter.id());
            cmd.addProperty("source", emitter.source());
            cmd.addProperty("spatial", emitter.spatial());
            cmd.addProperty("world", emitter.world());
            if (emitter.spatial()) {
                JsonObject pos = new JsonObject();
                pos.addProperty("x", emitter.x());
                pos.addProperty("y", emitter.y());
                pos.addProperty("z", emitter.z());
                cmd.add("position", pos);
                cmd.addProperty("radius", emitter.radius());
            }
            cmd.addProperty("loop", emitter.loop());
            cmd.addProperty("volume", emitter.volume());
            if (emitter.speakerBlockId() != null) {
                cmd.addProperty("speakerBlockId", emitter.speakerBlockId());
            }
            client.sendAudioCommand(cmd);

            if ("PAUSED".equalsIgnoreCase(emitter.state())) {
                JsonObject pauseCmd = new JsonObject();
                pauseCmd.addProperty("action", "pause");
                pauseCmd.addProperty("id", emitter.id());
                client.sendAudioCommand(pauseCmd);
            }
        }
    }

    public AudioEmitter playSpatial(
        String id,
        String source,
        String world,
        double x,
        double y,
        double z,
        double radius,
        boolean loop,
        double volume,
        String speakerBlockId
    ) {
        String normalizedId = id.trim().toLowerCase();
        double rad = radius > 0 ? radius : 30.0;
        double vol = Math.max(0.0, Math.min(1.0, volume));

        AudioEmitter emitter = new AudioEmitter(
            normalizedId,
            source.trim(),
            true,
            world != null ? world : "world",
            x,
            y,
            z,
            rad,
            loop,
            vol,
            "PLAYING",
            System.currentTimeMillis(),
            speakerBlockId
        );
        emitters.put(normalizedId, emitter);

        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "play");
        cmd.addProperty("id", normalizedId);
        cmd.addProperty("source", source.trim());
        cmd.addProperty("spatial", true);
        cmd.addProperty("world", emitter.world());
        JsonObject pos = new JsonObject();
        pos.addProperty("x", x);
        pos.addProperty("y", y);
        pos.addProperty("z", z);
        cmd.add("position", pos);
        cmd.addProperty("radius", rad);
        cmd.addProperty("loop", loop);
        cmd.addProperty("volume", vol);
        if (speakerBlockId != null) {
            cmd.addProperty("speakerBlockId", speakerBlockId);
        }
        sendToBackend(cmd);
        save();
        return emitter;
    }

    public AudioEmitter playBroadcast(
        String id,
        String source,
        boolean loop,
        double volume
    ) {
        String normalizedId = id.trim().toLowerCase();
        double vol = Math.max(0.0, Math.min(1.0, volume));

        AudioEmitter emitter = new AudioEmitter(
            normalizedId,
            source.trim(),
            false,
            "world",
            0,
            0,
            0,
            0,
            loop,
            vol,
            "PLAYING",
            System.currentTimeMillis(),
            null
        );
        emitters.put(normalizedId, emitter);

        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "broadcast");
        cmd.addProperty("id", normalizedId);
        cmd.addProperty("source", source.trim());
        cmd.addProperty("loop", loop);
        cmd.addProperty("volume", vol);
        sendToBackend(cmd);
        save();
        return emitter;
    }

    public String playSfx(
        String source,
        String world,
        Double x,
        Double y,
        Double z,
        Double radius
    ) {
        String sfxId = "sfx-" + UUID.randomUUID().toString().substring(0, 8);
        boolean spatial = (x != null && y != null && z != null);

        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "sfx");
        cmd.addProperty("id", sfxId);
        cmd.addProperty("source", source.trim());
        cmd.addProperty("spatial", spatial);
        if (spatial) {
            cmd.addProperty("world", world != null ? world : "world");
            JsonObject pos = new JsonObject();
            pos.addProperty("x", x);
            pos.addProperty("y", y);
            pos.addProperty("z", z);
            cmd.add("position", pos);
            cmd.addProperty("radius", radius != null && radius > 0 ? radius : 30.0);
        }
        cmd.addProperty("loop", false);
        cmd.addProperty("volume", 1.0);
        sendToBackend(cmd);
        return sfxId;
    }

    public boolean pause(String id) {
        String key = id.trim().toLowerCase();
        AudioEmitter existing = emitters.get(key);
        if (existing == null) {
            return false;
        }

        emitters.put(key, existing.withState("PAUSED"));
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "pause");
        cmd.addProperty("id", key);
        sendToBackend(cmd);
        save();
        return true;
    }

    public boolean resume(String id) {
        String key = id.trim().toLowerCase();
        AudioEmitter existing = emitters.get(key);
        if (existing == null) {
            return false;
        }

        emitters.put(key, existing.withState("PLAYING"));
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "resume");
        cmd.addProperty("id", key);
        sendToBackend(cmd);
        save();
        return true;
    }

    public boolean stop(String id) {
        String key = id.trim().toLowerCase();
        if ("all".equals(key)) {
            return stopAll() > 0;
        }

        AudioEmitter removed = emitters.remove(key);
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "stop");
        cmd.addProperty("id", key);
        sendToBackend(cmd);
        save();
        return removed != null;
    }

    public int stopAll() {
        int count = emitters.size();
        emitters.clear();
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "stop");
        cmd.addProperty("id", "all");
        sendToBackend(cmd);
        save();
        return count;
    }

    public boolean setVolume(String id, double volume) {
        String key = id.trim().toLowerCase();
        AudioEmitter existing = emitters.get(key);
        if (existing == null) {
            return false;
        }

        double clamped = Math.max(0.0, Math.min(1.0, volume));
        emitters.put(key, existing.withVolume(clamped));

        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "volume");
        cmd.addProperty("id", key);
        cmd.addProperty("volume", clamped);
        sendToBackend(cmd);
        save();
        return true;
    }

    public void purgeCache(String duration) {
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "cache_purge");
        cmd.addProperty("duration", duration != null ? duration : "all");
        sendToBackend(cmd);
    }

    public void requestCacheStatus() {
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "cache_status");
        sendToBackend(cmd);
    }

    public List<MediaFileInfo> getAvailableMediaFiles() {
        List<MediaFileInfo> list = new ArrayList<>();
        if (!mediaFolder.exists()) {
            return list;
        }

        Path basePath = mediaFolder.toPath();
        try (Stream<Path> stream = Files.walk(basePath)) {
            stream.filter(Files::isRegularFile)
                .filter(p -> !p.startsWith(mediaFolder.toPath().resolve("cache")))
                .forEach(p -> {
                    String fileName = p.getFileName().toString();
                    String lower = fileName.toLowerCase();
                    if (SUPPORTED_EXTENSIONS.stream().anyMatch(lower::endsWith)) {
                        String relative = basePath.relativize(p).toString().replace('\\', '/');
                        try {
                            long size = Files.size(p);
                            list.add(new MediaFileInfo(fileName, relative, size));
                        } catch (IOException ignored) {
                        }
                    }
                });
        } catch (IOException e) {
            LOGGER.log(Level.WARNING, "[VoiceEngine] Failed to scan media directory: " + e.getMessage(), e);
        }

        list.sort(Comparator.comparing(MediaFileInfo::relativePath));
        return list;
    }

    public void renderParticles() {
        if (!particlesEnabled || emitters.isEmpty()) {
            return;
        }

        for (AudioEmitter e : emitters.values()) {
            if (e.spatial() && "PLAYING".equalsIgnoreCase(e.state())) {
                try {
                    World world = Bukkit.getWorld(e.world());
                    if (world != null) {
                        Location loc = new Location(world, e.x() + 0.5, e.y() + 1.2, e.z() + 0.5);
                        world.spawnParticle(Particle.NOTE, loc, 1, 0.2, 0.2, 0.2, 0.5);
                    }
                } catch (Throwable ignored) {
                }
            }
        }
    }

    private void sendToBackend(JsonObject json) {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client != null && client.isOpen()) {
            client.sendAudioCommand(json);
        }
    }

    public Optional<AudioEmitter> getEmitter(String id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(emitters.get(id.trim().toLowerCase()));
    }

    public Collection<AudioEmitter> getAllEmitters() {
        return Collections.unmodifiableCollection(emitters.values());
    }

    public boolean isPersistenceEnabled() {
        return persistenceEnabled;
    }

    public void setPersistenceEnabled(boolean persistenceEnabled) {
        this.persistenceEnabled = persistenceEnabled;
    }

    public boolean isParticlesEnabled() {
        return particlesEnabled;
    }

    public void setParticlesEnabled(boolean particlesEnabled) {
        this.particlesEnabled = particlesEnabled;
    }

    public File getMediaFolder() {
        return mediaFolder;
    }
}
