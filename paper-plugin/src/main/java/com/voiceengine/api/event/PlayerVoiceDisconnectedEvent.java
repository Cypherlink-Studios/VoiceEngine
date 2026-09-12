package com.voiceengine.api.event;

import org.bukkit.entity.Player;
import org.bukkit.event.Event;
import org.bukkit.event.HandlerList;
import org.jetbrains.annotations.NotNull;

import java.util.UUID;

public class PlayerVoiceDisconnectedEvent extends Event {
    private static final HandlerList HANDLERS = new HandlerList();

    private final UUID playerUuid;
    private final Player player;

    public PlayerVoiceDisconnectedEvent(UUID playerUuid, Player player) {
        super(false);
        this.playerUuid = playerUuid;
        this.player = player;
    }

    public UUID getPlayerUuid() {
        return playerUuid;
    }

    public Player getPlayer() {
        return player;
    }

    @NotNull
    @Override
    public HandlerList getHandlers() {
        return HANDLERS;
    }

    public static HandlerList getHandlerList() {
        return HANDLERS;
    }
}
