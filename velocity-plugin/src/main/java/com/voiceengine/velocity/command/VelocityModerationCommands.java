package com.voiceengine.velocity.command;

import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.voiceengine.velocity.moderation.DurationParser;
import com.voiceengine.velocity.moderation.PunishmentRecord;
import com.voiceengine.velocity.moderation.VelocityModerationService;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.incendo.cloud.annotation.specifier.Greedy;
import org.incendo.cloud.annotations.Argument;
import org.incendo.cloud.annotations.Command;
import org.incendo.cloud.annotations.CommandDescription;
import org.incendo.cloud.annotations.Default;
import org.incendo.cloud.annotations.Permission;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public class VelocityModerationCommands {
    private static final MiniMessage MINI_MESSAGE = MiniMessage.miniMessage();

    private final ProxyServer proxyServer;
    private final VelocityModerationService moderationService;

    public VelocityModerationCommands(ProxyServer proxyServer, VelocityModerationService moderationService) {
        this.proxyServer = proxyServer;
        this.moderationService = moderationService;
    }

    @Command("voice|ve|voiceengine|audio kick <player> [reason]")
    @Permission("voiceengine.admin.kick")
    @CommandDescription("Kick a player from the VoiceEngine web client session")
    public void onKick(
        CommandSource source,
        @Argument("player") String playerName,
        @Argument("reason") @Default("Kicked by staff") @Greedy String reason
    ) {
        Optional<Player> targetOpt = proxyServer.getPlayer(playerName);
        if (targetOpt.isEmpty()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Player <yellow><player></yellow> not found on the network.</red>",
                Placeholder.parsed("player", playerName)));
            return;
        }

        Player target = targetOpt.get();
        boolean kicked = moderationService.kickPlayer(target.getUniqueId(), reason);
        if (kicked) {
            source.sendMessage(MINI_MESSAGE.deserialize("<green>Successfully kicked <yellow><player></yellow> from voice chat. Reason: <reason></green>",
                Placeholder.parsed("player", target.getUsername()),
                Placeholder.parsed("reason", reason)));
            target.sendMessage(MINI_MESSAGE.deserialize("<red>You were kicked from voice chat by a moderator. Reason: <reason></red>",
                Placeholder.parsed("reason", reason)));
        } else {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Failed to kick player: Voice backend offline.</red>"));
        }
    }

    @Command("voice|ve|voiceengine|audio mute <player> <duration> [reason]")
    @Permission("voiceengine.admin.mute")
    @CommandDescription("Mute a player's microphone in VoiceEngine")
    public void onMute(
        CommandSource source,
        @Argument("player") String playerName,
        @Argument("duration") String duration,
        @Argument("reason") @Default("Muted by staff") @Greedy String reason
    ) {
        Optional<Player> targetOpt = proxyServer.getPlayer(playerName);
        if (targetOpt.isEmpty()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Player <yellow><player></yellow> not found.</red>",
                Placeholder.parsed("player", playerName)));
            return;
        }

        long expiresAt;
        try {
            expiresAt = DurationParser.parseDurationToExpiration(duration);
        } catch (IllegalArgumentException e) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red><msg></red>", Placeholder.parsed("msg", e.getMessage())));
            return;
        }

        Player target = targetOpt.get();
        String clientIp = target.getRemoteAddress() != null && target.getRemoteAddress().getAddress() != null
            ? target.getRemoteAddress().getAddress().getHostAddress() : null;

        UUID staffUuid = (source instanceof Player p) ? p.getUniqueId() : null;
        String staffName = (source instanceof Player p) ? p.getUsername() : "Console";

        try {
            moderationService.mutePlayer(target.getUniqueId(), target.getUsername(), clientIp, staffUuid, staffName, expiresAt, reason);
            String formattedTime = DurationParser.formatRemaining(expiresAt);
            source.sendMessage(MINI_MESSAGE.deserialize("<green>Muted <yellow><player></yellow> for <time>. Reason: <reason></green>",
                Placeholder.parsed("player", target.getUsername()),
                Placeholder.parsed("time", formattedTime),
                Placeholder.parsed("reason", reason)));

            target.sendMessage(MINI_MESSAGE.deserialize("<red>You have been muted in voice chat for <time>. Reason: <reason></red>",
                Placeholder.parsed("time", formattedTime),
                Placeholder.parsed("reason", reason)));
        } catch (Exception e) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Database error while saving mute: <msg></red>",
                Placeholder.parsed("msg", e.getMessage())));
        }
    }

    @Command("voice|ve|voiceengine|audio deafen <player> <duration> [reason]")
    @Permission("voiceengine.admin.deafen")
    @CommandDescription("Deafen a player so they cannot hear voice audio")
    public void onDeafen(
        CommandSource source,
        @Argument("player") String playerName,
        @Argument("duration") String duration,
        @Argument("reason") @Default("Deafened by staff") @Greedy String reason
    ) {
        Optional<Player> targetOpt = proxyServer.getPlayer(playerName);
        if (targetOpt.isEmpty()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Player <yellow><player></yellow> not found.</red>",
                Placeholder.parsed("player", playerName)));
            return;
        }

        long expiresAt;
        try {
            expiresAt = DurationParser.parseDurationToExpiration(duration);
        } catch (IllegalArgumentException e) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red><msg></red>", Placeholder.parsed("msg", e.getMessage())));
            return;
        }

        Player target = targetOpt.get();
        String clientIp = target.getRemoteAddress() != null && target.getRemoteAddress().getAddress() != null
            ? target.getRemoteAddress().getAddress().getHostAddress() : null;

        UUID staffUuid = (source instanceof Player p) ? p.getUniqueId() : null;
        String staffName = (source instanceof Player p) ? p.getUsername() : "Console";

        try {
            moderationService.deafenPlayer(target.getUniqueId(), target.getUsername(), clientIp, staffUuid, staffName, expiresAt, reason);
            String formattedTime = DurationParser.formatRemaining(expiresAt);
            source.sendMessage(MINI_MESSAGE.deserialize("<green>Deafened <yellow><player></yellow> for <time>. Reason: <reason></green>",
                Placeholder.parsed("player", target.getUsername()),
                Placeholder.parsed("time", formattedTime),
                Placeholder.parsed("reason", reason)));

            target.sendMessage(MINI_MESSAGE.deserialize("<red>You have been deafened in voice chat for <time>. Reason: <reason></red>",
                Placeholder.parsed("time", formattedTime),
                Placeholder.parsed("reason", reason)));
        } catch (Exception e) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Database error while saving deafen: <msg></red>",
                Placeholder.parsed("msg", e.getMessage())));
        }
    }

    @Command("voice|ve|voiceengine|audio ban <player> <duration> [reason]")
    @Permission("voiceengine.admin.ban")
    @CommandDescription("Ban a player from using VoiceEngine across the network")
    public void onBan(
        CommandSource source,
        @Argument("player") String playerName,
        @Argument("duration") String duration,
        @Argument("reason") @Default("Banned by staff") @Greedy String reason
    ) {
        Optional<Player> targetOpt = proxyServer.getPlayer(playerName);
        if (targetOpt.isEmpty()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Player <yellow><player></yellow> not found.</red>",
                Placeholder.parsed("player", playerName)));
            return;
        }

        long expiresAt;
        try {
            expiresAt = DurationParser.parseDurationToExpiration(duration);
        } catch (IllegalArgumentException e) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red><msg></red>", Placeholder.parsed("msg", e.getMessage())));
            return;
        }

        Player target = targetOpt.get();
        String clientIp = target.getRemoteAddress() != null && target.getRemoteAddress().getAddress() != null
            ? target.getRemoteAddress().getAddress().getHostAddress() : null;

        UUID staffUuid = (source instanceof Player p) ? p.getUniqueId() : null;
        String staffName = (source instanceof Player p) ? p.getUsername() : "Console";

        try {
            moderationService.banPlayer(target.getUniqueId(), target.getUsername(), clientIp, staffUuid, staffName, expiresAt, reason);
            String formattedTime = DurationParser.formatRemaining(expiresAt);
            source.sendMessage(MINI_MESSAGE.deserialize("<green>Banned <yellow><player></yellow> from voice chat for <time>. Reason: <reason></green>",
                Placeholder.parsed("player", target.getUsername()),
                Placeholder.parsed("time", formattedTime),
                Placeholder.parsed("reason", reason)));

            target.sendMessage(MINI_MESSAGE.deserialize("<red>You have been banned from VoiceEngine for <time>. Reason: <reason></red>",
                Placeholder.parsed("time", formattedTime),
                Placeholder.parsed("reason", reason)));
        } catch (Exception e) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Database error while saving ban: <msg></red>",
                Placeholder.parsed("msg", e.getMessage())));
        }
    }

    @Command("voice|ve|voiceengine|audio unmute <player>")
    @Permission("voiceengine.admin.mute")
    @CommandDescription("Unmute a player in VoiceEngine")
    public void onUnmute(CommandSource source, @Argument("player") String playerName) {
        Optional<Player> targetOpt = proxyServer.getPlayer(playerName);
        if (targetOpt.isEmpty()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Player <yellow><player></yellow> not found.</red>",
                Placeholder.parsed("player", playerName)));
            return;
        }

        Player target = targetOpt.get();
        try {
            boolean unmuted = moderationService.unmutePlayer(target.getUniqueId());
            if (unmuted) {
                source.sendMessage(MINI_MESSAGE.deserialize("<green>Unmuted <yellow><player></yellow> successfully.</green>",
                    Placeholder.parsed("player", target.getUsername())));
                target.sendMessage(MINI_MESSAGE.deserialize("<green>You have been unmuted in voice chat.</green>"));
            } else {
                source.sendMessage(MINI_MESSAGE.deserialize("<yellow><player></yellow> was not actively muted.",
                    Placeholder.parsed("player", target.getUsername())));
            }
        } catch (Exception e) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Error unmuting player: <msg></red>", Placeholder.parsed("msg", e.getMessage())));
        }
    }

    @Command("voice|ve|voiceengine|audio undeafen <player>")
    @Permission("voiceengine.admin.deafen")
    @CommandDescription("Undeafen a player in VoiceEngine")
    public void onUndeafen(CommandSource source, @Argument("player") String playerName) {
        Optional<Player> targetOpt = proxyServer.getPlayer(playerName);
        if (targetOpt.isEmpty()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Player <yellow><player></yellow> not found.</red>",
                Placeholder.parsed("player", playerName)));
            return;
        }

        Player target = targetOpt.get();
        try {
            boolean undeafened = moderationService.undeafenPlayer(target.getUniqueId());
            if (undeafened) {
                source.sendMessage(MINI_MESSAGE.deserialize("<green>Undeafened <yellow><player></yellow> successfully.</green>",
                    Placeholder.parsed("player", target.getUsername())));
                target.sendMessage(MINI_MESSAGE.deserialize("<green>You have been undeafened in voice chat.</green>"));
            } else {
                source.sendMessage(MINI_MESSAGE.deserialize("<yellow><player></yellow> was not actively deafened.",
                    Placeholder.parsed("player", target.getUsername())));
            }
        } catch (Exception e) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Error undeafening player: <msg></red>", Placeholder.parsed("msg", e.getMessage())));
        }
    }

    @Command("voice|ve|voiceengine|audio unban <player>")
    @Permission("voiceengine.admin.ban")
    @CommandDescription("Unban a player in VoiceEngine")
    public void onUnban(CommandSource source, @Argument("player") String playerName) {
        Optional<Player> targetOpt = proxyServer.getPlayer(playerName);
        if (targetOpt.isEmpty()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Player <yellow><player></yellow> not found.</red>",
                Placeholder.parsed("player", playerName)));
            return;
        }

        Player target = targetOpt.get();
        try {
            boolean unbanned = moderationService.unbanPlayer(target.getUniqueId());
            if (unbanned) {
                source.sendMessage(MINI_MESSAGE.deserialize("<green>Unbanned <yellow><player></yellow> successfully.</green>",
                    Placeholder.parsed("player", target.getUsername())));
                target.sendMessage(MINI_MESSAGE.deserialize("<green>You have been unbanned from VoiceEngine.</green>"));
            } else {
                source.sendMessage(MINI_MESSAGE.deserialize("<yellow><player></yellow> was not actively banned.",
                    Placeholder.parsed("player", target.getUsername())));
            }
        } catch (Exception e) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Error unbanning player: <msg></red>", Placeholder.parsed("msg", e.getMessage())));
        }
    }

    @Command("voice|ve|voiceengine|audio modstatus <player>")
    @Permission("voiceengine.admin.status")
    @CommandDescription("Inspect active sanctions on a player")
    public void onStatus(CommandSource source, @Argument("player") String playerName) {
        Optional<Player> targetOpt = proxyServer.getPlayer(playerName);
        if (targetOpt.isEmpty()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Player <yellow><player></yellow> not found.</red>",
                Placeholder.parsed("player", playerName)));
            return;
        }

        Player target = targetOpt.get();
        List<PunishmentRecord> active = moderationService.getAllActive(target.getUniqueId());
        source.sendMessage(MINI_MESSAGE.deserialize("<gradient:#6366f1:#a855f7><bold>[VoiceEngine Moderation]</bold></gradient> <gray>Status for <yellow><player></yellow>:</gray>",
            Placeholder.parsed("player", target.getUsername())));

        if (active.isEmpty()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<green>No active voice sanctions.</green>"));
            return;
        }

        for (PunishmentRecord r : active) {
            String time = DurationParser.formatRemaining(r.expiresAt());
            source.sendMessage(MINI_MESSAGE.deserialize(
                "<gray>- <red><type></red> (Expires in: <yellow><time></yellow>) | Staff: <aqua><staff></aqua> | Reason: <white><reason></white></gray>",
                Placeholder.parsed("type", r.punishmentType().name()),
                Placeholder.parsed("time", time),
                Placeholder.parsed("staff", r.staffName()),
                Placeholder.parsed("reason", r.reason())
            ));
        }
    }
}
