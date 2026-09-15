export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: DiscordEmbedField[];
  timestamp?: string;
  footer?: { text: string };
}

export class DiscordNotifier {
  private webhookUrl?: string;
  private cooldownMs: number;
  private lastAlertTimes = new Map<string, number>();
  private lagMonitorInterval?: NodeJS.Timeout;

  constructor(webhookUrl?: string, cooldownMs = 60000) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL;
    this.cooldownMs = cooldownMs;
  }

  public setWebhookUrl(url: string): void {
    this.webhookUrl = url;
  }

  public getWebhookUrl(): string | undefined {
    return this.webhookUrl;
  }

  private isRateLimited(alertKey: string, now = Date.now()): boolean {
    const last = this.lastAlertTimes.get(alertKey);
    if (last && now - last < this.cooldownMs) {
      return true;
    }
    this.lastAlertTimes.set(alertKey, now);
    return false;
  }

  public async sendAlert(embed: DiscordEmbed, alertKey: string): Promise<boolean> {
    if (!this.webhookUrl) {
      return false;
    }

    if (this.isRateLimited(alertKey)) {
      return false;
    }

    const payload = {
      username: 'VoiceEngine Health Watchdog',
      avatar_url: 'https://raw.githubusercontent.com/Cypherlink-Studios/VoiceEngine/main/icon.png',
      embeds: [
        {
          ...embed,
          timestamp: embed.timestamp || new Date().toISOString(),
          footer: embed.footer || { text: 'VoiceEngine Observability Alert' },
        },
      ],
    };

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.warn(`[DiscordNotifier] Webhook returned status ${res.status}: ${await res.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[DiscordNotifier] Failed to dispatch webhook alert:', err);
      return false;
    }
  }

  public async notifyEventLoopLag(lagMs: number, thresholdMs = 30): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: '🚨 High Event Loop Delay Alert',
      description: 'Node.js event loop lag exceeded safe operational threshold.',
      color: 0xe74c3c, // Red
      fields: [
        { name: 'Current Lag', value: `\`${lagMs.toFixed(2)} ms\``, inline: true },
        { name: 'Threshold', value: `\`${thresholdMs} ms\``, inline: true },
        { name: 'Impact', value: 'Audio spatial batch jitter and delayed consumer negotiation', inline: false },
      ],
    };

    return this.sendAlert(embed, 'event_loop_lag');
  }

  public async notifyWorkerHighCpu(
    workerIndex: number,
    pid: number,
    cpuPercent: number,
    threshold = 85
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: '⚠️ Mediasoup SFU Worker High CPU',
      description: `SFU Worker #${workerIndex} CPU utilization is critically high.`,
      color: 0xf1c40f, // Amber
      fields: [
        { name: 'Worker Index', value: `#${workerIndex}`, inline: true },
        { name: 'PID', value: `${pid}`, inline: true },
        { name: 'CPU Usage', value: `\`${cpuPercent.toFixed(1)}%\``, inline: true },
        { name: 'Threshold', value: `\`${threshold}%\``, inline: true },
      ],
    };

    return this.sendAlert(embed, `worker_cpu_${workerIndex}`);
  }

  public startEventLoopLagMonitor(intervalMs = 2000, thresholdMs = 30): void {
    if (this.lagMonitorInterval) {
      return;
    }

    let expected = Date.now() + intervalMs;
    this.lagMonitorInterval = setInterval(() => {
      const now = Date.now();
      const lag = Math.max(0, now - expected);
      expected = now + intervalMs;

      if (lag > thresholdMs) {
        this.notifyEventLoopLag(lag, thresholdMs).catch(() => {});
      }
    }, intervalMs);

    this.lagMonitorInterval.unref();
  }

  public stop(): void {
    if (this.lagMonitorInterval) {
      clearInterval(this.lagMonitorInterval);
      this.lagMonitorInterval = undefined;
    }
  }
}
