package com.voiceengine.command;

import com.google.gson.JsonObject;
import com.voiceengine.config.PlayerPreferencesManager;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.net.VoiceBackendClient;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.io.StringReader;
import java.nio.file.Path;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RoomCommandsTest {
    private TranslationService translationService;
    private final PlainTextComponentSerializer serializer = PlainTextComponentSerializer.plainText();

    @BeforeEach
    void setUp() {
        translationService = new TranslationService();

        YamlConfiguration en = YamlConfiguration.loadConfiguration(new StringReader("""
            prefix: "[VE] "
            prefix_admin: "[VE Admin] "
            command:
              connect:
                backend_offline: "<prefix>Backend offline"
              room:
                created: "<prefix>Room created PIN: <pin>"
                created_streamer: "<prefix>Room created (PIN hidden) <click:copy_to_clipboard:'<pin>'>[Copy PIN]</click>"
                joined: "<prefix>Room joined PIN: <pin>"
                joined_streamer: "<prefix>Joined private room"
                left: "<prefix>Room left"
                kicked: "<prefix>You were kicked"
                kick_success: "<prefix>Kicked player <player>"
                spy_joined: "<prefix_admin>Spying room of <player>"
                error: "<prefix>Error: <error>"
            """));
        translationService.registerLocale("en_us", en);
    }

    @Test
    void testRoomCreateSuccess() {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.getName()).thenReturn("Alice");
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(true);

        AtomicReference<JsonObject> sentCmd = new AtomicReference<>();
        doAnswer(inv -> {
            sentCmd.set(inv.getArgument(0));
            return null;
        }).when(client).sendRoomCommand(any(JsonObject.class));

        RoomCommands commands = new RoomCommands(() -> client, translationService);
        commands.onRoomCreate(player);

        assertNotNull(sentCmd.get());
        assertEquals("create", sentCmd.get().get("action").getAsString());
        assertEquals(uuid.toString(), sentCmd.get().get("playerUuid").getAsString());
        String reqId = sentCmd.get().get("requestId").getAsString();

        JsonObject resp = new JsonObject();
        resp.addProperty("requestId", reqId);
        resp.addProperty("success", true);
        resp.addProperty("pin", "123456");

        commands.handleBackendResponse(resp);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("Room created PIN: 123456"));
    }

    @Test
    void testRoomCreateBackendOffline() {
        Player player = mock(Player.class);
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(false);

        RoomCommands commands = new RoomCommands(() -> client, translationService);
        commands.onRoomCreate(player);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        String text = serializer.serialize(msgCaptor.getValue());
        assertTrue(text.contains("Backend offline"));
    }

    @Test
    void testRoomJoinSuccessAndFailure() {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.getName()).thenReturn("Bob");
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(true);

        AtomicReference<JsonObject> sentCmd = new AtomicReference<>();
        doAnswer(inv -> {
            sentCmd.set(inv.getArgument(0));
            return null;
        }).when(client).sendRoomCommand(any(JsonObject.class));

        RoomCommands commands = new RoomCommands(() -> client, translationService);
        commands.onRoomJoin(player, "654321");

        assertNotNull(sentCmd.get());
        assertEquals("join", sentCmd.get().get("action").getAsString());
        assertEquals("654321", sentCmd.get().get("pin").getAsString());
        String reqId = sentCmd.get().get("requestId").getAsString();

        JsonObject resp = new JsonObject();
        resp.addProperty("requestId", reqId);
        resp.addProperty("success", true);
        resp.addProperty("pin", "654321");

        commands.handleBackendResponse(resp);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        assertTrue(serializer.serialize(msgCaptor.getValue()).contains("Room joined PIN: 654321"));
    }

    @Test
    void testRoomLeave() {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(true);

        AtomicReference<JsonObject> sentCmd = new AtomicReference<>();
        doAnswer(inv -> {
            sentCmd.set(inv.getArgument(0));
            return null;
        }).when(client).sendRoomCommand(any(JsonObject.class));

        RoomCommands commands = new RoomCommands(() -> client, translationService);
        commands.onRoomLeave(player);

        assertNotNull(sentCmd.get());
        assertEquals("leave", sentCmd.get().get("action").getAsString());
        String reqId = sentCmd.get().get("requestId").getAsString();

        JsonObject resp = new JsonObject();
        resp.addProperty("requestId", reqId);
        commands.handleBackendResponse(resp);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        assertTrue(serializer.serialize(msgCaptor.getValue()).contains("Room left"));
    }

    @Test
    void testRoomKick() {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(true);

        AtomicReference<JsonObject> sentCmd = new AtomicReference<>();
        doAnswer(inv -> {
            sentCmd.set(inv.getArgument(0));
            return null;
        }).when(client).sendRoomCommand(any(JsonObject.class));

        RoomCommands commands = new RoomCommands(() -> client, translationService);
        commands.onRoomKick(player, "Griefer123");

        assertNotNull(sentCmd.get());
        assertEquals("kick", sentCmd.get().get("action").getAsString());
        assertEquals("Griefer123", sentCmd.get().get("targetUsername").getAsString());
        String reqId = sentCmd.get().get("requestId").getAsString();

        JsonObject resp = new JsonObject();
        resp.addProperty("requestId", reqId);
        resp.addProperty("success", true);
        commands.handleBackendResponse(resp);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        assertTrue(serializer.serialize(msgCaptor.getValue()).contains("Kicked player Griefer123"));
    }

    @Test
    void testRoomSpy() {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.getName()).thenReturn("StaffMember");
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(true);

        AtomicReference<JsonObject> sentCmd = new AtomicReference<>();
        doAnswer(inv -> {
            sentCmd.set(inv.getArgument(0));
            return null;
        }).when(client).sendRoomCommand(any(JsonObject.class));

        RoomCommands commands = new RoomCommands(() -> client, translationService);
        commands.onRoomSpy(player, "SuspectUser");

        assertNotNull(sentCmd.get());
        assertEquals("spy", sentCmd.get().get("action").getAsString());
        assertEquals("SuspectUser", sentCmd.get().get("targetPlayer").getAsString());
        String reqId = sentCmd.get().get("requestId").getAsString();

        JsonObject resp = new JsonObject();
        resp.addProperty("requestId", reqId);
        resp.addProperty("success", true);
        commands.handleBackendResponse(resp);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player).sendMessage(msgCaptor.capture());
        assertTrue(serializer.serialize(msgCaptor.getValue()).contains("Spying room of SuspectUser"));
    }

    @Test
    void testRoomCreateAndJoinMaskPinInStreamerMode(@TempDir Path tempDir) {
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);
        when(player.getName()).thenReturn("StreamerAlice");
        when(player.locale()).thenReturn(Locale.US);

        VoiceBackendClient client = mock(VoiceBackendClient.class);
        when(client.isOpen()).thenReturn(true);

        AtomicReference<JsonObject> sentCmd = new AtomicReference<>();
        doAnswer(inv -> {
            sentCmd.set(inv.getArgument(0));
            return null;
        }).when(client).sendRoomCommand(any(JsonObject.class));

        PlayerPreferencesManager prefs = new PlayerPreferencesManager(tempDir.toFile());
        prefs.setStreamerMode(uuid, true);

        RoomCommands commands = new RoomCommands(() -> client, translationService, prefs);
        commands.onRoomCreate(player);

        JsonObject createResp = new JsonObject();
        createResp.addProperty("requestId", sentCmd.get().get("requestId").getAsString());
        createResp.addProperty("success", true);
        createResp.addProperty("pin", "654321");
        commands.handleBackendResponse(createResp);

        commands.onRoomJoin(player, "654321");
        JsonObject joinResp = new JsonObject();
        joinResp.addProperty("requestId", sentCmd.get().get("requestId").getAsString());
        joinResp.addProperty("success", true);
        joinResp.addProperty("pin", "654321");
        commands.handleBackendResponse(joinResp);

        ArgumentCaptor<Component> msgCaptor = ArgumentCaptor.forClass(Component.class);
        verify(player, times(2)).sendMessage(msgCaptor.capture());
        String createText = serializer.serialize(msgCaptor.getAllValues().get(0));
        String joinText = serializer.serialize(msgCaptor.getAllValues().get(1));

        assertTrue(createText.contains("[Copy PIN]"));
        assertFalse(createText.contains("654321"));
        assertTrue(joinText.contains("Joined private room"));
        assertFalse(joinText.contains("654321"));
    }
}
