package com.voiceengine.velocity.update;

/**
 * Metadata for a GitHub Release relevant to the Velocity plugin updater.
 */
public record ReleaseInfo(
    String tagName,
    String name,
    String body,
    String downloadUrl,
    String checksumUrl,
    String expectedSha256
) {
    public ReleaseInfo(String tagName, String name, String body, String downloadUrl, String checksumUrl) {
        this(tagName, name, body, downloadUrl, checksumUrl, null);
    }
}
