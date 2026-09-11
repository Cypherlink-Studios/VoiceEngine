package com.voiceengine.visual;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.entity.Player;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class SpeechFeedbackHandler {
    private final Set<UUID> speakingPlayers = ConcurrentHashMap.newKeySet();

    public void setSpeaking(UUID playerUuid, boolean speaking) {
        if (speaking) {
            speakingPlayers.add(playerUuid);
        } else {
            speakingPlayers.remove(playerUuid);
        }
    }

    public boolean isSpeaking(UUID playerUuid) {
        return speakingPlayers.contains(playerUuid);
    }

    public void renderVisualIndicators() {
        if (speakingPlayers.isEmpty()) {
            return;
        }

        for (UUID uuid : speakingPlayers) {
            Player player = Bukkit.getPlayer(uuid);
            if (player != null && player.isOnline()) {
                Location headLoc = player.getEyeLocation().add(0, 0.4, 0);
                // Subtle musical note particle above player head
                player.getWorld().spawnParticle(
                    Particle.NOTE,
                    headLoc,
                    1,
                    0.15, 0.1, 0.15,
                    0.5
                );
            }
        }
    }

    public void clear() {
        speakingPlayers.clear();
    }
}
