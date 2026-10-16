package com.voiceengine.command;

import com.voiceengine.config.VoiceConfig;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.update.ReleaseCheckResult;
import com.voiceengine.update.UpdateChecker;
import com.voiceengine.update.UpdateDownloader;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.command.CommandSender;
import org.incendo.cloud.annotations.Command;
import org.incendo.cloud.annotations.CommandDescription;
import org.incendo.cloud.annotations.Permission;

import java.io.File;
import java.util.function.Supplier;

public class VoiceUpdateCommand {
    private final UpdateChecker updateChecker;
    private final UpdateDownloader updateDownloader;
    private final Supplier<VoiceConfig> configSupplier;
    private final TranslationService translationService;
    private final String currentVersion;
    private final File updateFolder;

    public VoiceUpdateCommand(
        UpdateChecker updateChecker,
        UpdateDownloader updateDownloader,
        Supplier<VoiceConfig> configSupplier,
        TranslationService translationService,
        String currentVersion,
        File updateFolder
    ) {
        this.updateChecker = updateChecker;
        this.updateDownloader = updateDownloader;
        this.configSupplier = configSupplier;
        this.translationService = translationService;
        this.currentVersion = currentVersion;
        this.updateFolder = updateFolder;
    }

    @Command("voice|ve|voiceengine|audio update check")
    @Permission("voiceengine.admin.update")
    @CommandDescription("Check for VoiceEngine updates from GitHub")
    public void onUpdateCheck(CommandSender sender) {
        translationService.send(sender, "command.update.checking");
        VoiceConfig config = configSupplier.get();

        updateChecker.checkForUpdates(config.updatesRepository(), currentVersion, true)
            .thenAccept(result -> {
                if (result.errorMessage() != null) {
                    translationService.send(sender, "command.update.check_failed",
                        Placeholder.parsed("error", result.errorMessage())
                    );
                    return;
                }

                if (result.updateAvailable()) {
                    translationService.send(sender, "command.update.available",
                        Placeholder.parsed("latest", result.latestVersion() != null ? result.latestVersion() : "unknown"),
                        Placeholder.parsed("current", currentVersion)
                    );
                } else {
                    translationService.send(sender, "command.update.up_to_date",
                        Placeholder.parsed("current", currentVersion)
                    );
                }
            })
            .exceptionally(ex -> {
                translationService.send(sender, "command.update.check_failed",
                    Placeholder.parsed("error", ex.getMessage() != null ? ex.getMessage() : "Unknown error")
                );
                return null;
            });
    }

    @Command("voice|ve|voiceengine|audio update apply")
    @Permission("voiceengine.admin.update")
    @CommandDescription("Download and stage VoiceEngine update into plugins/update/")
    public void onUpdateApply(CommandSender sender) {
        translationService.send(sender, "command.update.checking");
        VoiceConfig config = configSupplier.get();

        updateChecker.checkForUpdates(config.updatesRepository(), currentVersion, false)
            .thenCompose(result -> {
                if (result.errorMessage() != null) {
                    translationService.send(sender, "command.update.check_failed",
                        Placeholder.parsed("error", result.errorMessage())
                    );
                    return java.util.concurrent.CompletableFuture.completedFuture(null);
                }

                if (!result.updateAvailable()) {
                    translationService.send(sender, "command.update.up_to_date",
                        Placeholder.parsed("current", currentVersion)
                    );
                    return java.util.concurrent.CompletableFuture.completedFuture(null);
                }

                String latestTag = result.latestVersion() != null ? result.latestVersion() : "latest";
                translationService.send(sender, "command.update.downloading",
                    Placeholder.parsed("latest", latestTag)
                );

                return updateDownloader.downloadAndStage(result.releaseInfo(), updateFolder)
                    .thenAccept(targetFile -> {
                        translationService.send(sender, "command.update.download_success",
                            Placeholder.parsed("latest", latestTag)
                        );
                    });
            })
            .exceptionally(ex -> {
                translationService.send(sender, "command.update.download_failed",
                    Placeholder.parsed("error", ex.getMessage() != null ? ex.getMessage() : "Download failed")
                );
                return null;
            });
    }

    @Command("voice|ve|voiceengine|audio update changelog")
    @Permission("voiceengine.admin.update")
    @CommandDescription("View VoiceEngine release changelog")
    public void onUpdateChangelog(CommandSender sender) {
        VoiceConfig config = configSupplier.get();

        updateChecker.checkForUpdates(config.updatesRepository(), currentVersion, false)
            .thenAccept(result -> {
                if (result.errorMessage() != null) {
                    translationService.send(sender, "command.update.check_failed",
                        Placeholder.parsed("error", result.errorMessage())
                    );
                    return;
                }

                String version = result.latestVersion() != null ? result.latestVersion() : currentVersion;
                String body = result.releaseInfo() != null && result.releaseInfo().body() != null && !result.releaseInfo().body().isBlank()
                    ? result.releaseInfo().body()
                    : "No release notes provided for this version.";

                // Limit body length to prevent chat overflow
                if (body.length() > 500) {
                    body = body.substring(0, 497) + "...";
                }

                translationService.send(sender, "command.update.changelog_header",
                    Placeholder.parsed("version", version)
                );
                translationService.send(sender, "command.update.changelog_body",
                    Placeholder.parsed("changelog", body)
                );
            })
            .exceptionally(ex -> {
                translationService.send(sender, "command.update.check_failed",
                    Placeholder.parsed("error", ex.getMessage() != null ? ex.getMessage() : "Unknown error")
                );
                return null;
            });
    }
}
