package com.voiceengine.command;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.net.VoiceBackendClient;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.incendo.cloud.annotations.Argument;
import org.incendo.cloud.annotations.Command;
import org.incendo.cloud.annotations.CommandDescription;
import org.incendo.cloud.annotations.Permission;
import org.incendo.cloud.annotations.suggestion.Suggestions;
import org.incendo.cloud.context.CommandContext;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import java.util.function.Supplier;

public class RoomCommands {
    private final Supplier<VoiceBackendClient> clientSupplier;
    private final TranslationService translationService;
    private final ConcurrentHashMap<String, Consumer<JsonObject>> pendingRequests = new ConcurrentHashMap<>();
    private final List<String> cachedRoomPlayers = new CopyOnWriteArrayList<>();

    public RoomCommands(Supplier<VoiceBackendClient> clientSupplier, TranslationService translationService) {
        this.clientSupplier = clientSupplier;
        this.translationService = translationService;
    }

    public void handleBackendResponse(JsonObject response) {
        if (response.has("requestId")) {
            String reqId = response.get("requestId").getAsString();
            Consumer<JsonObject> callback = pendingRequests.remove(reqId);
            if (callback != null) {
                callback.accept(response);
            }
        }
        if (response.has("type") && "room_players_response".equals(response.get("type").getAsString()) && response.has("players")) {
            cachedRoomPlayers.clear();
            for (JsonElement elem : response.getAsJsonArray("players")) {
                cachedRoomPlayers.add(elem.getAsString());
            }
        }
    }

    @Suggestions("roomPlayers")
    public List<String> suggestRoomPlayers(CommandContext<CommandSender> context, String input) {
        VoiceBackendClient client = clientSupplier.get();
        if (client != null && client.isOpen()) {
            JsonObject query = new JsonObject();
            query.addProperty("type", "query_room_players");
            query.addProperty("requestId", "query-" + System.currentTimeMillis());
            client.sendRoomCommand(query);
        }
        if (cachedRoomPlayers.isEmpty()) {
            try {
                if (Bukkit.getServer() == null) return List.of();
                return Bukkit.getOnlinePlayers().stream().map(Player::getName).toList();
            } catch (Exception e) {
                return List.of();
            }
        }
        return cachedRoomPlayers;
    }

    @Suggestions("onlinePlayers")
    public List<String> suggestOnlinePlayers(CommandContext<CommandSender> context, String input) {
        try {
            if (Bukkit.getServer() == null) return List.of();
            return Bukkit.getOnlinePlayers().stream().map(Player::getName).toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    @Command("voice|ve|voiceengine|audio room create")
    @Permission("voiceengine.room.create")
    @CommandDescription("Create a temporary private audio room")
    public void onRoomCreate(Player player) {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client == null || !client.isOpen()) {
            translationService.send(player, "command.connect.backend_offline");
            return;
        }

        String reqId = UUID.randomUUID().toString();
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "create");
        cmd.addProperty("requestId", reqId);
        cmd.addProperty("playerUuid", player.getUniqueId().toString());
        cmd.addProperty("username", player.getName());

        pendingRequests.put(reqId, resp -> {
            boolean success = resp.has("success") && resp.get("success").getAsBoolean();
            if (success) {
                String pin = resp.get("pin").getAsString();
                translationService.send(player, "command.room.created", Placeholder.parsed("pin", pin));
            } else {
                String error = resp.has("message") ? resp.get("message").getAsString() : "Failed to create room";
                translationService.send(player, "command.room.error", Placeholder.parsed("error", error));
            }
        });

        client.sendRoomCommand(cmd);
    }

    @Command("voice|ve|voiceengine|audio room join <pin>")
    @Permission("voiceengine.room.join")
    @CommandDescription("Join a temporary private audio room using a 6-digit PIN")
    public void onRoomJoin(Player player, @Argument("pin") String pin) {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client == null || !client.isOpen()) {
            translationService.send(player, "command.connect.backend_offline");
            return;
        }

