package com.voiceengine.command;

import com.voiceengine.auth.SessionToken;
import com.voiceengine.auth.TokenManager;
import com.voiceengine.config.PlayerPreferencesManager;
import com.voiceengine.config.VoiceConfig;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.net.VoiceBackendClient;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.incendo.cloud.annotations.Argument;
import org.incendo.cloud.annotations.Command;
import org.incendo.cloud.annotations.CommandDescription;
import org.incendo.cloud.annotations.Permission;
import org.incendo.cloud.annotations.suggestion.Suggestions;
import org.incendo.cloud.context.CommandContext;

import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import java.util.function.Supplier;

public class VoiceCommands {
    private final TokenManager tokenManager;
    private final Supplier<VoiceConfig> configSupplier;
    private final Supplier<VoiceBackendClient> clientSupplier;
    private final TranslationService translationService;
    private final Consumer<SessionToken> tokenConsumer;
    private final java.util.function.BiConsumer<SessionToken, String> ipTokenConsumer;
    private final Runnable reloadAction;
    private final Consumer<Player> vanishToggleConsumer;
    private final PlayerPreferencesManager preferencesManager;

    public VoiceCommands(
        TokenManager tokenManager,
        Supplier<VoiceConfig> configSupplier,
        Supplier<VoiceBackendClient> clientSupplier,
        TranslationService translationService,
        Consumer<SessionToken> tokenConsumer,
        Runnable reloadAction
    ) {
        this(tokenManager, configSupplier, clientSupplier, translationService, tokenConsumer, reloadAction, null, null, null);
    }

    public VoiceCommands(
        TokenManager tokenManager,
        Supplier<VoiceConfig> configSupplier,
        Supplier<VoiceBackendClient> clientSupplier,
        TranslationService translationService,
        Consumer<SessionToken> tokenConsumer,
        Runnable reloadAction,
        java.util.function.BiConsumer<SessionToken, String> ipTokenConsumer
    ) {
        this(tokenManager, configSupplier, clientSupplier, translationService, tokenConsumer, reloadAction, ipTokenConsumer, null, null);
    }

    public VoiceCommands(
        TokenManager tokenManager,
        Supplier<VoiceConfig> configSupplier,
        Supplier<VoiceBackendClient> clientSupplier,
        TranslationService translationService,
        Consumer<SessionToken> tokenConsumer,
        Runnable reloadAction,
        java.util.function.BiConsumer<SessionToken, String> ipTokenConsumer,
        Consumer<Player> vanishToggleConsumer
    ) {
        this(tokenManager, configSupplier, clientSupplier, translationService, tokenConsumer, reloadAction, ipTokenConsumer, vanishToggleConsumer, null);
    }

    public VoiceCommands(
        TokenManager tokenManager,
        Supplier<VoiceConfig> configSupplier,
        Supplier<VoiceBackendClient> clientSupplier,
        TranslationService translationService,
        Consumer<SessionToken> tokenConsumer,
        Runnable reloadAction,
        java.util.function.BiConsumer<SessionToken, String> ipTokenConsumer,
        Consumer<Player> vanishToggleConsumer,
        PlayerPreferencesManager preferencesManager
    ) {
        this.tokenManager = tokenManager;
        this.configSupplier = configSupplier;
        this.clientSupplier = clientSupplier;
        this.translationService = translationService;
        this.tokenConsumer = tokenConsumer;
        this.reloadAction = reloadAction;
        this.ipTokenConsumer = ipTokenConsumer;
        this.vanishToggleConsumer = vanishToggleConsumer;
        this.preferencesManager = preferencesManager;
    }

    @Command("voice|ve|voiceengine|audio")
    @Permission("voiceengine.use")
    @CommandDescription("Connect your microphone to VoiceEngine web client")
    public void onVoiceConnect(CommandSender sender) {
        if (!(sender instanceof Player player)) {
            translationService.send(sender, "command.connect.only_players");
            return;
        }
        onVoiceConnect(player);
    }

