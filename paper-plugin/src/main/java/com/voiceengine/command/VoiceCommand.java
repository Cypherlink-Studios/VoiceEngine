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

public class VoiceCommand implements CommandExecutor {
    private final TokenManager tokenManager;
    private final String webClientBaseUrl;

    public VoiceCommand(TokenManager tokenManager, String webClientBaseUrl) {
        this.tokenManager = tokenManager;
        this.webClientBaseUrl = webClientBaseUrl.endsWith("/") 
            ? webClientBaseUrl.substring(0, webClientBaseUrl.length() - 1) 
            : webClientBaseUrl;
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

        if (!player.hasPermission("voiceengine.use")) {
            player.sendMessage(Component.text("You do not have permission to use VoiceEngine.", NamedTextColor.RED));
            return true;
        }

        SessionToken sessionToken = tokenManager.generateToken(player.getUniqueId(), player.getName());
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
