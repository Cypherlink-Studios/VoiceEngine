package com.voiceengine.velocity.update;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Downloads and verifies {@code VoiceEngine-velocity.jar} into {@code plugins/update/},
 * tracking the staged file so it can be applied during proxy shutdown.
 */
public class UpdateDownloader {
    public static final String STAGED_JAR_NAME = "VoiceEngine-velocity.jar";

    private final HttpClient httpClient;
    private final AtomicReference<Path> pendingStagedJar = new AtomicReference<>();

    public UpdateDownloader() {
        this(HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.ALWAYS)
            .build());
    }

    public UpdateDownloader(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /**
     * Streams the release JAR to a temporary file, validates SHA-256 if provided,
     * and atomically stages it to {@code updateFolder/VoiceEngine-velocity.jar}.
     */
    public CompletableFuture<Path> downloadAndStage(ReleaseInfo releaseInfo, Path updateFolder) {
        if (releaseInfo == null || releaseInfo.downloadUrl() == null || releaseInfo.downloadUrl().isBlank()) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("No JAR download URL found in release " + (releaseInfo != null ? releaseInfo.tagName() : "null"))
            );
        }

        try {
            Files.createDirectories(updateFolder);
        } catch (IOException e) {
            return CompletableFuture.failedFuture(
                new RuntimeException("Failed to create update directory: " + e.getMessage(), e)
            );
        }

        Path targetJar = updateFolder.resolve(STAGED_JAR_NAME);
        Path tempFile = updateFolder.resolve(STAGED_JAR_NAME + ".tmp");

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(releaseInfo.downloadUrl()))
            .header("Accept", "application/octet-stream")
            .header("User-Agent", "VoiceEngine-Velocity-Updater")
            .timeout(Duration.ofMinutes(2))
            .GET()
            .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofInputStream())
            .thenApply(response -> {
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new RuntimeException("Download failed with HTTP status " + response.statusCode());
                }

                try (InputStream in = response.body()) {
                    Files.copy(in, tempFile, StandardCopyOption.REPLACE_EXISTING);
                } catch (Exception e) {
                    deleteQuietly(tempFile);
                    throw new RuntimeException("Failed to stream download: " + e.getMessage(), e);
                }

                String expectedSha = releaseInfo.expectedSha256();
                if (expectedSha != null && !expectedSha.isBlank()) {
                    Optional<String> actualSha = UpdateChecker.computeSha256(tempFile);
                    if (actualSha.isEmpty() || !actualSha.get().equalsIgnoreCase(expectedSha)) {
                        deleteQuietly(tempFile);
                        throw new RuntimeException(
                            "SHA-256 checksum mismatch for downloaded JAR (expected " + expectedSha + ", got " + actualSha.orElse("unavailable") + ")"
                        );
                    }
                }

                try {
                    Files.move(tempFile, targetJar, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
                } catch (Exception e) {
                    try {
                        Files.move(tempFile, targetJar, StandardCopyOption.REPLACE_EXISTING);
                    } catch (Exception ex) {
                        deleteQuietly(tempFile);
                        throw new RuntimeException("Failed to stage update JAR: " + ex.getMessage(), ex);
                    }
                }

                pendingStagedJar.set(targetJar);
                return targetJar;
            });
    }

    public Path getPendingStagedJar() {
        return pendingStagedJar.get();
    }

    /**
     * Replaces {@code runningJar} with the staged JAR if one is pending.
     * Returns true if replaced, false if no staged JAR was pending.
     */
    public boolean applyPendingUpdate(Path runningJar) throws IOException {
        Path staged = pendingStagedJar.get();
        if (staged == null || !Files.isRegularFile(staged) || runningJar == null) {
            return false;
        }
        try {
            Files.move(staged, runningJar, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException atomicUnsupported) {
            Files.move(staged, runningJar, StandardCopyOption.REPLACE_EXISTING);
        }
        pendingStagedJar.set(null);
        return true;
    }

    private static void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }
}
