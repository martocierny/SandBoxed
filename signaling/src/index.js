// SandBoxed Signaling Server
// First version with CORS support

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.host = null;
    this.players = new Map();
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

      if (isHost) {
        this.host = { id: playerId, ws: server };
        this.players.set(playerId, server);
        server.send(JSON.stringify({ type: "joined", role: "host", playerId }));
      } else {
        this.players.set(playerId, server);
        server.send(JSON.stringify({ type: "joined", role: "player", playerId }));

        if (this.host && this.host.ws.readyState === 1) {
          this.host.ws.send(JSON.stringify({
            type: "player-joined",
            playerId
          }));
        }
      }

      server.addEventListener("message", (event) => {
        this.handleMessage(playerId, event.data);
      });

      server.addEventListener("close", () => {
        this.players.delete(playerId);
        if (this.host && this.host.id === playerId) {
          this.host = null;
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
      if (target && target.readyState === 1) {
        target.send(JSON.stringify({
          type: "offer",
          from: fromId,
          sdp: data.sdp
        }));
      }
    }

    if (data.type === "answer" && this.host) {
      this.host.ws.send(JSON.stringify({
        type: "answer",
        from: fromId,
        sdp: data.sdp
      }));
    }

    if (data.type === "ice" && data.to) {
      const target = this.players.get(data.to);
      if (target && target.readyState === 1) {
        target.send(JSON.stringify({
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