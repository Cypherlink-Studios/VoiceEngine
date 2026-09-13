package com.voiceengine;

import com.voiceengine.api.VoiceEngine;
import com.voiceengine.api.VoiceEngineAPI;
import com.voiceengine.api.VoiceEngineAPIImpl;
import com.voiceengine.api.event.PlayerSpeakingStateChangeEvent;
import com.voiceengine.auth.TokenManager;
import com.voiceengine.command.CommandService;
import com.voiceengine.command.VoiceCommands;
import com.voiceengine.config.VoiceConfig;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.net.VoiceBackendClient;
import com.voiceengine.service.TelemetryService;
import com.voiceengine.service.VisualFeedbackService;
import com.voiceengine.telemetry.TelemetryCollector;
import com.voiceengine.visual.SpeechFeedbackHandler;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;
import com.voiceengine.command.SpeakerCommands;
import com.voiceengine.speaker.SpeakerManager;

import java.util.UUID;

public class VoiceEnginePlugin extends JavaPlugin implements Listener {
    private VoiceConfig voiceConfig;
    private TranslationService translationService;
    private TokenManager tokenManager;
    private SpeechFeedbackHandler speechFeedbackHandler;
    private TelemetryCollector telemetryCollector;
    private VoiceBackendClient voiceBackendClient;
    private SpeakerManager speakerManager;

    private TelemetryService telemetryService;
    private VisualFeedbackService visualFeedbackService;
    private CommandService commandService;
    private VoiceEngineAPI api;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.voiceConfig = VoiceConfig.fromConfiguration(getConfig());

        // 1. Initialize Localization
        this.translationService = new TranslationService();
        this.translationService.load(getDataFolder(), voiceConfig.defaultLocale());

        // 2. Initialize Core Handlers
        this.tokenManager = new TokenManager(voiceConfig.tokenTtl(), 6);
        this.speechFeedbackHandler = new SpeechFeedbackHandler();
        this.telemetryCollector = new TelemetryCollector();
        this.speakerManager = new SpeakerManager(getDataFolder());
        this.speakerManager.load();

        // 3. Connect to Voice Server Backend
        initVoiceBackendClient();

        // 4. Register Public API
        this.api = new VoiceEngineAPIImpl(tokenManager, speechFeedbackHandler, () -> voiceBackendClient);
        VoiceEngine.setApi(this.api);
        getServer().getServicesManager().register(VoiceEngineAPI.class, this.api, this, ServicePriority.Normal);

        // 5. Initialize Schedulers / Services
        this.telemetryService = new TelemetryService(
            this,
            telemetryCollector,
            () -> voiceBackendClient,
            () -> voiceConfig.serverId(),
            () -> speakerManager.getActiveSpeakerStates(voiceConfig.serverId()),
            voiceConfig.tickRateHz()
        );
        this.telemetryService.start();

        this.visualFeedbackService = new VisualFeedbackService(
            this,
            speechFeedbackHandler,
            () -> speakerManager.renderVisualIndicators(speechFeedbackHandler)
        );
        this.visualFeedbackService.start();

        // 6. Initialize Commands via Incendo Cloud v2
        this.commandService = new CommandService(this, translationService);
        this.commandService.initialize();

        SpeakerCommands speakerCommands = new SpeakerCommands(speakerManager, translationService);
        if (isProxyMode()) {
            getLogger().info("[VoiceEngine] Proxy mode active (server: " + voiceConfig.serverId() + "). Local /voice commands delegated to Velocity.");
            this.commandService.registerCommands(speakerCommands);
        } else {
            this.commandService.registerCommands(
                new VoiceCommands(
                    tokenManager,
                    () -> voiceConfig,
                    () -> voiceBackendClient,
                    translationService,
                    token -> {
                        if (voiceBackendClient != null && voiceBackendClient.isOpen()) {
                            voiceBackendClient.registerToken(token);
                        }
                    },
                    this::reloadPlugin,
                    (token, clientIp) -> {
                        if (voiceBackendClient != null && voiceBackendClient.isOpen()) {
                            voiceBackendClient.registerToken(token, clientIp);
                        }
                    }
                ),
                speakerCommands
            );
        }

