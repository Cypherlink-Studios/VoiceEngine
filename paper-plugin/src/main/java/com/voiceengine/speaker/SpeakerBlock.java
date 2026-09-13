package com.voiceengine.speaker;

import java.util.UUID;

public record SpeakerBlock(
    String id,
    String world,
    double x,
    double y,
    double z,
    double radius,
    UUID linkedPlayerUuid,
    boolean requireRedstone,
    boolean active
) {
    public SpeakerBlock withLinkedPlayer(UUID playerUuid) {
        return new SpeakerBlock(id, world, x, y, z, radius, playerUuid, requireRedstone, active);
    }

    public SpeakerBlock withRadius(double newRadius) {
        return new SpeakerBlock(id, world, x, y, z, newRadius, linkedPlayerUuid, requireRedstone, active);
    }

    public SpeakerBlock withRequireRedstone(boolean req) {
        return new SpeakerBlock(id, world, x, y, z, radius, linkedPlayerUuid, req, active);
    }

    public SpeakerBlock withActive(boolean isActive) {
        return new SpeakerBlock(id, world, x, y, z, radius, linkedPlayerUuid, requireRedstone, isActive);
    }

    public SpeakerBlockState toState(String serverId) {
        return new SpeakerBlockState(
            id,
            world,
            serverId != null ? serverId : "default",
            x,
            y,
            z,
            radius,
            linkedPlayerUuid != null ? linkedPlayerUuid.toString() : null,
            active
        );
    }
}
