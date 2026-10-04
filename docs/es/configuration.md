---
title: Configuración del Sistema
description: Referencia exhaustiva de directivas de configuración en Paper y proxy Velocity.
sidebar:
  order: 3
---

Esta guía detalla exhaustivamente todos los parámetros disponibles en los archivos de configuración de Paper (`config.yml`) y Velocity (`velocity-config.yml`).

---

## Configuración de Paper (`config.yml`)

El archivo se encuentra en `plugins/VoiceEngine/config.yml`.

```yaml
# URL de conexión WebSocket con el servidor backend SFU
voice-server-url: "ws://localhost:3000/ws/plugin"

# URL pública del cliente web enviada a los usuarios en /voice
web-client-url: "http://localhost:5173"

# Clave secreta compartida para autenticación HMAC entre Paper y el backend
secret-key: "change-me-to-a-secure-random-secret"

# Frecuencia de envío de telemetría de posición en Hz (10 a 15 recomendado)
tick-rate-hz: 10

# Tiempo de expiración del token de sesión de 6 caracteres (en minutos)
token-ttl-minutes: 5

# Mostrar mensaje en el chat al conectarse invitando a unirse a la llamada
notify-on-join: true

# Idioma por defecto cuando el cliente no envía locale reconocido (en_US, es_ES)
default-locale: "es_ES"

# Identificador de este nodo en la red
server-id: "default"

# Modo proxy: 'auto', 'true' o 'false'
# 'true' suprime el comando local /voice y delega la sesión a Velocity
proxy-mode: "auto"

# Mecánicas acústicas y jugabilidad en el mundo
mechanics:
  # Reduce el radio de proximidad a 8 bloques al agacharse (Shift)
  whisper-on-sneak: true

  # Aplica un filtro pasa-bajos biquad amortiguado (600 Hz) bajo el agua
  underwater-acoustics: true

  # Muestra partículas de notas musicales sobre la cabeza de quien habla
  speaking-particles: true

  # Comportamiento de espectadores: 'listen-only', 'isolated', 'all'
  spectator-mode: "listen-only"

# Bloques parlantes (altavoces de proximidad y jukeboxes)
speakers:
  max-radius: 100
  default-radius: 30

# Emisores dinámicos de audio 3D
audio-emitters:
  max-emitters: 50
  particle-indicators: true
```

### Explicación de Secciones Clave de Paper

| Propiedad | Tipo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `tick-rate-hz` | `integer` | `10` | Frecuencia con la que el plugin empaqueta la posición `(x, y, z)` y orientación `(yaw, pitch)` de los jugadores hacia el SFU. Valores de 10 a 15 ofrecen suavidad óptima sin sobrecargar la red. |
| `proxy-mode` | `string` | `"auto"` | Cuando está en `auto`, detecta si Velocity está activo en `paper-global.yml`. Si se fija en `true`, silencia avisos y delega la gestión de tokens al proxy. |
| `mechanics.whisper-on-sneak` | `boolean` | `true` | Si es verdadero, comprime el radio auditivo normal (30 bloques) a 8 bloques mientras el jugador mantiene la tecla de agacharse. |
| `mechanics.underwater-acoustics` | `boolean` | `true` | Aplica una amortiguación física de 600 Hz en la Web Audio API si el emisor o el receptor tienen la cabeza sumergida en agua. |
| `mechanics.spectator-mode` | `string` | `"listen-only"` | Define las reglas de aislamiento para el modo espectador (`listen-only`: escuchan a los vivos pero no pueden hablarles; `isolated`: sala propia entre espectadores; `all`: sin restricciones). |

---

## Configuración de Velocity (`velocity-config.yml`)

El archivo se encuentra en `plugins/voiceengine-velocity/velocity-config.yml`.

```yaml
# Dirección WebSocket del backend de voz SFU
voice-server-url: "ws://localhost:3000/ws/plugin"

# URL base pública del frontend web
web-client-url: "http://localhost:5173"

# Clave secreta compartida (debe coincidir con el backend y los servidores Paper)
secret-key: "change-me-to-a-secure-random-secret"

# Tiempo de vida del token de un solo uso en minutos
token-ttl-minutes: 5

# Notificar en chat a los jugadores al entrar a la red
notify-on-join: true

# Mensaje de bienvenida formateado con Adventure MiniMessage
join-message: "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <gray>¡El chat de voz por proximidad está disponible! Escribe <click:run_command:'/voice'><hover:show_text:'<gray>Clic para abrir enlace</gray>'><yellow>/voice</yellow></hover></click> para conectarte.</gray>"
```

:::tip
Ambos archivos admiten recarga en caliente en tiempo de ejecución:
- En Paper: `/voice reload` (permiso: `voiceengine.admin.reload`).
- En Velocity: `/voice-velocity reload` (permiso: `voiceengine.admin`).
:::
