// SPDX-License-Identifier: MIT
// The connection to the other players. The signaling server only helps players find
// each other. After that, the host and every player talk over a WebRTC data channel.

import { validate } from "./validate.js";
import { behaviorOf } from "./script.js";
import { addObject, removeObject, objectById, allObjects } from "./sandbox.js";
import { room, addPlayer, removePlayer, replacePlayers, setRules } from "./room.js";

const VERSION = 1;
const MAX_MESSAGE = 64 * 1024;
const WAIT_TIME = 15000;

// The signaling server is the local wrangler dev server by default.
// On the deployed game, open the page with ?server=wss://your-worker.workers.dev
const scheme = location.protocol === "https:" ? "https" : "http";
const params = new URLSearchParams(location.search);
let server = (params.get("server") || "").trim().replace(/\/+$/, "");
if (/^wss:\/\//i.test(server)) {
  server = "https://" + server.slice(6);
} else if (/^ws:\/\//i.test(server)) {
  server = "http://" + server.slice(5);
} else if (server && !/^https?:\/\//i.test(server)) {
  server = scheme + "://" + server;
}
if (!server) server = scheme + "://127.0.0.1:8787";
const API_URL = server;
const SIGNALING_URL = server.replace(/^http/, "ws"); // http -> ws, https -> wss

let role = null;
let socket = null;
let code = "";
let listener = null;
let helloWait = null;

// Host side: playerId -> { id, name, pc, channel, pendingIce, remoteReady }
const peers = new Map();

// Player side
let playerPeer = null;
let pendingPlayerIce = [];
let playerRemoteReady = false;

// The page listens for room updates: players, rules, a rejected object, the host leaving.
export function setNetListener(callback) {
  listener = callback;
}

function tell(event) {
  if (listener) listener(event);
}

export function isHost() {
  return role === "host";
}

export function isPlayer() {
  return role === "player";
}

// A player can talk to the host even after the signaling server is gone.
function playerChannelOpen() {
  return role === "player" && !!playerPeer && !!playerPeer.channel && playerPeer.channel.readyState === "open";
}

// ---------- Joining a room ----------

// Create a room on the signaling server and connect as the host.
// Returns the room code the players type in.
export async function host(name) {
  // Anything left from an earlier try goes first.
  close();

  // The game is hosted on this computer from now on, even if the room fails.
  role = "host";
  let data;
  try {
    const response = await fetch(API_URL + "/create", { method: "POST" });
    if (!response.ok) throw new Error("the signaling server answered " + response.status);
    data = await response.json();
  } catch (error) {
    role = null;
    // fetch() says "Failed to fetch" and hides the address, so say it here.
    if (error instanceof TypeError) throw new Error("the signaling server at " + API_URL + " did not answer");
    throw error;
  }
  code = String(data.roomId || "");
  if (!code) {
    role = null;
    throw new Error("the signaling server did not send a room code");
  }

  const id = crypto.randomUUID().slice(0, 8);
  try {
    await openSocket(`/room/${code}?role=host&playerId=${id}&name=${encodeURIComponent(name)}`);
  } catch (error) {
    role = null;
    socket = null;
    throw error;
  }
  return { code };
}

// Connect as a player and wait for the host's hello with the room and its objects.
export async function join(roomCode, name) {
  // Anything left from an earlier try goes first.
  close();

  code = String(roomCode || "").trim().toLowerCase();
  role = "player";
  const id = crypto.randomUUID().slice(0, 8);
  try {
    await openSocket(`/room/${code}?role=player&playerId=${id}&name=${encodeURIComponent(name)}`);
  } catch (error) {
    role = null;
    socket = null;
    throw error;
  }

  return await new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      helloWait = null;
      reject(new Error("the host did not answer"));
      // The socket of the failed attempt would otherwise stay open.
      close();
    }, WAIT_TIME);

    helloWait = {
      resolve: function (message) {
        clearTimeout(timer);
        helloWait = null;
        resolve(message);
      },
      reject: function (error) {
        clearTimeout(timer);
        helloWait = null;
        reject(error);
      }
    };
  });
}

