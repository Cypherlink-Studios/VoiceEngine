package com.voiceengine.velocity.update;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UpdateCheckerTest {

    private HttpClient mockHttpClient;

    @BeforeEach
    void setUp() {
        mockHttpClient = mock(HttpClient.class);
    }

    @Test
    void testVersionComparison() {
        assertTrue(UpdateChecker.isNewerVersion("1.1.1", "v1.2.0"));
        assertTrue(UpdateChecker.isNewerVersion("1.1.1", "v1.1.2"));
        assertTrue(UpdateChecker.isNewerVersion("1.1.1-SNAPSHOT", "v1.2.0"));
        assertTrue(UpdateChecker.isNewerVersion("1.1.1", "v2.0.0"));

        assertFalse(UpdateChecker.isNewerVersion("1.2.0", "v1.1.1"));
        assertFalse(UpdateChecker.isNewerVersion("1.2.0", "1.2.0"));
        assertFalse(UpdateChecker.isNewerVersion("1.2.0", "v1.2.0"));
        assertFalse(UpdateChecker.isNewerVersion("1.2.0", null));
        assertFalse(UpdateChecker.isNewerVersion("1.2.0", ""));
    }

    @Test
    @SuppressWarnings("unchecked")
    void testCheckForUpdatesWithDifferingSha256() {
        String releaseJson = """
            {
              "tag_name": "v1.3.0",
              "name": "Release 1.3.0",
              "body": "Velocity updater support",
              "assets": [
                {
                  "name": "VoiceEngine-velocity.jar",
                  "browser_download_url": "https://github.com/downloads/VoiceEngine-velocity.jar"
                },
                {
                  "name": "checksums.sha256",
                  "browser_download_url": "https://github.com/downloads/checksums.sha256"
                }
              ]
            }
            """;
        String remoteHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        String checksumsBody = remoteHash + "  VoiceEngine-velocity.jar\n";

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

        String localHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        UpdateChecker checker = new UpdateChecker(mockHttpClient, () -> Optional.of(localHash));
        ReleaseCheckResult result = checker.checkForUpdates("Cypherlink-Studios/VoiceEngine", "1.1.1", true).join();

        assertTrue(result.updateAvailable());
        assertEquals("1.1.1", result.currentVersion());
        assertEquals("v1.3.0", result.latestVersion());
        assertNotNull(result.releaseInfo());
        assertEquals(remoteHash, result.releaseInfo().expectedSha256());
        assertNull(result.errorMessage());
    }

    @Test
    @SuppressWarnings("unchecked")
    void testCheckForUpdatesSuppressesFalsePositiveWhenSha256Matches() {
        String releaseJson = """
            {
              "tag_name": "v1.4.0",
              "name": "Release 1.4.0",
              "body": "Paper-only changes",
              "assets": [
                {
                  "name": "VoiceEngine-velocity.jar",
                  "browser_download_url": "https://github.com/downloads/VoiceEngine-velocity.jar"
                },
                {
                  "name": "checksums.sha256",
                  "browser_download_url": "https://github.com/downloads/checksums.sha256"
                }
              ]
            }
            """;
        String sharedHash = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
        String checksumsBody = sharedHash + "  VoiceEngine-velocity.jar\n";

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
        ReleaseCheckResult result = checker.checkForUpdates("Cypherlink-Studios/VoiceEngine", "1.2.0", true).join();

        assertFalse(result.updateAvailable());
        assertNull(result.errorMessage());
    }

    @Test
    @SuppressWarnings("unchecked")
    void testCheckForUpdatesNotFound() {
        HttpResponse<String> mockResp = (HttpResponse<String>) mock(HttpResponse.class);
        when(mockResp.statusCode()).thenReturn(404);
        when(mockHttpClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(CompletableFuture.completedFuture(mockResp));

        UpdateChecker checker = new UpdateChecker(mockHttpClient, Optional::empty);
        ReleaseCheckResult result = checker.checkForUpdates("Cypherlink-Studios/VoiceEngine", "1.1.1", true).join();

        assertFalse(result.updateAvailable());
        assertNotNull(result.errorMessage());
        assertTrue(result.errorMessage().contains("No releases found"));
    }
}
