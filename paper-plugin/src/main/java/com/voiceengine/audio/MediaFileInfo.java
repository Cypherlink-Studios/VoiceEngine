package com.voiceengine.audio;

public record MediaFileInfo(
    String name,
    String relativePath,
    long sizeBytes
) {
    public String formattedSize() {
        if (sizeBytes < 1024) return sizeBytes + " B";
        if (sizeBytes < 1024 * 1024) return String.format("%.1f KB", sizeBytes / 1024.0);
        return String.format("%.1f MB", sizeBytes / (1024.0 * 1024.0));
    }
}
