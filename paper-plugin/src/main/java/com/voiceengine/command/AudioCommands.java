package com.voiceengine.command;

import com.voiceengine.audio.AudioEmitter;
import com.voiceengine.audio.AudioManager;
import com.voiceengine.audio.MediaFileInfo;
import com.voiceengine.i18n.TranslationService;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Location;
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
    public List<String> suggestMediaFiles(CommandContext<CommandSourceStack> context, String input) {
        return audioManager.getAvailableMediaFiles().stream()
            .map(MediaFileInfo::relativePath)
            .toList();
    }

    @Command("voice|ve|voiceengine|audio audio play <id> <source> <x> <y> <z> [radius]")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Play 3D spatial audio at specific coordinates")
    public void onPlay(
        CommandSourceStack stack,
        @Argument("id") String id,
        @Argument(value = "source", suggestions = "mediaFiles") @Quoted String source,
        @Argument("x") double x,
        @Argument("y") double y,
        @Argument("z") double z,
        @Argument("radius") @Range(min = "1", max = "1000") Double radius,
        @Flag("loop") boolean loop
    ) {
        String worldName = "world";
        if (stack.getSender() instanceof Player player) {
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

        translationService.send(stack.getSender(), "command.audio.play_started",
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
        CommandSourceStack stack,
        @Argument("id") String id,
        @Argument(value = "source", suggestions = "mediaFiles") @Quoted String source,
        @Flag("loop") boolean loop
    ) {
        AudioEmitter emitter = audioManager.playBroadcast(id, source, loop, 1.0);
        translationService.send(stack.getSender(), "command.audio.broadcast_started",
            Placeholder.parsed("id", emitter.id()),
            Placeholder.parsed("source", emitter.source()),
            Placeholder.parsed("loop", String.valueOf(loop))
        );
    }

    @Command("voice|ve|voiceengine|audio audio sfx <source>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Play a 2D one-shot sound effect globally")
    public void onSfx2D(
        CommandSourceStack stack,
        @Argument(value = "source", suggestions = "mediaFiles") @Quoted String source
    ) {
        String sfxId = audioManager.playSfx(source, null, null, null, null, null);
        translationService.send(stack.getSender(), "command.audio.sfx_started",
            Placeholder.parsed("id", sfxId),
            Placeholder.parsed("source", source)
        );
    }

    @Command("voice|ve|voiceengine|audio audio sfx <source> <x> <y> <z> [radius]")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Play a 3D one-shot sound effect at coordinates")
    public void onSfx3D(
        CommandSourceStack stack,
        @Argument(value = "source", suggestions = "mediaFiles") @Quoted String source,
        @Argument("x") double x,
        @Argument("y") double y,
        @Argument("z") double z,
        @Argument("radius") @Range(min = "1", max = "1000") Double radius
    ) {
        String worldName = "world";
        if (stack.getSender() instanceof Player player) {
            worldName = player.getWorld().getName();
        }

        double rad = (radius != null && radius > 0) ? radius : 30.0;
        String sfxId = audioManager.playSfx(source, worldName, x, y, z, rad);
        translationService.send(stack.getSender(), "command.audio.sfx_started",
            Placeholder.parsed("id", sfxId),
            Placeholder.parsed("source", source)
        );
    }

    @Command("voice|ve|voiceengine|audio audio pause <id>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Pause an active audio emitter")
    public void onPause(CommandSourceStack stack, @Argument("id") String id) {
        boolean paused = audioManager.pause(id);
        if (paused) {
            translationService.send(stack.getSender(), "command.audio.paused",
                Placeholder.parsed("id", id)
            );
        } else {
            translationService.send(stack.getSender(), "command.audio.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio resume <id>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Resume a paused audio emitter")
    public void onResume(CommandSourceStack stack, @Argument("id") String id) {
        boolean resumed = audioManager.resume(id);
        if (resumed) {
            translationService.send(stack.getSender(), "command.audio.resumed",
                Placeholder.parsed("id", id)
            );
        } else {
            translationService.send(stack.getSender(), "command.audio.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio stop <id>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Stop an audio emitter or 'all'")
    public void onStop(CommandSourceStack stack, @Argument("id") String id) {
        if ("all".equalsIgnoreCase(id.trim())) {
            int count = audioManager.stopAll();
            translationService.send(stack.getSender(), "command.audio.stopped_all",
                Placeholder.parsed("count", String.valueOf(count))
            );
            return;
        }

        boolean stopped = audioManager.stop(id);
        if (stopped) {
            translationService.send(stack.getSender(), "command.audio.stopped",
                Placeholder.parsed("id", id)
            );
        } else {
            translationService.send(stack.getSender(), "command.audio.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio volume <id> <volume>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Adjust volume of an audio emitter (0.0 to 1.0)")
    public void onVolume(
        CommandSourceStack stack,
        @Argument("id") String id,
        @Argument("volume") @Range(min = "0.0", max = "1.0") double volume
    ) {
        boolean updated = audioManager.setVolume(id, volume);
        if (updated) {
            translationService.send(stack.getSender(), "command.audio.volume_set",
                Placeholder.parsed("id", id),
                Placeholder.parsed("volume", String.format("%.2f", volume))
            );
        } else {
            translationService.send(stack.getSender(), "command.audio.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio list")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("List all active audio emitters")
    public void onList(CommandSourceStack stack) {
        Collection<AudioEmitter> emitters = audioManager.getAllEmitters();
        if (emitters.isEmpty()) {
            translationService.send(stack.getSender(), "command.audio.no_emitters");
            return;
        }

        translationService.send(stack.getSender(), "command.audio.list_header",
            Placeholder.parsed("count", String.valueOf(emitters.size()))
        );

        for (AudioEmitter e : emitters) {
            String mode = e.spatial()
                ? String.format("Spatial (%.1f, %.1f, %.1f) in %s [r=%.1f]", e.x(), e.y(), e.z(), e.world(), e.radius())
                : "Global 2D";

            translationService.send(stack.getSender(), "command.audio.list_item",
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
    public void onFiles(CommandSourceStack stack) {
        List<MediaFileInfo> files = audioManager.getAvailableMediaFiles();
        if (files.isEmpty()) {
            translationService.send(stack.getSender(), "command.audio.no_files");
            return;
        }

        translationService.send(stack.getSender(), "command.audio.files_header",
            Placeholder.parsed("count", String.valueOf(files.size()))
        );

        for (MediaFileInfo f : files) {
            translationService.send(stack.getSender(), "command.audio.files_item",
                Placeholder.parsed("file", f.relativePath()),
                Placeholder.parsed("size", f.formattedSize())
            );
        }
    }

    @Command("voice|ve|voiceengine|audio audio cache status")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("View remote media download cache status")
    public void onCacheStatus(CommandSourceStack stack) {
        audioManager.requestCacheStatus();
        translationService.send(stack.getSender(), "command.audio.cache_status_requested");
    }

    @Command("voice|ve|voiceengine|audio audio cache purge [duration]")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Purge remote media download cache (e.g. 7d, 24h, all)")
    public void onCachePurge(
        CommandSourceStack stack,
        @Argument("duration") String duration
    ) {
        String targetDuration = (duration != null && !duration.isBlank()) ? duration : "all";
        audioManager.purgeCache(targetDuration);
        translationService.send(stack.getSender(), "command.audio.cache_purged",
            Placeholder.parsed("duration", targetDuration)
        );
    }

    @Command("voice|ve|voiceengine|audio audio particles <state>")
    @Permission("voiceengine.admin.audio")
    @CommandDescription("Toggle visual musical note particles for spatial emitters")
    public void onParticles(
        CommandSourceStack stack,
        @Argument("state") String state
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
        translationService.send(stack.getSender(), "command.audio.particles_toggled",
            Placeholder.parsed("state", enable ? "ENABLED" : "DISABLED")
        );
    }
}
