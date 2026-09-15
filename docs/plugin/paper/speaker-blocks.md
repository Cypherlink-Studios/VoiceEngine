# Speaker Blocks System

The **Speaker Blocks System** allows server administrators and map builders to bind audio sources and live player microphones directly to physical in-game blocks (such as Jukeboxes, Note Blocks, or Skulls).

---

## What is a Speaker Block?

A Speaker Block acts as an in-world public address (PA) system or megaphone:

```
                                  [ Player speaking in mic ]
                                              |
                                              v
                                      [ WebRTC Server ]
                                              |
                                              v (Relayed to Speaker Block)
 +------------------------------------------------------------------------+
 |                       [ In-Game Speaker Block ]                        |
 |                           (e.g., Jukebox)                              |
 |                                                                        |
 |    * Musical note particles pulse when speaking                        |
 |    * Audio projects across custom radius (e.g., 80 blocks)             |
 |    * Directional 3D sound emanates from the block                      |
 +-----------------------------------+------------------------------------+
                                     |
                 +-------------------+-------------------+
                 |                                       |
                 v                                       v
         [ Listener A (30m) ]                    [ Listener B (70m) ]
         Clear & loud                            Faint & distant
```

---

## Core Use Cases

- **Town Hall & Courtroom Announcements**: Link a mayor, judge, or host to a central podium speaker block so their voice carries across an entire auditorium.
- **Stadium & Arena Megaphones**: Broadcast tournament commentary or referee calls to all spectators in the stands.
- **Redstone-Triggered Alarms**: Require a Redstone signal to trigger emergency sirens or security alerts when a tripwire is crossed.
- **DJ Booths & Nightclubs**: Connect in-game music tracks directly to custom DJ furniture blocks.

---

## Creating & Managing Speaker Blocks

All commands require the `voiceengine.admin.speaker` permission (default: OP).

### 1. Creating a Speaker Block
Aim your crosshair at the block you want to turn into a speaker (must be within 5 blocks of your player):

```bash
/voice speaker create <id> [radius]
```

- `id`: Unique name for the speaker (e.g. `town_hall_podium`, `dj_main`).
- `radius` *(Optional)*: Hearing radius in blocks (default: `30.0`, maximum: `500.0`).

#### Example
```bash
/voice speaker create podium 60
```

---

### 2. Linking a Player's Microphone

Relay a live player's voice through the speaker block:

```bash
/voice speaker link <id> <player>
```

- When `<player>` speaks into their microphone, their voice is projected from the speaker block's coordinates with the speaker's radius.
- Both the player's normal proximity voice and the speaker broadcast operate in tandem.

To unlink the player:
```bash
/voice speaker unlink <id>
```

---

### 3. Redstone Activation Control

You can require an active Redstone power signal for the speaker to function:

```bash
/voice speaker redstone <id> <true|false>
```

- If `true`: The speaker is disabled by default. When the block receives Redstone power (from a lever, button, daylight detector, or redstone wire), it immediately turns on.
- If `false` *(default)*: The speaker is always active.

> [!TIP]
> Use Redstone control to build interactive alarm systems, push-to-talk microphones in broadcast booths, or puzzle rooms in adventure maps!

---

### 4. Playing Audio Files Through a Speaker

In addition to live player voice, you can play sound files or music through a speaker block:

```bash
# Start audio playback through the speaker
/voice speaker play <id> <source>

# Stop playback on the speaker
/voice speaker stop <id>
```

#### Example
```bash
/voice speaker play podium "music/fanfare.mp3"
```

---

### 5. Listing & Deleting Speakers

```bash
# List all registered speakers, coordinates, radiuses, and linked players
/voice speaker list

# Remove a speaker block registration
/voice speaker remove <id>
```

---

## Visual Feedback

When a speaker block is actively transmitting (either playing media or broadcasting a linked player's microphone), the plugin automatically renders musical note particles around the block. This lets nearby players immediately recognize where the sound is originating.

---

## Persistence (`speakers.yml`)

Speaker configurations are automatically persisted in `plugins/VoiceEngine/speakers.yml`:

```yaml
speakers:
  town_hall_podium:
    world: "world"
    x: 15
    y: 65
    z: -340
    radius: 75.0
    require-redstone: false
    linked-player: "e7514a60-31ec-4c63-b8d4-862d29486dc1"
```

Data is safely loaded on server start and reloaded whenever `/voice reload` is called.
