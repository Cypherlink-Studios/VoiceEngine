package com.voiceengine.telemetry;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class SpatialTelemetryTest {

    @Test
    void testTelemetryBatchSerialization() {
        UUID uuid1 = UUID.randomUUID();
        UUID uuid2 = UUID.randomUUID();

        PlayerSpatialState player1 = new PlayerSpatialState(
            uuid1, "Steve", "world", 100.25, 64.00, -200.75, 90.0f, 0.0f, false, false
        );

        PlayerSpatialState player2 = new PlayerSpatialState(
            uuid2, "Alex", "world", 105.10, 64.00, -195.50, 270.0f, 15.0f, true, true
        );

        long now = System.currentTimeMillis();
        SpatialTelemetryBatch batch = new SpatialTelemetryBatch(now, List.of(player1, player2));

        String json = batch.toJson();
        assertNotNull(json);
        assertTrue(json.contains("telemetry_batch"));
        assertTrue(json.contains("Steve"));
        assertTrue(json.contains("Alex"));
        assertTrue(json.contains("isSneaking"));
        assertTrue(json.contains("isSubmerged"));

        SpatialTelemetryBatch deserialized = SpatialTelemetryBatch.fromJson(json);
        assertEquals("telemetry_batch", deserialized.type());
        assertEquals(now, deserialized.timestamp());
        assertEquals(2, deserialized.players().size());

        PlayerSpatialState dPlayer1 = deserialized.players().get(0);
        assertEquals(uuid1, dPlayer1.uuid());
        assertEquals("Steve", dPlayer1.username());
        assertEquals(100.25, dPlayer1.x());
        assertFalse(dPlayer1.isSneaking());

        PlayerSpatialState dPlayer2 = deserialized.players().get(1);
        assertEquals(uuid2, dPlayer2.uuid());
        assertEquals("Alex", dPlayer2.username());
        assertTrue(dPlayer2.isSneaking());
        assertTrue(dPlayer2.isSubmerged());
    }

    @Test
    void testBatchWithCustomServerId() {
        UUID uuid = UUID.randomUUID();
        PlayerSpatialState player = new PlayerSpatialState(
            uuid, "Steve", "survival-1", "world", 10.0, 64.0, 20.0, 0.0f, 0.0f, false, false
        );

        long now = System.currentTimeMillis();
        SpatialTelemetryBatch batch = new SpatialTelemetryBatch("survival-1", now, List.of(player));

        String json = batch.toJson();
        assertTrue(json.contains("\"serverId\":\"survival-1\""));

        SpatialTelemetryBatch deserialized = SpatialTelemetryBatch.fromJson(json);
        assertEquals("survival-1", deserialized.serverId());
        assertEquals("survival-1", deserialized.players().get(0).serverId());
    }
}
