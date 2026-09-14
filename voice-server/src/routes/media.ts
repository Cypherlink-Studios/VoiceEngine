import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.webm': 'audio/webm',
  '.flac': 'audio/flac',
};

import { MediaCacheService } from '../media/MediaCacheService.js';

function parseDurationToMs(durationStr: string): number | null {
  const match = durationStr.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

function getEffectiveMediaDirs(): string[] {
  const dirs = [config.mediaDir, ...(config.mediaDirs || [])];
  return Array.from(new Set(dirs.filter(Boolean).map((d) => path.resolve(d))));
}

export function createMediaRouter(cacheService: MediaCacheService = new MediaCacheService()): Router {
  const router = Router();

  // Cache Status Endpoint
  router.get('/cache/status', (_req: Request, res: Response) => {
    try {
      const status = cacheService.getCacheStatus();
      res.json({ success: true, status });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query cache status';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // Cache Purge Endpoint
  router.post('/cache/purge', (req: Request, res: Response) => {
    try {
      const { duration, purgeAll } = req.body || {};
      if (purgeAll || duration === 'all') {
        const result = cacheService.purgeCache({ purgeAll: true });
        res.json({ success: true, result });
        return;
      }

      if (duration && typeof duration === 'string') {
        const ms = parseDurationToMs(duration);
        if (ms === null) {
          res.status(400).json({ success: false, error: 'Invalid duration format (e.g. 7d, 24h, 30m, all)' });
          return;
        }
        const result = cacheService.purgeCache({ maxAgeMs: ms });
        res.json({ success: true, result });
        return;
      }

      // Default purge: purge older than maxCacheAgeDays
      const maxAgeMs = config.mediaMaxCacheAgeDays * 24 * 60 * 60 * 1000;
      const result = cacheService.purgeCache({ maxAgeMs });
      res.json({ success: true, result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to purge cache';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // List Local Media Files
  router.get('/files', (_req: Request, res: Response) => {
    try {
      const baseDirs = getEffectiveMediaDirs();

      const seenNames = new Set<string>();
      const audioFiles = [];

      for (const baseDir of baseDirs) {
        const resolvedBase = path.resolve(baseDir);
        if (!fs.existsSync(resolvedBase)) continue;

        try {
          const files = fs.readdirSync(resolvedBase);
          for (const file of files) {
            if (seenNames.has(file)) continue;
            const fullPath = path.join(resolvedBase, file);
            try {
              const stats = fs.statSync(fullPath);
              if (stats.isFile()) {
                const ext = path.extname(file).toLowerCase();
                if (MIME_TYPES[ext]) {
                  seenNames.add(file);
                  audioFiles.push({
                    name: file,
                    sizeBytes: stats.size,
                    format: ext.replace('.', ''),
                    updatedAt: stats.mtimeMs,
                  });
                }
              }
            } catch {}
          }
        } catch {}
      }

      res.json({ success: true, files: audioFiles });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to list media files';
      res.status(500).json({ success: false, error: msg });
    }
  });

  // CORS Proxy for external internet streams
  router.get('/proxy', async (req: Request, res: Response) => {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "url" query parameter' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        res.status(400).json({ error: 'Protocol must be http: or https:' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Invalid URL format' });
      return;
    }

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'VoiceEngine/1.0 (AudioProxy)',
      };
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const remoteRes = await fetch(parsedUrl.toString(), { headers });

      res.status(remoteRes.status);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

      const contentType = remoteRes.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);

      const contentRange = remoteRes.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);

      const contentLength = remoteRes.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      const acceptRanges = remoteRes.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

      if (!remoteRes.body) {
        res.end();
        return;
      }

      // Pipe remote web stream to Express response
      const reader = remoteRes.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!res.write(value)) {
              await new Promise<void>((resolve) => res.once('drain', resolve));
            }
          }
          res.end();
        } catch (err) {
          reader.cancel().catch(() => {});
          res.end();
        }
      };
      pump();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown proxy error';
      res.status(502).json({ error: 'Proxy request failed', message: msg });
    }
  });

  // Static media file streaming with HTTP 206 Partial Content
  router.get('/*', (req: Request, res: Response) => {
    const rawPath = req.params[0];
    if (!rawPath) {
      res.status(400).json({ error: 'No media file specified' });
      return;
    }

    let decodedSubpath: string;
    try {
      decodedSubpath = decodeURIComponent(rawPath);
    } catch {
      res.status(400).json({ error: 'Malformed path encoding' });
      return;
    }

    // Prevent directory traversal
    const normalized = path.normalize(decodedSubpath);
    if (normalized.startsWith('..') || decodedSubpath.split(/[\/\\]/).includes('..')) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const baseDirs = getEffectiveMediaDirs();
    let targetFile: string | null = null;

    for (const safeBase of baseDirs) {
      const candidate = path.resolve(safeBase, decodedSubpath);
      if (!candidate.startsWith(safeBase)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (fs.existsSync(candidate)) {
        try {
          const stats = fs.statSync(candidate);
          if (!stats.isDirectory()) {
            targetFile = candidate;
            break;
          }
        } catch {}
      }
    }

    if (!targetFile) {
      res.status(404).json({ error: 'Media file not found' });
      return;
    }

    let stats: fs.Stats;
    try {
      stats = fs.statSync(targetFile);
    } catch {
      res.status(500).json({ error: 'Unable to read file metadata' });
      return;
    }

    if (stats.isDirectory()) {
      res.status(400).json({ error: 'Requested path is a directory' });
      return;
    }

    const fileSize = stats.size;
    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);

    const rangeHeader = req.headers.range;

    if (!rangeHeader) {
      // Full file response
      res.setHeader('Content-Length', fileSize);
      res.status(200);
      const stream = fs.createReadStream(targetFile);
      stream.pipe(res);
      return;
    }

    // Parse Range: bytes=start-end
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.status(416).end();
      return;
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    // Handle range suffix: bytes=-500 (last 500 bytes)
    if (!match[1] && match[2]) {
      const suffix = parseInt(match[2], 10);
      start = Math.max(0, fileSize - suffix);
      end = fileSize - 1;
    }

    if (start >= fileSize || end >= fileSize || start > end) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.status(416).end();
      return;
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);

    const stream = fs.createReadStream(targetFile, { start, end });
    stream.pipe(res);
  });

  return router;
}
