package com.voiceengine.telemetry;

import org.bukkit.Location;
import org.bukkit.entity.Player;

import java.util.UUID;

public record PlayerSpatialState(
    UUID uuid,
    String username,
    String world,
    double x,
    double y,
    double z,
    float yaw,
    float pitch,
    boolean isSneaking,
    boolean isSubmerged
) {
    public static PlayerSpatialState fromPlayer(Player player) {
        Location loc = player.getLocation();
        return new PlayerSpatialState(
            player.getUniqueId(),
            player.getName(),
            player.getWorld().getName(),
            round(loc.getX()),
            round(loc.getY()),
            round(loc.getZ()),
            roundAngle(loc.getYaw()),
            roundAngle(loc.getPitch()),
            player.isSneaking(),
            player.isInWater()
        );
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static float roundAngle(float value) {
        return Math.round(value * 10.0f) / 10.0f;
    }
}
