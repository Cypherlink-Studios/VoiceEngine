---
title: Moderación y Seguridad
description: Motor de moderación SQLite WAL, sanciones en red, prevención de evasión por IP y sincronización instantánea.
sidebar:
  order: 6
---

El sistema de moderación de VoiceEngine está diseñado para proteger la comunidad contra acoso, infracciones verbales y abusos, proporcionando herramientas centralizadas en el proxy Velocity con aplicación instantánea en milisegundos.

---

## Motor de Base de Datos SQLite (WAL)

En el proxy Velocity, VoiceEngine almacena las sanciones en una base de datos local SQLite de alto rendimiento (`moderation.db`) con registro previo en diario de transacciones (**Write-Ahead Logging - WAL**):

- **Sin Dependencias Externas**: No requiere instalar ni configurar motores externos como MySQL o PostgreSQL.
- **Consultas Asíncronas**: Las comprobaciones de IP y UUID al unirse se realizan de forma no bloqueante sin afectar los ticks del servidor proxy.
- **Persistencia Concurrente**: Admite lecturas y escrituras simultáneas con latencias de microsegundos.

---

## Tipos de Sanciones

| Sanción | Efecto Inmediato en el Navegador | Persistencia | Prevención por IP |
| :--- | :--- | :--- | :--- |
| **Kick** (`/voice-velocity kick`) | Cierra la sesión WebRTC y desconecta al usuario del cliente web. | No persistente. El usuario puede reconectarse solicitando un nuevo token si no está baneado. | No aplica. |
| **Mute** (`/voice-velocity mute`) | Pausa la transmisión del productor de audio del micrófono en el SFU. El usuario escucha el entorno pero no puede hablar. | Temporal o permanente. | Vinculado a UUID. |
| **Deafen** (`/voice-velocity deafen`)| Desconecta los canales de consumo de audio hacia el jugador. No escucha a ningún participante. | Temporal o permanente. | Vinculado a UUID. |
| **Ban** (`/voice-velocity ban`) | Desconecta la sesión web al instante y bloquea nuevos accesos. | Temporal o permanente. | Bloquea tanto el **UUID de Minecraft** como la **dirección IP**. |

---

## Prevención de Evasión de Baneo por IP

Cuando un usuario malintencionado es baneado con `/voice-velocity ban <jugador> <duración> <motivo>`:

1. El sistema registra el UUID de la cuenta y la dirección IP con la que se conectó al proxy.
2. Si el jugador intenta utilizar una cuenta secundaria (alt account) desde la misma red doméstica o dirección IP, el generador de tokens de `/voice` bloquea la solicitud de inmediato:
   ```text
   [VoiceEngine] No puedes conectarte al chat de voz porque tu dirección IP está sancionada.
   ```
3. Al ejecutar `/voice-velocity unban <jugador>`, el sistema desvincula el baneo y libera automáticamente la dirección IP asociada.

---

## Sincronización Inmediata con el SFU

A diferencia de otros sistemas que esperan un ciclo de refresco o expiración de token:

```
[Moderador ejecuta /voice-velocity mute Juan 1h MicSpam]
         │
         ▼
[Plugin Velocity] ─── WebSocket Payload ───> [Voice Backend SFU]
                                                     │
                                                     ▼ (0 ms)
                                  [Pausa inmediata de Producer mediasoup]
                                                     │
                                                     ▼ (WebSocket Push)
                                  [Notificación modal en Web Client de Juan]
```

El usuario sancionado no necesita recargar la página: su micrófono se apaga en el acto y el cliente web muestra un indicador de sanción activa con el motivo y el tiempo restante.
