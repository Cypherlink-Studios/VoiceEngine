---
title: Comandos y Permisos
description: Árbol de comandos y nodos de permisos en Paper y Velocity con autocompletado y validación.
sidebar:
  order: 4
---

VoiceEngine implementa el framework **Incendo Cloud v2** con integración nativa a Brigadier de Mojang en Paper y Cloud Velocity en el proxy, ofreciendo validación estricta y autocompletado asíncrono en tiempo real.

---

## Comandos en Servidores Paper

### Alias Disponibles
Cualquiera de los siguientes alias raíz puede ser utilizado indistintamente:
`/voice`, `/ve`, `/voiceengine`, `/audio`.

### Comandos de Jugador y Administración

| Comando | Permiso | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `/voice` | `voiceengine.use` | Todos (`true`) | Genera un token de sesión de 6 caracteres y muestra el enlace clicable para abrir el cliente web. |
| `/voice admin` | `voiceengine.admin` | OP | Genera un token con privilegios de administrador y abre el panel web. |
| `/voice reload` | `voiceengine.admin.reload` | OP | Recarga `config.yml`, idiomas, emisores de audio y bloques parlantes sin reiniciar el servidor. |
| `/voice status` | `voiceengine.admin.status` | OP | Muestra el estado de la conexión WebSocket con el backend, reintentos y tokens activos. |

### Comandos de Bloques Parlantes (`/voice speaker`)

Requieren el permiso `voiceengine.admin.speaker` (por defecto OP):

| Comando | Argumentos | Descripción |
| :--- | :--- | :--- |
| `/voice speaker create` | `<id> [radio]` | Registra el bloque al que estás mirando como altavoz con radio configurable (defecto: 30 bloques). |
| `/voice speaker remove` | `<id>` | Desregistra y elimina el altavoz. |
| `/voice speaker link` | `<id> <jugador>` | Vincula el micrófono de un jugador conectado para que su voz se amplifique a través del bloque. |
| `/voice speaker unlink` | `<id>` | Desvincula cualquier micrófono de jugador activo del bloque. |
| `/voice speaker redstone` | `<id> <true\|false>` | Alterna si el altavoz requiere señal de Redstone para emitir sonido. |
| `/voice speaker play` | `<id> <fuente>` | Inicia la reproducción de una pista o stream a través del altavoz. |
| `/voice speaker stop` | `<id>` | Detiene la reproducción en el altavoz especificado. |
| `/voice speaker list` | *Ninguno* | Lista todos los altavoces registrados, sus coordenadas, radio y estado. |

### Comandos de Emisores de Audio (`/voice audio`)

Requieren el permiso `voiceengine.admin.audio` (por defecto OP):

| Comando | Argumentos | Modificadores | Descripción |
| :--- | :--- | :--- | :--- |
| `/voice audio play` | `<id> <fuente> <x> <y> <z> [radio]` | `--loop` | Inicia una reproducción espacial 3D en coordenadas específicas con repetición opcional. |
| `/voice audio broadcast` | `<id> <fuente>` | *Ninguno* | Emisión no espacial en 2D que escuchan todos los jugadores por igual en el servidor. |
| `/voice audio sfx` | `<fuente> [x y z [radio]]` | *Ninguno* | Reproduce un efecto de sonido de un solo disparo (global o en coordenadas posicionales). |
| `/voice audio pause` | `<id>` | *Ninguno* | Pausa la reproducción del emisor indicado. |
| `/voice audio resume` | `<id>` | *Ninguno* | Reanuda un emisor pausado. |
| `/voice audio stop` | `<id>\|all` | *Ninguno* | Detiene y destruye el emisor especificado (o todos). |
| `/voice audio volume` | `<id> <volumen>` | *Ninguno* | Ajusta el multiplicador de volumen entre `0.0` y `2.0` (1.0 = 100%). |
| `/voice audio cache status` | *Ninguno* | *Ninguno* | Muestra los archivos en caché y el espacio utilizado en el backend. |
| `/voice audio cache purge` | `[all\|24h\|7d\|30d]` | *Ninguno* | Limpia archivos multimedia antiguos del almacenamiento en disco. |
| `/voice audio particles` | `<on\|off\|toggle>` | *Ninguno* | Alterna la visualización de partículas verdes en la posición de los emisores activos. |

---

## Comandos en Proxy Velocity

### Alias de Proxy
`/voice-velocity`, `/ve-velocity`, `/voiceengine-velocity`, `/audio-velocity`.

### Comandos de Moderación

Requieren el permiso `voiceengine.mod` (Staff / Moderadores):

| Comando | Argumentos | Descripción |
| :--- | :--- | :--- |
| `/voice-velocity kick` | `<jugador> [motivo]` | Desconecta de inmediato la sesión de voz en el navegador del jugador. |
| `/voice-velocity mute` | `<jugador> <duración> [motivo]` | Silencia el micrófono del jugador en el SFU (ej. `30m`, `2h`, `perm`). |
| `/voice-velocity deafen` | `<jugador> <duración> [motivo]` | Ensordece al jugador para que no escuche a nadie durante el tiempo indicado. |
| `/voice-velocity ban` | `<jugador> <duración> [motivo]` | Desconecta y bloquea permanentemente o temporalmente el UUID y la IP del jugador. |
| `/voice-velocity unmute` | `<jugador>` | Revoca un silenciamiento activo y reactiva la transmisión de voz. |
| `/voice-velocity undeafen`| `<jugador>` | Revoca un ensordecimiento activo. |
| `/voice-velocity unban` | `<jugador>` | Revoca la sanción de baneo y desbloquea la IP asociada. |
| `/voice-velocity modstatus` | `<jugador>` | Consulta el historial y sanciones activas del jugador con su cuenta regresiva. |

---

## Ejemplo de Configuración con LuckPerms

```bash
# Jugadores estándar en Paper y Velocity
lp group default permission set voiceengine.use true

# Grupo Moderadores en Velocity
lpv group mod permission set voiceengine.mod true

# Administradores en Paper
lp group admin permission set voiceengine.admin true
lp group admin permission set voiceengine.admin.speaker true
lp group admin permission set voiceengine.admin.audio true
```
