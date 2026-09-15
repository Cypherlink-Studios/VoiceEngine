# Telemetry & Spatial Audio System

The **Telemetry Service** in VoiceEngine Paper is the bridge that turns Minecraft world physics into realistic, directional 3D audio. This guide explains how spatial data is gathered, batched, transmitted, and converted into proximity audio.

---

## The Telemetry Pipeline

```
 [ Minecraft Game World ]
       |
       | (Sampled 10-15 times/sec)
       v
 [ TelemetryCollector.java ]
  - Reads X, Y, Z coordinates
  - Reads Yaw & Pitch (Head orientation)
  - Reads World / Dimension name
  - Checks Sneaking & Submerged flags
       |
       v
 [ SpatialTelemetryBatch ]  <---  Includes Active Speaker Blocks
       |
       | Encoded into WebSocket payload (JSON / Compact Binary)
       v
 [ VoiceEngine SFU Backend ]
  - 3D Spatial Grid Hashing (32-block integer cells)
  - Squared-distance filter: (dx^2 + dy^2 + dz^2 <= R^2)
  - Server-ID & Dimension boundary isolation
       |
       v
 [ Web Voice Client (Browser) ]
  - Web Audio API HRTF 3D PannerNode
  - Real-time stereo balance & distance attenuation
```

---

## Collected Spatial Attributes

Every sampling tick, the plugin captures the following parameters for each online player:

| Field | Data Type | Description |
| :--- | :--- | :--- |
| `uuid` | `UUID` | Unique player identifier matching the web client session token. |
| `name` | `String` | Player username for logging and UI labeling. |
| `world` | `String` | Current world name (e.g., `world`, `world_nether`, `world_the_end`). Players in different worlds cannot hear each other. |
| `x`, `y`, `z` | `double` | Exact 3D player position in world blocks. |
| `yaw`, `pitch` | `float` | Player looking angle. Determines which ear (left or right) hears a sound source and calculates front-vs-back HRTF filtering. |
| `sneaking` | `boolean` | `true` if the player is shifting/sneaking. Used by the backend for stealth distance reduction or whisper attenuation. |
| `submerged` | `boolean` | `true` if the player's head is underwater. Used for low-pass muffled audio filtering. |

---

## Telemetry Batching & Performance

Minecraft ticks at **20 TPS** (one tick every 50 ms). Transmitting network packets every single tick for hundreds of players can cause network overhead. 

VoiceEngine employs a configurable decoupled tick rate:

- **10 Hz (Default)**: Telemetry runs once every **2 Minecraft ticks** (every 100 ms).
- **Interpolation**: The Web Client uses linear interpolation (`lerp`) between telemetry packets. Audio motion feels completely smooth at 60+ FPS even if packets arrive at 10 Hz.

### CPU Efficiency in the Plugin
- **No Heavy Physics**: Telemetry collection performs simple memory reads (`player.getLocation()`) in the Bukkit server thread and hands off the batch to an asynchronous thread pool for WebSocket serialization.
- **Microsecond Execution**: In benchmarks with 500 online players, telemetry batch assembly takes less than **0.3 ms** per cycle, ensuring **zero impact on server TPS**.

---

## 3D Spatial Calculation on the Backend

Once the Paper plugin delivers the telemetry batch to the backend:

1. **Spatial Grid Hashing**: The backend inserts players into a 3D grid with $32 \times 32 \times 32$ block buckets using fast integer hashing:
   $$\text{CellKey} = (\lfloor X/32 \rfloor, \lfloor Y/32 \rfloor, \lfloor Z/32 \rfloor)$$
2. **Neighbor Querying**: Instead of checking every player against every other player ($O(N^2)$), the backend only checks players within the 27 neighboring grid cells ($O(N \cdot k)$).
3. **Squared-Distance Pre-filtering**:
   $$\Delta x^2 + \Delta y^2 + \Delta z^2 \le R_{\text{max}}^2$$
   By avoiding expensive square root operations ($\sqrt{\dots}$), distance evaluations execute in nanoseconds.

---

## World & Dimension Isolation

The Paper plugin guarantees strict dimension isolation:

```
 Overworld (world)             Nether (world_nether)
 +-------------------+         +-------------------+
 | Player A  (10,64) |         | Player C  (10,64) |
 |         \         |         |                   |
 |          Player B |         |                   |
 +-------------------+         +-------------------+
         ^                               ^
         |                               |
 (Can hear each other)         (Isolated in Nether)
```

Even if **Player A** in the Overworld and **Player C** in the Nether are standing at the exact same $X, Y, Z$ coordinates, the backend verifies `worldA === worldB` before routing audio. Players never hear phantom voices across dimensions.
