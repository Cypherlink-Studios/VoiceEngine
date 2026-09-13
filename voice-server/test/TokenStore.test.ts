import { describe, it, expect, beforeEach } from 'vitest';
import { TokenStore } from '../src/auth/TokenStore.js';

describe('TokenStore', () => {
  describe('Development Mode (enableDevTokens = true)', () => {
    let tokenStore: TokenStore;

    beforeEach(() => {
      tokenStore = new TokenStore(true);
    });

    it('initializes with built-in development tokens', () => {
      expect(tokenStore.size()).toBeGreaterThanOrEqual(5);
      const tokens = tokenStore.getTokens();
      expect(tokens).toContain('STEVE1');
      expect(tokens).toContain('ALEX01');
      expect(tokens).toContain('SUBM01');
      expect(tokens).toContain('NINJA1');
      expect(tokens).toContain('ADMIN1');
    });

    it('successfully redeems development tokens', () => {
      const record = tokenStore.validateAndRedeem('STEVE1');
      expect(record).not.toBeNull();
      expect(record?.playerName).toBe('Steve');
      expect(record?.playerUuid).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('permits repeated redemption of ADMIN1 development token', () => {
      const first = tokenStore.validateAndRedeemAdmin('ADMIN1');
      expect(first).not.toBeNull();
      expect(first?.isAdmin).toBe(true);

      const second = tokenStore.validateAndRedeemAdmin('ADMIN1');
      expect(second).not.toBeNull();
      expect(second?.playerName).toBe('ServerAdmin');
    });

    it('rejects regular dev token STEVE1 when calling validateAndRedeemAdmin', () => {
      const adminRecord = tokenStore.validateAndRedeemAdmin('STEVE1');
      expect(adminRecord).toBeNull();
    });
  });

  describe('Production Mode (enableDevTokens = false)', () => {
    let tokenStore: TokenStore;

    beforeEach(() => {
      tokenStore = new TokenStore(false);
    });

    it('initializes with zero tokens', () => {
      expect(tokenStore.size()).toBe(0);
      expect(tokenStore.getTokens()).toHaveLength(0);
    });

    it('rejects STEVE1 in production mode', () => {
      const record = tokenStore.validateAndRedeem('STEVE1');
      expect(record).toBeNull();
    });

    it('rejects ADMIN1 in production mode', () => {
      const record = tokenStore.validateAndRedeemAdmin('ADMIN1');
      expect(record).toBeNull();
    });

    it('rejects ALEX01, SUBM01, NINJA1 in production mode', () => {
      expect(tokenStore.validateAndRedeem('ALEX01')).toBeNull();
      expect(tokenStore.validateAndRedeem('SUBM01')).toBeNull();
      expect(tokenStore.validateAndRedeem('NINJA1')).toBeNull();
    });

    it('only accepts tokens dynamically registered from Minecraft plugin', () => {
      tokenStore.registerToken({
        token: 'DYN123',
        playerUuid: '11111111-2222-3333-4444-555555555555',
        playerName: 'DynamicPlayer',
        expiresAt: Date.now() + 60000,
        isAdmin: false,
      });

      expect(tokenStore.size()).toBe(1);
      expect(tokenStore.getTokens()).toEqual(['DYN123']);

      const redeemed = tokenStore.validateAndRedeem('DYN123');
      expect(redeemed).not.toBeNull();
      expect(redeemed?.playerName).toBe('DynamicPlayer');
    });

    it('enforces single-use for dynamically registered admin tokens', () => {
      tokenStore.registerToken({
        token: 'OP9999',
        playerUuid: '99999999-8888-7777-6666-555555555555',
        playerName: 'RealAdmin',
        expiresAt: Date.now() + 60000,
        isAdmin: true,
      });

      // First redemption succeeds
      const first = tokenStore.validateAndRedeemAdmin('OP9999');
      expect(first).not.toBeNull();
      expect(first?.playerName).toBe('RealAdmin');

      // Second redemption must fail in production (single-use token)
      const second = tokenStore.validateAndRedeemAdmin('OP9999');
      expect(second).toBeNull();
    });

    it('cleans up expired tokens properly', () => {
      tokenStore.registerToken({
        token: 'EXP123',
        playerUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        playerName: 'ExpiredUser',
        expiresAt: Date.now() - 1000, // already expired
        isAdmin: false,
      });

      expect(tokenStore.size()).toBe(1);
      tokenStore.cleanExpired();
      expect(tokenStore.size()).toBe(0);
    });
  });
});
