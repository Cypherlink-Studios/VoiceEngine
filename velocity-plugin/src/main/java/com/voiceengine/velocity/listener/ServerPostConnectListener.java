package com.voiceengine.velocity.listener;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.player.ServerPostConnectEvent;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.proxy.ServerConnection;
import com.velocitypowered.api.proxy.server.RegisteredServer;
import com.voiceengine.velocity.config.VelocityVoiceConfig;
import com.voiceengine.velocity.moderation.ModerationDatabase;
import com.voiceengine.velocity.net.VelocityBackendClient;
import com.voiceengine.velocity.update.ReleaseCheckResult;
import com.voiceengine.velocity.update.UpdateChecker;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

public class ServerPostConnectListener {
    private static final MiniMessage MINI_MESSAGE = MiniMessage.miniMessage();

    private final ProxyServer server;
    private final Object plugin;
    private final Supplier<VelocityVoiceConfig> configSupplier;
    private final Supplier<VelocityBackendClient> clientSupplier;
    private final ModerationDatabase moderationDatabase;
    private final UpdateChecker updateChecker;
    private final Set<UUID> welcomedPlayers = ConcurrentHashMap.newKeySet();

    public ServerPostConnectListener(
        Supplier<VelocityVoiceConfig> configSupplier,
        Supplier<VelocityBackendClient> clientSupplier
    ) {
        this(null, null, configSupplier, clientSupplier, null, null);
    }

    public ServerPostConnectListener(
        Supplier<VelocityVoiceConfig> configSupplier,
        Supplier<VelocityBackendClient> clientSupplier,
        ModerationDatabase moderationDatabase
    ) {
        this(null, null, configSupplier, clientSupplier, moderationDatabase, null);
    }

    public ServerPostConnectListener(
        ProxyServer server,
        Object plugin,
        Supplier<VelocityVoiceConfig> configSupplier,
        Supplier<VelocityBackendClient> clientSupplier,
        ModerationDatabase moderationDatabase,
        UpdateChecker updateChecker
    ) {
        this.server = server;
        this.plugin = plugin;
        this.configSupplier = configSupplier;
        this.clientSupplier = clientSupplier;
        this.moderationDatabase = moderationDatabase;
        this.updateChecker = updateChecker;
    }

    @Subscribe
    public void onServerPostConnect(ServerPostConnectEvent event) {
        Player player = event.getPlayer();
        RegisteredServer previousServer = event.getPreviousServer();

        if (previousServer == null) {
            // First connection to the proxy network
            VelocityVoiceConfig config = configSupplier.get();
            boolean firstJoin = welcomedPlayers.add(player.getUniqueId());
            if (config.notifyOnJoin() && firstJoin) {
                boolean streamerMode = moderationDatabase != null && moderationDatabase.getStreamerMode(player.getUniqueId());
                String prefix = streamerMode ? "<yellow>[Streamer Mode active]</yellow> " : "";
                player.sendMessage(MINI_MESSAGE.deserialize(prefix + config.joinMessage()));
            }
            if (firstJoin && config.updatesNotifyAdminsOnJoin() && player.hasPermission("voiceengine.admin.update")) {
                ReleaseCheckResult cached = updateChecker != null ? updateChecker.getCachedResult() : null;
                if (cached != null && cached.updateAvailable() && server != null && plugin != null) {
                    server.getScheduler().buildTask(plugin, () -> {
                        if (player.isActive()) {
                            player.sendMessage(MINI_MESSAGE.deserialize(
                                "<gradient:#6366f1:#a855f7><bold>[VoiceEngine Admin]</bold></gradient> <yellow>A new VoiceEngine-Velocity update is available (<gold><latest></gold>). " +
                                "<click:run_command:'/voice-velocity update apply'><hover:show_text:'<green>Click to download and stage update</green>'><underlined><white>/voice-velocity update apply</white></underlined></hover></click> to stage.</yellow>",
                                Placeholder.parsed("latest", cached.latestVersion() != null ? cached.latestVersion() : "latest")
                            ));
                        }
                    }).delay(2, TimeUnit.SECONDS).schedule();
                }
            }
        } else {
            // Player transitioned between servers (e.g. Lobby -> Survival)
            String prevName = previousServer.getServerInfo().getName();
            String currentName = player.getCurrentServer()
                .map(ServerConnection::getServer)
                .map(s -> s.getServerInfo().getName())
                .orElse("unknown");

            VelocityBackendClient client = clientSupplier.get();
            if (client != null && client.isOpen()) {
                client.notifyServerSwitch(player.getUniqueId(), prevName, currentName);
            }
        }
    }

    public void removePlayer(UUID playerUuid) {
        welcomedPlayers.remove(playerUuid);
    }
}
