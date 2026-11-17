package com.voiceengine.velocity.command;

import com.velocitypowered.api.command.CommandSource;
import com.voiceengine.velocity.config.VelocityVoiceConfig;
import com.voiceengine.velocity.update.UpdateChecker;
import com.voiceengine.velocity.update.UpdateDownloader;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.incendo.cloud.annotations.Command;
import org.incendo.cloud.annotations.CommandDescription;
import org.incendo.cloud.annotations.Permission;

import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

/**
 * Proxy-side update commands for VoiceEngine-Velocity.
 */
public class VelocityUpdateCommands {
    private static final MiniMessage MINI_MESSAGE = MiniMessage.miniMessage();
    private static final String PREFIX = "<gradient:#6366f1:#a855f7><bold>[VoiceEngine Admin]</bold></gradient> ";

    private final UpdateChecker updateChecker;
    private final UpdateDownloader updateDownloader;
    private final Supplier<VelocityVoiceConfig> configSupplier;
    private final String currentVersion;
    private final Path updateFolder;

    public VelocityUpdateCommands(
        UpdateChecker updateChecker,
        UpdateDownloader updateDownloader,
        Supplier<VelocityVoiceConfig> configSupplier,
        String currentVersion,
        Path updateFolder
    ) {
        this.updateChecker = updateChecker;
        this.updateDownloader = updateDownloader;
        this.configSupplier = configSupplier;
        this.currentVersion = currentVersion;
        this.updateFolder = updateFolder;
    }

    @Command("voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity update check")
    @Permission("voiceengine.admin.update")
    @CommandDescription("Check for VoiceEngine Velocity updates from GitHub")
    public void onUpdateCheck(CommandSource source) {
        source.sendMessage(MINI_MESSAGE.deserialize(PREFIX + "<yellow>Checking for VoiceEngine-Velocity updates...</yellow>"));
        VelocityVoiceConfig config = configSupplier.get();

        updateChecker.checkForUpdates(config.updatesRepository(), currentVersion, true)
            .thenAccept(result -> {
                if (result.errorMessage() != null) {
                    source.sendMessage(MINI_MESSAGE.deserialize(
                        PREFIX + "<red>Failed to check for updates: <error></red>",
                        Placeholder.parsed("error", result.errorMessage())
                    ));
                    return;
                }

                if (result.updateAvailable()) {
                    source.sendMessage(MINI_MESSAGE.deserialize(
                        PREFIX + "<green>Update available!</green> <gray>Current:</gray> <yellow><current></yellow> <gray>-> Latest:</gray> <aqua><latest></aqua> " +
                        "<click:run_command:'/voice-velocity update apply'><hover:show_text:'<green>Click to download and stage update</green>'><underlined><green>[Apply Update]</green></underlined></hover></click>",
                        Placeholder.parsed("current", currentVersion),
                        Placeholder.parsed("latest", result.latestVersion() != null ? result.latestVersion() : "unknown")
                    ));
                } else {
                    source.sendMessage(MINI_MESSAGE.deserialize(
                        PREFIX + "<green>VoiceEngine-Velocity is up to date (<yellow><current></yellow>).</green>",
                        Placeholder.parsed("current", currentVersion)
                    ));
                }
            })
            .exceptionally(ex -> {
                source.sendMessage(MINI_MESSAGE.deserialize(
                    PREFIX + "<red>Failed to check for updates: <error></red>",
                    Placeholder.parsed("error", ex.getMessage() != null ? ex.getMessage() : "Unknown error")
                ));
                return null;
            });
    }

    @Command("voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity update apply")
    @Permission("voiceengine.admin.update")
    @CommandDescription("Download, verify, and stage VoiceEngine Velocity update")
    public void onUpdateApply(CommandSource source) {
        source.sendMessage(MINI_MESSAGE.deserialize(PREFIX + "<yellow>Checking for VoiceEngine-Velocity updates...</yellow>"));
        VelocityVoiceConfig config = configSupplier.get();

        updateChecker.checkForUpdates(config.updatesRepository(), currentVersion, false)
            .thenCompose(result -> {
                if (result.errorMessage() != null) {
                    source.sendMessage(MINI_MESSAGE.deserialize(
                        PREFIX + "<red>Failed to check for updates: <error></red>",
                        Placeholder.parsed("error", result.errorMessage())
                    ));
                    return CompletableFuture.completedFuture(null);
                }

                if (!result.updateAvailable()) {
                    source.sendMessage(MINI_MESSAGE.deserialize(
                        PREFIX + "<green>VoiceEngine-Velocity is already up to date (<yellow><current></yellow>).</green>",
                        Placeholder.parsed("current", currentVersion)
                    ));
                    return CompletableFuture.completedFuture(null);
                }

                String latestTag = result.latestVersion() != null ? result.latestVersion() : "latest";
                source.sendMessage(MINI_MESSAGE.deserialize(
                    PREFIX + "<yellow>Downloading VoiceEngine-Velocity <latest> asynchronously...</yellow>",
                    Placeholder.parsed("latest", latestTag)
                ));

                return updateDownloader.downloadAndStage(result.releaseInfo(), updateFolder)
                    .thenAccept(targetPath -> source.sendMessage(MINI_MESSAGE.deserialize(
                        PREFIX + "<green>VoiceEngine-Velocity <latest> staged at <white><path></white>! Restart the proxy to apply the update.</green>",
                        Placeholder.parsed("latest", latestTag),
                        Placeholder.parsed("path", targetPath.toString())
                    )));
            })
            .exceptionally(ex -> {
                String msg = ex.getCause() != null && ex.getCause().getMessage() != null
                    ? ex.getCause().getMessage()
                    : (ex.getMessage() != null ? ex.getMessage() : "Download failed");
                source.sendMessage(MINI_MESSAGE.deserialize(
                    PREFIX + "<red>Failed to download update: <error></red>",
                    Placeholder.parsed("error", msg)
                ));
                return null;
            });
    }

    @Command("voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity update changelog")
    @Permission("voiceengine.admin.update")
    @CommandDescription("View VoiceEngine release changelog")
    public void onUpdateChangelog(CommandSource source) {
        VelocityVoiceConfig config = configSupplier.get();

        updateChecker.checkForUpdates(config.updatesRepository(), currentVersion, false)
            .thenAccept(result -> {
                if (result.errorMessage() != null) {
                    source.sendMessage(MINI_MESSAGE.deserialize(
                        PREFIX + "<red>Failed to check for updates: <error></red>",
                        Placeholder.parsed("error", result.errorMessage())
                    ));
                    return;
                }

                String version = result.latestVersion() != null ? result.latestVersion() : currentVersion;
                String body = result.releaseInfo() != null && result.releaseInfo().body() != null && !result.releaseInfo().body().isBlank()
                    ? result.releaseInfo().body()
                    : "No release notes provided for this version.";

                if (body.length() > 500) {
                    body = body.substring(0, 497) + "...";
                }

                source.sendMessage(MINI_MESSAGE.deserialize(
                    PREFIX + "<gold>--- Changelog for <version> ---</gold>",
                    Placeholder.parsed("version", version)
                ));
                source.sendMessage(MINI_MESSAGE.deserialize(
                    "<gray><changelog></gray>",
                    Placeholder.parsed("changelog", body)
                ));
            })
            .exceptionally(ex -> {
                source.sendMessage(MINI_MESSAGE.deserialize(
                    PREFIX + "<red>Failed to fetch changelog: <error></red>",
                    Placeholder.parsed("error", ex.getMessage() != null ? ex.getMessage() : "Unknown error")
                ));
                return null;
            });
    }
}
