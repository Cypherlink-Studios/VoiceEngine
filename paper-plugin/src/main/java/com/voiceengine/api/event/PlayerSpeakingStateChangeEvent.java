package com.voiceengine.api.event;

import org.bukkit.entity.Player;
import org.bukkit.event.Event;
import org.bukkit.event.HandlerList;
import org.jetbrains.annotations.NotNull;

import java.util.UUID;

public class PlayerSpeakingStateChangeEvent extends Event {
    private static final HandlerList HANDLERS = new HandlerList();

    private final UUID playerUuid;
    private final Player player;
    private final boolean speaking;

    public PlayerSpeakingStateChangeEvent(UUID playerUuid, Player player, boolean speaking) {
        super(false);
        this.playerUuid = playerUuid;
        this.player = player;
        this.speaking = speaking;
    }

    public UUID getPlayerUuid() {
        return playerUuid;
    }

    public Player getPlayer() {
        return player;
    }

    public boolean isSpeaking() {
        return speaking;
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
