package com.voiceengine.command;

import com.voiceengine.audio.AudioManager;
import com.voiceengine.audio.MediaFileInfo;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.speaker.SpeakerBlock;
import com.voiceengine.speaker.SpeakerManager;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Bukkit;
import org.bukkit.block.Block;
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

public class SpeakerCommands {
    private final SpeakerManager speakerManager;
    private final TranslationService translationService;
    private final AudioManager audioManager;

    public SpeakerCommands(SpeakerManager speakerManager, TranslationService translationService) {
        this(speakerManager, translationService, null);
    }

    public SpeakerCommands(SpeakerManager speakerManager, TranslationService translationService, AudioManager audioManager) {
        this.speakerManager = speakerManager;
        this.translationService = translationService;
        this.audioManager = audioManager;
    }

    @Suggestions("speakers")
    public List<String> suggestSpeakers(CommandContext<CommandSender> context, String input) {
        return speakerManager.getAllSpeakers().stream()
            .map(SpeakerBlock::id)
            .toList();
    }

    @Suggestions("onlinePlayers")
    public List<String> suggestOnlinePlayers(CommandContext<CommandSender> context, String input) {
        try {
            if (Bukkit.getServer() == null) {
                return List.of();
            }
            return Bukkit.getOnlinePlayers().stream()
                .map(Player::getName)
                .toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    @Suggestions("mediaFiles")
    public List<String> suggestMediaFiles(CommandContext<CommandSender> context, String input) {
        if (audioManager == null) {
            return List.of();
        }
        return audioManager.getAvailableMediaFiles().stream()
            .map(MediaFileInfo::relativePath)
            .toList();
    }

    @Suggestions("booleans")
    public List<String> suggestBooleans(CommandContext<CommandSender> context, String input) {
        return List.of("true", "false");
    }

    @Command("voice|ve|voiceengine|audio speaker create <id> [radius]")
    @Permission("voiceengine.admin.speaker")
    @CommandDescription("Create a new speaker block at targeted block")
    public void onCreate(
        CommandSender sender,
        @Argument("id") String id,
        @Argument("radius") @Range(min = "1", max = "500") Double radius
    ) {
        if (!(sender instanceof Player player)) {
            translationService.send(sender, "command.connect.only_players");
            return;
        }

        Block targetBlock = player.getTargetBlockExact(5);
        if (targetBlock == null || targetBlock.isEmpty()) {
            translationService.send(player, "command.speaker.must_look_at_block");
            return;
        }

        double rad = (radius != null && radius > 0) ? radius : 30.0;
        boolean created = speakerManager.createSpeaker(
            id,
            targetBlock.getWorld().getName(),
            targetBlock.getX(),
            targetBlock.getY(),
            targetBlock.getZ(),
            rad
        );

        if (created) {
            translationService.send(player, "command.speaker.created",
                Placeholder.parsed("id", id),
                Placeholder.parsed("x", String.valueOf(targetBlock.getX())),
                Placeholder.parsed("y", String.valueOf(targetBlock.getY())),
                Placeholder.parsed("z", String.valueOf(targetBlock.getZ())),
                Placeholder.parsed("radius", String.valueOf(rad))
            );
        } else {
            translationService.send(player, "command.speaker.already_exists",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio speaker remove <id>")
    @Permission("voiceengine.admin.speaker")
    @CommandDescription("Remove a registered speaker block")
    public void onRemove(CommandSender sender, @Argument(value = "id", suggestions = "speakers") String id) {
        boolean removed = speakerManager.removeSpeaker(id);
        if (removed) {
            translationService.send(sender, "command.speaker.removed",
                Placeholder.parsed("id", id)
            );
        } else {
            translationService.send(sender, "command.speaker.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio speaker link <id> <player>")
    @Permission("voiceengine.admin.speaker")
    @CommandDescription("Link a player's microphone to a speaker block")
    public void onLink(
        CommandSender sender,
        @Argument(value = "id", suggestions = "speakers") String id,
        @Argument(value = "player", suggestions = "onlinePlayers") String playerName
    ) {
        Player targetPlayer = Bukkit.getPlayer(playerName);
        if (targetPlayer == null) {
            translationService.send(sender, "command.moderation.player_not_found",
                Placeholder.parsed("player", playerName)
            );
            return;
        }

        boolean linked = speakerManager.linkSpeaker(id, targetPlayer.getUniqueId());
        if (linked) {
            translationService.send(sender, "command.speaker.linked",
                Placeholder.parsed("id", id),
                Placeholder.parsed("player", targetPlayer.getName())
            );
        } else {
            translationService.send(sender, "command.speaker.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio speaker unlink <id>")
    @Permission("voiceengine.admin.speaker")
    @CommandDescription("Unlink voice transmission from a speaker block")
    public void onUnlink(CommandSender sender, @Argument(value = "id", suggestions = "speakers") String id) {
        boolean unlinked = speakerManager.unlinkSpeaker(id);
        if (unlinked) {
            translationService.send(sender, "command.speaker.unlinked",
                Placeholder.parsed("id", id)
            );
        } else {
            translationService.send(sender, "command.speaker.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio speaker redstone <id> <requireRedstone>")
    @Permission("voiceengine.admin.speaker")
    @CommandDescription("Toggle redstone activation requirement for a speaker block")
    public void onRedstone(
        CommandSender sender,
        @Argument(value = "id", suggestions = "speakers") String id,
        @Argument(value = "requireRedstone", suggestions = "booleans") boolean requireRedstone
    ) {
        boolean updated = speakerManager.setRequireRedstone(id, requireRedstone);
        if (updated) {
            translationService.send(sender, "command.speaker.redstone_set",
                Placeholder.parsed("id", id),
                Placeholder.parsed("value", String.valueOf(requireRedstone))
            );
        } else {
            translationService.send(sender, "command.speaker.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio speaker play <id> <source>")
    @Permission("voiceengine.admin.speaker")
    @CommandDescription("Play audio media track on a speaker block")
    public void onSpeakerPlay(
        CommandSender sender,
        @Argument(value = "id", suggestions = "speakers") String id,
        @Argument(value = "source", suggestions = "mediaFiles") @Quoted String source,
        @Flag("loop") boolean loop
    ) {
        boolean bound = speakerManager.bindAudio(id, source, loop);
        if (bound) {
            translationService.send(sender, "command.speaker.play_started",
                Placeholder.parsed("id", id),
                Placeholder.parsed("source", source),
                Placeholder.parsed("loop", String.valueOf(loop))
            );
        } else {
            translationService.send(sender, "command.speaker.not_found",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio speaker stop <id>")
    @Permission("voiceengine.admin.speaker")
    @CommandDescription("Stop audio media playback on a speaker block")
    public void onSpeakerStop(CommandSender sender, @Argument(value = "id", suggestions = "speakers") String id) {
        boolean stopped = speakerManager.unbindAudio(id);
        if (stopped) {
            translationService.send(sender, "command.speaker.play_stopped",
                Placeholder.parsed("id", id)
            );
        } else {
            translationService.send(sender, "command.speaker.no_audio",
                Placeholder.parsed("id", id)
            );
        }
    }

    @Command("voice|ve|voiceengine|audio speaker list")
    @Permission("voiceengine.admin.speaker")
    @CommandDescription("List all registered speaker blocks")
    public void onList(CommandSender sender) {
        Collection<SpeakerBlock> speakers = speakerManager.getAllSpeakers();
        if (speakers.isEmpty()) {
            translationService.send(sender, "command.speaker.no_speakers");
            return;
        }

        translationService.send(sender, "command.speaker.list_header",
            Placeholder.parsed("count", String.valueOf(speakers.size()))
        );

        for (SpeakerBlock s : speakers) {
            String linkedName = "none";
            if (s.linkedPlayerUuid() != null) {
                Player p = Bukkit.getPlayer(s.linkedPlayerUuid());
                linkedName = (p != null) ? p.getName() : s.linkedPlayerUuid().toString();
            }

            String mediaInfo = (s.audioSource() != null) ? s.audioSource() + (s.loopMedia() ? " (loop)" : "") : "none";

            translationService.send(sender, "command.speaker.list_item",
                Placeholder.parsed("id", s.id()),
                Placeholder.parsed("x", String.format("%.1f", s.x())),
                Placeholder.parsed("y", String.format("%.1f", s.y())),
                Placeholder.parsed("z", String.format("%.1f", s.z())),
                Placeholder.parsed("world", s.world()),
                Placeholder.parsed("radius", String.valueOf(s.radius())),
                Placeholder.parsed("linked", linkedName),
                Placeholder.parsed("redstone", String.valueOf(s.requireRedstone())),
                Placeholder.parsed("media", mediaInfo)
            );
        }
    }
}
