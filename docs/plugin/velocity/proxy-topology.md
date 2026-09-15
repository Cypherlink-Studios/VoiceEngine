# Network Topology & Server Switching

One of VoiceEngine's most powerful architectural capabilities is **seamless cross-server audio routing**. This guide explains how Velocity coordinates player transitions across Paper subservers without dropping or restarting browser WebRTC connections.

---

## The Network Topology

In a multi-server setup, the VoiceEngine backend acts as a central audio hub, while Velocity and all Paper instances communicate with it over authenticated WebSockets:

```
                            [ Web Voice Client (Browser) ]
                                          |
                                          | WebRTC Audio (Persistent)
                                          v
                              [ VoiceEngine SFU Backend ]
                                          ^
                     WebSocket            |            WebSocket
          +-------------------------------+-------------------------------+
          |                               |                               |
          v                               v                               v
 [ Velocity Proxy ]             [ Paper: Lobby ]               [ Paper: Survival ]
 (Auth & Moderation)            (server-id: "lobby")           (server-id: "survival")
          |                               ^                               ^
          |                               |                               |
          +===============================+===============================+
                            Player moves between servers
```

---

## Cross-Server Transition Sequence

Here is what happens step-by-step when a player moves between subservers:

```
Player                  Velocity Proxy             VoiceEngine Backend          Paper (Survival)
  |                           |                             |                          |
  |-- /server survival ------>|                             |                          |
  |                           |-- ServerPostConnectListener |                          |
  |                           |   (player moved to survival)|                          |
  |                           |---------------------------->|                          |
  |                           |                             |                          |
  |                           |                             |   (Paper Survival starts |
  |                           |                             |    streaming telemetry)  |
  |                           |                             |<-------------------------|
  |                           |                             |                          |
  |                           |                             |-- Swaps spatial context -|
  |                           |                             |   (Now near survival     |
  |                           |                             |    players!)             |
  v                           v                             v                          v
 (Browser WebRTC connection remains 100% uninterrupted — zero reload or reconnect needed!)
```

1. **Player issues transfer**: The player switches servers (e.g. `/server survival` or portal).
2. **Velocity Event**: Velocity's `ServerPostConnectListener` catches the successful transition.
3. **Backend Notified**: Velocity informs the VoiceEngine backend that the player's active server context has changed to `survival`.
4. **Paper Telemetry Handshake**: The Paper `survival` server's `TelemetryService` samples the player's new position and includes it in its periodic telemetry batches tagged with `server-id: "survival"`.
5. **Seamless Spatial Swap**: The backend immediately calculates proximity based on players on `survival`. The WebRTC audio session in the player's browser never disconnects or stutters!

---

## Best Practices for Multi-Server Networks

### 1. Consistent Shared Secret
Ensure that the exact same `secret-key` is configured across:
- `plugins/voiceengine-velocity/velocity-config.yml`
- Every `plugins/VoiceEngine/config.yml` on every Paper instance
- The backend `.env` file (`PLUGIN_SECRET=...`)

### 2. Unique `server-id` per Paper Instance
Every backend Paper server must have a distinct, descriptive `server-id` in its `config.yml`:

```yaml
# On Lobby Server:
server-id: "lobby"

# On SMP Server:
server-id: "survival"

# On Minigame Hub:
server-id: "minigames"
```

If two Paper servers share the same `server-id`, players standing at the same coordinates on different servers would hear each other as if they were in the same room.

### 3. Automatic Proxy Mode
Ensure each Paper server has:
```yaml
proxy-mode: "auto"
```
This ensures Paper suppresses local `/voice` prompts, leaving Velocity in full control of join messages and connection links.

---

## Player Disconnect Handling

When a player quits the network:
1. Velocity's `DisconnectListener` catches the quit event.
2. Velocity notifies the VoiceEngine backend via WebSocket.
3. The backend marks the player as offline, frees their WebRTC producer slot, and updates nearby listeners immediately.
