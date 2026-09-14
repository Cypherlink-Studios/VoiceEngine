package com.voiceengine.command;

import com.voiceengine.audio.AudioEmitter;
import com.voiceengine.audio.AudioManager;
import com.voiceengine.audio.MediaFileInfo;
import com.voiceengine.i18n.TranslationService;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Location;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.incendo.cloud.annotation.specifier.Quoted;
import org.incendo.cloud.annotation.specifier.Range;
import org.incendo.cloud.annotations.Argument;
import org.incendo.cloud.annotations.Command;
import org.incendo.cloud.annotations.CommandDescription;
import org.incendo.cloud.annotations.Flag;
import org.incendo.cloud.annotations.Permission;
import org.incendo.cloud.annotations.suggestion.Suggestions;
import org.incendo.cloud.context.CommandContext;

import java.util.Collection;
import java.util.List;

public class AudioCommands {
    private final AudioManager audioManager;
    private final TranslationService translationService;

    public AudioCommands(AudioManager audioManager, TranslationService translationService) {
        this.audioManager = audioManager;
        this.translationService = translationService;
    }

    @Suggestions("mediaFiles")
    public List<String> suggestMediaFiles(CommandContext<CommandSender> context, String input) {
        return audioManager.getAvailableMediaFiles().stream()
            .map(MediaFileInfo::relativePath)
            .toList();
    }

    @Suggestions("activeEmitters")
    public List<String> suggestActiveEmitters(CommandContext<CommandSender> context, String input) {
        return audioManager.getAllEmitters().stream()
            .map(AudioEmitter::id)
            .toList();
    }

    @Suggestions("stoppableEmitters")
    public List<String> suggestStoppableEmitters(CommandContext<CommandSender> context, String input) {
        java.util.List<String> list = new java.util.ArrayList<>();
        list.add("all");
        list.addAll(audioManager.getAllEmitters().stream().map(AudioEmitter::id).toList());
        return list;
    }

    @Suggestions("volumePresets")
    public List<String> suggestVolumePresets(CommandContext<CommandSender> context, String input) {
        return List.of("0.25", "0.5", "0.75", "1.0");
    }

    @Suggestions("purgeDurations")
    public List<String> suggestPurgeDurations(CommandContext<CommandSender> context, String input) {
        return List.of("all", "24h", "7d", "30d");
    }

    @Suggestions("particleStates")
    public List<String> suggestParticleStates(CommandContext<CommandSender> context, String input) {
        return List.of("on", "off", "toggle");
    }

    @Command("voice|ve|voiceengine|audio audio play <id> <source> <x> <y> <z> [radius]")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Play 3D spatial audio at specific coordinates")
    public void onPlay(
        CommandSender sender,
        @Argument("id") String id,
        @Argument(value = "source", suggestions = "mediaFiles") @Quoted String source,
        @Argument("x") double x,
        @Argument("y") double y,
        @Argument("z") double z,
        @Argument("radius") @Range(min = "1", max = "1000") Double radius,
        @Flag("loop") boolean loop
    ) {
        String worldName = "world";
        if (sender instanceof Player player) {
            worldName = player.getWorld().getName();
        }

        double rad = (radius != null && radius > 0) ? radius : 30.0;
        AudioEmitter emitter = audioManager.playSpatial(
            id,
            source,
            worldName,
            x,
            y,
            z,
            rad,
            loop,
            1.0,
            null
        );

        translationService.send(sender, "command.audio.play_started",
            Placeholder.parsed("id", emitter.id()),
            Placeholder.parsed("source", emitter.source()),
            Placeholder.parsed("x", String.format("%.1f", x)),
            Placeholder.parsed("y", String.format("%.1f", y)),
            Placeholder.parsed("z", String.format("%.1f", z)),
            Placeholder.parsed("radius", String.valueOf(rad)),
            Placeholder.parsed("loop", String.valueOf(loop))
        );
    }

    @Command("voice|ve|voiceengine|audio audio broadcast <id> <source>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Broadcast 2D audio globally to all connected players")
    public void onBroadcast(
        CommandSender sender,
        @Argument("id") String id,
        @Argument(value = "source", suggestions = "mediaFiles") @Quoted String source,
        @Flag("loop") boolean loop
    ) {
        AudioEmitter emitter = audioManager.playBroadcast(id, source, loop, 1.0);
        translationService.send(sender, "command.audio.broadcast_started",
            Placeholder.parsed("id", emitter.id()),
            Placeholder.parsed("source", emitter.source()),
            Placeholder.parsed("loop", String.valueOf(loop))
        );
    }

    @Command("voice|ve|voiceengine|audio audio sfx <source>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Play a 2D one-shot sound effect globally")
    public void onSfx2D(
        CommandSender sender,
        @Argument(value = "source", suggestions = "mediaFiles") @Quoted String source
    ) {
        String sfxId = audioManager.playSfx(source, null, null, null, null, null);
        translationService.send(sender, "command.audio.sfx_started",
            Placeholder.parsed("id", sfxId),
            Placeholder.parsed("source", source)
        );
    }

    @Command("voice|ve|voiceengine|audio audio sfx <source> <x> <y> <z> [radius]")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Play a 3D one-shot sound effect at coordinates")
    public void onSfx3D(
        CommandSender sender,
        @Argument(value = "source", suggestions = "mediaFiles") @Quoted String source,
        @Argument("x") double x,
        @Argument("y") double y,
        @Argument("z") double z,
        @Argument("radius") @Range(min = "1", max = "1000") Double radius
    ) {
        String worldName = "world";
        if (sender instanceof Player player) {
            worldName = player.getWorld().getName();
        }

        double rad = (radius != null && radius > 0) ? radius : 30.0;
        String sfxId = audioManager.playSfx(source, worldName, x, y, z, rad);
        translationService.send(sender, "command.audio.sfx_started",
            Placeholder.parsed("id", sfxId),
            Placeholder.parsed("source", source)
        );
    }