function openSocket(path) {
  return new Promise(function (resolve, reject) {
    const ws = new WebSocket(SIGNALING_URL + path);
    socket = ws;
    let opened = false;

    const timer = setTimeout(function () {
      if (opened) return;
      try { ws.close(); } catch (error) { /* already closed */ }
      reject(new Error("the signaling server did not answer at " + API_URL));
    }, WAIT_TIME);

    ws.onopen = function () {
      opened = true;
      clearTimeout(timer);
      resolve();
    };

    ws.onerror = function () {
      if (opened) return;
      clearTimeout(timer);
      if (socket === ws) socket = null;
      reject(new Error("could not reach the signaling server at " + API_URL));
    };

    ws.onclose = function () {
      if (!opened) {
        clearTimeout(timer);
        if (socket === ws) socket = null;
        reject(new Error("the signaling server closed the connection"));
        return;
      }
      if (socket === ws) tell({ type: "disconnected" });
    };

    ws.onmessage = function (event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if (role === "host") hostSignal(message);
      else if (role === "player") playerSignal(message);
    };
  });
}

function sendSignal(message) {
  if (socket && socket.readyState === 1) socket.send(JSON.stringify(message));
}

// ---------- The host ----------

function hostSignal(message) {
  if (message.type === "player-joined") {
    createPeer(message.playerId, message.name || "Player");
  } else if (message.type === "player-left") {
    const peer = peers.get(message.playerId);
    if (peer) closePeer(peer);
    peers.delete(message.playerId);
    removePlayer(message.name || message.playerId);
    broadcastPlayers();
    tell({ type: "players" });
  } else if (message.type === "answer") {
    const peer = peers.get(message.from);
    if (!peer) return;
    peer.pc.setRemoteDescription({ type: "answer", sdp: message.sdp })
      .then(function () { return flushPeerIce(peer); })
      .catch(function (error) { tell({ type: "error", message: error.message }); });
  } else if (message.type === "ice") {
    const peer = peers.get(message.from);
    if (peer) addPeerIce(peer, message.candidate);
  } else if (message.type === "error") {
    tell({ type: "error", message: message.message || "the signaling server refused the room" });
  }
}

function createPeer(playerId, name) {
  const old = peers.get(playerId);
  if (old) closePeer(old);

  const peer = {
    id: playerId,
    name: String(name).slice(0, 20),
    pc: null,
    channel: null,
    pendingIce: [],
    remoteReady: false
  };
  peers.set(playerId, peer);

  const connection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  peer.pc = connection;

  connection.onicecandidate = function (event) {
    if (event.candidate) {
      sendSignal({ type: "ice", to: playerId, candidate: event.candidate });
    }
  };

  connection.onconnectionstatechange = function () {
    if (connection.connectionState === "failed") {
      tell({ type: "error", message: "could not connect to " + peer.name });
    }
  };

  const channel = connection.createDataChannel("sandboxed");
  peer.channel = channel;

  channel.onopen = function () {
    onPeerOpen(peer);
  };
  channel.onmessage = function (event) {
    onPeerMessage(peer, event.data);
  };
  channel.onclose = function () {
    // The player left without closing the socket, for example after a crash.
    if (peers.get(playerId) !== peer) return;
    peers.delete(playerId);
    removePlayer(peer.name);
    broadcastPlayers();
    tell({ type: "players" });
  };

  connection.createOffer()
    .then(function (offer) { return connection.setLocalDescription(offer); })
    .then(function () {
      sendSignal({ type: "offer", to: playerId, sdp: connection.localDescription.sdp });
    })
    .catch(function (error) { tell({ type: "error", message: error.message }); });
}

function onPeerOpen(peer) {
  // The sandbox has a limit. A late player still gets a connection, then a short answer.
  // The player closes the connection after reading it, so the answer arrives first.
  if (room && room.players.length >= room.maxPlayers) {
    sendPeer(peer, { t: "full", v: VERSION });
    return;
  }

  addPlayer(peer.name);
  sendPeer(peer, {
    t: "hello",
    v: VERSION,
    room: roomInfo(),
    players: room.players.map(function (player) { return player.name; })
  });

  // One message per object, so a big drawing cannot block the rest.
  allObjects().forEach(function (object) {
    if (object.id) sendPeer(peer, addMessage(object));
  });

  broadcastPlayers();
  tell({ type: "players" });
}

