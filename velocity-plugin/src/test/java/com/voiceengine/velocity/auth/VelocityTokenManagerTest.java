package com.voiceengine.velocity.auth;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class VelocityTokenManagerTest {

    @Test
    void testCreateAndLookupToken() {
        VelocityTokenManager manager = new VelocityTokenManager(Duration.ofMinutes(5));
        UUID playerUuid = UUID.randomUUID();

        VelocitySessionToken token = manager.generateToken(playerUuid, "Alice", false);
        assertNotNull(token);
        assertEquals(6, token.token().length());
        assertEquals(playerUuid, token.playerUuid());
        assertEquals("Alice", token.playerName());
        assertFalse(token.isAdmin());
        assertFalse(token.isExpired());

        // Lookup by token string
        var found = manager.getTokenByString(token.token());
        assertTrue(found.isPresent());
        assertEquals(playerUuid, found.get().playerUuid());

        // Lookup by player UUID
        var foundByPlayer = manager.getTokenForPlayer(playerUuid);
        assertTrue(foundByPlayer.isPresent());
        assertEquals(token.token(), foundByPlayer.get().token());
    }

    @Test
    void testAdminToken() {
        VelocityTokenManager manager = new VelocityTokenManager(Duration.ofMinutes(5));
        UUID playerUuid = UUID.randomUUID();

        VelocitySessionToken token = manager.generateToken(playerUuid, "AdminUser", true);
        assertNotNull(token);
        assertTrue(token.isAdmin());
    }

    @Test
    void testExpiredToken() throws InterruptedException {
        VelocityTokenManager manager = new VelocityTokenManager(Duration.ofMillis(50));
        UUID playerUuid = UUID.randomUUID();

        VelocitySessionToken token = manager.generateToken(playerUuid, "Bob", false);
        Thread.sleep(70);

        assertTrue(token.isExpired());
        assertTrue(manager.getTokenByString(token.token()).isEmpty());
        assertTrue(manager.getTokenForPlayer(playerUuid).isEmpty());
    }

    @Test
    void testDynamicTtlUpdate() {
        VelocityTokenManager manager = new VelocityTokenManager(Duration.ofMinutes(5));
        assertEquals(Duration.ofMinutes(5), manager.getTokenTtl());

        manager.setTokenTtl(Duration.ofMinutes(15));
        assertEquals(Duration.ofMinutes(15), manager.getTokenTtl());

        UUID playerUuid = UUID.randomUUID();
        VelocitySessionToken token = manager.generateToken(playerUuid, "Charlie", false);
        long minutesUntilExpiry = Duration.between(java.time.Instant.now(), token.expiresAt()).toMinutes();
        assertTrue(minutesUntilExpiry >= 14 && minutesUntilExpiry <= 15);
    }
}
