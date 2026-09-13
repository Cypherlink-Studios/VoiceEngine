package com.voiceengine.velocity.moderation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DurationParserTest {

    @Test
    void testPermanentDurations() {
        assertEquals(0L, DurationParser.parseDurationToExpiration("perm"));
        assertEquals(0L, DurationParser.parseDurationToExpiration("permanent"));

        assertEquals("permanent", DurationParser.formatRemaining(null));
        assertEquals("permanent", DurationParser.formatRemaining(0L));
    }

    @Test
    void testTimedDurations() {
        long now = System.currentTimeMillis();

        long exp30s = DurationParser.parseDurationToExpiration("30s");
        assertTrue(exp30s >= now + 29_000 && exp30s <= now + 31_000);

        long exp15m = DurationParser.parseDurationToExpiration("15m");
        assertTrue(exp15m >= now + (15 * 60 * 1000L) - 1000);

        long exp2h = DurationParser.parseDurationToExpiration("2h");
        assertTrue(exp2h >= now + (2 * 3600 * 1000L) - 1000);

        long exp1d = DurationParser.parseDurationToExpiration("1d");
        assertTrue(exp1d >= now + (86400 * 1000L) - 1000);

        long exp7d = DurationParser.parseDurationToExpiration("7d");
        assertTrue(exp7d >= now + (7 * 86400 * 1000L) - 1000);
    }

    @Test
    void testInvalidDurationThrows() {
        assertThrows(IllegalArgumentException.class, () -> DurationParser.parseDurationToExpiration("invalid"));
        assertThrows(IllegalArgumentException.class, () -> DurationParser.parseDurationToExpiration("10x"));
        assertThrows(IllegalArgumentException.class, () -> DurationParser.parseDurationToExpiration("-5m"));
        assertThrows(IllegalArgumentException.class, () -> DurationParser.parseDurationToExpiration(null));
        assertThrows(IllegalArgumentException.class, () -> DurationParser.parseDurationToExpiration(""));
    }

    @Test
    void testFormatRemaining() {
        long past = System.currentTimeMillis() - 5000;
        assertEquals("expired", DurationParser.formatRemaining(past));

        long futureSeconds = System.currentTimeMillis() + 45_000;
        assertTrue(DurationParser.formatRemaining(futureSeconds).endsWith("s"));

        long futureMinutes = System.currentTimeMillis() + (10 * 60 * 1000) + 15_000;
        assertTrue(DurationParser.formatRemaining(futureMinutes).contains("m"));

        long futureHours = System.currentTimeMillis() + (3 * 3600 * 1000) + (10 * 60 * 1000);
        assertTrue(DurationParser.formatRemaining(futureHours).contains("h"));

        long futureDays = System.currentTimeMillis() + (2 * 86400 * 1000) + (4 * 3600 * 1000);
        assertTrue(DurationParser.formatRemaining(futureDays).contains("d"));
    }
}
