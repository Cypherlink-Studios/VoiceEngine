package com.voiceengine.listener;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.Event;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.EventExecutor;
import org.bukkit.plugin.Plugin;

import java.lang.reflect.Method;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.logging.Level;

public class VanishHookListener implements Listener {
    private final Plugin plugin;
    private final Supplier<Boolean> autoHookSupplier;
    private final BiConsumer<Player, Boolean> vanishStateConsumer;
    private final Consumer<UUID> quitConsumer;

    public VanishHookListener(
        Plugin plugin,
        Supplier<Boolean> autoHookSupplier,
        BiConsumer<Player, Boolean> vanishStateConsumer,
        Consumer<UUID> quitConsumer
    ) {
        this.plugin = plugin;
        this.autoHookSupplier = autoHookSupplier != null ? autoHookSupplier : () -> true;
        this.vanishStateConsumer = vanishStateConsumer;
        this.quitConsumer = quitConsumer;
    }

    public void registerHooks() {
        if (!Boolean.TRUE.equals(autoHookSupplier.get())) {
            return;
        }

        // 1. Hook into EssentialsX VanishStatusChangeEvent
        tryRegisterEvent("net.ess3.api.events.VanishStatusChangeEvent", (listener, event) -> {
            try {
                Method getAffected = event.getClass().getMethod("getAffected");
                Object user = getAffected.invoke(event);
                Method getBase = user.getClass().getMethod("getBase");
                Player player = (Player) getBase.invoke(user);
                Method getValue = event.getClass().getMethod("getValue");
                boolean vanished = (Boolean) getValue.invoke(event);
                if (player != null && vanishStateConsumer != null) {
                    vanishStateConsumer.accept(player, vanished);
                }
            } catch (Exception ignored) {}
        });

        // 2. Hook into SuperVanish / PremiumVanish PlayerVanishStateChangeEvent
        tryRegisterEvent("de.myzelyam.api.vanish.PlayerVanishStateChangeEvent", (listener, event) -> {
            try {
                Method getUUID = event.getClass().getMethod("getUUID");
                UUID uuid = (UUID) getUUID.invoke(event);
                Player player = Bukkit.getPlayer(uuid);
                Method isVanishing = event.getClass().getMethod("isVanishing");
                boolean vanished = (Boolean) isVanishing.invoke(event);
                if (player != null && vanishStateConsumer != null) {
                    vanishStateConsumer.accept(player, vanished);
                }
            } catch (Exception ignored) {}
        });
    }

    private void tryRegisterEvent(String className, EventExecutor executor) {
        try {
            Class<?> rawClass = Class.forName(className);
            if (Event.class.isAssignableFrom(rawClass)) {
                Class<? extends Event> eventClass = rawClass.asSubclass(Event.class);
                Bukkit.getPluginManager().registerEvent(eventClass, this, EventPriority.MONITOR, executor, plugin);
                plugin.getLogger().info("[VoiceEngine] Hooked into vanish event: " + className);
            }
        } catch (ClassNotFoundException ignored) {
            // Plugin not installed, safely ignore
        } catch (Exception e) {
            plugin.getLogger().log(Level.FINE, "[VoiceEngine] Could not register hook for " + className, e);
        }
    }

    public boolean isPlayerVanished(Player player) {
        if (player == null || !Boolean.TRUE.equals(autoHookSupplier.get())) {
            return false;
        }
        if (player.hasMetadata("vanished")) {
            for (org.bukkit.metadata.MetadataValue meta : player.getMetadata("vanished")) {
                if (meta.asBoolean()) return true;
            }
        }
        return false;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        if (!Boolean.TRUE.equals(autoHookSupplier.get())) return;
        Player player = event.getPlayer();
        if (isPlayerVanished(player) && vanishStateConsumer != null) {
            vanishStateConsumer.accept(player, true);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        if (quitConsumer != null) {
            quitConsumer.accept(event.getPlayer().getUniqueId());
        }
    }
}
