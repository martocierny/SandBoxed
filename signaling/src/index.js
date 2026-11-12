// SandBoxed Signaling Server
// The server only helps players find the host. After that they talk over WebRTC.

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.host = null;
    this.players = new Map(); // playerId -> { ws, name, host }
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();

      const playerId = url.searchParams.get("playerId") || crypto.randomUUID();
      const isHost = url.searchParams.get("role") === "host";
      const name = (url.searchParams.get("name") || "").trim().slice(0, 24) || "Player";

      // A room has one host. The sandbox lives on that computer.
      if (isHost && this.host) {
        server.send(JSON.stringify({ type: "error", message: "this room already has a host" }));
        server.close(1008, "a host is already here");
        return new Response(null, { status: 101, webSocket: client });
      }

      // A player needs a host, otherwise there is nobody to connect to.
      if (!isHost && (!this.host || this.host.ws.readyState !== 1)) {
        server.send(JSON.stringify({ type: "host-missing", message: "there is no host in this room" }));
        server.close(1008, "no host");
        return new Response(null, { status: 101, webSocket: client });
      }

      this.players.set(playerId, { ws: server, name, host: isHost });

      if (isHost) {
        this.host = { id: playerId, ws: server };
        server.send(JSON.stringify({ type: "joined", role: "host", playerId }));
      } else {
        server.send(JSON.stringify({ type: "joined", role: "player", playerId, name }));

        if (this.host.ws.readyState === 1) {
          this.host.ws.send(JSON.stringify({
            type: "player-joined",
            playerId,
            name
          }));
        }
      }

      server.addEventListener("message", (event) => {
        this.handleMessage(playerId, event.data);
      });

      server.addEventListener("close", () => {
        this.players.delete(playerId);

        if (isHost) {
          // The sandbox ends with its host, so the players hear that it is over.
          this.host = null;
          this.players.forEach((other) => {
            if (other.ws.readyState === 1) {
              other.ws.send(JSON.stringify({ type: "host-left" }));
            }
          });
          this.players.clear();
        } else if (this.host && this.host.ws.readyState === 1) {
          this.host.ws.send(JSON.stringify({ type: "player-left", playerId, name }));
        }
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    return corsResponse("SandBoxed Signaling Server is running");
  }

  handleMessage(fromId, raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (data.type === "offer" && data.to) {
      const target = this.players.get(data.to);
      if (target && target.ws.readyState === 1) {
        target.ws.send(JSON.stringify({
          type: "offer",
          from: fromId,
          sdp: data.sdp
        }));
      }
    }

    if (data.type === "answer" && this.host) {
      if (this.host.ws.readyState === 1) {
        this.host.ws.send(JSON.stringify({
          type: "answer",
          from: fromId,
          sdp: data.sdp
        }));
      }
    }

    if (data.type === "ice" && data.to) {
      const target = this.players.get(data.to);
      if (target && target.ws.readyState === 1) {
        target.ws.send(JSON.stringify({
          type: "ice",
          from: fromId,
          candidate: data.candidate
        }));
      }
    }
  }
}

// Helper for CORS
function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    }
  });
}

// Main Worker
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    // Create a new room
    if (url.pathname === "/create" && request.method === "POST") {
      const roomId = crypto.randomUUID().slice(0, 8);
      const id = env.ROOM.idFromName(roomId);
      const room = env.ROOM.get(id);

      // Touch the room so it exists
      await room.fetch(new Request("https://dummy", { method: "GET" }));

      return corsResponse(JSON.stringify({ roomId }));
    }

    // Connect to a room via WebSocket
    if (url.pathname.startsWith("/room/")) {
      const roomId = url.pathname.split("/")[2];
      const id = env.ROOM.idFromName(roomId);
      const room = env.ROOM.get(id);
      return room.fetch(request);
    }

    return corsResponse(JSON.stringify({ message: "SandBoxed Signaling Server" }));
  }
};
