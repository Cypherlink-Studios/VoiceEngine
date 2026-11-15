package com.voiceengine.listener;

import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.metadata.FixedMetadataValue;
import org.bukkit.metadata.MetadataValue;
import org.bukkit.plugin.Plugin;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VanishHookListenerTest {

    @Test
    void testPlayerQuitTriggersConsumer() {
        Plugin plugin = mock(Plugin.class);
        Player player = mock(Player.class);
        UUID uuid = UUID.randomUUID();
        when(player.getUniqueId()).thenReturn(uuid);

        AtomicReference<UUID> quitUuid = new AtomicReference<>();
        VanishHookListener listener = new VanishHookListener(
            plugin,
            () -> true,
            null,
            quitUuid::set
        );

        PlayerQuitEvent event = new PlayerQuitEvent(player, (net.kyori.adventure.text.Component) null);
        listener.onPlayerQuit(event);

        assertEquals(uuid, quitUuid.get());
    }

    @Test
    void testPlayerJoinWithVanishedMetadata() {
        Plugin plugin = mock(Plugin.class);
        Player player = mock(Player.class);
        when(player.hasMetadata("vanished")).thenReturn(true);
        MetadataValue meta = mock(MetadataValue.class);
        when(meta.asBoolean()).thenReturn(true);
        when(player.getMetadata("vanished")).thenReturn(List.of(meta));

        AtomicBoolean vanished = new AtomicBoolean(false);
        VanishHookListener listener = new VanishHookListener(
            plugin,
            () -> true,
            (p, v) -> vanished.set(v),
            null
        );

        assertTrue(listener.isPlayerVanished(player));

        PlayerJoinEvent event = new PlayerJoinEvent(player, (net.kyori.adventure.text.Component) null);
        listener.onPlayerJoin(event);

        assertTrue(vanished.get());
    }

    @Test
    void testAutoHookDisabledIgnoresVanish() {
        Plugin plugin = mock(Plugin.class);
        Player player = mock(Player.class);
        when(player.hasMetadata("vanished")).thenReturn(true);

        AtomicBoolean vanished = new AtomicBoolean(false);
        VanishHookListener listener = new VanishHookListener(
            plugin,
            () -> false,
            (p, v) -> vanished.set(v),
            null
        );

        assertFalse(listener.isPlayerVanished(player));

        PlayerJoinEvent event = new PlayerJoinEvent(player, (net.kyori.adventure.text.Component) null);
        listener.onPlayerJoin(event);

        assertFalse(vanished.get());
    }
}
