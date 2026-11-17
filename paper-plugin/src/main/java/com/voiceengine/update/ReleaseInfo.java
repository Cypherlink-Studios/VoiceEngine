package com.voiceengine.update;

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
