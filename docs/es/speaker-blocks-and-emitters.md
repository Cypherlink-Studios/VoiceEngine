---
title: Bloques Parlantes y Emisores
description: Emisores dinámicos posicionales 3D, bloques físicos amplificados, megáfonos por Redstone y sincronización de medios.
sidebar:
  order: 5
---

VoiceEngine incluye dos potentes subsistemas para emitir sonido dentro del mundo de Minecraft: **Bloques Parlantes (Speaker Blocks)** y **Emisores de Audio 3D Dinámicos (Dynamic Audio Emitters)**.

---

## Bloques Parlantes (Speaker Blocks)

Los bloques parlantes permiten transformar cualquier bloque físico del juego (como un tocadiscos, bloque musical o bloque decorativo) en una fuente acústica emisora en el espacio tridimensional.

### Características
1. **Radio de Cobertura Personalizado**: Desde pequeños radios íntimos (5 bloques) hasta sistemas de megafonía comunitaria (100+ bloques).
2. **Modo Megáfono de Jugador**: Al vincular un jugador mediante `/voice speaker link <id> <jugador>`, la voz capturada por el micrófono de dicho jugador se proyecta desde el bloque con amplificación hacia todo el radio configurado.
3. **Control por Corriente de Redstone**: Permite activar o apagar el altavoz dinámicamente mediante palancas, placas de presión o circuitos de Redstone (`/voice speaker redstone <id> true`).
4. **Reproducción de Fuentes Multimedia**: Los administradores pueden enviar música, podcasts o archivos de audio locales directamente al bloque con sincronización en tiempo real.

### Ejemplo de Configuración de un Megáfono de Aldea
```bash
# 1. Mirando al bloque de tocadiscos en la plaza:
/voice speaker create plaza_central 50

# 2. Configurar activación exclusiva cuando la palanca esté encendida:
/voice speaker redstone plaza_central true

# 3. Vincular al presentador del evento:
/voice speaker link plaza_central Steve
```

---

## Emisores de Audio 3D Dinámicos

Los emisores de audio posicionales permiten colocar fuentes de música o efectos de sonido en cualquier coordenada del mundo tridimensional (`x, y, z`) o realizar transmisiones 2D globales a todo el servidor.

### Tipos de Reproducción
- **Espacial 3D (`/voice audio play`)**: Se calcula la posición relativa respecto a los oídos del jugador. A medida que el usuario camina o gira la cabeza, el sonido se desplaza espacialmente en estéreo binaural y disminuye con la distancia.
- **Transmisión Global 2D (`/voice audio broadcast`)**: Se reproduce en los auriculares de todos los jugadores conectados con volumen uniforme e idéntico, ideal para anuncios, eventos o bandas sonoras cinemáticas.
- **Efectos de Sonido Puntuales (`/voice audio sfx`)**: Sonidos de un solo disparo (one-shot) sin bucle continuo.

### Fuentes Multimedia Compatibles
- **Archivos Locales**: Pistas ubicadas en el directorio de medios del servidor (`media/`).
- **URLs Directas de Audio**: Enlaces directos a archivos `.mp3`, `.ogg`, `.flac` o `.wav` accesibles por HTTP/HTTPS.
- **Enlaces Remotos de Streaming**: Compatible con fuentes externas y URLs de streaming procesadas automáticamente por `ffmpeg` y el motor de descarga del backend.

```bash
# Reproducir música posicional en bucle continuo en la taberna:
/voice audio play taberna_musica https://miservidor.com/musica/folk.mp3 120 64 -350 25 --loop

# Pausar y reanudar la emisión:
/voice audio pause taberna_musica
/voice audio resume taberna_musica

# Ajustar el volumen al 70%:
/voice audio volume taberna_musica 0.7
```

---

## Sistema de Caché LRU de Medios

El servidor backend gestiona una caché inteligente en disco para evitar descargas duplicadas de fuentes externas:

- Los archivos descargados se almacenan con un hash seguro de su contenido.
- El comando `/voice audio cache status` reporta el uso de almacenamiento.
- El comando `/voice audio cache purge 24h` elimina pistas que no se hayan reproducido en las últimas 24 horas para liberar espacio en disco.
