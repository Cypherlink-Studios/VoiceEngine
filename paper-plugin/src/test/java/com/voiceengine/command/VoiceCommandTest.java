package com.voiceengine.command;

import com.voiceengine.auth.SessionToken;
import com.voiceengine.auth.TokenManager;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.command.Command;
import org.bukkit.command.ConsoleCommandSender;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VoiceCommandTest {
    private TokenManager tokenManager;
    private final String baseUrl = "http://localhost:5173";
    private final Command mockCommand = mock(Command.class);
    private final PlainTextComponentSerializer serializer = PlainTextComponentSerializer.plainText();

    @BeforeEach
    void setUp() {
        tokenManager = new TokenManager(Duration.ofMinutes(5), 6);
    }

    @Test
    void testConsoleSenderRejected() {
        ConsoleCommandSender console = mock(ConsoleCommandSender.class);
        VoiceCommand voiceCommand = new VoiceCommand(tokenManager, baseUrl);

        boolean handled = voiceCommand.onCommand(console, mockCommand, "voice", new String[0]);
        assertTrue(handled);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(console).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("Only players can connect"));
    }

    @Test
    void testStandardVoiceCommandWithoutPermission() {
        Player player = mock(Player.class);
        when(player.hasPermission("voiceengine.use")).thenReturn(false);

        VoiceCommand voiceCommand = new VoiceCommand(tokenManager, baseUrl);
        boolean handled = voiceCommand.onCommand(player, mockCommand, "voice", new String[0]);
        assertTrue(handled);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("You do not have permission"));
    }

    @Test
    void testStandardVoiceCommandWithPermission() {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.getName()).thenReturn("Steve");
        when(player.hasPermission("voiceengine.use")).thenReturn(true);

        AtomicReference<SessionToken> registeredToken = new AtomicReference<>();
        VoiceCommand voiceCommand = new VoiceCommand(tokenManager, baseUrl, registeredToken::set);

        boolean handled = voiceCommand.onCommand(player, mockCommand, "voice", new String[0]);
        assertTrue(handled);

        assertNotNull(registeredToken.get());
        assertFalse(registeredToken.get().isAdmin());
        assertEquals("Steve", registeredToken.get().playerName());

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("[VoiceEngine]"));
        assertTrue(text.contains(registeredToken.get().token()));
    }

    @Test
    void testAdminVoiceCommandWithoutPermission() {
        Player player = mock(Player.class);
        when(player.hasPermission("voiceengine.admin")).thenReturn(false);

        VoiceCommand voiceCommand = new VoiceCommand(tokenManager, baseUrl);
        boolean handled = voiceCommand.onCommand(player, mockCommand, "voice", new String[]{"admin"});
        assertTrue(handled);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("permission to access the VoiceEngine admin portal"));
    }

    @Test
    void testAdminVoiceCommandWithPermission() {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.getName()).thenReturn("AdminDev");
        when(player.hasPermission("voiceengine.admin")).thenReturn(true);

        AtomicReference<SessionToken> registeredToken = new AtomicReference<>();
        VoiceCommand voiceCommand = new VoiceCommand(tokenManager, baseUrl, registeredToken::set);

        boolean handled = voiceCommand.onCommand(player, mockCommand, "voice", new String[]{"admin"});
        assertTrue(handled);

        assertNotNull(registeredToken.get());
        assertTrue(registeredToken.get().isAdmin());
        assertEquals("AdminDev", registeredToken.get().playerName());

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("[VoiceEngine Admin]"));
        assertTrue(text.contains(registeredToken.get().token()));
    }
}
