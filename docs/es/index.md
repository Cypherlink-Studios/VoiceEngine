---
title: Introducción a VoiceEngine
description: Chat de voz por proximidad 3D en el navegador y streaming de audio para servidores Paper y redes Velocity sin mods en el cliente.
sidebar:
  order: 1
---

**VoiceEngine** es un sistema integral de chat de voz posicional en 3D y emisión de audio para servidores de Minecraft (Paper y redes Velocity). A diferencia de otras alternativas tradicionales de la comunidad, **elimina por completo el requisito de instalar mods o clientes modificados** (Fabric, Forge, NeoForge) en el lado de los jugadores.

Los usuarios se conectan con el cliente vainilla oficial de Minecraft Java Edition, ejecutan `/voice` en el chat del juego y abren un enlace seguro en cualquier navegador web moderno (ordenador de escritorio o móvil). La transmisión se realiza mediante **WebRTC** y una unidad de reenvío selectivo (**SFU - Selective Forwarding Unit**) basada en **mediasoup**.

---

## Características Principales

### Audio Espacial 3D y Acústica Inmersiva
- **Audio Binaural 3D**: Procesamiento de audio espacial de alta precisión mediante la **Web Audio API** y algoritmos Head-Related Transfer Function (`HRTF`).
- **Atenuación Atmosférica**: Filtro dinámico pasa-bajos que emula la absorción del aire a frecuencias altas (de 20 kHz a 3.5 kHz) en función de la distancia entre jugadores.
- **Acústica Subacuática**: Filtro pasa-bajos biquad a 600 Hz activado automáticamente cuando cualquiera de los interlocutores se sumerge en agua.
- **Susurro al Agacharse**: Agacharse (`Shift`) reduce dinámicamente el radio de audición de 30 bloques a 8 bloques.
- **Aislamiento Interdimensional**: Partición estricta de salas entre Overworld, Nether y The End.
- **Modos de Espectador**: Modos configurables (`listen-only`, `isolated`, `all`) adaptados para minijuegos y torneos competitivos.

### Procesamiento de Voz en el Cliente (DSP)
- **Supresión Neuronal de Ruido (RNNoise)**: AudioWorklet compilado en WebAssembly con detección SIMD que elimina ruido de tecleo, ventiladores y reverberaciones de sala.
- **Filtro Pasa-Altos (80 Hz)**: Elimina golpes de mesa, vibraciones de baja frecuencia y ruido de respiración.
- **Compresor y Limitador Soft-Knee**: Control dinámico de ganancia que evita distorsiones digitales y saturación de picos de voz.
- **Detección de Actividad de Voz (VAD) No Limitada**: Temporizador de 40 Hz alojado en un Web Worker dedicado, inmune al congelamiento de pestañas en segundo plano cuando Minecraft está en pantalla completa.

### Integración en el Mundo y Emisores
- **Partículas Visuales de Voz**: Notas musicales sobre la cabeza de los jugadores que emiten audio en tiempo real.
- **Bloques Parlantes (Speaker Blocks)**: Jukeboxes o bloques del mundo físico registrados como altavoces amplificados con radio configurable y soporte para activación por Redstone.
- **Emisores de Audio 3D Dinámicos**: Reproducción de música ambiental posicional, efectos one-shot o transmisiones globales 2D mediante comandos del servidor.
- **Caché Local de Medios**: Descarga automática y almacenamiento en caché LRU de fuentes multimedia remotas.

### Escalabilidad de Red y Moderación
- **Soporte Nativo para Velocity**: Autenticación centralizada en el proxy; los jugadores conservan la llamada activa al cambiar entre servidores backend de Paper.
- **Motor de Moderación SQLite (WAL)**: Sanciones persistentes (`kick`, `mute`, `deafen`, `ban`) con bloqueo por UUID e IP para evitar evasiones de sanción.
- **Sincronización Inmediata por WebSocket**: Acciones del personal aplicadas en milisegundos desconectando o silenciando la sesión web al instante.
- **Radar de Proximidad y HUD Picture-in-Picture (PiP)**: Interfaz de radar interactivo con distancias relativas y modo ventana flotante sobre el juego con atajos de teclado rápidos (`M` para silenciar, `D` para ensordecer).

---

## Arquitectura de Conexión

```
┌─────────────────┐       Token /ws/plugin       ┌──────────────────────┐
│  Minecraft      │ ───────────────────────────> │  Voice Server (SFU)  │
│  Paper/Velocity │ <─────────────────────────── │  Node.js + mediasoup │
└─────────────────┘      Sanciones / Telemetría  └──────────────────────┘
         │                                                   │
   /voice enlace                                     WebRTC Audio Tracks
         │                                           & WebSocket /ws/client
         ▼                                                   │
┌────────────────────────────────────────────────────────────▼──┐
│ Navegador Web del Jugador (Web Client)                         │
│ - WebRTC Audio Consumer/Producer                               │
│ - DSP: RNNoise WASM + High-Pass Filter + Dynamic Compressor    │
│ - Web Audio API: PannerNode HRTF 3D + Acoustic Air Rolloff     │
└───────────────────────────────────────────────────────────────┘
```

:::note
Para comenzar con la instalación y configuración de los servidores Paper y proxies Velocity, consulta la guía [Comenzando](./getting-started).
:::