function onPeerMessage(peer, raw) {
  if (role !== "host") return;
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE) return;
  let message;
  try {
    message = JSON.parse(raw);
  } catch (error) {
    return;
  }
  if (message.v !== VERSION) return;

  if (message.t === "add-request") {
    let object;
    try {
      object = validate(message.script);
    } catch (error) {
      sendPeer(peer, { t: "reject", v: VERSION, reason: error.message });
      return;
    }
    object.id = crypto.randomUUID();
    object.author = peer.name;
    try {
      addObject(object);
    } catch (error) {
      sendPeer(peer, { t: "reject", v: VERSION, reason: error.message });
      return;
    }
    broadcast(addMessage(object));
    tell({ type: "players" });
  } else if (message.t === "remove-request") {
    const object = objectById(message.id);
    if (!object) return;
    if (object.author !== peer.name) {
      sendPeer(peer, { t: "reject", v: VERSION, reason: "that object belongs to someone else" });
      return;
    }
    removeObject(object);
    broadcast({ t: "remove", v: VERSION, id: message.id });
  }
}

function addMessage(object) {
  return {
    t: "add",
    v: VERSION,
    id: object.id,
    author: object.author,
    x: Number.isFinite(object.x) ? object.x : undefined,
    y: Number.isFinite(object.y) ? object.y : undefined,
    script: {
      name: object.name,
      look: object.look,
      behavior: behaviorOf(object)
    }
  };
}

function roomInfo() {
  return {
    name: room.name,
    host: room.host,
    maxPlayers: room.maxPlayers,
    visibility: room.visibility,
    gravity: room.gravity,
    destruction: room.destruction
  };
}

function broadcastPlayers() {
  if (!room) return;
  broadcast({
    t: "players",
    v: VERSION,
    players: room.players.map(function (player) { return player.name; })
  });
}

function broadcast(message) {
  peers.forEach(function (peer) { sendPeer(peer, message); });
}

function sendPeer(peer, message) {
  if (peer.channel && peer.channel.readyState === "open") {
    peer.channel.send(JSON.stringify(message));
  }
}

function addPeerIce(peer, candidate) {
  if (!candidate) return;
  if (!peer.remoteReady) {
    peer.pendingIce.push(candidate);
    return;
  }
  peer.pc.addIceCandidate(candidate).catch(function (error) {
    tell({ type: "error", message: error.message });
  });
}

async function flushPeerIce(peer) {
  peer.remoteReady = true;
  const queued = peer.pendingIce.splice(0);
  for (const candidate of queued) {
    try {
      await peer.pc.addIceCandidate(candidate);
    } catch (error) {
      tell({ type: "error", message: error.message });
    }
  }
}

function closePeer(peer) {
  try { if (peer.channel) peer.channel.close(); } catch (error) { /* already closed */ }
  try { peer.pc.close(); } catch (error) { /* already closed */ }
}

// ---------- A player ----------

function playerSignal(message) {
  if (message.type === "offer") {
    handleOffer(message.from, message.sdp);
  } else if (message.type === "ice") {
    addPlayerIce(message.candidate);
  } else if (message.type === "host-left") {
    tell({ type: "host-left" });
    close();
  } else if (message.type === "host-missing") {
    if (helloWait) helloWait.reject(new Error("there is no host in this room"));
    else tell({ type: "host-left" });
    close();
  } else if (message.type === "error") {
    const text = message.message || "the signaling server refused the room";
    if (helloWait) helloWait.reject(new Error(text));
    else tell({ type: "error", message: text });
    close();
  }
}

async function handleOffer(fromId, sdp) {
  playerPeer = {
    pc: new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }),
    channel: null,
    pendingIce: [],
    remoteReady: false
  };
  pendingPlayerIce = [];
  playerRemoteReady = false;

  const connection = playerPeer.pc;
  const peer = playerPeer;

  connection.ondatachannel = function (event) {
    peer.channel = event.channel;
    peer.channel.onmessage = function (messageEvent) {
      onHostMessage(messageEvent.data);
    };
  };

  connection.onicecandidate = function (event) {
    if (event.candidate) {
      sendSignal({ type: "ice", to: fromId, candidate: event.candidate });
    }
  };

  connection.onconnectionstatechange = function () {
    if (connection.connectionState === "failed") {
      tell({ type: "error", message: "could not connect to the host" });
    }
  };

  try {
    await connection.setRemoteDescription({ type: "offer", sdp });
    playerRemoteReady = true;
    await flushPlayerIce();
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    sendSignal({ type: "answer", sdp: answer.sdp });
  } catch (error) {
    tell({ type: "error", message: error.message });
  }
}

