package com.voiceengine.api;

import com.voiceengine.auth.SessionToken;
import org.bukkit.entity.Player;

import java.util.Optional;
import java.util.UUID;

public interface VoiceEngineAPI {
    boolean isConnected(UUID playerUuid);

    default boolean isConnected(Player player) {
        return player != null && isConnected(player.getUniqueId());
    }

    boolean isSpeaking(UUID playerUuid);

    default boolean isSpeaking(Player player) {
        return player != null && isSpeaking(player.getUniqueId());
    }

    Optional<SessionToken> getActiveToken(UUID playerUuid);

    default Optional<SessionToken> getActiveToken(Player player) {
        return player != null ? getActiveToken(player.getUniqueId()) : Optional.empty();
    }

    boolean isBackendConnected();
}
