package com.voiceengine.update;

public record ReleaseInfo(
    String tagName,
    String name,
    String body,
    String downloadUrl,
    String checksumUrl
) {}
