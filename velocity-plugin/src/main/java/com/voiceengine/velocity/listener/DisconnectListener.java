package com.voiceengine.velocity.listener;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.voiceengine.velocity.net.VelocityBackendClient;

import java.util.function.Supplier;

public class DisconnectListener {
    private final ServerPostConnectListener postConnectListener;
    private final Supplier<VelocityBackendClient> backendClientSupplier;

    public DisconnectListener(ServerPostConnectListener postConnectListener) {
        this(postConnectListener, null);
    }

    public DisconnectListener(ServerPostConnectListener postConnectListener, Supplier<VelocityBackendClient> backendClientSupplier) {
        this.postConnectListener = postConnectListener;
        this.backendClientSupplier = backendClientSupplier;
    }

    @Subscribe
    public void onDisconnect(DisconnectEvent event) {
        postConnectListener.removePlayer(event.getPlayer().getUniqueId());
        if (backendClientSupplier != null) {
            VelocityBackendClient client = backendClientSupplier.get();
            if (client != null && client.isOpen()) {
                client.sendPlayerQuit(event.getPlayer().getUniqueId());
            }
        }
    }
}
