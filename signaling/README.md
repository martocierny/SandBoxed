# SandBoxed signaling server

A small Cloudflare Worker that helps players find each other. It only carries the WebRTC
handshake. Once the peer connection is open, the game goes straight from browser to browser
and the server is no longer involved.

The game in `public/index.html` uses this server. The host form makes a room and shows its
code, and the Join form takes that code. `public/webrtc-test/` is a small page for trying the
connection on its own.

## What it does

- `POST /create` returns a short room ID.
- `GET /room/:id?role=host&playerId=...&name=...` upgrades to a WebSocket.
- A host creates one `RTCPeerConnection` and one `sandboxed` data channel per player.
- The host sends an `offer` to each player, the player answers, and ICE candidates are
  relayed in both directions.
- The server relays `player-joined`, `offer`, `answer` and `ice`, then stays out of the way.
- A room has one host. A second host is refused.
- A player who joins a room with no host is refused, because there is nobody to connect to.
- When a player leaves, the host gets `player-left`. When the host leaves, every player gets
  `host-left` and the sandbox ends.
- The data channel carries the room: the host sends objects, rule changes and the list of
  players. A player sends only to the host, and the host checks every request.

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

Open <http://127.0.0.1:8000/>.

1. Click **Host**, choose a name and a sandbox name, and create the sandbox. The sandbox
   shows a room code.
2. In another tab or on another computer, click **Join**, enter a name and that code.
3. Make an object in the workbench and put it into the sandbox. It appears for every player.
4. The host can change the rules and clear the sandbox. A player can remove their own objects.

The test page at <http://127.0.0.1:8000/webrtc-test/> does the same connection with a plain
chat, which is easier to watch: create a room, share the ID, and join from another device.

Both pages use `127.0.0.1:8787` by default. To use another server (for example the machine's
LAN address, or a deployed Worker), add `?server=` to the page URL:

```
http://192.168.1.20:8000/?server=ws://192.168.1.20:8787
https://example.com/?server=wss://sandboxed-signaling.example.workers.dev
```

`?server=` accepts a full URL or just `host:port`. A page served over HTTPS needs a `wss://`
server; browsers block `ws://` from HTTPS pages.

## Deploy

```
cd signaling
npx wrangler deploy
```

Open the game over HTTPS with `?server=wss://<your-worker>.workers.dev`. CORS is open (`*`)
in the Worker; tighten it to the address of your page if you run it for more than a test.

## Limitations

- Only STUN (`stun.l.google.com`). Players behind symmetric NAT or restrictive networks need
  a TURN server and will fail to connect.
- There is no list of public sandboxes yet, even though the host form asks who can join.
  A player always needs the code.
- Players with the same name look like one player. Use different names.
- Objects and rules are shared, but positions are not. Dragging an object changes it on this
  computer only, so an object can stand at a different place on each screen.
- No reconnect: a reloaded player gets a new ID, and a reloaded host ends the room.
- Messages on the data channel have no size limit on the sending side; the receiving side
  drops anything over 64 KB.