function addPlayerIce(candidate) {
  if (!candidate) return;
  if (!playerPeer || !playerRemoteReady) {
    pendingPlayerIce.push(candidate);
    return;
  }
  playerPeer.pc.addIceCandidate(candidate).catch(function (error) {
    tell({ type: "error", message: error.message });
  });
}

async function flushPlayerIce() {
  const queued = pendingPlayerIce.splice(0);
  for (const candidate of queued) {
    try {
      await playerPeer.pc.addIceCandidate(candidate);
    } catch (error) {
      tell({ type: "error", message: error.message });
    }
  }
}

function onHostMessage(raw) {
  if (role !== "player") return;
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE) return;
  let message;
  try {
    message = JSON.parse(raw);
  } catch (error) {
    return;
  }
  if (message.v !== VERSION) return;

  if (message.t === "hello") {
    if (helloWait) helloWait.resolve(message);
    // Only now is the player in the sandbox, so a closed channel means the host is gone.
    // close() empties playerPeer first, so leaving on purpose does not come here.
    const peer = playerPeer;
    if (peer && peer.channel) {
      peer.channel.onclose = function () {
        if (playerPeer === peer) tell({ type: "host-left" });
      };
    }
  } else if (message.t === "add") {
    let object;
    try {
      object = validate(message.script);
    } catch (error) {
      return;
    }
    object.id = message.id;
    object.author = message.author;
    try {
      addObject(object, message.x, message.y);
    } catch (error) {
      return;
    }
  } else if (message.t === "remove") {
    const object = objectById(message.id);
    if (object) removeObject(object);
  } else if (message.t === "rules") {
    setRules({ gravity: !!message.gravity, destruction: message.destruction });
    tell({ type: "rules" });
  } else if (message.t === "players") {
    replacePlayers(message.players);
    tell({ type: "players" });
  } else if (message.t === "reject") {
    tell({ type: "reject", reason: message.reason });
  } else if (message.t === "full") {
    if (helloWait) helloWait.reject(new Error("the sandbox is full"));
    else tell({ type: "full" });
    close();
  }
}

// ---------- What the game calls ----------

// The host shares an object it already put into the sandbox.
// A player asks the host; it appears when the host accepts it.
export function shareObject(object) {
  if (isHost()) {
    if (!object.id) object.id = crypto.randomUUID();
    if (!object.author && room) object.author = room.host;
    broadcast(addMessage(object));
  } else if (playerChannelOpen()) {
    sendPlayer({
      t: "add-request",
      v: VERSION,
      script: { name: object.name, look: object.look, behavior: behaviorOf(object) }
    });
  }
}

export function shareRemove(object) {
  if (!object.id) return;
  if (isHost()) {
    broadcast({ t: "remove", v: VERSION, id: object.id });
  } else if (playerChannelOpen()) {
    sendPlayer({ t: "remove-request", v: VERSION, id: object.id });
  }
}

// The host changed the rules of the sandbox. The other players get the new ones.
export function shareRules(changes) {
  if (!isHost() || !room) return;
  setRules(changes);
  broadcast({ t: "rules", v: VERSION, gravity: room.gravity, destruction: room.destruction });
}

function sendPlayer(message) {
  const channel = playerPeer && playerPeer.channel;
  if (channel && channel.readyState === "open") channel.send(JSON.stringify(message));
}

export function close() {
  peers.forEach(closePeer);
  peers.clear();
  if (playerPeer) {
    try { if (playerPeer.channel) playerPeer.channel.close(); } catch (error) { /* already closed */ }
    try { playerPeer.pc.close(); } catch (error) { /* already closed */ }
    playerPeer = null;
  }
  pendingPlayerIce = [];
  playerRemoteReady = false;
  if (helloWait) {
    helloWait.reject(new Error("the connection closed"));
    helloWait = null;
  }
  if (socket) {
    try { socket.close(1000, "leaving"); } catch (error) { /* already closed */ }
  }
  socket = null;
  role = null;
  code = "";
}
