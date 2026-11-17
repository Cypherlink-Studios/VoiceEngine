package com.voiceengine.velocity.update;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UpdateDownloaderTest {

    @Test
    @SuppressWarnings("unchecked")
    void testDownloadStageVerifyAndApplyOnShutdown(@TempDir Path tempDir) throws Exception {
        byte[] jarBytes = "PK\u0003\u0004velocity-jar-bytes".getBytes(StandardCharsets.UTF_8);
        String expectedSha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(jarBytes));

        HttpClient mockClient = mock(HttpClient.class);
        HttpResponse<InputStream> mockResp = (HttpResponse<InputStream>) mock(HttpResponse.class);
        when(mockResp.statusCode()).thenReturn(200);
        when(mockResp.body()).thenReturn(new ByteArrayInputStream(jarBytes));
        when(mockClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(CompletableFuture.completedFuture(mockResp));

        UpdateDownloader downloader = new UpdateDownloader(mockClient);
        Path updateFolder = tempDir.resolve("update");
        ReleaseInfo info = new ReleaseInfo(
            "v1.2.0",
            "Release 1.2.0",
            "Notes",
            "https://github.com/downloads/VoiceEngine-velocity.jar",
            null,
            expectedSha
        );

        Path staged = downloader.downloadAndStage(info, updateFolder).join();
        assertTrue(Files.isRegularFile(staged));
        assertEquals(UpdateDownloader.STAGED_JAR_NAME, staged.getFileName().toString());
        assertArrayEquals(jarBytes, Files.readAllBytes(staged));
        assertEquals(staged, downloader.getPendingStagedJar());

        Path runningJar = tempDir.resolve("VoiceEngine-velocity-1.1.1.jar");
        Files.writeString(runningJar, "old-jar");

        assertTrue(downloader.applyPendingUpdate(runningJar));
        assertArrayEquals(jarBytes, Files.readAllBytes(runningJar));
        assertFalse(Files.exists(staged));
        assertNull(downloader.getPendingStagedJar());
    }

    @Test
    @SuppressWarnings("unchecked")
    void testDownloadAbortsOnSha256Mismatch(@TempDir Path tempDir) throws Exception {
        byte[] jarBytes = "PK\u0003\u0004corrupted-jar".getBytes(StandardCharsets.UTF_8);

        HttpClient mockClient = mock(HttpClient.class);
        HttpResponse<InputStream> mockResp = (HttpResponse<InputStream>) mock(HttpResponse.class);
        when(mockResp.statusCode()).thenReturn(200);
        when(mockResp.body()).thenReturn(new ByteArrayInputStream(jarBytes));
        when(mockClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(CompletableFuture.completedFuture(mockResp));

        UpdateDownloader downloader = new UpdateDownloader(mockClient);
        Path updateFolder = tempDir.resolve("update");
        ReleaseInfo info = new ReleaseInfo(
            "v1.2.0",
            "Release 1.2.0",
            "Notes",
            "https://github.com/downloads/VoiceEngine-velocity.jar",
            null,
            "0000000000000000000000000000000000000000000000000000000000000000"
        );

        CompletionException ex = assertThrows(
            CompletionException.class,
            () -> downloader.downloadAndStage(info, updateFolder).join()
        );
        assertTrue(ex.getCause().getMessage().contains("SHA-256 checksum mismatch"));
        assertFalse(Files.exists(updateFolder.resolve(UpdateDownloader.STAGED_JAR_NAME)));
        assertFalse(Files.exists(updateFolder.resolve(UpdateDownloader.STAGED_JAR_NAME + ".tmp")));
        assertNull(downloader.getPendingStagedJar());
    }
}
