---
title: Deployment and Observability
description: Mediasoup SFU backend deployment on Docker/Linux, SSL reverse proxy setup, and Prometheus/Grafana monitoring.
sidebar:
  order: 7
---

The VoiceEngine backend server is written in **Node.js 20+** and utilizes the native C++ **mediasoup** library to power high-concurrency, low-latency WebRTC streams.

---

## Production Deployment with Docker Compose

We recommend running the voice server via Docker Compose:

```yaml
version: '3.8'

services:
  voice-server:
    image: ghcr.io/cypherlink-studios/voiceengine-server:latest
    container_name: voiceengine-sfu
    restart: unless-stopped
    network_mode: "host" # Highly recommended for Linux WebRTC performance
    environment:
      NODE_ENV: production
      HTTP_PORT: 3000
      MEDIASOUP_MIN_PORT: 40000
      MEDIASOUP_MAX_PORT: 49999
      ANNOUNCED_IP: "203.0.113.10" # Public IP of your dedicated server
      PLUGIN_SECRET: "your-hmac-secret-key"
      JWT_SECRET: "your-jwt-secret-key"
      REDIS_URL: "redis://localhost:6379"
    volumes:
      - ./media:/app/media
      - ./cache:/app/cache
```

:::caution
The UDP port range configured under `MEDIASOUP_MIN_PORT` and `MEDIASOUP_MAX_PORT` (e.g. `40000-49999/udp`) must be open in your firewall (UFW / iptables) and cloud hosting security groups (AWS, Cloudflare Spectrum, Hetzner).
:::

---

## Nginx Reverse Proxy Setup

Proxy both HTTPS web assets and WebSocket handshakes to port `3000`:

```nginx
server {
    server_name voice.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/voice.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/voice.yourdomain.com/privkey.pem;
}
```

---

## Prometheus & Grafana Observability

VoiceEngine provides a standard Prometheus metrics endpoint at `/metrics`:

### Exposed Metrics

| Metric | Type | Description |
| :--- | :--- | :--- |
| `voiceengine_active_producers` | Gauge | Count of active microphone tracks currently transmitting. |
| `voiceengine_active_consumers` | Gauge | Count of active receiving audio streams on the SFU. |
| `voiceengine_webrtc_packet_loss` | Counter | Cumulative WebRTC audio packets lost over the network. |
| `voiceengine_audio_jitter_seconds`| Histogram | Statistical spread of transit time variation between audio packets. |
| `voiceengine_media_cache_bytes` | Gauge | Total storage occupied by cached audio and media tracks. |

### Prometheus Job Configuration (`prometheus.yml`)

```yaml
scrape_configs:
  - job_name: 'voiceengine'
    scrape_interval: 5s
    static_configs:
      - targets: ['127.0.0.1:3000']
```

A turnkey Grafana dashboard is bundled in `monitoring/grafana-dashboard.json` providing real-time graphs for SFU bitrate, concurrent users, and voice stream health.
