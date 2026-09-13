package com.voiceengine.velocity;

import com.google.inject.Inject;
import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.PluginContainer;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.ProxyServer;
import com.voiceengine.velocity.auth.VelocityTokenManager;
import com.voiceengine.velocity.command.VelocityVoiceCommands;
import com.voiceengine.velocity.config.VelocityVoiceConfig;
import com.voiceengine.velocity.listener.DisconnectListener;
import com.voiceengine.velocity.listener.ServerPostConnectListener;
import com.voiceengine.velocity.net.VelocityBackendClient;
import org.incendo.cloud.SenderMapper;
import org.incendo.cloud.annotations.AnnotationParser;
import org.incendo.cloud.execution.ExecutionCoordinator;
import org.incendo.cloud.velocity.VelocityCommandManager;
import org.slf4j.Logger;

import java.nio.file.Path;

@Plugin(
    id = "voiceengine-velocity",
    name = "VoiceEngine-Velocity",
    version = "1.0.0-SNAPSHOT",
    description = "VoiceEngine Velocity Proxy Voice Integration",
    authors = {"VoiceEngine"}
)
public class VoiceEngineVelocityPlugin {
    private final ProxyServer server;
    private final Logger logger;
    private final Path dataDirectory;
    private final PluginContainer pluginContainer;

    private VelocityVoiceConfig voiceConfig;
    private VelocityTokenManager tokenManager;
    private VelocityBackendClient backendClient;
    private ServerPostConnectListener postConnectListener;
    private com.voiceengine.velocity.moderation.ModerationDatabase moderationDatabase;
    private com.voiceengine.velocity.moderation.VelocityModerationService moderationService;

    @Inject
    public VoiceEngineVelocityPlugin(
        ProxyServer server,
        Logger logger,
        @DataDirectory Path dataDirectory,
        PluginContainer pluginContainer
    ) {
        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
        this.pluginContainer = pluginContainer;
    }

    @Subscribe
    public void onProxyInitialization(ProxyInitializeEvent event) {
        // 1. Load configuration
        this.voiceConfig = VelocityVoiceConfig.load(dataDirectory, logger);

        // 2. Initialize token manager (5 min TTL, 6 chars)
        this.tokenManager = new VelocityTokenManager(voiceConfig.tokenTtl(), 6);

        // 3. Initialize Moderation Database & Service
        try {
            this.moderationDatabase = new com.voiceengine.velocity.moderation.ModerationDatabase(dataDirectory.resolve("moderation.db").toFile());
            this.moderationDatabase.init();
            this.moderationService = new com.voiceengine.velocity.moderation.VelocityModerationService(
                moderationDatabase,
                () -> backendClient,
                logger
            );
        } catch (Exception e) {
            logger.error("Failed to initialize ModerationDatabase: {}", e.getMessage(), e);
        }

        // 4. Connect to Voice Server backend
        initBackendClient();

        // 5. Register Listeners
        this.postConnectListener = new ServerPostConnectListener(() -> voiceConfig, () -> backendClient);
        server.getEventManager().register(this, postConnectListener);
        server.getEventManager().register(this, new DisconnectListener(postConnectListener, () -> backendClient));

        // 6. Initialize Commands via Incendo Cloud Velocity
        try {
            VelocityCommandManager<CommandSource> commandManager = new VelocityCommandManager<>(
                pluginContainer,
                server,
                ExecutionCoordinator.simpleCoordinator(),
                SenderMapper.identity()
            );

            AnnotationParser<CommandSource> annotationParser = new AnnotationParser<>(
                commandManager,
                CommandSource.class
            );

            annotationParser.parse(new VelocityVoiceCommands(
                tokenManager,
                () -> voiceConfig,
                () -> backendClient,
                token -> {
                    if (backendClient != null && backendClient.isOpen()) {
                        backendClient.registerToken(token);
                    }
                },
                this::reloadPlugin,
                moderationService
            ));

            if (moderationService != null) {
                annotationParser.parse(new com.voiceengine.velocity.command.VelocityModerationCommands(
                    server,
                    moderationService
                ));
            }
        } catch (Exception e) {
            logger.error("Failed to initialize Cloud Velocity command manager: {}", e.getMessage(), e);
        }

        logger.info("VoiceEngine Velocity proxy plugin enabled successfully!");
    }

    @Subscribe
    public void onProxyShutdown(ProxyShutdownEvent event) {
        if (backendClient != null) {
            backendClient.shutdown();
        }
        if (moderationDatabase != null) {
            moderationDatabase.close();
        }
        logger.info("VoiceEngine Velocity proxy plugin disabled.");
    }

    public void reloadPlugin() {
        this.voiceConfig = VelocityVoiceConfig.load(dataDirectory, logger);

        boolean uriChanged = backendClient == null || !backendClient.getURI().equals(voiceConfig.voiceServerUri());
        boolean secretChanged = backendClient == null || !backendClient.getSecretKey().equals(voiceConfig.secretKey());

        if (uriChanged || secretChanged) {
            if (backendClient != null) {
                backendClient.shutdown();
            }
            initBackendClient();
        }

        if (tokenManager != null) {
            tokenManager.setTokenTtl(voiceConfig.tokenTtl());
        }

        logger.info("VoiceEngine Velocity configuration reloaded.");
    }

    private void initBackendClient() {
        try {
            this.backendClient = new VelocityBackendClient(
                voiceConfig.voiceServerUri(),
                voiceConfig.secretKey(),
                logger
            );
            if (moderationService != null) {
                this.backendClient.setOnConnected(() -> moderationService.syncToBackend(backendClient));
            }
            this.backendClient.connect();
        } catch (Exception e) {
            logger.warn("Failed to initialize VelocityBackendClient: {}", e.getMessage());
        }
    }

    public VelocityVoiceConfig getVoiceConfig() {
        return voiceConfig;
    }

    public VelocityTokenManager getTokenManager() {
        return tokenManager;
    }

    public VelocityBackendClient getBackendClient() {
        return backendClient;
    }

    public com.voiceengine.velocity.moderation.VelocityModerationService getModerationService() {
        return moderationService;
    }
}
