package com.voiceengine.telemetry;

import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class TelemetryCollector {

    public SpatialTelemetryBatch collectBatch(Collection<? extends Player> players) {
        return collectBatch(players, "default");
    }

    public SpatialTelemetryBatch collectBatch(Collection<? extends Player> players, String serverId) {
        return collectBatch(players, serverId, List.of());
    }

    public SpatialTelemetryBatch collectBatch(Collection<? extends Player> players, String serverId, List<com.voiceengine.speaker.SpeakerBlockState> speakers) {
        List<PlayerSpatialState> states = new ArrayList<>(players.size());
        for (Player player : players) {
            if (player != null && player.isOnline()) {
                states.add(PlayerSpatialState.fromPlayer(player, serverId));
            }
        }
        return new SpatialTelemetryBatch(serverId, System.currentTimeMillis(), states, speakers);
    }
}
