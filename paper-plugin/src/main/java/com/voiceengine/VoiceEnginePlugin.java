package com.voiceengine;

import com.voiceengine.auth.TokenManager;
import com.voiceengine.command.VoiceCommand;
import com.voiceengine.net.VoiceBackendClient;
import com.voiceengine.telemetry.SpatialTelemetryBatch;
import com.voiceengine.telemetry.TelemetryCollector;
import com.voiceengine.visual.SpeechFeedbackHandler;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.net.URI;
import java.time.Duration;

public class VoiceEnginePlugin extends JavaPlugin implements Listener {
    private TokenManager tokenManager;
    private SpeechFeedbackHandler speechFeedbackHandler;
    private TelemetryCollector telemetryCollector;
    private VoiceBackendClient voiceBackendClient;

    private BukkitTask telemetryTask;
    private BukkitTask visualTask;

    @Override
    public void onEnable() {
        saveDefaultConfig();

        String voiceServerUrl = getConfig().getString("voice-server-url", "ws://localhost:3000/ws/plugin");
        String webClientUrl = getConfig().getString("web-client-url", "http://localhost:5173");
        String secretKey = getConfig().getString("secret-key", "change-me-to-a-secure-random-secret");
        int tickRateHz = Math.max(1, Math.min(20, getConfig().getInt("tick-rate-hz", 10)));
        long tokenTtlMinutes = getConfig().getLong("token-ttl-minutes", 5);

        this.tokenManager = new TokenManager(Duration.ofMinutes(tokenTtlMinutes), 6);
        this.speechFeedbackHandler = new SpeechFeedbackHandler();
        this.telemetryCollector = new TelemetryCollector();

        // Connect to Voice Server
        try {
            this.voiceBackendClient = new VoiceBackendClient(
                URI.create(voiceServerUrl),
                secretKey,
                speechFeedbackHandler
            );
            this.voiceBackendClient.connect();
        } catch (Exception e) {
            getLogger().warning("Failed to initialize VoiceBackendClient: " + e.getMessage());
        }

        // Register Command & Events
        if (getCommand("voice") != null) {
            getCommand("voice").setExecutor(new VoiceCommand(tokenManager, webClientUrl));
        }
        getServer().getPluginManager().registerEvents(this, this);

        // Schedule Telemetry Streaming
        long periodTicks = Math.max(1L, 20L / tickRateHz);
        this.telemetryTask = Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> {
            if (voiceBackendClient != null && voiceBackendClient.isOpen()) {
                SpatialTelemetryBatch batch = telemetryCollector.collectBatch(Bukkit.getOnlinePlayers());
                voiceBackendClient.sendTelemetry(batch);
            }
        }, periodTicks, periodTicks);

        // Schedule In-game visual speech indicators on main thread
        this.visualTask = Bukkit.getScheduler().runTaskTimer(this, () -> {
            speechFeedbackHandler.renderVisualIndicators();
        }, 5L, 5L);

        getLogger().info("VoiceEngine plugin enabled successfully!");
    }

    @Override
    public void onDisable() {
        if (telemetryTask != null) {
            telemetryTask.cancel();
        }
        if (visualTask != null) {
            visualTask.cancel();
        }
        if (voiceBackendClient != null) {
            voiceBackendClient.shutdown();
        }
        if (speechFeedbackHandler != null) {
            speechFeedbackHandler.clear();
        }
        getLogger().info("VoiceEngine plugin disabled.");
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        if (getConfig().getBoolean("notify-on-join", true)) {
            Bukkit.getScheduler().runTaskLater(this, () -> {
                if (event.getPlayer().isOnline()) {
                    event.getPlayer().sendMessage(
                        Component.text()
                            .append(Component.text("[VoiceEngine] ", NamedTextColor.AQUA, TextDecoration.BOLD))
                            .append(Component.text("Proximity voice is active! Type ", NamedTextColor.GRAY))
                            .append(Component.text("/voice", NamedTextColor.YELLOW, TextDecoration.UNDERLINED)
                                .clickEvent(ClickEvent.runCommand("/voice")))
                            .append(Component.text(" to join.", NamedTextColor.GRAY))
                            .build()
                    );
                }
            }, 40L); // 2 seconds after join
        }
    }

    public TokenManager getTokenManager() {
        return tokenManager;
    }

    public SpeechFeedbackHandler getSpeechFeedbackHandler() {
        return speechFeedbackHandler;
    }
}
