package com.voiceengine.command;

import com.voiceengine.auth.SessionToken;
import com.voiceengine.auth.TokenManager;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

public class VoiceCommand implements CommandExecutor {
    private final TokenManager tokenManager;
    private final String webClientBaseUrl;
    private final Consumer<SessionToken> tokenConsumer;
    private final BooleanSupplier isBackendConnected;

    public VoiceCommand(TokenManager tokenManager, String webClientBaseUrl) {
        this(tokenManager, webClientBaseUrl, null, () -> true);
    }

    public VoiceCommand(TokenManager tokenManager, String webClientBaseUrl, Consumer<SessionToken> tokenConsumer) {
        this(tokenManager, webClientBaseUrl, tokenConsumer, () -> true);
    }

    public VoiceCommand(
        TokenManager tokenManager,
        String webClientBaseUrl,
        Consumer<SessionToken> tokenConsumer,
        BooleanSupplier isBackendConnected
    ) {
        this.tokenManager = tokenManager;
        this.webClientBaseUrl = webClientBaseUrl.endsWith("/") 
            ? webClientBaseUrl.substring(0, webClientBaseUrl.length() - 1) 
            : webClientBaseUrl;
        this.tokenConsumer = tokenConsumer;
        this.isBackendConnected = isBackendConnected != null ? isBackendConnected : () -> true;
    }

    @Override
    public boolean onCommand(
        @NotNull CommandSender sender,
        @NotNull Command command,
        @NotNull String label,
        @NotNull String[] args
    ) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("Only players can connect to VoiceEngine.", NamedTextColor.RED));
            return true;
        }

        if (args.length > 0 && args[0].equalsIgnoreCase("admin")) {
            if (!player.hasPermission("voiceengine.admin")) {
                player.sendMessage(Component.text("You do not have permission to access the VoiceEngine admin portal.", NamedTextColor.RED));
                return true;
            }

            if (!isBackendConnected.getAsBoolean()) {
                player.sendMessage(Component.text("[VoiceEngine] Voice backend is offline. Unable to generate admin session.", NamedTextColor.RED));
                return true;
            }

            SessionToken sessionToken = tokenManager.generateToken(player.getUniqueId(), player.getName(), true);
            if (tokenConsumer != null) {
                tokenConsumer.accept(sessionToken);
            }

            String adminUrl = webClientBaseUrl + "/admin?token=" + sessionToken.token();
            Component message = Component.text()
                .append(Component.text("[VoiceEngine Admin] ", NamedTextColor.GOLD, TextDecoration.BOLD))
                .append(Component.text("Click here to open the Admin Portal", NamedTextColor.YELLOW, TextDecoration.UNDERLINED))
                .append(Component.text(" (code: " + sessionToken.token() + ", expires in 5m)", NamedTextColor.GRAY))
                .clickEvent(ClickEvent.openUrl(adminUrl))
                .hoverEvent(HoverEvent.showText(Component.text("Click to open " + adminUrl, NamedTextColor.GOLD)))
                .build();

            player.sendMessage(message);
            return true;
        }

        if (!player.hasPermission("voiceengine.use")) {
            player.sendMessage(Component.text("You do not have permission to use VoiceEngine.", NamedTextColor.RED));
            return true;
        }

        SessionToken sessionToken = tokenManager.generateToken(player.getUniqueId(), player.getName(), false);
        if (tokenConsumer != null) {
            tokenConsumer.accept(sessionToken);
        }

        String connectionUrl = webClientBaseUrl + "/?token=" + sessionToken.token();
        Component message = Component.text()
            .append(Component.text("[VoiceEngine] ", NamedTextColor.AQUA, TextDecoration.BOLD))
            .append(Component.text("Click here to connect your microphone", NamedTextColor.GREEN, TextDecoration.UNDERLINED))
            .append(Component.text(" (code: " + sessionToken.token() + ", expires in 5m)", NamedTextColor.GRAY))
            .clickEvent(ClickEvent.openUrl(connectionUrl))
            .hoverEvent(HoverEvent.showText(Component.text("Click to open " + connectionUrl, NamedTextColor.YELLOW)))
            .build();

        player.sendMessage(message);
        return true;
    }
}
