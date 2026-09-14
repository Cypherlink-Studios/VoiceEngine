package com.voiceengine.command;

import com.voiceengine.i18n.TranslationService;
import com.voiceengine.service.VoiceEngineService;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.command.CommandSender;
import org.bukkit.plugin.Plugin;
import org.incendo.cloud.annotations.AnnotationParser;
import org.incendo.cloud.bukkit.CloudBukkitCapabilities;
import org.incendo.cloud.exception.InvalidSyntaxException;
import org.incendo.cloud.exception.NoPermissionException;
import org.incendo.cloud.execution.ExecutionCoordinator;
import org.incendo.cloud.paper.LegacyPaperCommandManager;

import java.util.logging.Level;

public class CommandService implements VoiceEngineService {
    private final Plugin plugin;
    private final TranslationService translationService;
    private LegacyPaperCommandManager<CommandSender> commandManager;
    private AnnotationParser<CommandSender> annotationParser;

    public CommandService(Plugin plugin, TranslationService translationService) {
        this.plugin = plugin;
        this.translationService = translationService;
    }

    public void initialize() {
        try {
            this.commandManager = LegacyPaperCommandManager.createNative(
                plugin,
                ExecutionCoordinator.simpleCoordinator()
            );
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Failed to initialize LegacyPaperCommandManager", e);
            throw new RuntimeException(e);
        }

        if (this.commandManager.hasCapability(CloudBukkitCapabilities.NATIVE_BRIGADIER)) {
            try {
                this.commandManager.registerBrigadier();
            } catch (Exception e) {
                plugin.getLogger().warning("Could not register native Brigadier: " + e.getMessage());
            }
        } else if (this.commandManager.hasCapability(CloudBukkitCapabilities.ASYNCHRONOUS_COMPLETION)) {
            try {
                this.commandManager.registerAsynchronousCompletions();
            } catch (Exception e) {
                plugin.getLogger().warning("Could not register async completions: " + e.getMessage());
            }
        }

        this.commandManager.exceptionController().registerHandler(NoPermissionException.class, ctx -> {
            translationService.send(ctx.context().sender(), "command.connect.no_permission");
        });

        this.commandManager.exceptionController().registerHandler(InvalidSyntaxException.class, ctx -> {
            translationService.send(ctx.context().sender(), "error.invalid_syntax",
                Placeholder.parsed("syntax", ctx.exception().correctSyntax()));
        });

        this.annotationParser = new AnnotationParser<>(this.commandManager, CommandSender.class);
    }

    public void registerCommands(Object... commandHolders) {
        if (annotationParser != null) {
            for (Object holder : commandHolders) {
                annotationParser.parse(holder);
            }
        }
    }

    public LegacyPaperCommandManager<CommandSender> getCommandManager() {
        return commandManager;
    }

    public AnnotationParser<CommandSender> getAnnotationParser() {
        return annotationParser;
    }
}
