package com.voiceengine.velocity.auth;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class VelocityTokenManager {
    private static final String CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private volatile Duration tokenTtl;
    private final int tokenLength;
    private final Map<UUID, VelocitySessionToken> playerTokens = new ConcurrentHashMap<>();
    private final Map<String, VelocitySessionToken> tokenIndex = new ConcurrentHashMap<>();

    public VelocityTokenManager(Duration tokenTtl) {
        this(tokenTtl, 6);
    }

    public VelocityTokenManager(Duration tokenTtl, int tokenLength) {
        this.tokenTtl = tokenTtl;
        this.tokenLength = tokenLength;
    }

    public Duration getTokenTtl() {
        return tokenTtl;
    }

    public void setTokenTtl(Duration tokenTtl) {
        if (tokenTtl != null) {
            this.tokenTtl = tokenTtl;
        }
    }

    public VelocitySessionToken generateToken(UUID playerUuid, String playerName, boolean isAdmin) {
        cleanupExpired();

        VelocitySessionToken existing = playerTokens.get(playerUuid);
        if (existing != null && !existing.isExpired()) {
            return existing;
        }

        String tokenStr = generateUniqueString();
        Instant expiresAt = Instant.now().plus(tokenTtl);
        VelocitySessionToken token = new VelocitySessionToken(tokenStr, playerUuid, playerName, expiresAt, isAdmin);

        playerTokens.put(playerUuid, token);
        tokenIndex.put(tokenStr, token);
        return token;
    }

    public Optional<VelocitySessionToken> getTokenByString(String tokenStr) {
        cleanupExpired();
        if (tokenStr == null) return Optional.empty();
        return Optional.ofNullable(tokenIndex.get(tokenStr.toUpperCase()));
    }

    public Optional<VelocitySessionToken> getTokenForPlayer(UUID playerUuid) {
        cleanupExpired();
        return Optional.ofNullable(playerTokens.get(playerUuid));
    }

    private void cleanupExpired() {
        tokenIndex.values().removeIf(VelocitySessionToken::isExpired);
        playerTokens.values().removeIf(VelocitySessionToken::isExpired);
    }

    private String generateUniqueString() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(tokenLength);
            for (int i = 0; i < tokenLength; i++) {
                sb.append(CHARSET.charAt(RANDOM.nextInt(CHARSET.length())));
            }
            code = sb.toString();
        } while (tokenIndex.containsKey(code));
        return code;
    }
}
