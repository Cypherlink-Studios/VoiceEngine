package com.voiceengine.telemetry;

import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class TelemetryCollector {

    public SpatialTelemetryBatch collectBatch(Collection<? extends Player> players) {
        List<PlayerSpatialState> states = new ArrayList<>(players.size());
        for (Player player : players) {
            if (player != null && player.isOnline()) {
                states.add(PlayerSpatialState.fromPlayer(player));
            }
        }
        return new SpatialTelemetryBatch(System.currentTimeMillis(), states);
    }
}
