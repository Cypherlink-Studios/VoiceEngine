---
title: Comenzando con VoiceEngine
description: Guía paso a paso para la instalación y puesta en marcha de VoiceEngine en servidores Paper y redes Velocity.
sidebar:
  order: 2
---

Esta guía detalla los pasos para instalar y desplegar **VoiceEngine** en tu infraestructura de Minecraft.

---

## Requisitos Previos

- **Java Runtime**: Java 17 o Java 21 (recomendado).
- **Servidor Minecraft**: Paper o Purpur 1.20.4 o superior (compatible con 1.20.6 y 1.21.x).
- **Red Proxy (Opcional)**: Velocity 3.4.0 o superior.
- **Servidor de Voz (SFU)**: Servidor Linux/Docker ejecutando Node.js 20+ LTS con acceso a puertos UDP para WebRTC.
- **Certificados SSL/TLS**: Un dominio público con HTTPS y WSS configurados para permitir que los navegadores accedan al micrófono.

:::caution
Los navegadores web modernos (Chrome, Firefox, Safari, Edge) bloquean el acceso al micrófono de los usuarios en sitios HTTP no seguros, excepto en `localhost`. Para entornos de producción, el cliente web debe servirse obligatoriamente bajo HTTPS.
:::

---

## Escenario A: Servidor Standalone (Paper)

Si ejecutas un servidor individual de Paper sin proxy Velocity:

### 1. Instalación del JAR
Descarga el archivo `VoiceEngine-paper.jar` compilado y colócalo en la carpeta `plugins/` de tu servidor Paper.

### 2. Primer Inicio y Generación de Configuración
Inicia el servidor para generar la configuración por defecto en `plugins/VoiceEngine/config.yml`:

```yaml
voice-server-url: "wss://voice.tudominio.com/ws/plugin"
web-client-url: "https://voice.tudominio.com"
secret-key: "genera-un-secreto-seguro-y-aleatorio"
tick-rate-hz: 10
proxy-mode: "false"
```

### 3. Reinicio o Recarga
Aplica los cambios ejecutando `/voice reload` o reiniciando el servidor Paper.

---

## Escenario B: Red de Servidores (Proxy Velocity)

Para redes multinodo con proxy Velocity:

### 1. Instalación en Velocity
Descarga `VoiceEngine-velocity.jar` y colócalo en la carpeta `plugins/` de tu proxy Velocity. Inicia el proxy para generar `plugins/voiceengine-velocity/velocity-config.yml`:

```yaml
voice-server-url: "wss://voice.tudominio.com/ws/plugin"
web-client-url: "https://voice.tudominio.com"
secret-key: "genera-un-secreto-seguro-y-aleatorio"
token-ttl-minutes: 5
notify-on-join: true
```

### 2. Instalación en los Nodos Paper
Coloca `VoiceEngine-paper.jar` en cada uno de los servidores Paper de la red (Lobby, Survival, Minijuegos, etc.). Configura cada `plugins/VoiceEngine/config.yml` con el mismo `secret-key` y activa el modo proxy:

```yaml
voice-server-url: "wss://voice.tudominio.com/ws/plugin"
secret-key: "genera-un-secreto-seguro-y-aleatorio"
proxy-mode: "true"
server-id: "survival-1"
```

:::tip
Al establecer `proxy-mode: "true"` en Paper, el comando `/voice` en el backend delega al proxy, asegurando que el token de sesión persista cuando el jugador se mueva entre modalidades.
:::

---

## Verificación de Conexión

1. Entra a tu servidor de Minecraft con una cuenta de jugador.
2. Ejecuta el comando `/voice` (o `/voice-velocity` en la consola del proxy).
3. Haz clic en el enlace generado en el chat:
   ```text
   https://voice.tudominio.com/?token=A3B9X1
   ```
4. El navegador solicitará permisos de micrófono. Al concederlos, verás la interfaz del radar y tu estado de voz activo.
5. Abre la consola o ejecuta `/voice status` para verificar la sincronización con el servidor de voz backend.
