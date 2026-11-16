package com.voiceengine.velocity.command;

import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.proxy.Player;
import com.voiceengine.velocity.auth.VelocitySessionToken;
import com.voiceengine.velocity.auth.VelocityTokenManager;
import com.voiceengine.velocity.config.VelocityVoiceConfig;
import com.voiceengine.velocity.moderation.DurationParser;
import com.voiceengine.velocity.moderation.ModerationDatabase;
import com.voiceengine.velocity.moderation.PunishmentRecord;
import com.voiceengine.velocity.moderation.VelocityModerationService;
import com.voiceengine.velocity.net.VelocityBackendClient;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.incendo.cloud.annotations.Argument;
import org.incendo.cloud.annotations.Command;
import org.incendo.cloud.annotations.CommandDescription;
import org.incendo.cloud.annotations.Permission;
import org.incendo.cloud.annotations.suggestion.Suggestions;
import org.incendo.cloud.context.CommandContext;

import java.util.List;
import java.util.Locale;
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
    private final ModerationDatabase moderationDatabase;

    public VelocityVoiceCommands(
        VelocityTokenManager tokenManager,
        Supplier<VelocityVoiceConfig> configSupplier,
        Supplier<VelocityBackendClient> clientSupplier,
        Consumer<VelocitySessionToken> tokenConsumer,
        Runnable reloadAction
    ) {
        this(tokenManager, configSupplier, clientSupplier, tokenConsumer, reloadAction, null, null);
    }

    public VelocityVoiceCommands(
        VelocityTokenManager tokenManager,
        Supplier<VelocityVoiceConfig> configSupplier,
        Supplier<VelocityBackendClient> clientSupplier,
        Consumer<VelocitySessionToken> tokenConsumer,
        Runnable reloadAction,
        VelocityModerationService moderationService
    ) {
        this(tokenManager, configSupplier, clientSupplier, tokenConsumer, reloadAction, moderationService, null);
    }

    public VelocityVoiceCommands(
        VelocityTokenManager tokenManager,
        Supplier<VelocityVoiceConfig> configSupplier,
        Supplier<VelocityBackendClient> clientSupplier,
        Consumer<VelocitySessionToken> tokenConsumer,
        Runnable reloadAction,
        VelocityModerationService moderationService,
        ModerationDatabase moderationDatabase
    ) {
        this.tokenManager = tokenManager;
        this.configSupplier = configSupplier;
        this.clientSupplier = clientSupplier;
        this.tokenConsumer = tokenConsumer;
        this.reloadAction = reloadAction;
        this.moderationService = moderationService;
        this.moderationDatabase = moderationDatabase;
    }

    @Command("voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity")
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

        boolean streamerMode = moderationDatabase != null && moderationDatabase.getStreamerMode(player.getUniqueId());
        boolean streamerExplicit = moderationDatabase != null && moderationDatabase.hasExplicitPreference(player.getUniqueId());

        VelocitySessionToken sessionToken = tokenManager.generateToken(
            player.getUniqueId(),
            player.getUsername(),
            false,
            streamerMode,
            streamerExplicit
        );
        if (client != null && client.isOpen()) {
            client.registerToken(sessionToken, clientIp, isMuted);
        } else if (tokenConsumer != null) {
            tokenConsumer.accept(sessionToken);
        }

        VelocityVoiceConfig config = configSupplier.get();
        String baseUrl = config.webClientUrl().replaceAll("/+$", "");
        String connectionUrl = baseUrl + "/?token=" + sessionToken.token();
        if (streamerMode) {
            player.sendMessage(MINI_MESSAGE.deserialize(
                "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <yellow>[Streamer Mode]</yellow> <gray>Session ready (<time>):</gray> <click:open_url:'<clean_url>'><hover:show_text:'<yellow>Open VoiceEngine (clean URL without token)</yellow>'><underlined><green>[Open Web]</green></underlined></hover></click> <click:copy_to_clipboard:'<token>'><hover:show_text:'<aqua>Copy single-use code to clipboard</aqua>'><underlined><aqua>[Copy Code]</aqua></underlined></hover></click> <click:copy_to_clipboard:'<url>'><hover:show_text:'<gold>Copy full link to clipboard</gold>'><underlined><gold>[Copy Link]</gold></underlined></hover></click>",
                Placeholder.parsed("clean_url", baseUrl + "/"),
                Placeholder.parsed("url", connectionUrl),
                Placeholder.parsed("token", sessionToken.token()),
                Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
            ));
        } else {
            player.sendMessage(MINI_MESSAGE.deserialize(
                "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <gray>Click to connect:</gray> <click:open_url:'<url>'><hover:show_text:'<gray>Click to open web client</gray>'><underlined><aqua><url></aqua></underlined></hover></click> <gray>or enter code</gray> <yellow><bold><token></bold></yellow> <dark_gray>(expires in <time>)</dark_gray>",
                Placeholder.parsed("url", connectionUrl),
                Placeholder.parsed("token", sessionToken.token()),
                Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
            ));
        }
    }

    @Command("voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity admin")
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

        boolean streamerMode = moderationDatabase != null && moderationDatabase.getStreamerMode(player.getUniqueId());
        boolean streamerExplicit = moderationDatabase != null && moderationDatabase.hasExplicitPreference(player.getUniqueId());

        VelocitySessionToken sessionToken = tokenManager.generateToken(
            player.getUniqueId(),
            player.getUsername(),
            true,
            streamerMode,
            streamerExplicit
        );
        if (client != null && client.isOpen()) {
            client.registerToken(sessionToken, clientIp, false);
        } else if (tokenConsumer != null) {
            tokenConsumer.accept(sessionToken);
        }

        VelocityVoiceConfig config = configSupplier.get();
        String baseUrl = config.webClientUrl().replaceAll("/+$", "");
        String adminUrl = baseUrl + "/admin?token=" + sessionToken.token();
        if (streamerMode) {
            player.sendMessage(MINI_MESSAGE.deserialize(
                "<gradient:#6366f1:#a855f7><bold>[VoiceEngine Admin]</bold></gradient> <yellow>[Streamer Mode]</yellow> <gray>Admin session ready (<time>):</gray> <click:open_url:'<clean_url>'><hover:show_text:'<gold>Open Admin Portal (clean URL without token)</gold>'><underlined><yellow>[Open Panel]</yellow></underlined></hover></click> <click:copy_to_clipboard:'<token>'><hover:show_text:'<aqua>Copy admin code to clipboard</aqua>'><underlined><aqua>[Copy Code]</aqua></underlined></hover></click> <click:copy_to_clipboard:'<url>'><hover:show_text:'<gold>Copy full admin link to clipboard</gold>'><underlined><gold>[Copy Link]</gold></underlined></hover></click>",
                Placeholder.parsed("clean_url", baseUrl + "/admin"),
                Placeholder.parsed("url", adminUrl),
                Placeholder.parsed("token", sessionToken.token()),
                Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
            ));
        } else {
            player.sendMessage(MINI_MESSAGE.deserialize(
                "<gradient:#6366f1:#a855f7><bold>[VoiceEngine Admin]</bold></gradient> <gray>Access your admin portal here:</gray> <click:open_url:'<url>'><hover:show_text:'<gray>Click to open admin dashboard</gray>'><underlined><aqua><url></aqua></underlined></hover></click> <gray>or use code</gray> <yellow><bold><token></bold></yellow> <dark_gray>(expires in <time>)</dark_gray>",
                Placeholder.parsed("url", adminUrl),
                Placeholder.parsed("token", sessionToken.token()),
                Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
            ));
        }
    }

    @Command("voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity reload")
    @Permission("voiceengine.admin.reload")
    @CommandDescription("Reload VoiceEngine Velocity proxy configuration")
    public void onVoiceReload(CommandSource source) {
        if (reloadAction != null) {
            reloadAction.run();
        }
        source.sendMessage(MINI_MESSAGE.deserialize("<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <green>Velocity proxy configuration reloaded successfully!</green>"));
    }

    @Command("voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity status")
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

    @Suggestions("velocityStreamerActions")
    public List<String> suggestStreamerActions(CommandContext<CommandSource> context, String input) {
        return List.of("on", "off", "status");
    }

    @Command("voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity streamer")
    @Permission("voiceengine.streamer")
    @CommandDescription("Toggle Zero-Leak Streamer Mode across the proxy network")
    public void onVoiceStreamerToggle(CommandSource source) {
        if (!(source instanceof Player player)) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Only players can execute this command.</red>"));
            return;
        }
        boolean next = moderationDatabase != null && moderationDatabase.toggleStreamerMode(player.getUniqueId());
        applyStreamerModeChange(player, next);
    }

    @Command("voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity streamer <action>")
    @Permission("voiceengine.streamer")
    @CommandDescription("Configure or inspect Zero-Leak Streamer Mode")
    public void onVoiceStreamerAction(
        CommandSource source,
        @Argument(value = "action", suggestions = "velocityStreamerActions") String action
    ) {
        if (!(source instanceof Player player)) {
            source.sendMessage(MINI_MESSAGE.deserialize("<red>Only players can execute this command.</red>"));
            return;
        }
        String normalized = action != null ? action.trim().toLowerCase(Locale.ROOT) : "";
        switch (normalized) {
            case "on", "enable", "true" -> {
                if (moderationDatabase != null) {
                    moderationDatabase.setStreamerMode(player.getUniqueId(), true);
                }
                applyStreamerModeChange(player, true);
            }
            case "off", "disable", "false" -> {
                if (moderationDatabase != null) {
                    moderationDatabase.setStreamerMode(player.getUniqueId(), false);
                }
                applyStreamerModeChange(player, false);
            }
            case "status" -> {
                boolean enabled = moderationDatabase != null && moderationDatabase.getStreamerMode(player.getUniqueId());
                player.sendMessage(MINI_MESSAGE.deserialize(enabled
                    ? "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <gray>Zero-Leak Streamer Mode is currently <green>ENABLED</green>.</gray>"
                    : "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <gray>Zero-Leak Streamer Mode is currently <yellow>DISABLED</yellow>.</gray>"
                ));
            }
            default -> player.sendMessage(MINI_MESSAGE.deserialize(
                "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <red>Invalid option. Use <yellow>/voice streamer [on|off|status]</yellow>.</red>"
            ));
        }
    }

    private void applyStreamerModeChange(Player player, boolean enabled) {
        VelocityBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client != null && client.isOpen()) {
            client.sendStreamerModeSync(player.getUniqueId(), enabled);
        }
        player.sendMessage(MINI_MESSAGE.deserialize(enabled
            ? "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <green>Zero-Leak Streamer Mode <yellow>ENABLED</yellow>. Codes and URLs will stay hidden in chat.</green>"
            : "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <red>Zero-Leak Streamer Mode <yellow>DISABLED</yellow>. Standard clickable links and codes are restored.</red>"
        ));
    }
}
