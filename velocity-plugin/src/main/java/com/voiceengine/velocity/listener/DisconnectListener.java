package com.voiceengine.velocity.listener;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.DisconnectEvent;

public class DisconnectListener {
    private final ServerPostConnectListener postConnectListener;

    public DisconnectListener(ServerPostConnectListener postConnectListener) {
        this.postConnectListener = postConnectListener;
    }

    @Subscribe
    public void onDisconnect(DisconnectEvent event) {
        postConnectListener.removePlayer(event.getPlayer().getUniqueId());
    }
}
