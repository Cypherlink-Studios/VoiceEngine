package com.voiceengine.update;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UpdateCheckerAndDownloaderTest {

    private HttpClient mockHttpClient;
    private HttpResponse<String> mockStringResponse;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        mockHttpClient = mock(HttpClient.class);
        mockStringResponse = (HttpResponse<String>) mock(HttpResponse.class);
    }

    @Test
    void testVersionComparison() {
        assertTrue(UpdateChecker.isNewerVersion("1.0.0", "v1.1.0"));
        assertTrue(UpdateChecker.isNewerVersion("1.0.0", "v1.0.1"));
        assertTrue(UpdateChecker.isNewerVersion("1.0.0-SNAPSHOT", "v1.0.1"));
        assertTrue(UpdateChecker.isNewerVersion("1.0.0", "v2.0.0"));
        assertTrue(UpdateChecker.isNewerVersion("1.0", "v1.0.1"));

        assertFalse(UpdateChecker.isNewerVersion("1.1.0", "v1.0.0"));
        assertFalse(UpdateChecker.isNewerVersion("1.0.0", "1.0.0"));
        assertFalse(UpdateChecker.isNewerVersion("1.0.0", "v1.0.0"));
        assertFalse(UpdateChecker.isNewerVersion("1.0.0-SNAPSHOT", "1.0.0"));
        assertFalse(UpdateChecker.isNewerVersion("1.0.0", null));
        assertFalse(UpdateChecker.isNewerVersion("1.0.0", ""));
    }

    @Test
    @SuppressWarnings("unchecked")
    void testCheckForUpdatesSuccess() {
        String jsonPayload = """
            {
              "tag_name": "v1.2.0",
              "name": "Release 1.2.0",
              "body": "- Fixed audio lag\\n- Added updater",
              "assets": [
                {
                  "name": "VoiceEngine-paper-1.2.0.jar",
                  "browser_download_url": "https://github.com/downloads/VoiceEngine-paper-1.2.0.jar"
                },
                {
                  "name": "checksums.sha256",
                  "browser_download_url": "https://github.com/downloads/checksums.sha256"
                }
              ]
            }
            """;

        when(mockStringResponse.statusCode()).thenReturn(200);
        when(mockStringResponse.body()).thenReturn(jsonPayload);
        when(mockHttpClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(CompletableFuture.completedFuture(mockStringResponse));

        UpdateChecker checker = new UpdateChecker(mockHttpClient);
        ReleaseCheckResult result = checker.checkForUpdates("Cypherlink-Studios/VoiceEngine", "1.0.0", true).join();

        assertTrue(result.updateAvailable());
        assertEquals("1.0.0", result.currentVersion());
        assertEquals("v1.2.0", result.latestVersion());
        assertNotNull(result.releaseInfo());
        assertEquals("https://github.com/downloads/VoiceEngine-paper-1.2.0.jar", result.releaseInfo().downloadUrl());
        assertEquals("https://github.com/downloads/checksums.sha256", result.releaseInfo().checksumUrl());
        assertNull(result.errorMessage());
    }

    @Test
    @SuppressWarnings("unchecked")
    void testCheckForUpdatesNotFound() {
        when(mockStringResponse.statusCode()).thenReturn(404);
        when(mockHttpClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(CompletableFuture.completedFuture(mockStringResponse));

        UpdateChecker checker = new UpdateChecker(mockHttpClient);
        ReleaseCheckResult result = checker.checkForUpdates("Cypherlink-Studios/VoiceEngine", "1.0.0", true).join();

        assertFalse(result.updateAvailable());
        assertNotNull(result.errorMessage());
        assertTrue(result.errorMessage().contains("No releases found"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void testDownloaderStreamsAndStagesJar(@TempDir File tempDir) throws Exception {
        HttpResponse<java.io.InputStream> mockStreamResponse = (HttpResponse<java.io.InputStream>) mock(HttpResponse.class);
        byte[] dummyJarBytes = "PK\u0003\u0004dummy-jar-content".getBytes(StandardCharsets.UTF_8);

        when(mockStreamResponse.statusCode()).thenReturn(200);
        when(mockStreamResponse.body()).thenReturn(new ByteArrayInputStream(dummyJarBytes));
        when(mockHttpClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(CompletableFuture.completedFuture(mockStreamResponse));

        UpdateDownloader downloader = new UpdateDownloader(mockHttpClient);
        ReleaseInfo info = new ReleaseInfo("v1.2.0", "Release 1.2.0", "Notes", "https://download.url/VoiceEngine-paper.jar", null);

        File staged = downloader.downloadAndStage(info, tempDir).join();

        assertNotNull(staged);
        assertTrue(staged.exists());
        assertEquals("VoiceEngine-paper.jar", staged.getName());
        assertEquals(dummyJarBytes.length, Files.readAllBytes(staged.toPath()).length);
    }

    @Test
    @SuppressWarnings("unchecked")
    void testCheckForUpdatesSuppressesFalsePositiveWhenSha256Matches() {
        String releaseJson = """
            {
              "tag_name": "v1.4.0",
              "name": "Release 1.4.0",
              "body": "Velocity-only changes",
              "assets": [
                {
                  "name": "VoiceEngine-paper.jar",
                  "browser_download_url": "https://github.com/downloads/VoiceEngine-paper.jar"
                },
                {
                  "name": "checksums.sha256",
                  "browser_download_url": "https://github.com/downloads/checksums.sha256"
                }
              ]
            }
            """;
        String sharedHash = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
        String checksumsBody = sharedHash + "  VoiceEngine-paper.jar\n";

        HttpResponse<String> releaseResp = (HttpResponse<String>) mock(HttpResponse.class);
        when(releaseResp.statusCode()).thenReturn(200);
        when(releaseResp.body()).thenReturn(releaseJson);

        HttpResponse<String> checksumResp = (HttpResponse<String>) mock(HttpResponse.class);
        when(checksumResp.statusCode()).thenReturn(200);
        when(checksumResp.body()).thenReturn(checksumsBody);

        when(mockHttpClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenAnswer(inv -> {
                HttpRequest req = inv.getArgument(0);
                if (req.uri().toString().endsWith("checksums.sha256")) {
                    return CompletableFuture.completedFuture(checksumResp);
                }
                return CompletableFuture.completedFuture(releaseResp);
            });

        UpdateChecker checker = new UpdateChecker(mockHttpClient, () -> Optional.of(sharedHash));
        ReleaseCheckResult result = checker.checkForUpdates("Cypherlink-Studios/VoiceEngine", "1.3.0", true).join();

        assertFalse(result.updateAvailable());
        assertNull(result.errorMessage());
    }

    @Test
    @SuppressWarnings("unchecked")
    void testDownloaderVerifiesSha256AndAbortsOnMismatch(@TempDir File tempDir) throws Exception {
        HttpResponse<java.io.InputStream> mockStreamResponse = (HttpResponse<java.io.InputStream>) mock(HttpResponse.class);
        byte[] dummyJarBytes = "PK\u0003\u0004corrupted-paper-jar".getBytes(StandardCharsets.UTF_8);

        when(mockStreamResponse.statusCode()).thenReturn(200);
        when(mockStreamResponse.body()).thenReturn(new ByteArrayInputStream(dummyJarBytes));
        when(mockHttpClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(CompletableFuture.completedFuture(mockStreamResponse));

        UpdateDownloader downloader = new UpdateDownloader(mockHttpClient);
        ReleaseInfo badInfo = new ReleaseInfo(
            "v1.3.1",
            "Release 1.3.1",
            "Notes",
            "https://download.url/VoiceEngine-paper.jar",
            null,
            "0000000000000000000000000000000000000000000000000000000000000000"
        );

        CompletionException ex = assertThrows(
            CompletionException.class,
            () -> downloader.downloadAndStage(badInfo, tempDir).join()
        );
        assertTrue(ex.getCause().getMessage().contains("SHA-256 checksum mismatch"));
        assertFalse(new File(tempDir, "VoiceEngine-paper.jar").exists());
        assertFalse(new File(tempDir, "VoiceEngine-paper.jar.tmp").exists());
    }
}
