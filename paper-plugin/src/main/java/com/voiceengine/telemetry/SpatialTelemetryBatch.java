package com.voiceengine.telemetry;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.voiceengine.speaker.SpeakerBlockState;

import java.util.List;

public record SpatialTelemetryBatch(
    String type,
    String serverId,
    long timestamp,
    List<PlayerSpatialState> players,
    List<SpeakerBlockState> speakers,
    String spectatorMode,
    boolean radarEnabled
) {
    private static final Gson GSON = new GsonBuilder().create();

    public SpatialTelemetryBatch(long timestamp, List<PlayerSpatialState> players) {
        this("telemetry_batch", "default", timestamp, players, List.of(), "listen-only", true);
    }

    public SpatialTelemetryBatch(String serverId, long timestamp, List<PlayerSpatialState> players) {
        this("telemetry_batch", serverId != null ? serverId : "default", timestamp, players, List.of(), "listen-only", true);
    }

    public SpatialTelemetryBatch(String serverId, long timestamp, List<PlayerSpatialState> players, List<SpeakerBlockState> speakers) {
        this("telemetry_batch", serverId != null ? serverId : "default", timestamp, players, speakers != null ? speakers : List.of(), "listen-only", true);
    }

    public SpatialTelemetryBatch(String serverId, long timestamp, List<PlayerSpatialState> players, List<SpeakerBlockState> speakers, String spectatorMode) {
        this("telemetry_batch", serverId != null ? serverId : "default", timestamp, players, speakers != null ? speakers : List.of(), spectatorMode != null ? spectatorMode : "listen-only", true);
    }

    public SpatialTelemetryBatch(String serverId, long timestamp, List<PlayerSpatialState> players, List<SpeakerBlockState> speakers, String spectatorMode, boolean radarEnabled) {
        this("telemetry_batch", serverId != null ? serverId : "default", timestamp, players, speakers != null ? speakers : List.of(), spectatorMode != null ? spectatorMode : "listen-only", radarEnabled);
    }

    public String toJson() {
        return GSON.toJson(this);
    }

    public static SpatialTelemetryBatch fromJson(String json) {
        return GSON.fromJson(json, SpatialTelemetryBatch.class);
    }
}