    public void onVoiceConnect(Player player) {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client == null || !client.isOpen()) {
            translationService.send(player, "command.connect.backend_offline");
            return;
        }

        boolean streamerMode = preferencesManager != null && preferencesManager.isStreamerMode(player.getUniqueId());
        boolean streamerExplicit = preferencesManager != null && preferencesManager.hasExplicitPreference(player.getUniqueId());

        SessionToken sessionToken = tokenManager.generateToken(
            player.getUniqueId(),
            player.getName(),
            false,
            streamerMode,
            streamerExplicit
        );
        String clientIp = player.getAddress() != null && player.getAddress().getAddress() != null ? player.getAddress().getAddress().getHostAddress() : null;
        if (ipTokenConsumer != null) {
            ipTokenConsumer.accept(sessionToken, clientIp);
        } else if (tokenConsumer != null) {
            tokenConsumer.accept(sessionToken);
        }

        VoiceConfig config = configSupplier.get();
        String baseUrl = config.webClientUrl().replaceAll("/+$", "");
        String connectionUrl = baseUrl + "/?token=" + sessionToken.token();
        if (streamerMode) {
            translationService.send(player, "command.connect.prompt_streamer",
                Placeholder.parsed("url", baseUrl + "/"),
                Placeholder.parsed("token", sessionToken.token()),
                Placeholder.parsed("token_url", connectionUrl),
                Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
            );
        } else {
            translationService.send(player, "command.connect.prompt",
                Placeholder.parsed("url", connectionUrl),
                Placeholder.parsed("token", sessionToken.token()),
                Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
            );
        }
    }

    @Command("voice|ve|voiceengine|audio admin")
    @Permission("voiceengine.admin")
    @CommandDescription("Open the VoiceEngine Admin Portal")
    public void onVoiceAdmin(CommandSender sender) {
        if (!(sender instanceof Player player)) {
            translationService.send(sender, "command.connect.only_players");
            return;
        }
        onVoiceAdmin(player);
    }

    public void onVoiceAdmin(Player player) {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client == null || !client.isOpen()) {
            translationService.send(player, "command.admin.backend_offline");
            return;
        }

        boolean streamerMode = preferencesManager != null && preferencesManager.isStreamerMode(player.getUniqueId());
        boolean streamerExplicit = preferencesManager != null && preferencesManager.hasExplicitPreference(player.getUniqueId());

        SessionToken sessionToken = tokenManager.generateToken(
            player.getUniqueId(),
            player.getName(),
            true,
            streamerMode,
            streamerExplicit
        );
        String clientIp = player.getAddress() != null && player.getAddress().getAddress() != null ? player.getAddress().getAddress().getHostAddress() : null;
        if (ipTokenConsumer != null) {
            ipTokenConsumer.accept(sessionToken, clientIp);
        } else if (tokenConsumer != null) {
            tokenConsumer.accept(sessionToken);
        }

        VoiceConfig config = configSupplier.get();
        String baseUrl = config.webClientUrl().replaceAll("/+$", "");
        String connectionUrl = baseUrl + "/admin?token=" + sessionToken.token();
        if (streamerMode) {
            translationService.send(player, "command.admin.prompt_streamer",
                Placeholder.parsed("url", baseUrl + "/admin"),
                Placeholder.parsed("token", sessionToken.token()),
                Placeholder.parsed("token_url", connectionUrl),
                Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
            );
        } else {
            translationService.send(player, "command.admin.prompt",
                Placeholder.parsed("url", connectionUrl),
                Placeholder.parsed("token", sessionToken.token()),
                Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
            );
        }
    }

    @Command("voice|ve|voiceengine|audio reload")
    @Permission("voiceengine.admin.reload")
    @CommandDescription("Reload VoiceEngine configuration and translations")
    public void onVoiceReload(CommandSender sender) {
        if (reloadAction != null) {
            reloadAction.run();
        }
        translationService.send(sender, "command.reload.success");
    }

    @Command("voice|ve|voiceengine|audio status")
    @Permission("voiceengine.admin.status")
    @CommandDescription("View VoiceEngine backend connectivity and status")
    public void onVoiceStatus(CommandSender sender) {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        VoiceConfig config = configSupplier.get();

        translationService.send(sender, "command.status.header");
        if (client != null && client.isOpen()) {
            translationService.send(sender, "command.status.connected");
        } else {
            int attempts = client != null ? client.getReconnectAttempts() : 0;
            translationService.send(sender, "command.status.disconnected",
                Placeholder.parsed("attempts", String.valueOf(attempts))
            );
        }

        translationService.send(sender, "command.status.uri",
            Placeholder.parsed("uri", config.voiceServerUri().toString())
        );
        translationService.send(sender, "command.status.active_tokens",
            Placeholder.parsed("count", String.valueOf(tokenManager.getActiveTokenCount()))
        );
    }

    @Command("voice|ve|voiceengine|audio vanish")
    @Permission("voiceengine.admin.vanish")
    @CommandDescription("Toggle acoustic staff vanish mode (zero-leak)")
    public void onVoiceVanish(CommandSender sender) {
        if (!(sender instanceof Player player)) {
            translationService.send(sender, "command.connect.only_players");
            return;
        }
        if (vanishToggleConsumer != null) {
            vanishToggleConsumer.accept(player);
        }
    }

    @Command("voice|ve|voiceengine|audio staff")
    @Permission("voiceengine.admin.vanish")
    @CommandDescription("Toggle acoustic staff vanish mode (zero-leak)")
    public void onVoiceStaff(CommandSender sender) {
        onVoiceVanish(sender);
    }

    @Suggestions("streamerActions")
    public List<String> suggestStreamerActions(CommandContext<CommandSender> context, String input) {
        return List.of("on", "off", "status");
    }

    @Command("voice|ve|voiceengine|audio streamer")
    @Permission("voiceengine.streamer")
    @CommandDescription("Toggle Zero-Leak Streamer Mode for /voice codes and room PINs")
    public void onVoiceStreamerToggle(CommandSender sender) {
        if (!(sender instanceof Player player)) {
            translationService.send(sender, "command.connect.only_players");
            return;
        }
        boolean next = preferencesManager != null && preferencesManager.toggleStreamerMode(player.getUniqueId());
        applyStreamerModeChange(player, next);
    }

    @Command("voice|ve|voiceengine|audio streamer <action>")
    @Permission("voiceengine.streamer")
    @CommandDescription("Configure or inspect Zero-Leak Streamer Mode")
    public void onVoiceStreamerAction(
        CommandSender sender,
        @Argument(value = "action", suggestions = "streamerActions") String action
    ) {
        if (!(sender instanceof Player player)) {
            translationService.send(sender, "command.connect.only_players");
            return;
        }
        String normalized = action != null ? action.trim().toLowerCase(Locale.ROOT) : "";
        switch (normalized) {
            case "on", "enable", "true" -> {
                if (preferencesManager != null) {
                    preferencesManager.setStreamerMode(player.getUniqueId(), true);
                }
                applyStreamerModeChange(player, true);
            }
            case "off", "disable", "false" -> {
                if (preferencesManager != null) {
                    preferencesManager.setStreamerMode(player.getUniqueId(), false);
                }
                applyStreamerModeChange(player, false);
            }
            case "status" -> {
                boolean enabled = preferencesManager != null && preferencesManager.isStreamerMode(player.getUniqueId());
                translationService.send(player, enabled ? "command.streamer.status_on" : "command.streamer.status_off");
            }
            default -> translationService.send(player, "command.streamer.invalid_action");
        }
    }

    private void applyStreamerModeChange(Player player, boolean enabled) {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client != null && client.isOpen()) {
            client.sendStreamerModeSync(player.getUniqueId(), enabled);
        }
        translationService.send(player, enabled ? "command.streamer.enabled" : "command.streamer.disabled");
    }
}
