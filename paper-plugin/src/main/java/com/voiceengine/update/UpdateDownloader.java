package com.voiceengine.update;

import java.io.File;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

public class UpdateDownloader {
    private final HttpClient httpClient;

    public UpdateDownloader() {
        this(HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.ALWAYS)
            .build());
    }

    public UpdateDownloader(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    public CompletableFuture<File> downloadAndStage(ReleaseInfo releaseInfo, File updateFolder) {
        if (releaseInfo == null || releaseInfo.downloadUrl() == null || releaseInfo.downloadUrl().isBlank()) {
            return CompletableFuture.failedFuture(new IllegalArgumentException("No JAR download URL found in release " + (releaseInfo != null ? releaseInfo.tagName() : "null")));
        }

        if (!updateFolder.exists()) {
            updateFolder.mkdirs();
        }

        File targetJar = new File(updateFolder, "VoiceEngine-paper.jar");
        File tempFile = new File(updateFolder, "VoiceEngine-paper.jar.tmp");

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(releaseInfo.downloadUrl()))
            .header("Accept", "application/octet-stream")
            .header("User-Agent", "VoiceEngine-Paper-Updater")
            .timeout(Duration.ofMinutes(2))
            .GET()
            .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofInputStream())
            .thenApply(response -> {
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new RuntimeException("Download failed with HTTP status " + response.statusCode());
                }

                try (InputStream in = response.body()) {
                    Files.copy(in, tempFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                } catch (Exception e) {
                    tempFile.delete();
                    throw new RuntimeException("Failed to stream download: " + e.getMessage(), e);
                }

                try {
                    Files.move(tempFile.toPath(), targetJar.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
                } catch (Exception e) {
                    // Fallback if atomic move unsupported on this filesystem
                    try {
                        Files.move(tempFile.toPath(), targetJar.toPath(), StandardCopyOption.REPLACE_EXISTING);
                    } catch (Exception ex) {
                        tempFile.delete();
                        throw new RuntimeException("Failed to stage update JAR: " + ex.getMessage(), ex);
                    }
                }

                return targetJar;
            });
    }
}
