package com.voiceengine.auth;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class TokenManager {
    private static final String CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 31 chars, no 0/O/1/I
    private static final int DEFAULT_TOKEN_LENGTH = 6;
    private static final Duration DEFAULT_TTL = Duration.ofMinutes(5);

    private final SecureRandom random = new SecureRandom();
    private final Map<String, SessionToken> tokens = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final int tokenLength;

    public TokenManager() {
        this(DEFAULT_TTL, DEFAULT_TOKEN_LENGTH);
    }

    public TokenManager(Duration ttl, int tokenLength) {
        this.ttl = ttl;
        this.tokenLength = tokenLength;
    }

    public SessionToken generateToken(UUID playerUuid, String playerName) {
        // Clean up any existing tokens for this player
        tokens.entrySet().removeIf(entry -> entry.getValue().playerUuid().equals(playerUuid));

        String code = generateUniqueCode();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(ttl);

        SessionToken sessionToken = new SessionToken(code, playerUuid, playerName, now, expiresAt, false);
        tokens.put(code, sessionToken);
        return sessionToken;
    }

    public Optional<SessionToken> validateToken(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        SessionToken token = tokens.get(code.toUpperCase().trim());
        if (token == null || token.isExpired() || token.redeemed()) {
            return Optional.empty();
        }
        return Optional.of(token);
    }

    public Optional<SessionToken> redeemToken(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        String normalized = code.toUpperCase().trim();
        SessionToken token = tokens.get(normalized);
        if (token == null || token.isExpired() || token.redeemed()) {
            return Optional.empty();
        }
        SessionToken redeemed = token.markRedeemed();
        tokens.put(normalized, redeemed);
        return Optional.of(redeemed);
    }

    public void cleanExpiredTokens() {
        tokens.entrySet().removeIf(entry -> entry.getValue().isExpired());
    }

    public int getActiveTokenCount() {
        return (int) tokens.values().stream().filter(t -> !t.isExpired() && !t.redeemed()).count();
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 100; attempt++) {
            StringBuilder sb = new StringBuilder(tokenLength);
            for (int i = 0; i < tokenLength; i++) {
                sb.append(CHARSET.charAt(random.nextInt(CHARSET.length())));
            }
            String candidate = sb.toString();
            if (!tokens.containsKey(candidate)) {
                return candidate;
            }
        }
        return UUID.randomUUID().toString().substring(0, tokenLength).toUpperCase();
    }
}
