import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

import { BinaryResolver } from './BinaryResolver.js';

export interface CachedMediaMetadata {
  hash: string;
  sourceUrl: string;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  cachedAt: number;
  lastAccessedAt: number;
}

export interface CacheStatus {
  totalFiles: number;
  totalSizeBytes: number;
  maxSizeBytes: number;
  oldestFile?: {
    fileName: string;
    lastAccessedMs: number;
    ageDays: number;
  };
}

export interface PurgeResult {
  deletedFiles: number;
  reclaimedBytes: number;
}

export class MediaCacheService {
  private cacheDir: string;
  private maxCacheSizeMb: number;
  private maxCacheAgeDays: number;

  constructor(
    cacheDir: string = config.mediaCacheDir,
    maxCacheSizeMb: number = config.mediaMaxCacheSizeMb,
    maxCacheAgeDays: number = config.mediaMaxCacheAgeDays
  ) {
    this.cacheDir = path.resolve(cacheDir);
    this.maxCacheSizeMb = maxCacheSizeMb;
    this.maxCacheAgeDays = maxCacheAgeDays;
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  public getHash(url: string): string {
    return crypto.createHash('sha256').update(url.trim()).digest('hex').slice(0, 16);
  }

  public getCachedFilePath(url: string, extension: string = '.mp3'): string {
    const hash = this.getHash(url);
    return path.join(this.cacheDir, `${hash}${extension}`);
  }

  public isCached(url: string): boolean {
    const hash = this.getHash(url);
    const files = fs.readdirSync(this.cacheDir);
    return files.some((f) => f.startsWith(hash) && !f.endsWith('.json'));
  }

  public async getOrDownload(url: string): Promise<CachedMediaMetadata> {
    this.ensureDir();
    const hash = this.getHash(url);
    const files = fs.readdirSync(this.cacheDir);
    const existingAudio = files.find((f) => f.startsWith(hash) && !f.endsWith('.json'));

    if (existingAudio) {
      const fullPath = path.join(this.cacheDir, existingAudio);
      const stats = fs.statSync(fullPath);
      // Touch mtime for LRU eviction tracking
      const now = new Date();
      fs.utimesSync(fullPath, now, now);

      return {
        hash,
        sourceUrl: url,
        filePath: fullPath,
        fileName: existingAudio,
        fileSizeBytes: stats.size,
        cachedAt: stats.birthtimeMs || stats.ctimeMs,
        lastAccessedAt: Date.now(),
      };
    }

    // Determine if this is a YouTube/SoundCloud URL or direct audio stream
    const isPlatformUrl = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)*(youtube\.com|youtu\.be|soundcloud\.com)/i.test(url);
    const targetFile = path.join(this.cacheDir, `${hash}.mp3`);

    if (isPlatformUrl) {
      await this.downloadWithYtDlp(url, targetFile);
    } else {
      await this.downloadDirect(url, targetFile);
    }

    const stats = fs.statSync(targetFile);
    const meta: CachedMediaMetadata = {
      hash,
      sourceUrl: url,
      filePath: targetFile,
      fileName: path.basename(targetFile),
      fileSizeBytes: stats.size,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    // Save metadata JSON
    const metaFile = path.join(this.cacheDir, `${hash}.json`);
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');

    // Run auto-quota enforcement
    await this.enforceQuota();

    return meta;
  }

  private async downloadDirect(url: string, destPath: string): Promise<void> {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VoiceEngine/1.0 (MediaDownloader)' },
    });
    if (!res.ok) {
      throw new Error(`Failed to download audio from ${url}: HTTP ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error(`The provided URL returned HTML webpage content instead of an audio stream (${contentType}). If this is a streaming platform (like YouTube or SoundCloud), verify the link and domain format.`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
  }

  public resolveCookiesPath(): string | null {
    if (config.ytCookiesPath && fs.existsSync(config.ytCookiesPath)) {
      return path.resolve(config.ytCookiesPath);
    }
    const candidates = [
      path.resolve(process.cwd(), 'cookies.txt'),
      path.resolve(this.cacheDir, '..', 'cookies.txt'),
      path.resolve(this.cacheDir, 'cookies.txt'),
      path.resolve(config.mediaDir, 'cookies.txt'),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
    return null;
  }

  private async downloadWithYtDlp(url: string, destPath: string): Promise<void> {
    const ytDlpPath = BinaryResolver.getYtDlpPath();
    if (!ytDlpPath) {
      const installHint = process.platform === 'win32'
        ? 'Install with "pip install yt-dlp" and "winget install Gyan.FFmpeg", or configure YT_DLP_PATH.'
        : 'Install with "pip install yt-dlp" (or "sudo apt install yt-dlp ffmpeg"), or configure YT_DLP_PATH.';
      throw new Error(`yt-dlp executable was not found on the host system. ${installHint}`);
    }

    const ffmpegPath = BinaryResolver.getFfmpegPath();
    const args = [
      '-x',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
      '--no-playlist',
      // Pass Node.js as the JavaScript runtime for challenge solving (EJS)
      '--js-runtimes',
      `node:${process.execPath}`,
      // Bypass datacenter IP bot-check blocks by prioritizing mobile client APIs
      '--extractor-args',
      'youtube:player_client=android,ios,web',
    ];

    if (ffmpegPath) {
      args.push('--ffmpeg-location', ffmpegPath);
    }

    const cookiesPath = this.resolveCookiesPath();
    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }

    args.push('-o', destPath, url);

    try {
      await execFileAsync(ytDlpPath, args, {
        env: BinaryResolver.getExecutionEnvironment(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`yt-dlp extraction failed: ${msg}. Verify yt-dlp and ffmpeg configuration.`);
    }
  }

  public getCacheStatus(): CacheStatus {
    this.ensureDir();
    const files = fs.readdirSync(this.cacheDir);
    let totalSizeBytes = 0;
    let oldestFile: CacheStatus['oldestFile'] = undefined;
    let oldestTime = Infinity;
    let audioFileCount = 0;

    for (const file of files) {
      if (file.endsWith('.json')) continue;
      const fullPath = path.join(this.cacheDir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          audioFileCount++;
          totalSizeBytes += stats.size;
          const accessedTime = stats.mtimeMs;
          if (accessedTime < oldestTime) {
            oldestTime = accessedTime;
            const ageDays = (Date.now() - accessedTime) / (1000 * 60 * 60 * 24);
            oldestFile = {
              fileName: file,
              lastAccessedMs: accessedTime,
              ageDays: Math.round(ageDays * 10) / 10,
            };
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return {
      totalFiles: audioFileCount,
      totalSizeBytes,
      maxSizeBytes: this.maxCacheSizeMb * 1024 * 1024,
      oldestFile,
    };
  }

  public purgeCache(options?: { maxAgeMs?: number; purgeAll?: boolean }): PurgeResult {
    this.ensureDir();
    const files = fs.readdirSync(this.cacheDir);
    let deletedFiles = 0;
    let reclaimedBytes = 0;
    const now = Date.now();

    for (const file of files) {
      const fullPath = path.join(this.cacheDir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) continue;

        let shouldDelete = false;

        if (options?.purgeAll) {
          shouldDelete = true;
        } else if (options?.maxAgeMs !== undefined) {
          if (now - stats.mtimeMs >= options.maxAgeMs) {
            shouldDelete = true;
          }
        }

        if (shouldDelete) {
          reclaimedBytes += stats.size;
          fs.unlinkSync(fullPath);
          deletedFiles++;

          // If this was an audio file, also delete its sibling .json metadata if exists
          const baseName = path.parse(file).name;
          const metaPath = path.join(this.cacheDir, `${baseName}.json`);
          if (fs.existsSync(metaPath)) {
            try {
              const metaStats = fs.statSync(metaPath);
              reclaimedBytes += metaStats.size;
              fs.unlinkSync(metaPath);
            } catch {}
          }
        }
      } catch {}
    }

    return { deletedFiles, reclaimedBytes };
  }

  public async enforceQuota(): Promise<PurgeResult> {
    this.ensureDir();
    const maxBytes = this.maxCacheSizeMb * 1024 * 1024;
    const files = fs.readdirSync(this.cacheDir).filter((f) => !f.endsWith('.json'));

    interface FileEntry {
      name: string;
      fullPath: string;
      size: number;
      mtime: number;
    }

    const entries: FileEntry[] = [];
    let currentTotalBytes = 0;

    for (const file of files) {
      const fullPath = path.join(this.cacheDir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          entries.push({
            name: file,
            fullPath,
            size: stats.size,
            mtime: stats.mtimeMs,
          });
          currentTotalBytes += stats.size;
        }
      } catch {}
    }

    if (currentTotalBytes <= maxBytes) {
      return { deletedFiles: 0, reclaimedBytes: 0 };
    }

    // Sort oldest first (LRU eviction)
    entries.sort((a, b) => a.mtime - b.mtime);

    let deletedFiles = 0;
    let reclaimedBytes = 0;

    for (const entry of entries) {
      if (currentTotalBytes - reclaimedBytes <= maxBytes) break;

      try {
        fs.unlinkSync(entry.fullPath);
        deletedFiles++;
        reclaimedBytes += entry.size;

        const baseName = path.parse(entry.name).name;
        const metaPath = path.join(this.cacheDir, `${baseName}.json`);
        if (fs.existsSync(metaPath)) {
          fs.unlinkSync(metaPath);
        }
      } catch {}
    }

    return { deletedFiles, reclaimedBytes };
  }
}
