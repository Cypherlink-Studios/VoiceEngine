package com.voiceengine.velocity.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class VelocityVoiceConfigTest {

    @Test
    void testLoadDefaults(@TempDir Path tempDir) {
        VelocityVoiceConfig config = VelocityVoiceConfig.load(tempDir);
        assertNotNull(config);
        assertEquals(URI.create("ws://localhost:3000/ws/plugin"), config.voiceServerUri());
        assertEquals("http://localhost:5173", config.webClientUrl());
        assertEquals("change-me-to-a-secure-random-secret", config.secretKey());
        assertEquals(Duration.ofMinutes(5), config.tokenTtl());
        assertTrue(config.notifyOnJoin());
    }

    @Test
    void testLoadCustomConfig(@TempDir Path tempDir) throws IOException {
        Path configFile = tempDir.resolve("velocity-config.yml");
        String yaml = """
            voice-server-url: "ws://custom-proxy:3000/ws/plugin"
            web-client-url: "https://voice.network.com/"
            secret-key: "proxy-secret-999"
            token-ttl-minutes: 10
            notify-on-join: false
            join-message: "<green>Join our voice chat!</green>"
            """;
        Files.writeString(configFile, yaml);

        VelocityVoiceConfig config = VelocityVoiceConfig.load(tempDir);
        assertEquals(URI.create("ws://custom-proxy:3000/ws/plugin"), config.voiceServerUri());
        assertEquals("https://voice.network.com", config.webClientUrl());
        assertEquals("proxy-secret-999", config.secretKey());
        assertEquals(Duration.ofMinutes(10), config.tokenTtl());
        assertFalse(config.notifyOnJoin());
        assertEquals("<green>Join our voice chat!</green>", config.joinMessage());
    }
}
