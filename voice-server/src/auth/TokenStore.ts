import { SessionTokenRecord } from '../types.js';

export class TokenStore {
  private tokens = new Map<string, SessionTokenRecord>();

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
    if (record.redeemed) return null;
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
      if (now > record.expiresAt || record.redeemed) {
        this.tokens.delete(key);
      }
    }
  }

  public size(): number {
    return this.tokens.size;
  }
}
