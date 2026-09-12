import { SessionTokenRecord } from '../types.js';

export class TokenStore {
  private tokens = new Map<string, SessionTokenRecord>();

  constructor() {
    this.registerDevTokens();
  }

  /**
   * Built-in development tokens that are always available for testing.
   */
  public registerDevTokens(): void {
    const farFuture = Date.now() + 365 * 24 * 60 * 60 * 1000;
    this.registerToken({
      token: 'STEVE1',
      playerUuid: '00000000-0000-0000-0000-000000000001',
      playerName: 'Steve',
      expiresAt: farFuture,
    });
    this.registerToken({
      token: 'ALEX01',
      playerUuid: '00000000-0000-0000-0000-000000000002',
      playerName: 'Alex',
      expiresAt: farFuture,
    });
    this.registerToken({
      token: 'SUBM01',
      playerUuid: '00000000-0000-0000-0000-000000000003',
      playerName: 'Submariner',
      expiresAt: farFuture,
    });
    this.registerToken({
      token: 'NINJA1',
      playerUuid: '00000000-0000-0000-0000-000000000004',
      playerName: 'Ninja',
      expiresAt: farFuture,
    });
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
