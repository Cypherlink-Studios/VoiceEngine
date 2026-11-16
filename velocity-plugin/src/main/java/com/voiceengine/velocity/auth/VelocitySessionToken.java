package com.voiceengine.velocity.auth;

import java.time.Instant;
import java.util.UUID;

public record VelocitySessionToken(
    String token,
    UUID playerUuid,
    String playerName,
    Instant expiresAt,
    boolean isAdmin,
    boolean streamerMode,
    boolean streamerModeExplicit
) {
    public VelocitySessionToken(
        String token,
        UUID playerUuid,
        String playerName,
        Instant expiresAt,
        boolean isAdmin
    ) {
        this(token, playerUuid, playerName, expiresAt, isAdmin, false, false);
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }
}
