import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { TokenStore } from './TokenStore.js';

export interface AdminSession {
  sessionToken: string;
  playerUuid: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

export class AdminAuthManager {
  private sessions = new Map<string, AdminSession>();
  private readonly sessionTtlMs: number;

  constructor(sessionTtlMs = 24 * 60 * 60 * 1000) {
    this.sessionTtlMs = sessionTtlMs;
  }

  public authenticate(token: string, tokenStore: TokenStore): AdminSession | null {
    const record = tokenStore.validateAndRedeemAdmin(token);
    if (!record) {
      return null;
    }

    const sessionToken = uuidv4();
    const now = Date.now();
    const session: AdminSession = {
      sessionToken,
      playerUuid: record.playerUuid,
      username: record.playerName,
      createdAt: now,
      expiresAt: now + this.sessionTtlMs,
    };

    this.sessions.set(sessionToken, session);
    return session;
  }

  public validateSession(sessionToken: string): AdminSession | null {
    if (!sessionToken) return null;
    const session = this.sessions.get(sessionToken);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionToken);
      return null;
    }

    return session;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: Missing or malformed Authorization header' });
        return;
      }

      const token = authHeader.substring(7).trim();
      const session = this.validateSession(token);
      if (!session) {
        res.status(401).json({ error: 'Unauthorized: Invalid or expired admin session' });
        return;
      }

      (req as any).adminSession = session;
      next();
    };
  }

  public cleanExpired(): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(key);
      }
    }
  }
}
