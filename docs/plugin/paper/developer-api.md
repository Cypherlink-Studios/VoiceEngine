# Developer API Reference (Paper)

The VoiceEngine Paper plugin exposes an API for external plugins to interact with the voice engine, listen for speaking events, generate connection tokens, and trigger audio emitters programmatically.

---

## Adding the Dependency

### Gradle (Kotlin DSL)
```kotlin
repositories {
    mavenCentral()
    // Local or private repository containing VoiceEngine-paper
    maven("https://repo.yourserver.com/releases")
}

dependencies {
    compileOnly("com.voiceengine:VoiceEngine-paper:1.0.0-SNAPSHOT")
}
```

### Maven (`pom.xml`)
```xml
<dependency>
    <groupId>com.voiceengine</groupId>
    <artifactId>VoiceEngine-paper</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <scope>provided</scope>
</dependency>
```

Add `VoiceEngine` to your `plugin.yml` soft-depend list:
```yaml
name: MyCustomPlugin
version: 1.0.0
main: com.example.MyPlugin
softdepend: [VoiceEngine]
```

---

## Obtaining the API Instance

You can access the `VoiceEngineAPI` interface either via the static facade or through Bukkit's `ServicesManager`:

### Option A: Static Facade
```java
import com.voiceengine.api.VoiceEngine;
import com.voiceengine.api.VoiceEngineAPI;

VoiceEngineAPI api = VoiceEngine.getApi();
if (api != null) {
    // API is ready
}
```

### Option B: Bukkit Services Manager
```java
import com.voiceengine.api.VoiceEngineAPI;
import org.bukkit.Bukkit;
import org.bukkit.plugin.RegisteredServiceProvider;

RegisteredServiceProvider<VoiceEngineAPI> provider = 
    Bukkit.getServicesManager().getRegistration(VoiceEngineAPI.class);

if (provider != null) {
    VoiceEngineAPI api = provider.getProvider();
}
```

---

## Custom Events

VoiceEngine dispatches custom Bukkit events on the main server thread, allowing you to react to voice activity without dealing with asynchronous thread safety issues.

### 1. `PlayerSpeakingStateChangeEvent`
Fired when a player starts or stops speaking into their microphone (detected via backend Voice Activity Detection):

```java
package com.example;

import com.voiceengine.api.event.PlayerSpeakingStateChangeEvent;
import org.bukkit.Particle;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;

public class VoiceListener implements Listener {

    @EventHandler
    public void onPlayerSpeak(PlayerSpeakingStateChangeEvent event) {
        Player player = event.getPlayer();
        boolean isSpeaking = event.isSpeaking();

        if (player != null && isSpeaking) {
            // Player just started speaking
            player.getWorld().spawnParticle(
                Particle.NOTE,
                player.getLocation().add(0, 2.2, 0),
                1
            );
        }
    }
}
```

### 2. `PlayerVoiceConnectedEvent` & `PlayerVoiceDisconnectedEvent`
Fired when a player connects or disconnects their web browser session:

```java
@EventHandler
public void onVoiceConnect(PlayerVoiceConnectedEvent event) {
    UUID playerUuid = event.getPlayerUuid();
    Player player = Bukkit.getPlayer(playerUuid);
    if (player != null) {
        player.sendMessage("§a[Voice] Web voice client connected!");
    }
}

@EventHandler
public void onVoiceDisconnect(PlayerVoiceDisconnectedEvent event) {
    UUID playerUuid = event.getPlayerUuid();
    // Clean up custom player state
}
```

---

## Programmatic Token Generation

If you have a custom `/discord`, `/link`, or web onboarding command, you can generate temporary VoiceEngine tokens directly:

```java
import com.voiceengine.api.VoiceEngine;
import com.voiceengine.auth.SessionToken;

VoiceEngineAPI api = VoiceEngine.getApi();
if (api != null) {
    // Generate a normal player token
    SessionToken token = api.generateToken(player.getUniqueId(), player.getName(), false);
    String code = token.token(); // e.g. "A7K9X2"
    
    player.sendMessage("Your one-time voice code is: " + code);
}
```

---

## Checking Voice State

```java
VoiceEngineAPI api = VoiceEngine.getApi();
if (api != null) {
    boolean isOnline = api.isPlayerConnected(player.getUniqueId());
    boolean isTalking = api.isPlayerSpeaking(player.getUniqueId());

    if (!isOnline) {
        player.sendMessage("§cWarning: You must connect to voice chat to play this minigame!");
    }
}
```
