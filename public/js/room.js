// SPDX-License-Identifier: MIT
// The sandbox the player is in: its name, code, rules and players.
// The host decides the rules. The other players get them from the host.

const nameKey = "sandboxed.player";

export let room = null;

// The name of the player, remembered in this browser.
export function savedName() {
  try {
    return localStorage.getItem(nameKey) || "";
  } catch (error) {
    return "";
  }
}

export function rememberName(name) {
  try {
    localStorage.setItem(nameKey, name);
  } catch (error) {
    // Without storage the name is asked again next time.
  }
}

export function hostRoom(settings) {
  rememberName(settings.player);
  room = {
    name: settings.name,
    code: "",
    host: settings.player,
    maxPlayers: settings.maxPlayers,
    visibility: settings.visibility,
    gravity: settings.gravity,
    destruction: settings.destruction,
    players: [{ name: settings.player, host: true }]
  };
  return room;
}

// A player joins the sandbox of a host. The code is the one typed in.
export function joinRoom(settings) {
  rememberName(settings.player);
  room = {
    name: settings.name,
    code: settings.code,
    host: settings.host,
    maxPlayers: settings.maxPlayers,
    visibility: settings.visibility,
    gravity: settings.gravity,
    destruction: settings.destruction,
    players: []
  };
  replacePlayers(settings.players || []);
  return room;
}

export function addPlayer(name) {
  if (!room || !name) return;
  if (room.players.some(function (player) { return player.name === name; })) return;
  room.players.push({ name: name, host: name === room.host });
}

export function removePlayer(name) {
  if (!room) return;
  room.players = room.players.filter(function (player) { return player.name !== name; });
}

// The host sends the whole list, so a player always has the same players as the host.
export function replacePlayers(names) {
  if (!room) return;
  room.players = names.filter(Boolean).map(function (name) {
    return { name: name, host: name === room.host };
  });
}

// Only the values the game knows are taken, so a bad message cannot change anything else.
export function setRules(changes) {
  if (!room || !changes) return;
  if (typeof changes.gravity === "boolean") room.gravity = changes.gravity;
  if (["all", "own", "none"].includes(changes.destruction)) room.destruction = changes.destruction;
}

export function leaveRoom() {
  room = null;
}
