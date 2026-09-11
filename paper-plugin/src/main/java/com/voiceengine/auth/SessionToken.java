package com.voiceengine.auth;

import java.time.Instant;
import java.util.UUID;

public record SessionToken(
    String token,
    UUID playerUuid,
    String playerName,
    Instant createdAt,
    Instant expiresAt,
    boolean redeemed
) {
    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public SessionToken markRedeemed() {
        return new SessionToken(token, playerUuid, playerName, createdAt, expiresAt, true);
    }
}
