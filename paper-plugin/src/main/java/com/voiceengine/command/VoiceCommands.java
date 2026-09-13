package com.voiceengine.command;

import com.voiceengine.auth.SessionToken;
import com.voiceengine.auth.TokenManager;
import com.voiceengine.config.VoiceConfig;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.net.VoiceBackendClient;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.incendo.cloud.annotations.Command;
import org.incendo.cloud.annotations.CommandDescription;
import org.incendo.cloud.annotations.Permission;

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

    public VoiceCommands(
        TokenManager tokenManager,
        Supplier<VoiceConfig> configSupplier,
        Supplier<VoiceBackendClient> clientSupplier,
        TranslationService translationService,
        Consumer<SessionToken> tokenConsumer,
        Runnable reloadAction
    ) {
        this(tokenManager, configSupplier, clientSupplier, translationService, tokenConsumer, reloadAction, null);
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
        this.tokenManager = tokenManager;
        this.configSupplier = configSupplier;
        this.clientSupplier = clientSupplier;
        this.translationService = translationService;
        this.tokenConsumer = tokenConsumer;
        this.reloadAction = reloadAction;
        this.ipTokenConsumer = ipTokenConsumer;
    }

    @Command("voice|ve|voiceengine|audio")
    @Permission("voiceengine.use")
    @CommandDescription("Connect your microphone to VoiceEngine web client")
    public void onVoiceConnect(CommandSourceStack stack) {
        if (!(stack.getSender() instanceof Player player)) {
            translationService.send(stack.getSender(), "command.connect.only_players");
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

        SessionToken sessionToken = tokenManager.generateToken(player.getUniqueId(), player.getName(), false);
        String clientIp = player.getAddress() != null && player.getAddress().getAddress() != null ? player.getAddress().getAddress().getHostAddress() : null;
        if (ipTokenConsumer != null) {
            ipTokenConsumer.accept(sessionToken, clientIp);
        } else if (tokenConsumer != null) {
            tokenConsumer.accept(sessionToken);
        }

        VoiceConfig config = configSupplier.get();
        String connectionUrl = config.webClientUrl() + "/?token=" + sessionToken.token();
        translationService.send(player, "command.connect.prompt",
            Placeholder.parsed("url", connectionUrl),
            Placeholder.parsed("token", sessionToken.token()),
            Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
        );
    }

    @Command("voice|ve|voiceengine|audio admin")
    @Permission("voiceengine.admin")
    @CommandDescription("Open the VoiceEngine Admin Portal")
    public void onVoiceAdmin(CommandSourceStack stack) {
        if (!(stack.getSender() instanceof Player player)) {
            translationService.send(stack.getSender(), "command.connect.only_players");
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

        SessionToken sessionToken = tokenManager.generateToken(player.getUniqueId(), player.getName(), true);
        String clientIp = player.getAddress() != null && player.getAddress().getAddress() != null ? player.getAddress().getAddress().getHostAddress() : null;
        if (ipTokenConsumer != null) {
            ipTokenConsumer.accept(sessionToken, clientIp);
        } else if (tokenConsumer != null) {
            tokenConsumer.accept(sessionToken);
        }

        VoiceConfig config = configSupplier.get();
        String adminUrl = config.webClientUrl() + "/admin?token=" + sessionToken.token();
        translationService.send(player, "command.admin.prompt",
            Placeholder.parsed("url", adminUrl),
            Placeholder.parsed("token", sessionToken.token()),
            Placeholder.parsed("time", config.tokenTtl().toMinutes() + "m")
        );
    }

    @Command("voice|ve|voiceengine|audio reload")
    @Permission("voiceengine.admin.reload")
    @CommandDescription("Reload VoiceEngine configuration and language bundles")
    public void onVoiceReload(CommandSourceStack stack) {
        onVoiceReload(stack.getSender());
    }

    public void onVoiceReload(CommandSender sender) {
        if (reloadAction != null) {
            reloadAction.run();
        }
        translationService.send(sender, "command.reload.success");
    }

    @Command("voice|ve|voiceengine|audio status")
    @Permission("voiceengine.admin.status")
    @CommandDescription("View VoiceEngine backend connectivity and status")
    public void onVoiceStatus(CommandSourceStack stack) {
        onVoiceStatus(stack.getSender());
    }

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
}
