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
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.UUID;

public class VoiceEnginePlugin extends JavaPlugin implements Listener {
    private VoiceConfig voiceConfig;
    private TranslationService translationService;
    private TokenManager tokenManager;
    private SpeechFeedbackHandler speechFeedbackHandler;
    private TelemetryCollector telemetryCollector;
    private VoiceBackendClient voiceBackendClient;

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

        // 3. Connect to Voice Server Backend
        initVoiceBackendClient();

        // 4. Register Public API
        this.api = new VoiceEngineAPIImpl(tokenManager, speechFeedbackHandler, () -> voiceBackendClient);
        VoiceEngine.setApi(this.api);
        getServer().getServicesManager().register(VoiceEngineAPI.class, this.api, this, ServicePriority.Normal);

        // 5. Initialize Schedulers / Services
        this.telemetryService = new TelemetryService(this, telemetryCollector, () -> voiceBackendClient, voiceConfig.tickRateHz());
        this.telemetryService.start();

        this.visualFeedbackService = new VisualFeedbackService(this, speechFeedbackHandler);
        this.visualFeedbackService.start();

        // 6. Initialize Commands via Incendo Cloud v2
        this.commandService = new CommandService(this, translationService);
        this.commandService.initialize();
        this.commandService.registerCommands(new VoiceCommands(
            tokenManager,
            () -> voiceConfig,
            () -> voiceBackendClient,
            translationService,
            token -> {
                if (voiceBackendClient != null && voiceBackendClient.isOpen()) {
                    voiceBackendClient.registerToken(token);
                }
            },
            this::reloadPlugin
        ));

        // 7. Register Bukkit Events
        getServer().getPluginManager().registerEvents(this, this);

        getLogger().info("VoiceEngine plugin enabled successfully!");
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
        getServer().getServicesManager().unregisterAll(this);
        VoiceEngine.setApi(null);

        getLogger().info("VoiceEngine plugin disabled.");
    }

    public void reloadPlugin() {
        reloadConfig();
        this.voiceConfig = VoiceConfig.fromConfiguration(getConfig());
        this.translationService.load(getDataFolder(), voiceConfig.defaultLocale());

        if (telemetryService != null) {
            telemetryService.updateTickRate(voiceConfig.tickRateHz());
        }

        // Reconnect backend client if URI or secret changed
        if (voiceBackendClient == null || !voiceBackendClient.getURI().equals(voiceConfig.voiceServerUri())) {
            if (voiceBackendClient != null) {
                voiceBackendClient.shutdown();
            }
            initVoiceBackendClient();
        }

        getLogger().info("VoiceEngine configuration and translations reloaded.");
    }

    private void initVoiceBackendClient() {
        try {
            this.voiceBackendClient = new VoiceBackendClient(
                voiceConfig.voiceServerUri(),
                voiceConfig.secretKey(),
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
        if (voiceConfig != null && voiceConfig.notifyOnJoin()) {
            Bukkit.getScheduler().runTaskLater(this, () -> {
                if (event.getPlayer().isOnline()) {
                    translationService.send(event.getPlayer(), "notification.join");
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
