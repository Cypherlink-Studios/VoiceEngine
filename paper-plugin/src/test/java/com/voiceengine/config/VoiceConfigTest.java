package com.voiceengine.config;

import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.net.URI;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class VoiceConfigTest {

    @Test
    void testDefaults() {
        YamlConfiguration empty = new YamlConfiguration();
        VoiceConfig config = VoiceConfig.fromConfiguration(empty);

        assertEquals(URI.create("ws://localhost:3000/ws/plugin"), config.voiceServerUri());
        assertEquals("http://localhost:5173", config.webClientUrl());
        assertEquals("change-me-to-a-secure-random-secret", config.secretKey());
        assertEquals(10, config.tickRateHz());
        assertEquals(Duration.ofMinutes(5), config.tokenTtl());
        assertTrue(config.notifyOnJoin());
        assertEquals("en_US", config.defaultLocale());
        assertEquals("default", config.serverId());
        assertEquals("auto", config.proxyMode());
        assertTrue(config.resolveProxyMode(true));
        assertFalse(config.resolveProxyMode(false));
    }

    @Test
    void testCustomValues() {
        String yaml = """
            voice-server-url: "ws://custom-voice:3000/ws/plugin"
            web-client-url: "https://voice.myserver.net/"
            secret-key: "super-secret-key-123"
            tick-rate-hz: 15
            token-ttl-minutes: 10
            notify-on-join: false
            default-locale: "es_ES"
            server-id: "survival-1"
            proxy-mode: "true"
            """;
        YamlConfiguration parsed = YamlConfiguration.loadConfiguration(new StringReader(yaml));
        VoiceConfig config = VoiceConfig.fromConfiguration(parsed);

        assertEquals(URI.create("ws://custom-voice:3000/ws/plugin"), config.voiceServerUri());
        assertEquals("https://voice.myserver.net", config.webClientUrl()); // trailing slash stripped
        assertEquals("super-secret-key-123", config.secretKey());
        assertEquals(15, config.tickRateHz());
        assertEquals(Duration.ofMinutes(10), config.tokenTtl());
        assertFalse(config.notifyOnJoin());
        assertEquals("es_ES", config.defaultLocale());
        assertEquals("survival-1", config.serverId());
        assertEquals("true", config.proxyMode());
        assertTrue(config.resolveProxyMode(false)); // explicitly "true"
    }

    @Test
    void testTickRateClamping() {
        String yaml = "tick-rate-hz: 100\ntoken-ttl-minutes: 0";
        YamlConfiguration parsed = YamlConfiguration.loadConfiguration(new StringReader(yaml));
        VoiceConfig config = VoiceConfig.fromConfiguration(parsed);

        assertEquals(20, config.tickRateHz()); // clamped to 20
        assertEquals(Duration.ofMinutes(1), config.tokenTtl()); // minimum 1 minute
    }
}
