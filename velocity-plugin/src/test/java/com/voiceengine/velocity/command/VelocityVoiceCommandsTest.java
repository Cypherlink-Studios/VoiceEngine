package com.voiceengine.velocity.command;

import com.velocitypowered.api.proxy.Player;
import com.voiceengine.velocity.auth.VelocitySessionToken;
import com.voiceengine.velocity.auth.VelocityTokenManager;
import com.voiceengine.velocity.config.VelocityVoiceConfig;
import com.voiceengine.velocity.moderation.ModerationDatabase;
import com.voiceengine.velocity.net.VelocityBackendClient;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.net.URI;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VelocityVoiceCommandsTest {
    private final PlainTextComponentSerializer serializer = PlainTextComponentSerializer.plainText();

    @Test
    void testVelocityStreamerModeToggleAndZeroLeakPrompts(@TempDir Path tempDir) throws SQLException {
        ModerationDatabase database = new ModerationDatabase(tempDir.resolve("moderation.db").toFile());
        database.init();

        try {
            VelocityTokenManager tokenManager = new VelocityTokenManager(Duration.ofMinutes(5));
            VelocityVoiceConfig config = new VelocityVoiceConfig(
                URI.create("ws://localhost:3000/ws/plugin"),
                "https://voice.example.com/",
                "secret",
                Duration.ofMinutes(5),
                true,
                "Welcome"
            );

            VelocityBackendClient client = mock(VelocityBackendClient.class);
            when(client.isOpen()).thenReturn(true);

            Player player = mock(Player.class);
            UUID uuid = UUID.randomUUID();
            when(player.getUniqueId()).thenReturn(uuid);
            when(player.getUsername()).thenReturn("ProxyStreamer");

            VelocityVoiceCommands commands = new VelocityVoiceCommands(
                tokenManager,
                () -> config,
                () -> client,
                null,
                () -> {},
                null,
                database
            );

            commands.onVoiceStreamerToggle(player);
            assertTrue(database.getStreamerMode(uuid));
            verify(client).sendStreamerModeSync(uuid, true);

            commands.onVoiceConnect(player);
            commands.onVoiceAdmin(player);

            ArgumentCaptor<VelocitySessionToken> tokenCaptor = ArgumentCaptor.forClass(VelocitySessionToken.class);
            verify(client, times(2)).registerToken(tokenCaptor.capture(), isNull(), eq(false));
            assertTrue(tokenCaptor.getAllValues().get(0).streamerMode());
            assertTrue(tokenCaptor.getAllValues().get(0).streamerModeExplicit());
            assertTrue(tokenCaptor.getAllValues().get(1).isAdmin());
            assertTrue(tokenCaptor.getAllValues().get(1).streamerMode());

            ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
            verify(player, times(3)).sendMessage(msgCaptor.capture());

            String connectText = serializer.serialize(msgCaptor.getAllValues().get(1));
            String adminText = serializer.serialize(msgCaptor.getAllValues().get(2));
            assertTrue(connectText.contains("[Open Web]"));
            assertFalse(connectText.contains(tokenCaptor.getAllValues().get(0).token()));
            assertFalse(connectText.contains("?token="));
            assertTrue(adminText.contains("[Open Panel]"));
            assertFalse(adminText.contains(tokenCaptor.getAllValues().get(1).token()));

            commands.onVoiceStreamerAction(player, "off");
            assertFalse(database.getStreamerMode(uuid));
            verify(client).sendStreamerModeSync(uuid, false);
        } finally {
            database.close();
        }
    }
}
