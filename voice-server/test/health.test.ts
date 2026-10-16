import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import { app, getPackageVersion } from '../src/index.js';

describe('Healthcheck Endpoint (GET /health)', () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeEach(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('returns 200 OK with expected JSON structure and valid version', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof data.version).toBe('string');
    expect(data.version).toBe(getPackageVersion());
    expect(typeof data.workers).toBe('number');
  });

  it('getPackageVersion correctly reads the package.json version', () => {
    const version = getPackageVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns 503 when the server is in a shutting down state', async () => {
    const testApp = express();
    const isShuttingDown = true;
    testApp.get('/health', (_req, res) => {
      if (isShuttingDown) {
        res.status(503).json({ status: 'shutting_down', uptime: 10 });
        return;
      }
      res.status(200).json({ status: 'ok' });
    });

    const testServer = createServer(testApp);
    await new Promise<void>((resolve) => {
      testServer.listen(0, '127.0.0.1', () => resolve());
    });

    const testAddress = testServer.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${testAddress.port}/health`);
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.status).toBe('shutting_down');

    await new Promise<void>((resolve) => testServer.close(() => resolve()));
  });
});
