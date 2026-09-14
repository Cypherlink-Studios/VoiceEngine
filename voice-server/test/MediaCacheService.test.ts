import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { AddressInfo } from 'net';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { MediaCacheService } from '../src/media/MediaCacheService.js';
import { createMediaRouter } from '../src/routes/media.js';
import { config } from '../src/config.js';

describe('MediaCacheService & Cache Endpoints', () => {
  let tempBaseDir: string;
  let tempCacheDir: string;
  let originalMediaDir: string;
  let originalCacheDir: string;
  let cacheService: MediaCacheService;
  let app: express.Express;
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeEach(async () => {
    tempBaseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 've-cache-test-'));
    tempCacheDir = path.join(tempBaseDir, 'cache');
    await fs.promises.mkdir(tempCacheDir, { recursive: true });

    originalMediaDir = config.mediaDir;
    originalCacheDir = config.mediaCacheDir;
    config.mediaDir = tempBaseDir;
    config.mediaCacheDir = tempCacheDir;

    cacheService = new MediaCacheService(tempCacheDir, 1, 7); // 1 MB limit for testing

    app = express();
    app.use(express.json());
    app.use('/api/media', createMediaRouter(cacheService));

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
    config.mediaCacheDir = originalCacheDir;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await fs.promises.rm(tempBaseDir, { recursive: true, force: true });
  });

  it('generates consistent hash for URLs', () => {
    const hash1 = cacheService.getHash('https://example.com/audio.mp3');
    const hash2 = cacheService.getHash('https://example.com/audio.mp3');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(16);
  });

  it('downloads and caches direct HTTP audio stream', async () => {
    // Mock audio source server
    let mockSource: ReturnType<typeof createServer>;
    let mockSourceUrl: string;

    await new Promise<void>((resolve) => {
      const mockApp = express();
      mockApp.get('/song.mp3', (req, res) => {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.status(200).send('MOCK_AUDIO_DATA_12345');
      });
      mockSource = mockApp.listen(0, () => {
        const port = (mockSource.address() as AddressInfo).port;
        mockSourceUrl = `http://localhost:${port}/song.mp3`;
        resolve();
      });
    });

    try {
      const meta = await cacheService.getOrDownload(mockSourceUrl);
      expect(meta.fileSizeBytes).toBe(21);
      expect(fs.existsSync(meta.filePath)).toBe(true);
      expect(cacheService.isCached(mockSourceUrl)).toBe(true);

      // Subsequent call returns cached version
      const metaCached = await cacheService.getOrDownload(mockSourceUrl);
      expect(metaCached.filePath).toBe(meta.filePath);
    } finally {
      await new Promise<void>((resolve) => mockSource.close(() => resolve()));
    }
  });

  it('computes cache status accurately', async () => {
    // Create two dummy cache entries
    const file1 = path.join(tempCacheDir, 'file1.mp3');
    const file2 = path.join(tempCacheDir, 'file2.mp3');
    await fs.promises.writeFile(file1, Buffer.alloc(1000));
    await fs.promises.writeFile(file2, Buffer.alloc(2000));

    const status = cacheService.getCacheStatus();
    expect(status.totalFiles).toBe(2);
    expect(status.totalSizeBytes).toBe(3000);
    expect(status.oldestFile?.fileName).toBeDefined();
  });

  it('purges cache by maxAgeMs and purgeAll', async () => {
    const file1 = path.join(tempCacheDir, 'old.mp3');
    const file2 = path.join(tempCacheDir, 'new.mp3');
    await fs.promises.writeFile(file1, Buffer.alloc(500));
    await fs.promises.writeFile(file2, Buffer.alloc(500));

    // Manually set old mtime on file1 (10 days ago)
    const oldTime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    fs.utimesSync(file1, oldTime, oldTime);

    // Purge files older than 7 days
    const resultAge = cacheService.purgeCache({ maxAgeMs: 7 * 24 * 60 * 60 * 1000 });
    expect(resultAge.deletedFiles).toBe(1);
    expect(fs.existsSync(file1)).toBe(false);
    expect(fs.existsSync(file2)).toBe(true);

    // Purge all
    const resultAll = cacheService.purgeCache({ purgeAll: true });
    expect(resultAll.deletedFiles).toBe(1);
    expect(fs.existsSync(file2)).toBe(false);
  });

  it('enforces cache quota by LRU eviction when size exceeds limit', async () => {
    // Service configured with 1 MB limit (1048576 bytes)
    const file1 = path.join(tempCacheDir, 'oldest.mp3');
    const file2 = path.join(tempCacheDir, 'newer.mp3');
    await fs.promises.writeFile(file1, Buffer.alloc(600 * 1024)); // 600 KB
    await fs.promises.writeFile(file2, Buffer.alloc(600 * 1024)); // 600 KB -> total 1.2 MB > 1 MB

    // Make file1 older
    const olderTime = new Date(Date.now() - 3600 * 1000);
    fs.utimesSync(file1, olderTime, olderTime);

    const purgeRes = await cacheService.enforceQuota();
    expect(purgeRes.deletedFiles).toBe(1);
    expect(fs.existsSync(file1)).toBe(false);
    expect(fs.existsSync(file2)).toBe(true);
  });

  it('provides /api/media/cache/status and /api/media/cache/purge routes', async () => {
    const testFile = path.join(tempCacheDir, 'test.mp3');
    await fs.promises.writeFile(testFile, Buffer.alloc(100));

    // Test status endpoint
    const statusRes = await fetch(`${baseUrl}/api/media/cache/status`);
    expect(statusRes.status).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson.success).toBe(true);
    expect(statusJson.status.totalFiles).toBe(1);

    // Test purge endpoint
    const purgeRes = await fetch(`${baseUrl}/api/media/cache/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration: 'all' }),
    });
    expect(purgeRes.status).toBe(200);
    const purgeJson = await purgeRes.json();
    expect(purgeJson.success).toBe(true);
    expect(purgeJson.result.deletedFiles).toBe(1);
    expect(fs.existsSync(testFile)).toBe(false);
  });

  it('lists local media files via /api/media/files', async () => {
    const localSong = path.join(tempBaseDir, 'song.ogg');
    await fs.promises.writeFile(localSong, Buffer.alloc(256));

    const res = await fetch(`${baseUrl}/api/media/files`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.files.length).toBeGreaterThanOrEqual(1);
    expect(json.files.some((f: any) => f.name === 'song.ogg')).toBe(true);
  });

  it('resolves cookies.txt path when present', async () => {
    // When no cookies file exists
    expect(cacheService.resolveCookiesPath()).toBeNull();

    // Create a mock cookies.txt in tempBaseDir
    const cookiesFile = path.join(tempBaseDir, 'cookies.txt');
    await fs.promises.writeFile(cookiesFile, '# Netscape HTTP Cookie File\n');

    const resolved = cacheService.resolveCookiesPath();
    expect(resolved).toBe(cookiesFile);
  });
});