        String reqId = UUID.randomUUID().toString();
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "join");
        cmd.addProperty("requestId", reqId);
        cmd.addProperty("playerUuid", player.getUniqueId().toString());
        cmd.addProperty("username", player.getName());
        cmd.addProperty("pin", pin);

        pendingRequests.put(reqId, resp -> {
            boolean success = resp.has("success") && resp.get("success").getAsBoolean();
            if (success) {
                String joinedPin = resp.get("pin").getAsString();
                translationService.send(player, "command.room.joined", Placeholder.parsed("pin", joinedPin));
            } else {
                String error = resp.has("message") ? resp.get("message").getAsString() : "Invalid PIN or room full";
                translationService.send(player, "command.room.error", Placeholder.parsed("error", error));
            }
        });

        client.sendRoomCommand(cmd);
    }

    @Command("voice|ve|voiceengine|audio room leave")
    @Permission("voiceengine.room.leave")
    @CommandDescription("Leave your current temporary private audio room")
    public void onRoomLeave(Player player) {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client == null || !client.isOpen()) {
            translationService.send(player, "command.connect.backend_offline");
            return;
        }

        String reqId = UUID.randomUUID().toString();
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "leave");
        cmd.addProperty("requestId", reqId);
        cmd.addProperty("playerUuid", player.getUniqueId().toString());

        pendingRequests.put(reqId, resp -> {
            translationService.send(player, "command.room.left");
        });

        client.sendRoomCommand(cmd);
    }

    @Command("voice|ve|voiceengine|audio room kick <player>")
    @Permission("voiceengine.room.kick")
    @CommandDescription("Kick a player from your temporary private audio room")
    public void onRoomKick(Player player, @Argument(value = "player", suggestions = "onlinePlayers") String targetPlayer) {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client == null || !client.isOpen()) {
            translationService.send(player, "command.connect.backend_offline");
            return;
        }

        String reqId = UUID.randomUUID().toString();
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "kick");
        cmd.addProperty("requestId", reqId);
        cmd.addProperty("ownerUuid", player.getUniqueId().toString());
        cmd.addProperty("targetUsername", targetPlayer);

        pendingRequests.put(reqId, resp -> {
            boolean success = resp.has("success") && resp.get("success").getAsBoolean();
            if (success) {
                translationService.send(player, "command.room.kick_success", Placeholder.parsed("player", targetPlayer));
            } else {
                String error = resp.has("message") ? resp.get("message").getAsString() : "Kick failed";
                translationService.send(player, "command.room.error", Placeholder.parsed("error", error));
            }
        });

        client.sendRoomCommand(cmd);
    }

    @Command("voice|ve|voiceengine|audio room spy <playerName>")
    @Permission("voiceengine.admin.room.spy")
    @CommandDescription("Covertly wiretap a temporary room occupied by a player")
    public void onRoomSpy(Player player, @Argument(value = "playerName", suggestions = "roomPlayers") String targetPlayer) {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        if (client == null || !client.isOpen()) {
            translationService.send(player, "command.connect.backend_offline");
            return;
        }

        String reqId = UUID.randomUUID().toString();
        JsonObject cmd = new JsonObject();
        cmd.addProperty("action", "spy");
        cmd.addProperty("requestId", reqId);
        cmd.addProperty("staffUuid", player.getUniqueId().toString());
        cmd.addProperty("staffUsername", player.getName());
        cmd.addProperty("targetPlayer", targetPlayer);

        pendingRequests.put(reqId, resp -> {
            boolean success = resp.has("success") && resp.get("success").getAsBoolean();
            if (success) {
                translationService.send(player, "command.room.spy_joined", Placeholder.parsed("player", targetPlayer));
            } else {
                String error = resp.has("message") ? resp.get("message").getAsString() : "Spy failed";
                translationService.send(player, "command.room.error", Placeholder.parsed("error", error));
            }
        });

        client.sendRoomCommand(cmd);
    }
}
