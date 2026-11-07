# SandBoxed signaling server

A small Cloudflare Worker that helps players find each other. It only carries the WebRTC
handshake. Once the peer connection is open, chat goes straight from browser to browser and
the server is no longer involved.

This is a prototype. It is not connected to the game in `public/index.html` yet.

## What it does

- `POST /create` returns a short room ID.
- `GET /room/:id?role=host&playerId=...&name=...` upgrades to a WebSocket.
- A host creates one `RTCPeerConnection` and one `sandboxed` data channel per player.
- The host sends an `offer` to each player, the player answers, and ICE candidates are
  relayed in both directions.
- The server relays `player-joined`, `offer`, `answer` and `ice`, then stays out of the way.
- Chat uses the data channel: the host broadcasts to every player, a player messages the
  host only.

Each room is a Durable Object, so all sockets in a room are handled by the same instance.

## Run it locally

Start the signaling server:

```
cd signaling
npx wrangler dev --port 8787
```

Serve the page from another terminal, from the repository root:

```
python -m http.server 8000 --directory public
```

Open <http://127.0.0.1:8000/webrtc-test/>.

1. Enter a name and click **Create Room**.
2. Share the room ID.
3. On another device, enter the same name and ID and click **Join Room**.
4. When the status says **Connected**, send messages.

The page uses `127.0.0.1:8787` by default. To use another server (for example the machine's
LAN address, or a deployed Worker), add `?server=` to the page URL:

```
http://192.168.1.20:8000/webrtc-test/?server=ws://192.168.1.20:8787
https://example.com/webrtc-test/?server=wss://sandboxed-signaling.example.workers.dev
```

`?server=` accepts a full URL or just `host:port`. A page served over HTTPS needs a `wss://`
server; browsers block `ws://` from HTTPS pages.

## Deploy

```
cd signaling
npx wrangler deploy
```

Open the test page over HTTPS with `?server=wss://<your-worker>.workers.dev`. CORS is open
(`*`) in the Worker, which is fine for a test harness; tighten it before using this in the
game.

## Limitations

- Only STUN (`stun.l.google.com`). Players behind symmetric NAT or restrictive networks need
  a TURN server and will fail to connect.
- No reconnect: a reloaded player gets a new ID, and a reloaded host ends the room.
- The server does not tell the host when a player leaves, and does not check that a room
  exists before accepting a player.
- No message framing or size limits yet; this is chat only.
