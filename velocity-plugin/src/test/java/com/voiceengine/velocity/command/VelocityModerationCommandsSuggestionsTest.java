package com.voiceengine.velocity.command;

import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.voiceengine.velocity.moderation.VelocityModerationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VelocityModerationCommandsSuggestionsTest {
    private ProxyServer proxyServer;
    private VelocityModerationService moderationService;
    private VelocityModerationCommands commands;

    @BeforeEach
    void setUp() {
        proxyServer = mock(ProxyServer.class);
        moderationService = mock(VelocityModerationService.class);
        commands = new VelocityModerationCommands(proxyServer, moderationService);
    }

    @Test
    void testSuggestNetworkPlayers() {
        Player p1 = mock(Player.class);
        when(p1.getUsername()).thenReturn("Steve");
        Player p2 = mock(Player.class);
        when(p2.getUsername()).thenReturn("Alex");

        when(proxyServer.getAllPlayers()).thenReturn(List.of(p1, p2));

        List<String> suggestions = commands.suggestNetworkPlayers(null, "");
        assertEquals(List.of("Steve", "Alex"), suggestions);
    }

    @Test
    void testSuggestNetworkPlayersNullProxy() {
        VelocityModerationCommands nullProxyCommands = new VelocityModerationCommands(null, moderationService);
        List<String> suggestions = nullProxyCommands.suggestNetworkPlayers(null, "");
        assertTrue(suggestions.isEmpty());
    }

    @Test
    void testSuggestPunishmentDurations() {
        List<String> suggestions = commands.suggestPunishmentDurations(null, "");
        assertTrue(suggestions.contains("15m"));
        assertTrue(suggestions.contains("1h"));
        assertTrue(suggestions.contains("1d"));
        assertTrue(suggestions.contains("7d"));
        assertTrue(suggestions.contains("permanent"));
    }
}
