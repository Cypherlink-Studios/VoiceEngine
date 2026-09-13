package com.voiceengine.audio;

public record AudioEmitter(
    String id,
    String source,
    boolean spatial,
    String world,
    double x,
    double y,
    double z,
    double radius,
    boolean loop,
    double volume,
    String state, // "PLAYING", "PAUSED", "STOPPED"
    long startedAt,
    String speakerBlockId
) {
    public AudioEmitter(
        String id,
        String source,
        boolean spatial,
        String world,
        double x,
        double y,
        double z,
        double radius,
        boolean loop,
        double volume,
        String state,
        long startedAt
    ) {
        this(id, source, spatial, world, x, y, z, radius, loop, volume, state, startedAt, null);
    }

    public AudioEmitter withState(String newState) {
        return new AudioEmitter(id, source, spatial, world, x, y, z, radius, loop, volume, newState, startedAt, speakerBlockId);
    }

    public AudioEmitter withVolume(double newVolume) {
        return new AudioEmitter(id, source, spatial, world, x, y, z, radius, loop, newVolume, state, startedAt, speakerBlockId);
    }
}
