---
title: Developer API
description: Java integration guide for programmatically interacting with VoiceEngine on Paper servers and Velocity proxies.
sidebar:
  order: 8
---

VoiceEngine provides an idiomatic Java API for plugin developers looking to create custom audio events, minigame soundscapes, or server mechanics.

---

## Gradle / Maven Coordinates

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

## Paper Bukkit Events

VoiceEngine dispatches Bukkit events that can be subscribed to with standard `@EventHandler` annotations:

### 1. `PlayerVoiceStateChangeEvent`
Fired when a player mutes, un-mutes, deafens, or toggles speaking state in their web browser:

```java
import com.voiceengine.paper.api.event.PlayerVoiceStateChangeEvent;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;

public class VoiceChatListener implements Listener {

    @EventHandler
    public void onVoiceStateChange(PlayerVoiceStateChangeEvent event) {
        if (event.isSpeaking()) {
            event.getPlayer().sendMessage("§aYour microphone is active and transmitting voice!");
        }
    }
}
```

### 2. `PlayerSpeakerEnterEvent` and `PlayerSpeakerLeaveEvent`
Fired when a player walks into or exits the acoustic broadcast boundary of an active speaker block:

```java
@EventHandler
public void onEnterSpeakerRadius(PlayerSpeakerEnterEvent event) {
    String speakerId = event.getSpeaker().getId();
    event.getPlayer().sendActionBar(Component.text("Entered audio radius of: " + speakerId));
}
```

---

## Programmatic Emitter & Speaker Management

Access the `VoiceEngineAPI` singleton:

```java
import com.voiceengine.paper.api.VoiceEngineAPI;
import org.bukkit.Location;
import org.bukkit.entity.Player;

public class MinigameSoundController {

    private final VoiceEngineAPI api = VoiceEngineAPI.getInstance();

    public void playVictoryFanfare(Location loc) {
        // Plays a 3D emitter at podium location with a 40-block radius
        api.playAudioEmitter(
            "match_victory",
            "https://myserver.com/audio/fanfare.mp3",
            loc,
            40.0,
            false // no loop
        );
    }

    public void broadcastWinnerVoice(Player winner, Location podium) {
        // Registers podium as speaker and links winner's microphone
        api.createSpeaker("winner_podium", podium, 80.0);
        api.linkPlayerToSpeaker("winner_podium", winner.getUniqueId());
    }

    public void cleanupArena() {
        api.stopAudioEmitter("match_victory");
        api.removeSpeaker("winner_podium");
    }
}
```
