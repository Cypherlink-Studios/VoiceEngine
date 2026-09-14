import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

export interface BinaryResolution {
  name: string;
  found: boolean;
  path?: string;
  version?: string;
  error?: string;
}

export interface DependenciesStatus {
  ytDlp: BinaryResolution;
  ffmpeg: BinaryResolution;
  allAvailable: boolean;
}

export class BinaryResolver {
  private static cachedYtDlpPath: string | null = null;
  private static cachedFfmpegPath: string | null = null;

  /**
   * Retrieves all candidate search directories based on current operating system.
   */
  public static getCandidateDirectories(): string[] {
    const isWindows = process.platform === 'win32';
    const dirs: string[] = [];

    // 1. Process environment PATH
    const envPath = process.env.PATH || process.env.Path || '';
    const systemPaths = envPath.split(path.delimiter).map((p) => p.trim()).filter(Boolean);
    dirs.push(...systemPaths);

    const homedir = os.homedir();

    if (isWindows) {
      const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
      const appData = process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming');

      // Python Scripts in LocalAppData / AppData
      const pythonBases = [
        path.join(localAppData, 'Programs', 'Python'),
        path.join(localAppData, 'Python'),
        path.join(appData, 'Python'),
      ];

      for (const base of pythonBases) {
        if (fs.existsSync(base)) {
          try {
            const entries = fs.readdirSync(base, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const scriptsDir = path.join(base, entry.name, 'Scripts');
                if (fs.existsSync(scriptsDir)) {
                  dirs.push(scriptsDir);
                }
              }
            }
          } catch {}
        }
      }

      // Winget Packages (e.g. Gyan.FFmpeg)
      const wingetBase = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
      if (fs.existsSync(wingetBase)) {
        try {
          const packages = fs.readdirSync(wingetBase, { withFileTypes: true });
          for (const pkg of packages) {
            if (pkg.isDirectory()) {
              const pkgDir = path.join(wingetBase, pkg.name);
              try {
                const subEntries = fs.readdirSync(pkgDir, { withFileTypes: true });
                for (const sub of subEntries) {
                  if (sub.isDirectory()) {
                    const candidateBin = path.join(pkgDir, sub.name, 'bin');
                    if (fs.existsSync(candidateBin)) {
                      dirs.push(candidateBin);
                    }
                  }
                }
              } catch {}
              const directBin = path.join(pkgDir, 'bin');
              if (fs.existsSync(directBin)) {
                dirs.push(directBin);
              }
            }
          }
        } catch {}
      }

      // Winget Links
      const wingetLinks = path.join(localAppData, 'Microsoft', 'WinGet', 'Links');
      if (fs.existsSync(wingetLinks)) {
        dirs.push(wingetLinks);
      }

      // Common Windows static installations
      const wellKnownWindows = [
        'C:\\Program Files\\ffmpeg\\bin',
        'C:\\Program Files (x86)\\ffmpeg\\bin',
        'C:\\ffmpeg\\bin',
        'C:\\ProgramData\\chocolatey\\bin',
        path.join(homedir, 'scoop', 'shims'),
      ];
      dirs.push(...wellKnownWindows.filter((d) => fs.existsSync(d)));
    } else {
      // Linux, Unix, macOS candidates
      const wellKnownUnix = [
        path.join(homedir, '.local', 'bin'), // pip install --user standard
        path.join(homedir, 'bin'),
        path.join(homedir, '.cargo', 'bin'),
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/snap/bin',
        '/var/lib/snapd/snap/bin',
        '/opt/homebrew/bin', // macOS Homebrew (Apple Silicon)
        '/usr/local/opt/ffmpeg/bin',
      ];
      dirs.push(...wellKnownUnix.filter((d) => fs.existsSync(d)));
    }

