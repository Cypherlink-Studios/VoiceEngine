package com.voiceengine.velocity.update;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.CodeSource;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Queries GitHub Releases asynchronously and compares both SemVer and running-JAR SHA-256
 * against {@code checksums.sha256} to avoid cross-component false positives.
 */
public class UpdateChecker {
    private static final Duration CACHE_DURATION = Duration.ofHours(1);
    private static final Pattern VELOCITY_JAR_PATTERN = Pattern.compile("(?i)VoiceEngine-velocity.*\\.jar$");

    private final HttpClient httpClient;
    private final Supplier<Optional<String>> localSha256Supplier;
    private ReleaseCheckResult cachedResult;
    private Instant cacheExpiry = Instant.MIN;

    public UpdateChecker() {
        this(
            HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build(),
            UpdateChecker::resolveRunningJarSha256
        );
    }

    public UpdateChecker(HttpClient httpClient) {
        this(httpClient, UpdateChecker::resolveRunningJarSha256);
    }

    public UpdateChecker(HttpClient httpClient, Supplier<Optional<String>> localSha256Supplier) {
        this.httpClient = httpClient;
        this.localSha256Supplier = localSha256Supplier != null ? localSha256Supplier : Optional::empty;
    }

    /**
     * Checks GitHub Releases for a newer Velocity plugin build.
     */
    public CompletableFuture<ReleaseCheckResult> checkForUpdates(String repository, String currentVersion, boolean bypassCache) {
        if (!bypassCache && cachedResult != null && Instant.now().isBefore(cacheExpiry)) {
            return CompletableFuture.completedFuture(cachedResult);
        }

        String url = "https://api.github.com/repos/" + repository + "/releases/latest";
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "VoiceEngine-Velocity-Updater")
            .timeout(Duration.ofSeconds(15))
            .GET()
            .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
            .thenCompose(response -> {
                if (response.statusCode() == 404) {
                    return CompletableFuture.completedFuture(
                        ReleaseCheckResult.failure(currentVersion, "No releases found on GitHub repository: " + repository)
                    );
                }
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    return CompletableFuture.completedFuture(
                        ReleaseCheckResult.failure(currentVersion, "GitHub API returned status " + response.statusCode())
                    );
                }

                try {
                    JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
                    String tagName = json.has("tag_name") && !json.get("tag_name").isJsonNull() ? json.get("tag_name").getAsString() : "";
                    String name = json.has("name") && !json.get("name").isJsonNull() ? json.get("name").getAsString() : tagName;
                    String body = json.has("body") && !json.get("body").isJsonNull() ? json.get("body").getAsString() : "";

                    String downloadUrl = null;
                    String checksumUrl = null;

                    if (json.has("assets") && json.get("assets").isJsonArray()) {
                        JsonArray assets = json.getAsJsonArray("assets");
                        for (JsonElement elem : assets) {
                            if (elem.isJsonObject()) {
                                JsonObject asset = elem.getAsJsonObject();
                                String assetName = asset.has("name") ? asset.get("name").getAsString() : "";
                                String browserUrl = asset.has("browser_download_url") ? asset.get("browser_download_url").getAsString() : "";

                                if (VELOCITY_JAR_PATTERN.matcher(assetName).matches() && downloadUrl == null) {
                                    downloadUrl = browserUrl;
                                } else if (assetName.equalsIgnoreCase("checksums.sha256") || assetName.equalsIgnoreCase("checksums.txt")) {
                                    checksumUrl = browserUrl;
                                }
                            }
                        }
                    }

                    boolean versionNewer = isNewerVersion(currentVersion, tagName);
                    if (!versionNewer || checksumUrl == null || checksumUrl.isBlank()) {
                        ReleaseInfo releaseInfo = new ReleaseInfo(tagName, name, body, downloadUrl, checksumUrl, null);
                        ReleaseCheckResult result = ReleaseCheckResult.success(versionNewer, currentVersion, tagName, releaseInfo);
                        cacheResult(result);
                        return CompletableFuture.completedFuture(result);
                    }

                    String finalDownloadUrl = downloadUrl;
                    String finalChecksumUrl = checksumUrl;
                    return fetchExpectedSha256(finalChecksumUrl, VELOCITY_JAR_PATTERN)
                        .thenApply(expectedShaOpt -> {
                            String expectedSha = expectedShaOpt.orElse(null);
                            boolean isAvailable = true;
                            if (expectedSha != null) {
                                Optional<String> localSha = localSha256Supplier.get();
                                if (localSha.isPresent() && localSha.get().equalsIgnoreCase(expectedSha)) {
                                    isAvailable = false;
                                }
                            }
                            ReleaseInfo releaseInfo = new ReleaseInfo(tagName, name, body, finalDownloadUrl, finalChecksumUrl, expectedSha);
                            ReleaseCheckResult result = ReleaseCheckResult.success(isAvailable, currentVersion, tagName, releaseInfo);
                            cacheResult(result);
                            return result;
                        });
                } catch (Exception e) {
                    return CompletableFuture.completedFuture(
                        ReleaseCheckResult.failure(currentVersion, "Failed to parse release metadata: " + e.getMessage())
                    );
                }
            })
            .exceptionally(ex -> ReleaseCheckResult.failure(currentVersion, "Network error: " + ex.getMessage()));
    }

    private void cacheResult(ReleaseCheckResult result) {
        this.cachedResult = result;
        this.cacheExpiry = Instant.now().plus(CACHE_DURATION);
    }

    private CompletableFuture<Optional<String>> fetchExpectedSha256(String checksumUrl, Pattern assetPattern) {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(checksumUrl))
            .header("User-Agent", "VoiceEngine-Velocity-Updater")
            .timeout(Duration.ofSeconds(15))
            .GET()
            .build();

        return httpClient.sendAsync(req, HttpResponse.BodyHandlers.ofString())
            .thenApply(resp -> {
                if (resp.statusCode() < 200 || resp.statusCode() >= 300 || resp.body() == null) {
                    return Optional.<String>empty();
                }
                return parseSha256ForAsset(resp.body(), assetPattern);
            })
            .exceptionally(ex -> Optional.empty());
    }

    /**
     * Parses a standard {@code sha256sum} manifest and extracts the 64-hex digest for the matching asset.
     */
    public static Optional<String> parseSha256ForAsset(String manifest, Pattern assetPattern) {
        if (manifest == null || manifest.isBlank()) {
            return Optional.empty();
        }
        for (String line : manifest.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            String[] parts = trimmed.split("\\s+", 2);
            if (parts.length == 2) {
                String hash = parts[0].trim();
                String fileName = parts[1].trim();
                if (fileName.startsWith("*")) {
                    fileName = fileName.substring(1);
                }
                int slashIdx = Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\'));
                if (slashIdx >= 0) {
                    fileName = fileName.substring(slashIdx + 1);
                }
                if (hash.matches("(?i)[0-9a-f]{64}") && assetPattern.matcher(fileName).matches()) {
                    return Optional.of(hash.toLowerCase(Locale.ROOT));
                }
            }
        }
        return Optional.empty();
    }

    /**
     * Computes the SHA-256 hex digest of the currently executing plugin JAR if it is a regular file.
     */
    public static Optional<String> resolveRunningJarSha256() {
        try {
            CodeSource codeSource = UpdateChecker.class.getProtectionDomain().getCodeSource();
            if (codeSource == null || codeSource.getLocation() == null) {
                return Optional.empty();
            }
            Path jarPath = Path.of(codeSource.getLocation().toURI());
            if (!Files.isRegularFile(jarPath)) {
                return Optional.empty();
            }
            return computeSha256(jarPath);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /**
     * Computes the lowercase SHA-256 hex digest of a file.
     */
    public static Optional<String> computeSha256(Path file) {
        try (InputStream in = Files.newInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
            return Optional.of(HexFormat.of().formatHex(digest.digest()));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public ReleaseCheckResult getCachedResult() {
        return cachedResult;
    }

    public static boolean isNewerVersion(String currentVersion, String remoteVersion) {
        if (remoteVersion == null || remoteVersion.isBlank()) return false;
        if (currentVersion == null || currentVersion.isBlank()) return true;

        String cleanCurrent = cleanVersion(currentVersion);
        String cleanRemote = cleanVersion(remoteVersion);

        if (cleanCurrent.equalsIgnoreCase(cleanRemote)) {
            return false;
        }

        String[] currentParts = cleanCurrent.split("\\.");
        String[] remoteParts = cleanRemote.split("\\.");

        int length = Math.max(currentParts.length, remoteParts.length);
        for (int i = 0; i < length; i++) {
            int currentNum = i < currentParts.length ? parsePart(currentParts[i]) : 0;
            int remoteNum = i < remoteParts.length ? parsePart(remoteParts[i]) : 0;

            if (remoteNum > currentNum) {
                return true;
            } else if (remoteNum < currentNum) {
                return false;
            }
        }

        return false;
    }

    private static String cleanVersion(String version) {
        String clean = version.trim();
        if (clean.startsWith("v") || clean.startsWith("V")) {
            clean = clean.substring(1);
        }
        int dashIndex = clean.indexOf('-');
        if (dashIndex > 0) {
            clean = clean.substring(0, dashIndex);
        }
        return clean;
    }

    private static int parsePart(String part) {
        try {
            return Integer.parseInt(part.replaceAll("\\D+", ""));
        } catch (Exception e) {
            return 0;
        }
    }
}
