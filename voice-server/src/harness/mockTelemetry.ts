import { WebSocket } from 'ws';

interface MockPlayer {
  uuid: string;
  username: string;
  world: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  isSneaking: boolean;
  isSubmerged: boolean;
}

export function runMockTelemetry(serverUrl = 'ws://localhost:3000/ws/plugin', secret = 'change-me-to-a-secure-random-secret') {
  console.log(`[MockTelemetry] Connecting to ${serverUrl}...`);
  const ws = new WebSocket(serverUrl);

  const players: MockPlayer[] = [
    {
      uuid: '00000000-0000-0000-0000-000000000001',
      username: 'Steve',
      world: 'world',
      x: 0,
      y: 64,
      z: 0,
      yaw: 180,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    },
    {
      uuid: '00000000-0000-0000-0000-000000000002',
      username: 'Alex',
      world: 'world',
      x: 10,
      y: 64,
      z: 10,
      yaw: 0,
      pitch: 0,
      isSneaking: false,
      isSubmerged: false,
    },
    {
      uuid: '00000000-0000-0000-0000-000000000003',
      username: 'Submariner',
      world: 'world',
      x: -8,
      y: 58,
      z: 8,
      yaw: 90,
      pitch: 0,
      isSneaking: false,
      isSubmerged: true,
    },
    {
      uuid: '00000000-0000-0000-0000-000000000004',
      username: 'Ninja',
      world: 'world',
      x: 5,
      y: 64,
      z: -5,
      yaw: 270,
      pitch: 0,
      isSneaking: true,
      isSubmerged: false,
    },
  ];

  ws.on('open', () => {
    console.log('[MockTelemetry] Connected! Sending handshake...');
    ws.send(JSON.stringify({ type: 'plugin_handshake', secret }));

    // Register tokens for easy testing
    const tokens = [
      { token: 'STEVE1', uuid: players[0].uuid, name: players[0].username },
      { token: 'ALEX01', uuid: players[1].uuid, name: players[1].username },
      { token: 'SUBM01', uuid: players[2].uuid, name: players[2].username },
      { token: 'NINJA1', uuid: players[3].uuid, name: players[3].username },
    ];

    for (const t of tokens) {
      ws.send(
        JSON.stringify({
          type: 'register_token',
          token: t.token,
          playerUuid: t.uuid,
          playerName: t.name,
          expiresAt: Date.now() + 3600000, // 1 hour
        })
      );
      console.log(`[MockTelemetry] Registered test token: ${t.token} -> ${t.name}`);
    }

    let angle = 0;
    // 10 Hz Telemetry Loop
    const interval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        return;
      }

      angle += 0.05;
      // Alex orbits Steve at radius 12
      players[1].x = Math.round(Math.cos(angle) * 12 * 100) / 100;
      players[1].z = Math.round(Math.sin(angle) * 12 * 100) / 100;
      players[1].yaw = Math.round(((angle * 180) / Math.PI + 90) % 360);

      ws.send(
        JSON.stringify({
          type: 'telemetry_batch',
          timestamp: Date.now(),
          players,
        })
      );
    }, 100);
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'speech_status') {
      console.log(`[MockTelemetry] Speech status for ${msg.uuid}: ${msg.speaking ? 'SPEAKING' : 'silent'}`);
    }
  });

  return ws;
}

if (process.env.RUN_MOCK === 'true') {
  runMockTelemetry();
}
