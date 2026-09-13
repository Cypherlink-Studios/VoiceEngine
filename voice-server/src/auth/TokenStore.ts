import { SessionTokenRecord } from '../types.js';
import { config } from '../config.js';

export class TokenStore {
  private tokens = new Map<string, SessionTokenRecord>();
  private devTokens = new Set<string>();

  constructor(enableDevTokens: boolean = config.enableDevTokens) {
    if (enableDevTokens) {
      this.registerDevTokens();
    }
  }

  /**
   * Built-in development tokens that are always available for testing.
   */
  public registerDevTokens(): void {
    const farFuture = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const devList: Array<Omit<SessionTokenRecord, 'redeemed'>> = [
      {
        token: 'STEVE1',
        playerUuid: '00000000-0000-0000-0000-000000000001',
        playerName: 'Steve',
        expiresAt: farFuture,
      },
      {
        token: 'ALEX01',
        playerUuid: '00000000-0000-0000-0000-000000000002',
        playerName: 'Alex',
        expiresAt: farFuture,
      },
      {
        token: 'SUBM01',
        playerUuid: '00000000-0000-0000-0000-000000000003',
        playerName: 'Submariner',
        expiresAt: farFuture,
      },
      {
        token: 'NINJA1',
        playerUuid: '00000000-0000-0000-0000-000000000004',
        playerName: 'Ninja',
        expiresAt: farFuture,
      },
      {
        token: 'ADMIN1',
        playerUuid: '00000000-0000-0000-0000-000000000099',
        playerName: 'ServerAdmin',
        expiresAt: farFuture,
        isAdmin: true,
      },
    ];

    for (const record of devList) {
      this.devTokens.add(record.token.toUpperCase().trim());
      this.registerToken(record);
    }
  }

  public registerToken(record: Omit<SessionTokenRecord, 'redeemed'>): void {
    this.tokens.set(record.token.toUpperCase().trim(), {
      ...record,
      token: record.token.toUpperCase().trim(),
      redeemed: false,
    });
  }

  public validateAndRedeem(token: string): SessionTokenRecord | null {
    if (!token) return null;
    const key = token.toUpperCase().trim();
    const record = this.tokens.get(key);

    if (!record) return null;
    const isDev = this.devTokens.has(key);
    if (!isDev && record.redeemed) return null;
    if (Date.now() > record.expiresAt) {
      this.tokens.delete(key);
      return null;
    }

    record.redeemed = true;
    return record;
  }

  public isIpAllowed(record: SessionTokenRecord, remoteIp?: string): boolean {
    if (!record.clientIp || !remoteIp) return true;
    const normBound = this.normalizeIp(record.clientIp);
    const normRemote = this.normalizeIp(remoteIp);
    if (this.isLoopback(normBound) || this.isLoopback(normRemote)) return true;
    return normBound === normRemote;
  }

  public normalizeIp(ip: string): string {
    if (!ip) return '';
    let normalized = ip.trim();
    if (normalized.startsWith('::ffff:')) {
      normalized = normalized.substring(7);
    }
    return normalized;
  }

  public isLoopback(ip: string): boolean {
    const norm = this.normalizeIp(ip);
    return norm === '127.0.0.1' || norm === '::1' || norm === 'localhost';
  }

  public validateAndRedeemAdmin(token: string): SessionTokenRecord | null {
    if (!token) return null;
    const key = token.toUpperCase().trim();
    const record = this.tokens.get(key);

    if (!record) return null;
    const isDev = this.devTokens.has(key);
    if (!isDev && record.redeemed) return null;
    if (!record.isAdmin) return null;
    if (Date.now() > record.expiresAt) {
      this.tokens.delete(key);
      return null;
    }

    record.redeemed = true;
    return record;
  }

  public cleanExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.tokens.entries()) {
      if (now > record.expiresAt) {
        this.tokens.delete(key);
      }
    }
  }

  public getTokens(): string[] {
    return Array.from(this.tokens.keys());
  }

  public size(): number {
    return this.tokens.size;
  }
}
