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
    boolean active,
    String audioSource,
    boolean loopMedia
) {
    public SpeakerBlock(
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
        this(id, world, x, y, z, radius, linkedPlayerUuid, requireRedstone, active, null, false);
    }

    public SpeakerBlock withLinkedPlayer(UUID playerUuid) {
        return new SpeakerBlock(id, world, x, y, z, radius, playerUuid, requireRedstone, active, audioSource, loopMedia);
    }

    public SpeakerBlock withRadius(double newRadius) {
        return new SpeakerBlock(id, world, x, y, z, newRadius, linkedPlayerUuid, requireRedstone, active, audioSource, loopMedia);
    }

    public SpeakerBlock withRequireRedstone(boolean req) {
        return new SpeakerBlock(id, world, x, y, z, radius, linkedPlayerUuid, req, active, audioSource, loopMedia);
    }

    public SpeakerBlock withActive(boolean isActive) {
        return new SpeakerBlock(id, world, x, y, z, radius, linkedPlayerUuid, requireRedstone, isActive, audioSource, loopMedia);
    }

    public SpeakerBlock withAudioSource(String newAudioSource, boolean newLoopMedia) {
        return new SpeakerBlock(id, world, x, y, z, radius, linkedPlayerUuid, requireRedstone, active, newAudioSource, newLoopMedia);
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
