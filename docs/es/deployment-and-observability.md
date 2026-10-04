---
title: Despliegue y Observabilidad
description: Despliegue del backend SFU mediasoup en Docker/Linux, proxy inverso SSL y monitorización con Prometheus y Grafana.
sidebar:
  order: 7
---

El backend de VoiceEngine está desarrollado en **Node.js 20+** utilizando la biblioteca nativa en C++ **mediasoup** para gestionar flujos WebRTC de alta concurrencia y baja latencia.

---

## Despliegue con Docker Compose

La forma recomendada de desplegar el servidor de voz en producción es mediante contenedor Docker:

```yaml
version: '3.8'

services:
  voice-server:
    image: ghcr.io/cypherlink-studios/voiceengine-server:latest
    container_name: voiceengine-sfu
    restart: unless-stopped
    network_mode: "host" # Recomendado para rendimiento WebRTC en Linux
    environment:
      NODE_ENV: production
      HTTP_PORT: 3000
      MEDIASOUP_MIN_PORT: 40000
      MEDIASOUP_MAX_PORT: 49999
      ANNOUNCED_IP: "203.0.113.10" # IP pública de tu servidor dedicado
      PLUGIN_SECRET: "tu-clave-secreta-hmac"
      JWT_SECRET: "tu-clave-jwt-secreta"
      REDIS_URL: "redis://localhost:6379"
    volumes:
      - ./media:/app/media
      - ./cache:/app/cache
```

:::caution
El rango de puertos UDP configurado en `MEDIASOUP_MIN_PORT` y `MEDIASOUP_MAX_PORT` (por ejemplo, `40000-49999/udp`) debe estar abierto en tu cortafuegos (UFW / iptables) y en el panel de tu proveedor de hosting (AWS Security Groups, Cloudflare Spectrum o Hetzner).
:::

---

## Configuración de Proxy Inverso (Nginx)

El servidor web necesita redirigir tráfico HTTPS y WebSocket al puerto `3000`:

```nginx
server {
    server_name voice.tudominio.com;

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
    ssl_certificate /etc/letsencrypt/live/voice.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/voice.tudominio.com/privkey.pem;
}
```

---

## Métricas y Monitorización con Prometheus y Grafana

VoiceEngine expone un endpoint estándar de métricas en `/metrics` formateado para Prometheus:

### Métricas Clave Expuestas

| Métrica | Tipo | Descripción |
| :--- | :--- | :--- |
| `voiceengine_active_producers` | Gauge | Cantidad de pistas de micrófonos activas transmitiendo audio. |
| `voiceengine_active_consumers` | Gauge | Cantidad de canales receptores activos en el servidor SFU. |
| `voiceengine_webrtc_packet_loss` | Counter | Número de paquetes de audio perdidos por degradación de red. |
| `voiceengine_audio_jitter_seconds`| Histogram | Dispersión de latencia temporal entre paquetes de audio. |
| `voiceengine_media_cache_bytes` | Gauge | Espacio total ocupado en disco por archivos de audio en caché. |

### Configuración en `prometheus.yml`

```yaml
scrape_configs:
  - job_name: 'voiceengine'
    scrape_interval: 5s
    static_configs:
      - targets: ['127.0.0.1:3000']
```

El repositorio incluye un panel prediseñado para Grafana en `monitoring/grafana-dashboard.json` que grafica el rendimiento en tiempo real, latencias y consumo de ancho de banda.