    @Command("voice|ve|voiceengine|audio audio pause <id>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Pause an active audio emitter")
    public void onPause(CommandSender sender, @Argument(value = "id", suggestions = "activeEmitters") String id) {
        boolean paused = audioManager.pause(id);
        if (paused) {
            translationService.send(sender, "command.audio.paused",
                Placeholder.parsed("id", id)
            );
        } else {
            translationService.send(sender, "command.audio.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio resume <id>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Resume a paused audio emitter")
    public void onResume(CommandSender sender, @Argument(value = "id", suggestions = "activeEmitters") String id) {
        boolean resumed = audioManager.resume(id);
        if (resumed) {
            translationService.send(sender, "command.audio.resumed",
                Placeholder.parsed("id", id)
            );
        } else {
            translationService.send(sender, "command.audio.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio stop <id>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Stop an audio emitter or 'all'")
    public void onStop(CommandSender sender, @Argument(value = "id", suggestions = "stoppableEmitters") String id) {
        if ("all".equalsIgnoreCase(id.trim())) {
            int count = audioManager.stopAll();
            translationService.send(sender, "command.audio.stopped_all",
                Placeholder.parsed("count", String.valueOf(count))
            );
            return;
        }

        boolean stopped = audioManager.stop(id);
        if (stopped) {
            translationService.send(sender, "command.audio.stopped",
                Placeholder.parsed("id", id)
            );
        } else {
            translationService.send(sender, "command.audio.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio volume <id> <volume>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Adjust volume of an audio emitter (0.0 to 1.0)")
    public void onVolume(
        CommandSender sender,
        @Argument(value = "id", suggestions = "activeEmitters") String id,
        @Argument(value = "volume", suggestions = "volumePresets") @Range(min = "0.0", max = "1.0") double volume
    ) {
        boolean updated = audioManager.setVolume(id, volume);
        if (updated) {
            translationService.send(sender, "command.audio.volume_set",
                Placeholder.parsed("id", id),
                Placeholder.parsed("volume", String.format("%.2f", volume))
            );
        } else {
            translationService.send(sender, "command.audio.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio list")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("List all active audio emitters")
    public void onList(CommandSender sender) {
        Collection<AudioEmitter> emitters = audioManager.getAllEmitters();
        if (emitters.isEmpty()) {
            translationService.send(sender, "command.audio.no_emitters");
            return;
        }

        translationService.send(sender, "command.audio.list_header",
            Placeholder.parsed("count", String.valueOf(emitters.size()))
        );

        for (AudioEmitter e : emitters) {
            String mode = e.spatial()
                ? String.format("Spatial (%.1f, %.1f, %.1f) in %s [r=%.1f]", e.x(), e.y(), e.z(), e.world(), e.radius())
                : "Global 2D";

            translationService.send(sender, "command.audio.list_item",
                Placeholder.parsed("id", e.id()),
                Placeholder.parsed("state", e.state()),
                Placeholder.parsed("source", e.source()),
                Placeholder.parsed("mode", mode),
                Placeholder.parsed("volume", String.format("%.2f", e.volume())),
                Placeholder.parsed("loop", String.valueOf(e.loop()))
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio files")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("List available audio files in the media folder")
    public void onFiles(CommandSender sender) {
        List<MediaFileInfo> files = audioManager.getAvailableMediaFiles();
        if (files.isEmpty()) {
            translationService.send(sender, "command.audio.no_files");
            return;
        }

        translationService.send(sender, "command.audio.files_header",
            Placeholder.parsed("count", String.valueOf(files.size()))
        );

        for (MediaFileInfo f : files) {
            translationService.send(sender, "command.audio.files_item",
                Placeholder.parsed("file", f.relativePath()),
                Placeholder.parsed("size", f.formattedSize())
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio cache status")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("View remote media download cache status")
    public void onCacheStatus(CommandSender sender) {
        audioManager.requestCacheStatus();
        translationService.send(sender, "command.audio.cache_status_requested");
    }

    @Command("voice|ve|voiceengine|audio audio cache purge [duration]")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Purge remote media download cache (e.g. 7d, 24h, all)")
    public void onCachePurge(
        CommandSender sender,
        @Argument(value = "duration", suggestions = "purgeDurations") String duration
    ) {
        String targetDuration = (duration != null && !duration.isBlank()) ? duration : "all";
        audioManager.purgeCache(targetDuration);
        translationService.send(sender, "command.audio.cache_purged",
            Placeholder.parsed("duration", targetDuration)
        );
    }

    @Command("voice|ve|voiceengine|audio audio particles <state>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Toggle visual musical note particles for spatial emitters")
    public void onParticles(
        CommandSender sender,
        @Argument(value = "state", suggestions = "particleStates") String state
    ) {
        boolean enable;
        if ("on".equalsIgnoreCase(state) || "true".equalsIgnoreCase(state)) {
            enable = true;
        } else if ("off".equalsIgnoreCase(state) || "false".equalsIgnoreCase(state)) {
            enable = false;
        } else {
            enable = !audioManager.isParticlesEnabled();
        }

        audioManager.setParticlesEnabled(enable);
        translationService.send(sender, "command.audio.particles_toggled",
            Placeholder.parsed("state", enable ? "ENABLED" : "DISABLED")
        );
    }
}
