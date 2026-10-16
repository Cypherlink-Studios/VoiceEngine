package com.voiceengine.update;

public record ReleaseCheckResult(
    boolean updateAvailable,
    String currentVersion,
    String latestVersion,
    ReleaseInfo releaseInfo,
    String errorMessage
) {
    public static ReleaseCheckResult success(boolean available, String current, String latest, ReleaseInfo info) {
        return new ReleaseCheckResult(available, current, latest, info, null);
    }

    public static ReleaseCheckResult failure(String current, String error) {
        return new ReleaseCheckResult(false, current, null, null, error);
    }
}
