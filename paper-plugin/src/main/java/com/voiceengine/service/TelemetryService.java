package com.voiceengine.service;

import com.voiceengine.net.VoiceBackendClient;
import com.voiceengine.telemetry.SpatialTelemetryBatch;
import com.voiceengine.telemetry.TelemetryCollector;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.function.Supplier;

public class TelemetryService implements VoiceEngineService {
    private final Plugin plugin;
    private final TelemetryCollector collector;
    private final Supplier<VoiceBackendClient> clientSupplier;
    private int tickRateHz;
    private BukkitTask task;

    public TelemetryService(Plugin plugin, TelemetryCollector collector, Supplier<VoiceBackendClient> clientSupplier, int tickRateHz) {
        this.plugin = plugin;
        this.collector = collector;
        this.clientSupplier = clientSupplier;
        this.tickRateHz = Math.max(1, Math.min(20, tickRateHz));
    }

    public void updateTickRate(int newTickRateHz) {
        this.tickRateHz = Math.max(1, Math.min(20, newTickRateHz));
        if (task != null) {
            stop();
            start();
        }
    }

    @Override
    public void start() {
        if (task != null) {
            task.cancel();
        }
        long periodTicks = Math.max(1L, 20L / tickRateHz);
        this.task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, () -> {
            VoiceBackendClient client = clientSupplier.get();
            if (client != null && client.isOpen()) {
                SpatialTelemetryBatch batch = collector.collectBatch(Bukkit.getOnlinePlayers());
                client.sendTelemetry(batch);
            }
        }, periodTicks, periodTicks);
    }

    @Override
    public void stop() {
        if (task != null) {
            task.cancel();
            task = null;
        }
    }

    @Override
    public void reload() {
        if (task != null) {
            stop();
            start();
        }
    }

    public boolean isRunning() {
        return task != null && !task.isCancelled();
    }
}