    // Deduplicate while preserving order
    return Array.from(new Set(dirs));
  }

  /**
   * Tests if a given file path is executable.
   */
  private static isExecutable(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) return false;
      if (process.platform === 'win32') return true;
      // On POSIX, check X_OK bit
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolves the full path to an executable binary.
   */
  public static resolveBinary(binaryName: string, explicitConfigPath?: string): string | null {
    // 1. If explicit config/env path is provided and exists, use it
    if (explicitConfigPath && explicitConfigPath.trim()) {
      const explicit = path.resolve(explicitConfigPath.trim());
      if (fs.existsSync(explicit) && this.isExecutable(explicit)) {
        return explicit;
      }
    }

    const isWindows = process.platform === 'win32';
    const extensions = isWindows ? ['', '.exe', '.cmd', '.bat'] : [''];
    const searchDirs = this.getCandidateDirectories();

    for (const dir of searchDirs) {
      for (const ext of extensions) {
        const fullPath = path.join(dir, `${binaryName}${ext}`);
        if (fs.existsSync(fullPath) && this.isExecutable(fullPath)) {
          return fullPath;
        }
      }
    }

    return null;
  }

  /**
   * Returns resolved yt-dlp executable path or null if not found.
   */
  public static getYtDlpPath(): string | null {
    if (!this.cachedYtDlpPath) {
      this.cachedYtDlpPath = this.resolveBinary('yt-dlp', config.ytDlpPath);
    }
    return this.cachedYtDlpPath;
  }

  /**
   * Returns resolved ffmpeg executable path or null if not found.
   */
  public static getFfmpegPath(): string | null {
    if (!this.cachedFfmpegPath) {
      this.cachedFfmpegPath = this.resolveBinary('ffmpeg', config.ffmpegPath);
    }
    return this.cachedFfmpegPath;
  }

  /**
   * Generates execution environment with all candidate directories prepended to PATH.
   */
  public static getExecutionEnvironment(): NodeJS.ProcessEnv {
    const candidateDirs = this.getCandidateDirectories();
    const ffmpegPath = this.getFfmpegPath();
    const ytDlpPath = this.getYtDlpPath();

    const extraDirs: string[] = [];
    if (ffmpegPath) {
      extraDirs.push(path.dirname(ffmpegPath));
    }
    if (ytDlpPath) {
      extraDirs.push(path.dirname(ytDlpPath));
    }

    const merged = Array.from(new Set([...extraDirs, ...candidateDirs]));
    const pathString = merged.join(path.delimiter);

    return {
      ...process.env,
      PATH: pathString,
      Path: pathString,
    };
  }

  /**
   * Asynchronously checks status and versions of yt-dlp and ffmpeg across Windows/Linux.
   */
  public static async checkDependencies(): Promise<DependenciesStatus> {
    const ytPath = this.getYtDlpPath();
    const ffPath = this.getFfmpegPath();
    const env = this.getExecutionEnvironment();

    const ytStatus: BinaryResolution = {
      name: 'yt-dlp',
      found: !!ytPath,
      path: ytPath || undefined,
    };

    if (ytPath) {
      try {
        const { stdout } = await execFileAsync(ytPath, ['--version'], { env, timeout: 5000 });
        ytStatus.version = stdout.trim();
      } catch (err: unknown) {
        ytStatus.error = err instanceof Error ? err.message : String(err);
      }
    } else {
      ytStatus.error = process.platform === 'win32'
        ? 'Not found. Install with "pip install yt-dlp" or "winget install yt-dlp.yt-dlp"'
        : 'Not found. Install with "pip install yt-dlp" or "sudo apt install yt-dlp"';
    }

    const ffStatus: BinaryResolution = {
      name: 'ffmpeg',
      found: !!ffPath,
      path: ffPath || undefined,
    };

    if (ffPath) {
      try {
        const { stdout } = await execFileAsync(ffPath, ['-version'], { env, timeout: 5000 });
        const firstLine = stdout.split('\n')[0] || '';
        ffStatus.version = firstLine.trim();
      } catch (err: unknown) {
        ffStatus.error = err instanceof Error ? err.message : String(err);
      }
    } else {
      ffStatus.error = process.platform === 'win32'
        ? 'Not found. Install with "winget install Gyan.FFmpeg" or download from ffmpeg.org'
        : 'Not found. Install with "sudo apt install ffmpeg"';
    }

    return {
      ytDlp: ytStatus,
      ffmpeg: ffStatus,
      allAvailable: ytStatus.found && ffStatus.found,
    };
  }
}
