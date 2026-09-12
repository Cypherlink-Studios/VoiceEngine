package com.voiceengine.command;

import com.voiceengine.i18n.TranslationService;
import com.voiceengine.service.VoiceEngineService;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.plugin.Plugin;
import org.incendo.cloud.annotations.AnnotationParser;
import org.incendo.cloud.exception.InvalidSyntaxException;
import org.incendo.cloud.exception.NoPermissionException;
import org.incendo.cloud.execution.ExecutionCoordinator;
import org.incendo.cloud.paper.PaperCommandManager;

public class CommandService implements VoiceEngineService {
    private final Plugin plugin;
    private final TranslationService translationService;
    private PaperCommandManager<CommandSourceStack> commandManager;
    private AnnotationParser<CommandSourceStack> annotationParser;

    public CommandService(Plugin plugin, TranslationService translationService) {
        this.plugin = plugin;
        this.translationService = translationService;
    }

    public void initialize() {
        this.commandManager = PaperCommandManager.builder()
            .executionCoordinator(ExecutionCoordinator.simpleCoordinator())
            .buildOnEnable(plugin);

        this.commandManager.exceptionController().registerHandler(NoPermissionException.class, ctx -> {
            translationService.send(ctx.context().sender().getSender(), "command.connect.no_permission");
        });

        this.commandManager.exceptionController().registerHandler(InvalidSyntaxException.class, ctx -> {
            translationService.send(ctx.context().sender().getSender(), "error.invalid_syntax",
                Placeholder.parsed("syntax", ctx.exception().correctSyntax()));
        });

        this.annotationParser = new AnnotationParser<>(this.commandManager, CommandSourceStack.class);
    }

    public void registerCommands(Object... commandHolders) {
        if (annotationParser != null) {
            for (Object holder : commandHolders) {
                annotationParser.parse(holder);
            }
        }
    }

    public PaperCommandManager<CommandSourceStack> getCommandManager() {
        return commandManager;
    }

    public AnnotationParser<CommandSourceStack> getAnnotationParser() {
        return annotationParser;
    }
}
