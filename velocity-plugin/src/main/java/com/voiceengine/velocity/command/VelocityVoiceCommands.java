package com.voiceengine.velocity.command;

import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.proxy.Player;
import com.voiceengine.velocity.auth.VelocitySessionToken;
import com.voiceengine.velocity.auth.VelocityTokenManager;
import com.voiceengine.velocity.config.VelocityVoiceConfig;
import com.voiceengine.velocity.moderation.DurationParser;
import com.voiceengine.velocity.moderation.PunishmentRecord;
import com.voiceengine.velocity.moderation.VelocityModerationService;
import com.voiceengine.velocity.net.VelocityBackendClient;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.incendo.cloud.annotations.Command;
import org.incendo.cloud.annotations.CommandDescription;
import org.incendo.cloud.annotations.Permission;

import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;

public class VelocityVoiceCommands {
    private static final MiniMessage MINI_MESSAGE = MiniMessage.miniMessage();

    private final VelocityTokenManager tokenManager;
    private final Supplier<VelocityVoiceConfig> configSupplier;
    private final Supplier<VelocityBackendClient> clientSupplier;
    private final Consumer<VelocitySessionToken> tokenConsumer;
    private final Runnable reloadAction;
    private final VelocityModerationService moderationService;

    public VelocityVoiceCommands(
        VelocityTokenManager tokenManager,
        Supplier<VelocityVoiceConfig> configSupplier,
        Supplier<VelocityBackendClient> clientSupplier,
        Consumer<VelocitySessionToken> tokenConsumer,
        Runnable reloadAction
    ) {
        this(tokenManager, configSupplier, clientSupplier, tokenConsumer, reloadAction, null);
    }

    public VelocityVoiceCommands(
        VelocityTokenManager tokenManager,
        Supplier<VelocityVoiceConfig> configSupplier,
        Supplier<VelocityBackendClient> clientSupplier,
        Consumer<VelocitySessionToken> tokenConsumer,
        Runnable reloadAction,
        VelocityModerationService moderationService
    ) {
        this.tokenManager = tokenManager;
        this.configSupplier = configSupplier;
        this.clientSupplier = clientSupplier;
        this.tokenConsumer = tokenConsumer;
        this.reloadAction = reloadAction;
        this.moderationService = moderationService;
    }

    @Command("voicevelocity|vevelocity|voiceenginevelocity|audiovelocity")
    @Permission("voiceengine.use")
    @CommandDescription("Connect your microphone to VoiceEngine web client")
    public void onVoiceConnect(CommandSource source) {
        if (!(source instanceof Player player)) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Only players can execute this command.</red>"));
            return;
        }

        VelocityBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client == null || !client.isOpen()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>VoiceEngine backend is currently offline. Please try again in a few moments.</red>"));
            return;
        }

        String clientIp = (player.getRemoteAddress() != null && player.getRemoteAddress().getAddress() != null)
            ? player.getRemoteAddress().getAddress().getHostAddress()
            : null;

        if (moderationService != null) {
            // Check IP ban
            if (clientIp != null && moderationService.isIpBanned(clientIp)) {
                player.sendMessage(MINI_MESSAGE.deserialize("<red>Your IP address is banned from VoiceEngine.</red>"));
                return;
            }

            // Check player ban
            Optional<PunishmentRecord> banOpt = moderationService.getActiveBan(player.getUniqueId());
            if (banOpt.isPresent()) {
                PunishmentRecord ban = banOpt.get();
                String time = DurationParser.formatRemaining(ban.expiresAt());
                player.sendMessage(MINI_MESSAGE.deserialize(
                    "<red>You are banned from VoiceEngine! Reason: <reason> (Expires in: <time>)</red>",
                    Placeholder.parsed("reason", ban.reason() != null ? ban.reason() : "Banned by staff"),
                    Placeholder.parsed("time", time)
                ));
                return;
            }
        }

        boolean isMuted = false;
        if (moderationService != null) {
            Optional<PunishmentRecord> muteOpt = moderationService.getActiveMute(player.getUniqueId());
            if (muteOpt.isPresent()) {
                isMuted = true;
                String time = DurationParser.formatRemaining(muteOpt.get().expiresAt());
                player.sendMessage(MINI_MESSAGE.deserialize(
                    "<yellow>Notice: You are currently muted in voice chat (Expires in: <time>). Reason: <reason></yellow>",
                    Placeholder.parsed("time", time),
                    Placeholder.parsed("reason", muteOpt.get().reason() != null ? muteOpt.get().reason() : "Muted by staff")
                ));
            }
        }

        VelocitySessionToken sessionToken = tokenManager.generateToken(player.getUniqueId(), player.getUsername(), false);
        if (client != null && client.isOpen()) {
            client.registerToken(sessionToken, clientIp, isMuted);
        } else if (tokenConsumer != null) {
            tokenConsumer.accept(sessionToken);
        }

        VelocityVoiceConfig config = configSupplier.get();
        String connectionUrl = config.webClientUrl() + "/?token=" + sessionToken.token();
        player.sendMessage(MINI_MESSAGE.deserialize(
            "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <gray>Click to connect:</gray> <click:open_url:'<url>'><hover:show_text:'<gray>Click to open web client</gray>'><underlined><aqua><url></aqua></underlined></hover></click> <gray>or enter code</gray> <yellow><bold><token></bold></yellow> <dark_gray>(expires in <time>)</dark_gray>",
            Placeholder.parsed("url", connectionUrl),
            Placeholder.parsed("token", sessionToken.token()),
            Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
        ));
    }

    @Command("voicevelocity|vevelocity|voiceenginevelocity|audiovelocity admin")
    @Permission("voiceengine.admin")
    @CommandDescription("Open the VoiceEngine Admin Portal")
    public void onVoiceAdmin(CommandSource source) {
        if (!(source instanceof Player player)) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Only players can execute this command.</red>"));
            return;
        }

        VelocityBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client == null || !client.isOpen()) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>VoiceEngine backend is currently offline. Please try again in a few moments.</red>"));
            return;
        }

        String clientIp = (player.getRemoteAddress() != null && player.getRemoteAddress().getAddress() != null)
            ? player.getRemoteAddress().getAddress().getHostAddress()
            : null;

        if (moderationService != null) {
            // Check IP ban
            if (clientIp != null && moderationService.isIpBanned(clientIp)) {
                player.sendMessage(MINI_MESSAGE.deserialize("<red>Your IP address is banned from VoiceEngine.</red>"));
                return;
            }

            // Check player ban
            Optional<PunishmentRecord> banOpt = moderationService.getActiveBan(player.getUniqueId());
            if (banOpt.isPresent()) {
                PunishmentRecord ban = banOpt.get();
                String time = DurationParser.formatRemaining(ban.expiresAt());
                player.sendMessage(MINI_MESSAGE.deserialize(
                    "<red>You are banned from VoiceEngine! Reason: <reason> (Expires in: <time>)</red>",
                    Placeholder.parsed("reason", ban.reason() != null ? ban.reason() : "Banned by staff"),
                    Placeholder.parsed("time", time)
                ));
                return;
            }
        }

        VelocitySessionToken sessionToken = tokenManager.generateToken(player.getUniqueId(), player.getUsername(), true);
        if (client != null && client.isOpen()) {
            client.registerToken(sessionToken, clientIp, false);
        } else if (tokenConsumer != null) {
            tokenConsumer.accept(sessionToken);
        }

        VelocityVoiceConfig config = configSupplier.get();
        String adminUrl = config.webClientUrl() + "/admin?token=" + sessionToken.token();
        player.sendMessage(MINI_MESSAGE.deserialize(
            "<gradient:#6366f1:#a855f7><bold>[VoiceEngine Admin]</bold></gradient> <gray>Access your admin portal here:</gray> <click:open_url:'<url>'><hover:show_text:'<gray>Click to open admin dashboard</gray>'><underlined><aqua><url></aqua></underlined></hover></click> <gray>or use code</gray> <yellow><bold><token></bold></yellow> <dark_gray>(expires in <time>)</dark_gray>",
            Placeholder.parsed("url", adminUrl),
            Placeholder.parsed("token", sessionToken.token()),
            Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
        ));
    }

    @Command("voicevelocity|vevelocity|voiceenginevelocity|audiovelocity reload")
    @Permission("voiceengine.admin.reload")
    @CommandDescription("Reload VoiceEngine Velocity proxy configuration")
    public void onVoiceReload(CommandSource source) {
        if (reloadAction != null) {
            reloadAction.run();
        }
        source.sendMessage(MINI_MESSAGE.deserialize("<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <green>Velocity proxy configuration reloaded successfully!</green>"));
    }

    @Command("voicevelocity|vevelocity|voiceenginevelocity|audiovelocity status")
    @Permission("voiceengine.admin.status")
    @CommandDescription("Inspect backend connection status and active tokens")
    public void onVoiceStatus(CommandSource source) {
        VelocityBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        boolean connected = client != null && client.isOpen();
        VelocityVoiceConfig config = configSupplier.get();

        source.sendMessage(MINI_MESSAGE.deserialize(
            "<gradient:#6366f1:#a855f7><bold>[VoiceEngine Status]</bold></gradient><newline>" +
            "<gray>Backend URI: </gray><aqua><uri></aqua><newline>" +
            "<gray>Status: </gray><status><newline>" +
            "<gray>Reconnect Attempts: </gray><yellow><reconnects></yellow>",
            Placeholder.parsed("uri", config.voiceServerUri().toString()),
            Placeholder.parsed("status", connected ? "<green>Connected</green>" : "<red>Disconnected</red>"),
            Placeholder.parsed("reconnects", String.valueOf(client != null ? client.getReconnectAttempts() : 0))
        ));
    }
}
