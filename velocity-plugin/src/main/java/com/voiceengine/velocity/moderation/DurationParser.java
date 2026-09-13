package com.voiceengine.velocity.moderation;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class DurationParser {
    private static final Pattern DURATION_PATTERN = Pattern.compile("^(\\d+)([smhd])$", Pattern.CASE_INSENSITIVE);

    private DurationParser() {}

    /**
     * Parses a duration string (e.g. "30s", "15m", "2h", "1d", "7d", "perm", "permanent")
     * into an expiration timestamp in milliseconds from Unix epoch.
     * Returns 0L for permanent or indefinite punishments.
     * Throws IllegalArgumentException if the format is invalid.
     */
    public static long parseDurationToExpiration(String input) {
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("Duration cannot be empty");
        }

        String normalized = input.trim().toLowerCase();
        if ("perm".equals(normalized) || "permanent".equals(normalized)) {
            return 0L;
        }

        Matcher matcher = DURATION_PATTERN.matcher(normalized);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("Invalid duration format: '" + input + "'. Use e.g. 30s, 15m, 2h, 1d, perm");
        }

        long amount = Long.parseLong(matcher.group(1));
        String unit = matcher.group(2).toLowerCase();

        long millis = switch (unit) {
            case "s" -> amount * 1000L;
            case "m" -> amount * 60L * 1000L;
            case "h" -> amount * 60L * 60L * 1000L;
            case "d" -> amount * 24L * 60L * 60L * 1000L;
            default -> throw new IllegalArgumentException("Unknown unit: " + unit);
        };

        return System.currentTimeMillis() + millis;
    }

    public static String formatRemaining(Long expiresAt) {
        if (expiresAt == null || expiresAt <= 0) {
            return "permanent";
        }
        long diff = expiresAt - System.currentTimeMillis();
        if (diff <= 0) {
            return "expired";
        }

        long seconds = diff / 1000L;
        long minutes = seconds / 60L;
        long hours = minutes / 60L;
        long days = hours / 24L;

        if (days > 0) {
            return days + "d " + (hours % 24) + "h";
        }
        if (hours > 0) {
            return hours + "h " + (minutes % 60) + "m";
        }
        if (minutes > 0) {
            return minutes + "m " + (seconds % 60) + "s";
        }
        return seconds + "s";
    }
}
