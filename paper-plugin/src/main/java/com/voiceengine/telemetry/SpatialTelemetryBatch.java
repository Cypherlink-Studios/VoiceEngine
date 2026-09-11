package com.voiceengine.telemetry;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.util.List;

public record SpatialTelemetryBatch(
    String type,
    long timestamp,
    List<PlayerSpatialState> players
) {
    private static final Gson GSON = new GsonBuilder().create();

    public SpatialTelemetryBatch(long timestamp, List<PlayerSpatialState> players) {
        this("telemetry_batch", timestamp, players);
    }

    public String toJson() {
        return GSON.toJson(this);
    }

    public static SpatialTelemetryBatch fromJson(String json) {
        return GSON.fromJson(json, SpatialTelemetryBatch.class);
    }
}
