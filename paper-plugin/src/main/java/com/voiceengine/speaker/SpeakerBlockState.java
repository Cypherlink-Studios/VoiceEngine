package com.voiceengine.speaker;

public record SpeakerBlockState(
    String id,
    String world,
    String serverId,
    double x,
    double y,
    double z,
    double radius,
    String linkedPlayerUuid,
    boolean active
) {}
