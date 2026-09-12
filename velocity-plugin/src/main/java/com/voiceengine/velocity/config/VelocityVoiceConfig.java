package com.voiceengine.velocity.config;

import org.slf4j.Logger;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;

public record VelocityVoiceConfig(
    URI voiceServerUri,
    String webClientUrl,
    String secretKey,
    Duration tokenTtl,
    boolean notifyOnJoin,
    String joinMessage
) {
    public static VelocityVoiceConfig load(Path dataDirectory) {
        return load(dataDirectory, null);
    }

    public static VelocityVoiceConfig load(Path dataDirectory, Logger logger) {
        Path configFile = dataDirectory.resolve("velocity-config.yml");

        try {
            if (!Files.exists(dataDirectory)) {
                Files.createDirectories(dataDirectory);
            }

            if (!Files.exists(configFile)) {
                try (InputStream in = VelocityVoiceConfig.class.getResourceAsStream("/velocity-config.yml")) {
                    if (in != null) {
                        try (OutputStream out = Files.newOutputStream(configFile)) {
                            in.transferTo(out);
                        }
                    }
                }
            }

            if (Files.exists(configFile)) {
                try (InputStream in = Files.newInputStream(configFile)) {
                    Yaml yaml = new Yaml();
                    Map<String, Object> data = yaml.load(in);
                    return fromMap(data);
                }
            }
        } catch (Exception e) {
            if (logger != null) {
                logger.warn("Failed to load velocity-config.yml, using defaults: {}", e.getMessage());
            }
        }

        return fromMap(null);
    }

    @SuppressWarnings("unchecked")
    public static VelocityVoiceConfig fromMap(Map<String, Object> map) {
        String serverUrlStr = map != null ? (String) map.getOrDefault("voice-server-url", "ws://localhost:3000/ws/plugin") : "ws://localhost:3000/ws/plugin";
        URI serverUri;
        try {
            serverUri = URI.create(serverUrlStr != null ? serverUrlStr : "ws://localhost:3000/ws/plugin");
        } catch (Exception e) {
            serverUri = URI.create("ws://localhost:3000/ws/plugin");
        }

        String webClient = map != null ? (String) map.getOrDefault("web-client-url", "http://localhost:5173") : "http://localhost:5173";
        if (webClient == null || webClient.isBlank()) {
            webClient = "http://localhost:5173";
        } else if (webClient.endsWith("/")) {
            webClient = webClient.substring(0, webClient.length() - 1);
        }

        String secret = map != null ? (String) map.getOrDefault("secret-key", "change-me-to-a-secure-random-secret") : "change-me-to-a-secure-random-secret";
        if (secret == null) {
            secret = "change-me-to-a-secure-random-secret";
        }

        long ttlMinutes = 5;
        if (map != null && map.get("token-ttl-minutes") instanceof Number num) {
            ttlMinutes = Math.max(1, num.longValue());
        }

        boolean notify = true;
        if (map != null && map.get("notify-on-join") instanceof Boolean b) {
            notify = b;
        }

        String joinMsg = map != null ? (String) map.getOrDefault("join-message", "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <gray>Proximity voice chat is active! Type <click:run_command:'/voice'><yellow>/voice</yellow></click> to connect.</gray>") : "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <gray>Proximity voice chat is active! Type <click:run_command:'/voice'><yellow>/voice</yellow></click> to connect.</gray>";

        return new VelocityVoiceConfig(
            serverUri,
            webClient,
            secret,
            Duration.ofMinutes(ttlMinutes),
            notify,
            joinMsg
        );
    }
}
