package com.voiceengine.command;

import com.voiceengine.config.VoiceConfig;
import com.voiceengine.i18n.TranslationService;
import com.voiceengine.update.ReleaseCheckResult;
import com.voiceengine.update.ReleaseInfo;
import com.voiceengine.update.UpdateChecker;
import com.voiceengine.update.UpdateDownloader;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.io.File;
import java.io.StringReader;
import java.net.URI;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class VoiceUpdateCommandTest {

    private UpdateChecker mockChecker;
    private UpdateDownloader mockDownloader;
    private TranslationService translationService;
    private VoiceConfig voiceConfig;
    private CommandSender mockSender;
    private final PlainTextComponentSerializer serializer = PlainTextComponentSerializer.plainText();

    @BeforeEach
    void setUp() {
        mockChecker = mock(UpdateChecker.class);
        mockDownloader = mock(UpdateDownloader.class);
        translationService = new TranslationService();
        mockSender = mock(CommandSender.class);

        YamlConfiguration en = YamlConfiguration.loadConfiguration(new StringReader("""
            prefix_admin: "[VE Admin] "
            command:
              update:
                header: "<prefix_admin>Update Status Header"
                checking: "<prefix_admin>Checking updates"
                available: "<prefix_admin>Update available: <latest> (current: <current>)"
                up_to_date: "<prefix_admin>Up to date: <current>"
                check_failed: "<prefix_admin>Check failed: <error>"
                downloading: "<prefix_admin>Downloading <latest>"
                download_success: "<prefix_admin>Downloaded <latest> successfully"
                download_failed: "<prefix_admin>Download failed: <error>"
                changelog_header: "<prefix_admin>Changelog for <version>"
                changelog_body: "<changelog>"
            """));
        translationService.registerLocale("en_us", en);

        voiceConfig = new VoiceConfig(
            URI.create("ws://localhost:3000/ws/plugin"),
            "http://localhost:5173",
            "secret",
            10,
            Duration.ofMinutes(5),
            true,
            "en_US"
        );
    }

    @Test
    void testUpdateCheckWhenUpdateAvailable(@TempDir File tempDir) {
        VoiceUpdateCommand command = new VoiceUpdateCommand(
            mockChecker,
            mockDownloader,
            () -> voiceConfig,
            translationService,
            "1.0.0",
            tempDir
        );

        ReleaseInfo releaseInfo = new ReleaseInfo("v1.2.0", "Release 1.2.0", "Fixes", "https://download.url", null);
        ReleaseCheckResult result = ReleaseCheckResult.success(true, "1.0.0", "v1.2.0", releaseInfo);

        when(mockChecker.checkForUpdates(anyString(), anyString(), anyBoolean()))
            .thenReturn(CompletableFuture.completedFuture(result));

        command.onUpdateCheck(mockSender);

        ArgumentCaptor<Component> captor = ArgumentCaptor.forClass(Component.class);
        verify(mockSender, atLeast(2)).sendMessage(captor.capture());

        boolean foundAvailable = captor.getAllValues().stream()
            .map(serializer::serialize)
            .anyMatch(msg -> msg.contains("Update available: v1.2.0"));
        assertTrue(foundAvailable);
    }

    @Test
    void testUpdateCheckWhenUpToDate(@TempDir File tempDir) {
        VoiceUpdateCommand command = new VoiceUpdateCommand(
            mockChecker,
            mockDownloader,
            () -> voiceConfig,
            translationService,
            "1.0.0",
            tempDir
        );

        ReleaseCheckResult result = ReleaseCheckResult.success(false, "1.0.0", "v1.0.0", null);
        when(mockChecker.checkForUpdates(anyString(), anyString(), anyBoolean()))
            .thenReturn(CompletableFuture.completedFuture(result));

        command.onUpdateCheck(mockSender);

        ArgumentCaptor<Component> captor = ArgumentCaptor.forClass(Component.class);
        verify(mockSender, atLeast(2)).sendMessage(captor.capture());

        boolean foundUpToDate = captor.getAllValues().stream()
            .map(serializer::serialize)
            .anyMatch(msg -> msg.contains("Up to date: 1.0.0"));
        assertTrue(foundUpToDate);
    }

    @Test
    void testUpdateApplySuccess(@TempDir File tempDir) {
        VoiceUpdateCommand command = new VoiceUpdateCommand(
            mockChecker,
            mockDownloader,
            () -> voiceConfig,
            translationService,
            "1.0.0",
            tempDir
        );

        ReleaseInfo releaseInfo = new ReleaseInfo("v1.2.0", "Release 1.2.0", "Fixes", "https://download.url", null);
        ReleaseCheckResult result = ReleaseCheckResult.success(true, "1.0.0", "v1.2.0", releaseInfo);

        when(mockChecker.checkForUpdates(anyString(), anyString(), anyBoolean()))
            .thenReturn(CompletableFuture.completedFuture(result));

        File stagedJar = new File(tempDir, "VoiceEngine-paper.jar");
        when(mockDownloader.downloadAndStage(any(ReleaseInfo.class), any(File.class)))
            .thenReturn(CompletableFuture.completedFuture(stagedJar));

        command.onUpdateApply(mockSender);

        ArgumentCaptor<Component> captor = ArgumentCaptor.forClass(Component.class);
        verify(mockSender, atLeast(2)).sendMessage(captor.capture());

        boolean foundSuccess = captor.getAllValues().stream()
            .map(serializer::serialize)
            .anyMatch(msg -> msg.contains("Downloaded v1.2.0 successfully"));
        assertTrue(foundSuccess);
    }

    @Test
    void testUpdateChangelog(@TempDir File tempDir) {
        VoiceUpdateCommand command = new VoiceUpdateCommand(
            mockChecker,
            mockDownloader,
            () -> voiceConfig,
            translationService,
            "1.0.0",
            tempDir
        );

        ReleaseInfo releaseInfo = new ReleaseInfo("v1.2.0", "Release 1.2.0", "Audio latency improvements", "https://download.url", null);
        ReleaseCheckResult result = ReleaseCheckResult.success(true, "1.0.0", "v1.2.0", releaseInfo);

        when(mockChecker.checkForUpdates(anyString(), anyString(), anyBoolean()))
            .thenReturn(CompletableFuture.completedFuture(result));

        command.onUpdateChangelog(mockSender);

        ArgumentCaptor<Component> captor = ArgumentCaptor.forClass(Component.class);
        verify(mockSender, atLeast(2)).sendMessage(captor.capture());

        boolean foundHeader = captor.getAllValues().stream()
            .map(serializer::serialize)
            .anyMatch(msg -> msg.contains("Changelog for v1.2.0"));
        boolean foundBody = captor.getAllValues().stream()
            .map(serializer::serialize)
            .anyMatch(msg -> msg.contains("Audio latency improvements"));

        assertTrue(foundHeader);
        assertTrue(foundBody);
    }
}
