package com.voiceengine.update;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;

public class UpdateChecker {
    private final HttpClient httpClient;
    private ReleaseCheckResult cachedResult;
    private Instant cacheExpiry = Instant.MIN;
    private static final Duration CACHE_DURATION = Duration.ofHours(1);

    public UpdateChecker() {
        this(HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build());
    }

    public UpdateChecker(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    public CompletableFuture<ReleaseCheckResult> checkForUpdates(String repository, String currentVersion, boolean bypassCache) {
        if (!bypassCache && cachedResult != null && Instant.now().isBefore(cacheExpiry)) {
            return CompletableFuture.completedFuture(cachedResult);
        }

        String url = "https://api.github.com/repos/" + repository + "/releases/latest";
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "VoiceEngine-Paper-Updater")
            .timeout(Duration.ofSeconds(15))
            .GET()
            .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
            .thenApply(response -> {
                if (response.statusCode() == 404) {
                    return ReleaseCheckResult.failure(currentVersion, "No releases found on GitHub repository: " + repository);
                }
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    return ReleaseCheckResult.failure(currentVersion, "GitHub API returned status " + response.statusCode());
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

                                if (assetName.matches("(?i)VoiceEngine-paper.*\\.jar$") && downloadUrl == null) {
                                    downloadUrl = browserUrl;
                                } else if (assetName.equalsIgnoreCase("checksums.sha256") || assetName.equalsIgnoreCase("checksums.txt")) {
                                    checksumUrl = browserUrl;
                                }
                            }
                        }
                    }

                    ReleaseInfo releaseInfo = new ReleaseInfo(tagName, name, body, downloadUrl, checksumUrl);
                    boolean isAvailable = isNewerVersion(currentVersion, tagName);
                    ReleaseCheckResult result = ReleaseCheckResult.success(isAvailable, currentVersion, tagName, releaseInfo);

                    this.cachedResult = result;
                    this.cacheExpiry = Instant.now().plus(CACHE_DURATION);

                    return result;
                } catch (Exception e) {
                    return ReleaseCheckResult.failure(currentVersion, "Failed to parse release metadata: " + e.getMessage());
                }
            })
            .exceptionally(ex -> ReleaseCheckResult.failure(currentVersion, "Network error: " + ex.getMessage()));
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
