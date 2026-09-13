import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { createMediaRouter } from '../src/routes/media.js';
import { config } from '../src/config.js';

describe('Media Routes & Range Streaming', () => {
  let tempMediaDir: string;
  let originalMediaDir: string;
  let app: express.Express;
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeEach(async () => {
    tempMediaDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 've-media-test-'));
    originalMediaDir = config.mediaDir;
    config.mediaDir = tempMediaDir;

    // Create a dummy mp3 and wav file
    const sampleBuffer = Buffer.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    await fs.promises.writeFile(path.join(tempMediaDir, 'test.mp3'), sampleBuffer);
    await fs.promises.writeFile(path.join(tempMediaDir, 'sound.wav'), sampleBuffer);

    // Subdirectory test
    const subDir = path.join(tempMediaDir, 'cache');
    await fs.promises.mkdir(subDir, { recursive: true });
    await fs.promises.writeFile(path.join(subDir, 'cached.mp3'), sampleBuffer);

    app = express();
    app.use('/api/media', createMediaRouter());

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    config.mediaDir = originalMediaDir;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await fs.promises.rm(tempMediaDir, { recursive: true, force: true });
  });

  it('serves full audio file with 200 OK and proper headers when no Range is specified', async () => {
    const res = await fetch(`${baseUrl}/api/media/test.mp3`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('content-length')).toBe('36');

    const text = await res.text();
    expect(text).toBe('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });

  it('serves partial audio chunk with 206 Partial Content for byte range', async () => {
    const res = await fetch(`${baseUrl}/api/media/test.mp3`, {
      headers: { Range: 'bytes=0-9' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-9/36');
    expect(res.headers.get('content-length')).toBe('10');
    expect(res.headers.get('content-type')).toBe('audio/mpeg');

    const text = await res.text();
    expect(text).toBe('0123456789');
  });

  it('serves open-ended range bytes=10-', async () => {
    const res = await fetch(`${baseUrl}/api/media/test.mp3`, {
      headers: { Range: 'bytes=10-' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 10-35/36');
    expect(res.headers.get('content-length')).toBe('26');

    const text = await res.text();
    expect(text).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });

  it('serves nested cached files', async () => {
    const res = await fetch(`${baseUrl}/api/media/cache/cached.mp3`, {
      headers: { Range: 'bytes=5-8' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 5-8/36');
    const text = await res.text();
    expect(text).toBe('5678');
  });

  it('returns 416 Range Not Satisfiable when range is out of bounds', async () => {
    const res = await fetch(`${baseUrl}/api/media/test.mp3`, {
      headers: { Range: 'bytes=100-200' },
    });
    expect(res.status).toBe(416);
    expect(res.headers.get('content-range')).toBe('bytes */36');
  });

  it('returns 404 when media file does not exist', async () => {
    const res = await fetch(`${baseUrl}/api/media/nonexistent.mp3`);
    expect(res.status).toBe(404);
  });

  it('blocks directory traversal attempts with 403', async () => {
    const res = await fetch(`${baseUrl}/api/media/%2E%2E%2F%2E%2E%2Fpackage.json`);
    expect(res.status).toBe(403);
  });

  it('validates proxy url parameter', async () => {
    const resMissing = await fetch(`${baseUrl}/api/media/proxy`);
    expect(resMissing.status).toBe(400);

    const resInvalid = await fetch(`${baseUrl}/api/media/proxy?url=ftp://bad.com`);
    expect(resInvalid.status).toBe(400);
  });

  it('proxies remote stream with CORS headers', async () => {
    // Spin up a mock remote server
    let remoteServer: ReturnType<typeof createServer>;
    let remoteUrl: string;

    await new Promise<void>((resolve) => {
      const remoteApp = express();
      remoteApp.get('/stream.mp3', (req, res) => {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.status(200).end(Buffer.from('HELLO'));
      });
      remoteServer = remoteApp.listen(0, () => {
        const port = (remoteServer.address() as AddressInfo).port;
        remoteUrl = `http://localhost:${port}/stream.mp3`;
        resolve();
      });
    });

    try {
      const res = await fetch(`${baseUrl}/api/media/proxy?url=${encodeURIComponent(remoteUrl)}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('content-type')).toContain('audio/mpeg');
      const text = await res.text();
      expect(text).toBe('HELLO');

    } finally {
      await new Promise<void>((resolve) => remoteServer.close(() => resolve()));
    }
  });
});
