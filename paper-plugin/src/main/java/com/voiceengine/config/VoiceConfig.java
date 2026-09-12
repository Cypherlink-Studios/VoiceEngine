package com.voiceengine.config;

import org.bukkit.configuration.ConfigurationSection;

import java.net.URI;
import java.time.Duration;

public record VoiceConfig(
    URI voiceServerUri,
    String webClientUrl,
    String secretKey,
    int tickRateHz,
    Duration tokenTtl,
    boolean notifyOnJoin,
    String defaultLocale
) {
    public static VoiceConfig fromConfiguration(ConfigurationSection config) {
        String serverUrlStr = config != null ? config.getString("voice-server-url", "ws://localhost:3000/ws/plugin") : "ws://localhost:3000/ws/plugin";
        URI serverUri;
        try {
            serverUri = URI.create(serverUrlStr != null ? serverUrlStr : "ws://localhost:3000/ws/plugin");
        } catch (Exception e) {
            serverUri = URI.create("ws://localhost:3000/ws/plugin");
        }

        String webClient = config != null ? config.getString("web-client-url", "http://localhost:5173") : "http://localhost:5173";
        if (webClient == null || webClient.isBlank()) {
            webClient = "http://localhost:5173";
        } else if (webClient.endsWith("/")) {
            webClient = webClient.substring(0, webClient.length() - 1);
        }

        String secret = config != null ? config.getString("secret-key", "change-me-to-a-secure-random-secret") : "change-me-to-a-secure-random-secret";
        if (secret == null) {
            secret = "change-me-to-a-secure-random-secret";
        }

        int tickRate = Math.max(1, Math.min(20, config != null ? config.getInt("tick-rate-hz", 10) : 10));
        long ttlMinutes = Math.max(1, config != null ? config.getLong("token-ttl-minutes", 5) : 5);
        boolean notify = config == null || config.getBoolean("notify-on-join", true);
        String defaultLoc = config != null ? config.getString("default-locale", "en_US") : "en_US";
        if (defaultLoc == null || defaultLoc.isBlank()) {
            defaultLoc = "en_US";
        }

        return new VoiceConfig(
            serverUri,
            webClient,
            secret,
            tickRate,
            Duration.ofMinutes(ttlMinutes),
            notify,
            defaultLoc
        );
    }
}