        // 7. Register Bukkit Events
        getServer().getPluginManager().registerEvents(this, this);

        getLogger().info("VoiceEngine plugin enabled successfully!");
    }

    public boolean isProxyMode() {
        boolean forwarding = false;
        try {
            forwarding = getServer().spigot().getSpigotConfig().getBoolean("settings.bungeecord", false);
        } catch (Throwable ignored) {
        }
        return voiceConfig != null && voiceConfig.resolveProxyMode(forwarding);
    }

    @Override
    public void onDisable() {
        if (telemetryService != null) {
            telemetryService.stop();
        }
        if (visualFeedbackService != null) {
            visualFeedbackService.stop();
        }
        if (voiceBackendClient != null) {
            voiceBackendClient.shutdown();
        }
        if (speakerManager != null) {
            speakerManager.save();
        }
        getServer().getServicesManager().unregisterAll(this);
        VoiceEngine.setApi(null);

        getLogger().info("VoiceEngine plugin disabled.");
    }

    public void reloadPlugin() {
        reloadConfig();
        this.voiceConfig = VoiceConfig.fromConfiguration(getConfig());
        this.translationService.load(getDataFolder(), voiceConfig.defaultLocale());

        if (tokenManager != null) {
            tokenManager.setTtl(voiceConfig.tokenTtl());
        }

        if (telemetryService != null) {
            telemetryService.updateTickRate(voiceConfig.tickRateHz());
        }

        // Reconnect backend client if URI, secret key, or server identifier changed
        boolean uriChanged = voiceBackendClient == null || !voiceBackendClient.getURI().equals(voiceConfig.voiceServerUri());
        boolean secretChanged = voiceBackendClient == null || !voiceBackendClient.getSecretKey().equals(voiceConfig.secretKey());
        boolean serverIdChanged = voiceBackendClient == null || !voiceBackendClient.getServerId().equals(voiceConfig.serverId());

        if (uriChanged || secretChanged || serverIdChanged) {
            if (voiceBackendClient != null) {
                voiceBackendClient.shutdown();
            }
            initVoiceBackendClient();
        }

        if (speakerManager != null) {
            speakerManager.load();
        }

        getLogger().info("VoiceEngine configuration and translations reloaded.");
    }

    private void initVoiceBackendClient() {
        try {
            this.voiceBackendClient = new VoiceBackendClient(
                voiceConfig.voiceServerUri(),
                voiceConfig.secretKey(),
                voiceConfig.serverId(),
                speechFeedbackHandler,
                this::handleSpeechEvent
            );
            this.voiceBackendClient.connect();
        } catch (Exception e) {
            getLogger().warning("Failed to initialize VoiceBackendClient: " + e.getMessage());
        }
    }

    private void handleSpeechEvent(UUID playerUuid, boolean speaking) {
        Bukkit.getScheduler().runTask(this, () -> {
            Player player = Bukkit.getPlayer(playerUuid);
            PlayerSpeakingStateChangeEvent event = new PlayerSpeakingStateChangeEvent(playerUuid, player, speaking);
            Bukkit.getPluginManager().callEvent(event);
        });
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        if (!isProxyMode() && voiceConfig != null && voiceConfig.notifyOnJoin()) {
            Bukkit.getScheduler().runTaskLater(this, () -> {
                if (event.getPlayer().isOnline()) {
                    translationService.send(event.getPlayer(), "notification.join");
                }
            }, 40L); // 2 seconds after join
        }
    }

    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        if (voiceBackendClient != null && voiceBackendClient.isOpen()) {
            voiceBackendClient.sendPlayerQuit(event.getPlayer().getUniqueId());
        }
    }

    public SpeakerManager getSpeakerManager() {
        return speakerManager;
    }

    public TokenManager getTokenManager() {
        return tokenManager;
    }

    public SpeechFeedbackHandler getSpeechFeedbackHandler() {
        return speechFeedbackHandler;
    }

    public VoiceConfig getVoiceConfig() {
        return voiceConfig;
    }

    public TranslationService getTranslationService() {
        return translationService;
    }

    public VoiceEngineAPI getApi() {
        return api;
    }
}
