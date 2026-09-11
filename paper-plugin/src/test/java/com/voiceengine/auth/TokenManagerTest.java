package com.voiceengine.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TokenManagerTest {
    private TokenManager tokenManager;
    private final UUID testPlayerUuid = UUID.randomUUID();
    private final String testPlayerName = "Alex";

    @BeforeEach
    void setUp() {
        tokenManager = new TokenManager(Duration.ofMinutes(5), 6);
    }

    @Test
    void testGenerateToken() {
        SessionToken token = tokenManager.generateToken(testPlayerUuid, testPlayerName);
        assertNotNull(token);
        assertEquals(6, token.token().length());
        assertEquals(testPlayerUuid, token.playerUuid());
        assertEquals(testPlayerName, token.playerName());
        assertFalse(token.isExpired());
        assertFalse(token.redeemed());
    }

    @Test
    void testValidateTokenSuccess() {
        SessionToken token = tokenManager.generateToken(testPlayerUuid, testPlayerName);
        Optional<SessionToken> validated = tokenManager.validateToken(token.token());
        assertTrue(validated.isPresent());
        assertEquals(token.token(), validated.get().token());
    }

    @Test
    void testRedeemToken() {
        SessionToken token = tokenManager.generateToken(testPlayerUuid, testPlayerName);
        Optional<SessionToken> redeemed = tokenManager.redeemToken(token.token());
        assertTrue(redeemed.isPresent());
        assertTrue(redeemed.get().redeemed());

        // Second redemption attempt must fail
        Optional<SessionToken> secondRedeem = tokenManager.redeemToken(token.token());
        assertFalse(secondRedeem.isPresent());

        // Validation of already redeemed token must fail
        Optional<SessionToken> validatedAfterRedeem = tokenManager.validateToken(token.token());
        assertFalse(validatedAfterRedeem.isPresent());
    }

    @Test
    void testExpiredToken() throws InterruptedException {
        TokenManager shortLivedManager = new TokenManager(Duration.ofMillis(10), 6);
        SessionToken token = shortLivedManager.generateToken(testPlayerUuid, testPlayerName);

        Thread.sleep(30);

        assertTrue(token.isExpired());
        Optional<SessionToken> validated = shortLivedManager.validateToken(token.token());
        assertFalse(validated.isPresent());
    }

    @Test
    void testGeneratingNewTokenReplacesOld() {
        SessionToken token1 = tokenManager.generateToken(testPlayerUuid, testPlayerName);
        SessionToken token2 = tokenManager.generateToken(testPlayerUuid, testPlayerName);

        assertNotEquals(token1.token(), token2.token());
        // token1 should be removed
        assertFalse(tokenManager.validateToken(token1.token()).isPresent());
        // token2 should be valid
        assertTrue(tokenManager.validateToken(token2.token()).isPresent());
    }
}
