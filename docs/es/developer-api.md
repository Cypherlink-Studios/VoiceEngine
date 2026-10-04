---
title: API para Desarrolladores
description: Guía de integración en Java para interactuar programáticamente con VoiceEngine en Paper y Velocity.
sidebar:
  order: 8
---

VoiceEngine ofrece una API en Java limpia y desacoplada para desarrolladores de plugins que deseen integrar dinámicas de audio en minijuegos, sistemas de rol o mecánicas de servidor personalizadas.

---

## Dependencia en Gradle / Maven

### Gradle (Kotlin DSL)
```kotlin
repositories {
    maven("https://repo.darkbladedev.com/releases")
}

dependencies {
    compileOnly("com.voiceengine:VoiceEngine-paper:1.0.0")
}
```

### Maven
```xml
<dependency>
    <groupId>com.voiceengine</groupId>
    <artifactId>VoiceEngine-paper</artifactId>
    <version>1.0.0</version>
    <scope>provided</scope>
</dependency>
```

---

## Eventos de Paper

VoiceEngine dispara eventos nativos de Bukkit que pueden escucharse mediante `@EventHandler`:

### 1. `PlayerVoiceStateChangeEvent`
Se dispara cuando un jugador silencia o activa su micrófono, ensordece o altera su estado en el cliente web:

```java
import com.voiceengine.paper.api.event.PlayerVoiceStateChangeEvent;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;

public class VoiceChatListener implements Listener {

    @EventHandler
    public void onVoiceStateChange(PlayerVoiceStateChangeEvent event) {
        if (event.isSpeaking()) {
            event.getPlayer().sendMessage("§a¡Tu micrófono está transmitiendo voz!");
        }
    }
}
```

### 2. `PlayerSpeakerEnterEvent` y `PlayerSpeakerLeaveEvent`
Se disparan cuando un jugador entra o sale del radio acústico de un bloque parlante en el mundo:

```java
@EventHandler
public void onEnterSpeakerRadius(PlayerSpeakerEnterEvent event) {
    String speakerId = event.getSpeaker().getId();
    event.getPlayer().sendActionBar(Component.text("Has entrado al área del altavoz: " + speakerId));
}
```

---

## Control Programático de Emisores y Altavoces

Puedes inyectar o acceder a la instancia del servicio `VoiceEngineAPI`:

```java
import com.voiceengine.paper.api.VoiceEngineAPI;
import org.bukkit.Location;
import org.bukkit.entity.Player;

public class MinigameSoundController {

    private final VoiceEngineAPI api = VoiceEngineAPI.getInstance();

    public void playVictoryFanfare(Location loc) {
        // Inicia un emisor 3D en las coordenadas del pedestal con 40 bloques de radio
        api.playAudioEmitter(
            "victoria_partida",
            "https://miservidor.com/audio/fanfare.mp3",
            loc,
            40.0,
            false // sin bucle
        );
    }

    public void broadcastWinnerVoice(Player winner, Location podium) {
        // Registra el podio como altavoz y vincula la voz del ganador
        api.createSpeaker("podio_ganador", podium, 80.0);
        api.linkPlayerToSpeaker("podio_ganador", winner.getUniqueId());
    }

    public void cleanupArena() {
        api.stopAudioEmitter("victoria_partida");
        api.removeSpeaker("podio_ganador");
    }
}
```
