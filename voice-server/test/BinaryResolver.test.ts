import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { BinaryResolver } from '../src/media/BinaryResolver.js';

describe('BinaryResolver (Cross-Platform yt-dlp & ffmpeg detection)', () => {
  it('returns candidate search directories for current platform', () => {
    const dirs = BinaryResolver.getCandidateDirectories();
    expect(dirs).toBeInstanceOf(Array);
    expect(dirs.length).toBeGreaterThan(0);

    // Should include path delimiter items from PATH
    const envPath = process.env.PATH || process.env.Path || '';
    const firstEnvDir = envPath.split(path.delimiter).map((p) => p.trim()).filter(Boolean)[0];
    if (firstEnvDir) {
      expect(dirs).toContain(firstEnvDir);
    }
  });

  it('resolves explicit custom binary path when configured and existing', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 've-bin-test-'));
    const isWindows = process.platform === 'win32';
    const fakeBinName = isWindows ? 'custom-tool.exe' : 'custom-tool';
    const fakeBinPath = path.join(tempDir, fakeBinName);

    // Create fake executable file
    await fs.promises.writeFile(fakeBinPath, 'echo "fake"');
    if (!isWindows) {
      await fs.promises.chmod(fakeBinPath, 0o755);
    }

    try {
      const resolved = BinaryResolver.resolveBinary('custom-tool', fakeBinPath);
      expect(resolved).toBe(path.resolve(fakeBinPath));
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns null for non-existent binary', () => {
    const resolved = BinaryResolver.resolveBinary('completely-non-existent-binary-xyz-12345');
    expect(resolved).toBeNull();
  });

  it('generates execution environment containing PATH', () => {
    const env = BinaryResolver.getExecutionEnvironment();
    expect(env).toBeDefined();
    const resolvedPath = env.PATH || env.Path;
    expect(resolvedPath).toBeDefined();
    expect(typeof resolvedPath).toBe('string');
    expect((resolvedPath as string).length).toBeGreaterThan(0);
  });

  it('executes checkDependencies and returns structured status for yt-dlp and ffmpeg', async () => {
    const status = await BinaryResolver.checkDependencies();
    expect(status).toHaveProperty('ytDlp');
    expect(status).toHaveProperty('ffmpeg');
    expect(status).toHaveProperty('allAvailable');

    expect(typeof status.ytDlp.found).toBe('boolean');
    expect(typeof status.ffmpeg.found).toBe('boolean');

    if (status.ytDlp.found) {
      expect(status.ytDlp.path).toBeDefined();
    }
    if (status.ffmpeg.found) {
      expect(status.ffmpeg.path).toBeDefined();
    }
  });
});
