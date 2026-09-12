package com.voiceengine.api.event;

import com.voiceengine.auth.SessionToken;
import org.bukkit.entity.Player;
import org.bukkit.event.Event;
import org.bukkit.event.HandlerList;
import org.jetbrains.annotations.NotNull;

import java.util.UUID;

public class PlayerVoiceConnectedEvent extends Event {
    private static final HandlerList HANDLERS = new HandlerList();

    private final UUID playerUuid;
    private final Player player;
    private final SessionToken token;

    public PlayerVoiceConnectedEvent(UUID playerUuid, Player player, SessionToken token) {
        super(false);
        this.playerUuid = playerUuid;
        this.player = player;
        this.token = token;
    }

    public UUID getPlayerUuid() {
        return playerUuid;
    }

    public Player getPlayer() {
        return player;
    }

    public SessionToken getToken() {
        return token;
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
