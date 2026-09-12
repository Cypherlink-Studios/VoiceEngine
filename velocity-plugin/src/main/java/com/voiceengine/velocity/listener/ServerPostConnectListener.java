package com.voiceengine.velocity.listener;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.player.ServerPostConnectEvent;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ServerConnection;
import com.velocitypowered.api.proxy.server.RegisteredServer;
import com.voiceengine.velocity.config.VelocityVoiceConfig;
import com.voiceengine.velocity.net.VelocityBackendClient;
import net.kyori.adventure.text.minimessage.MiniMessage;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

public class ServerPostConnectListener {
    private static final MiniMessage MINI_MESSAGE = MiniMessage.miniMessage();

    private final Supplier<VelocityVoiceConfig> configSupplier;
    private final Supplier<VelocityBackendClient> clientSupplier;
    private final Set<UUID> welcomedPlayers = ConcurrentHashMap.newKeySet();

    public ServerPostConnectListener(
        Supplier<VelocityVoiceConfig> configSupplier,
        Supplier<VelocityBackendClient> clientSupplier
    ) {
        this.configSupplier = configSupplier;
        this.clientSupplier = clientSupplier;
    }

    @Subscribe
    public void onServerPostConnect(ServerPostConnectEvent event) {
        Player player = event.getPlayer();
        RegisteredServer previousServer = event.getPreviousServer();

        if (previousServer == null) {
            // First connection to the proxy network
            VelocityVoiceConfig config = configSupplier.get();
            if (config.notifyOnJoin() && welcomedPlayers.add(player.getUniqueId())) {
                player.sendMessage(MINI_MESSAGE.deserialize(config.joinMessage()));
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
