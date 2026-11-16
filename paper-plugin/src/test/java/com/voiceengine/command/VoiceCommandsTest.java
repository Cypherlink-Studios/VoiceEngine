package com.voiceengine.command;

import com.voiceengine.auth.SessionToken;
import com.voiceengine.auth.TokenManager;
import com.voiceengine.config.PlayerPreferencesManager;
import com.voiceengine.config.VoiceConfig;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.net.VoiceBackendClient;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.io.StringReader;
import java.net.URI;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VoiceCommandsTest {
    private TokenManager tokenManager;
    private TranslationService translationService;
    private VoiceConfig voiceConfig;
    private final PlainTextComponentSerializer serializer = PlainTextComponentSerializer.plainText();

    @BeforeEach
    void setUp() {
        tokenManager = new TokenManager(Duration.ofMinutes(5), 6);
        translationService = new TranslationService();

        YamlConfiguration en = YamlConfiguration.loadConfiguration(new StringReader("""
            prefix: "[VE] "
            prefix_admin: "[VE Admin] "
            command:
              connect:
                prompt: "<prefix>Connect at <url> with code <token>"
                prompt_streamer: "<prefix>[Streamer] <click:open_url:'<url>'>[Open Web]</click> <click:copy_to_clipboard:'<token>'>[Copy Code]</click> <click:copy_to_clipboard:'<token_url>'>[Copy Link]</click>"
                only_players: "<prefix>Only players"
                backend_offline: "<prefix>Backend offline"
              streamer:
                enabled: "<prefix>Streamer ON"
                disabled: "<prefix>Streamer OFF"
                status_on: "<prefix>Status ON"
                status_off: "<prefix>Status OFF"
                invalid_action: "<prefix>Invalid"
              admin:
                prompt: "<prefix_admin>Admin at <url> with code <token>"
                prompt_streamer: "<prefix_admin>[Streamer] <click:open_url:'<url>'>[Open Panel]</click> <click:copy_to_clipboard:'<token>'>[Copy Code]</click> <click:copy_to_clipboard:'<token_url>'>[Copy Link]</click>"
                backend_offline: "<prefix_admin>Backend offline"
              reload:
                success: "<prefix>Reload successful"
              status:
                header: "<prefix>Status Header"
                connected: "Status: CONNECTED"
                disconnected: "Status: DISCONNECTED (<attempts> attempts)"
                uri: "URI: <uri>"
                active_tokens: "Tokens: <count>"
            """));
        translationService.registerLocale("en_us", en);

        voiceConfig = new VoiceConfig(
            URI.create("ws://localhost:3000/ws/plugin"),
            "http://localhost:5173",
            "secret",
            10,
            Duration.ofMinutes(5),
            true,
            "en_US"
        );
    }

    @Test
    void testVoiceConnectSuccess() {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.getName()).thenReturn("Steve");
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(true);

        AtomicReference<SessionToken> sentToken = new AtomicReference<>();
        VoiceCommands commands = new VoiceCommands(
            tokenManager,
            () -> voiceConfig,
            () -> client,
            translationService,
            sentToken::set,
            () -> {}
        );

        commands.onVoiceConnect(player);

        assertNotNull(sentToken.get());
        assertFalse(sentToken.get().isAdmin());
        assertEquals("Steve", sentToken.get().playerName());

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("[VE] Connect at http://localhost:5173/?token=" + sentToken.get().token()));
    }

    @Test
    void testVoiceConnectBackendOffline() {
        Player player = mock(Player.class);
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(false);

        VoiceCommands commands = new VoiceCommands(
            tokenManager,
            () -> voiceConfig,
            () -> client,
            translationService,
            null,
            () -> {}
        );

        commands.onVoiceConnect(player);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("Backend offline"));
    }

    @Test
    void testVoiceAdminSuccess() {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.getName()).thenReturn("AdminDev");
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(true);

        AtomicReference<SessionToken> sentToken = new AtomicReference<>();
        VoiceCommands commands = new VoiceCommands(
            tokenManager,
            () -> voiceConfig,
            () -> client,
            translationService,
            sentToken::set,
            () -> {}
        );

        commands.onVoiceAdmin(player);

        assertNotNull(sentToken.get());
        assertTrue(sentToken.get().isAdmin());
        assertEquals("AdminDev", sentToken.get().playerName());

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("[VE Admin] Admin at http://localhost:5173/admin?token=" + sentToken.get().token()));
    }

    @Test
    void testVoiceReload() {
        CommandSender sender = mock(CommandSender.class);
        AtomicBoolean reloaded = new AtomicBoolean(false);

        VoiceCommands commands = new VoiceCommands(
            tokenManager,
            () -> voiceConfig,
            () -> null,
            translationService,
            null,
            () -> reloaded.set(true)
        );

        commands.onVoiceReload(sender);

        assertTrue(reloaded.get());
        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(sender).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("Reload successful"));
    }

    @Test
    void testVoiceStatusConnected() {
        CommandSender sender = mock(CommandSender.class);
        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(true);

        VoiceCommands commands = new VoiceCommands(
            tokenManager,
            () -> voiceConfig,
            () -> client,
            translationService,
            null,
            () -> {}
        );

        commands.onVoiceStatus(sender);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(sender, times(4)).sendMessage(msgCaptor.capture());
        var messages = msgCaptor.getAllValues().stream().map(serializer::serialize).toList();

        assertTrue(messages.get(0).contains("Status Header"));
        assertTrue(messages.get(1).contains("Status: CONNECTED"));
        assertTrue(messages.get(2).contains("URI: ws://localhost:3000/ws/plugin"));
        assertTrue(messages.get(3).contains("Tokens: 0"));
    }

    @Test
    void testVoiceConnectNotPlayer() {
        CommandSender sender = mock(CommandSender.class);
        VoiceCommands commands = new VoiceCommands(
            tokenManager,
            () -> voiceConfig,
            () -> null,
            translationService,
            null,
            () -> {}
        );

        commands.onVoiceConnect(sender);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(sender).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("Only players"));
    }

    @Test
    void testVoiceAdminNotPlayer() {
        CommandSender sender = mock(CommandSender.class);
        VoiceCommands commands = new VoiceCommands(
            tokenManager,
            () -> voiceConfig,
            () -> null,
            translationService,
            null,
            () -> {}
        );

        commands.onVoiceAdmin(sender);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(sender).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("Only players"));
    }

    @Test
    void testVoiceVanishToggle() {
        Player player = mock(Player.class);
        AtomicReference<Player> toggled = new AtomicReference<>();
        VoiceCommands commands = new VoiceCommands(
            tokenManager,
            () -> voiceConfig,
            () -> null,
            translationService,
            null,
            () -> {},
            null,
            toggled::set
        );

        commands.onVoiceVanish(player);
        assertEquals(player, toggled.get());

        commands.onVoiceStaff(player);
        assertEquals(player, toggled.get());
    }

    @Test
    void testStreamerModeToggleAndZeroLeakPrompts(@TempDir Path tempDir) {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.getName()).thenReturn("StreamerSteve");
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(true);

        PlayerPreferencesManager prefs = new PlayerPreferencesManager(tempDir.toFile());
        AtomicReference<SessionToken> sentToken = new AtomicReference<>();

        VoiceCommands commands = new VoiceCommands(
            tokenManager,
            () -> voiceConfig,
            () -> client,
            translationService,
            sentToken::set,
            () -> {},
            null,
            null,
            prefs
        );

        commands.onVoiceStreamerToggle(player);
        assertTrue(prefs.isStreamerMode(uuid));
        verify(client).sendStreamerModeSync(uuid, true);

        commands.onVoiceConnect(player);
        assertNotNull(sentToken.get());
        assertTrue(sentToken.get().streamerMode());
        assertTrue(sentToken.get().streamerModeExplicit());

        commands.onVoiceAdmin(player);
        assertNotNull(sentToken.get());
        assertTrue(sentToken.get().isAdmin());
        assertTrue(sentToken.get().streamerMode());

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player, times(3)).sendMessage(msgCaptor.capture());
        String connectText = serializer.serialize(msgCaptor.getAllValues().get(1));
        String adminText = serializer.serialize(msgCaptor.getAllValues().get(2));

        assertTrue(connectText.contains("[Open Web]"));
        assertFalse(connectText.contains("?token="));
        assertTrue(adminText.contains("[Open Panel]"));
        assertFalse(adminText.contains(sentToken.get().token()));

        commands.onVoiceStreamerAction(player, "off");
        assertFalse(prefs.isStreamerMode(uuid));
        verify(client).sendStreamerModeSync(uuid, false);
    }
}
