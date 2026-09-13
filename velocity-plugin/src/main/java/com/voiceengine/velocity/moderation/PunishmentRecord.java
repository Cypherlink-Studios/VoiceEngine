package com.voiceengine.velocity.moderation;

import java.util.UUID;

public record PunishmentRecord(
    long id,
    UUID playerUuid,
    String playerName,
    String clientIp,
    String deviceId,
    PunishmentType punishmentType,
    String reason,
    UUID staffUuid,
    String staffName,
    long createdAt,
    Long expiresAt,
    boolean revoked
) {
    public boolean isPermanent() {
        return expiresAt == null || expiresAt <= 0;
    }

    public boolean isExpired() {
        return !isPermanent() && System.currentTimeMillis() >= expiresAt;
    }

    public boolean isActive() {
        return !revoked && !isExpired();
    }
}
