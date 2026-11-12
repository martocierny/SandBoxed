// SPDX-License-Identifier: MIT
// The page: checking the AI, hosting a sandbox, and making objects with the AI in it.

import { show } from "./ui.js";
import { currentAI, testAI, getSettings, changeSettings } from "./ai.js";
import { lookAIs, sketchAI, behaviorAI, askedFor, generate } from "./prompts.js";
import { sketch } from "./sketch.js";
import { validate } from "./validate.js";
import { script, objectScript } from "./script.js";
import { allObjects, clearObjects, removeObject, onSelect, selected, setWorld } from "./sandbox.js";
import { setDraft, setScript } from "./workbench.js";
import { showPad, getStrokes } from "./pad.js";
import { room, savedName, hostRoom, joinRoom, leaveRoom } from "./room.js";
import {
  host, join, setNetListener, isPlayer, shareRemove, shareRules,
  close as disconnect
} from "./net.js";

const apiText = document.getElementById("api");
const modelText = document.getElementById("model");
const testText = document.getElementById("test");
const downloadButton = document.getElementById("download");
const downloadBox = document.getElementById("downloadBox");
const downloadNote = document.getElementById("downloadNote");
const removeBox = document.getElementById("removeBox");
const joinButton = document.getElementById("join");
const hostButton = document.getElementById("host");
const promptInput = document.getElementById("prompt");
const lookMode = document.getElementById("lookMode");
const createButton = document.getElementById("create");
const createText = document.getElementById("createText");
const aiChoice = document.getElementById("aiChoice");
const serverBox = document.getElementById("serverBox");
const serverUrl = document.getElementById("serverUrl");
const serverModel = document.getElementById("serverModel");
const browserBox = document.getElementById("browserBox");
const browserModel = document.getElementById("browserModel");
const gravityBox = document.getElementById("gravity");
const destructionBox = document.getElementById("destruction");
const joinText = document.getElementById("joinText");

// ---------- Choose the AI ----------

aiChoice.value = getSettings().ai;
browserModel.value = getSettings().size;
serverUrl.value = getSettings().url;
showBoxes();
document.getElementById("origin").textContent = location.origin;

// The settings of the chosen AI are shown under it.
function showBoxes() {
  browserBox.hidden = aiChoice.value !== "browser";
  serverBox.hidden = aiChoice.value !== "server";
}

// The old AI or model frees its memory, for example a browser model in the graphics card.
function release() {
  const before = currentAI();
  if (before.release) before.release();
}

aiChoice.onchange = function () {
  release();
  changeSettings({ ai: aiChoice.value });
  showBoxes();
  check();
};
browserModel.onchange = function () {
  release();
  changeSettings({ size: browserModel.value });
  check();
};
serverUrl.onchange = function () {
  changeSettings({ url: serverUrl.value });
  check();
};
serverModel.onchange = function () {
  changeSettings({ model: serverModel.value });
  test(checks);
};

// The models of the server. The remembered model stays chosen if the server still has it.
function showModels(models) {
  serverModel.textContent = "";
  models.forEach(function (model) { serverModel.add(new Option(model)); });
  if (!models.includes(getSettings().model)) changeSettings({ model: models[0] });
  serverModel.value = getSettings().model;
}

// ---------- Check the AI ----------

// Each check gets a number. When the player changes the AI during a check,
// the old check stops showing its results.
let checks = 0;

function ready(yes) {
  joinButton.disabled = !yes;
  hostButton.disabled = !yes;
  createButton.disabled = !yes;
}

async function check() {
  const number = ++checks;
  ready(false);
  downloadBox.hidden = true;
  removeBox.hidden = true;
  show(apiText, "checking...", "wait");
  show(modelText, "-", "wait");
  show(testText, "-", "wait");
  const status = await currentAI().status(getSettings());
  if (number !== checks) return;

  if (status.state === "missing") {
    show(apiText, status.text, "bad");
    show(modelText, "-", "bad");
    show(testText, "-", "bad");
    return;
  }
  show(apiText, "found", "ok");
  if (status.models) showModels(status.models);

  if (status.state === "unavailable") {
    show(modelText, status.text || "not supported on this computer", "bad");
    show(testText, "-", "bad");
    return;
  }
  if (status.state === "downloadable" || status.state === "downloading") {
    show(modelText, status.state === "downloading" ? "downloading..." : "not downloaded yet", "bad");
    downloadNote.textContent = status.note || "";
    downloadButton.disabled = false;
    downloadBox.hidden = false;
    return;
  }

  show(modelText, "ready", "ok");
  removeBox.hidden = !status.removable;
  await test(number);
}

async function test(number) {
  ready(false);
  show(testText, "asking the AI...", "wait");
  try {
    const answer = await testAI();
    if (number !== checks) return;
    show(testText, "AI answered: " + answer, "ok");
    ready(true);
  } catch (error) {
    if (number !== checks) return;
    show(testText, "failed: " + error.message, "bad");
  }
}

// Download needs a click from the player.
downloadButton.onclick = async function () {
  const number = checks;
  downloadButton.disabled = true;
  show(modelText, "downloading...", "wait");
  try {
    await currentAI().download(function (loaded) {
      if (number === checks) show(modelText, "downloading... " + Math.round(loaded * 100) + "%", "wait");
    }, getSettings());
    if (number === checks) await check();
  } catch (error) {
    if (number !== checks) return;
    show(modelText, "download failed: " + error.message, "bad");
    downloadButton.disabled = false;
  }
};

document.getElementById("remove").onclick = async function () {
  if (!confirm("Delete the model from this browser? You can download it again later.")) return;
  try {
    await currentAI().remove(getSettings());
  } catch (error) {
    show(modelText, "could not delete: " + error.message, "bad");
    return;
  }
  check();
};

// ---------- Screens: start, host, join and the sandbox ----------

const screens = ["startScreen", "hostScreen", "joinScreen", "sandboxScreen"];

function showScreen(name) {
  screens.forEach(function (id) { document.getElementById(id).hidden = id !== name; });
  window.scrollTo(0, 0);
}

// True while the player on this computer hosts the sandbox.
let hosting = false;

// True while a room is being made or joined, so a double click does nothing.
let starting = false;

joinButton.onclick = function () {
  const joinName = document.getElementById("joinName");
  if (!joinName.value) joinName.value = savedName();
  show(joinText, "", "wait");
  showScreen("joinScreen");
  (joinName.value ? document.getElementById("joinCode") : joinName).focus();
};

document.getElementById("joinBack").onclick = function () {
  showScreen("startScreen");
};

hostButton.onclick = function () {
  const playerName = document.getElementById("playerName");
  if (!playerName.value) playerName.value = savedName();
  showScreen("hostScreen");
  (playerName.value ? document.getElementById("sandboxName") : playerName).focus();
};

document.getElementById("hostBack").onclick = function () {
  showScreen("startScreen");
};

// The browser checks the form first: names are needed and 2 to 8 players.
document.getElementById("hostForm").onsubmit = async function (e) {
  e.preventDefault();
  if (starting) return;
  starting = true;
  const r = hostRoom({
    player: document.getElementById("playerName").value.trim(),
    name: document.getElementById("sandboxName").value.trim(),
    maxPlayers: Number(document.getElementById("maxPlayers").value),
    visibility: document.querySelector("input[name=visibility]:checked").value,
    gravity: document.getElementById("hostGravity").checked,
    destruction: document.getElementById("hostDestruction").value
  });
  hosting = true;
  clearObjects();
  setDraft(null);
  setScript("");
  show(createText, "", "wait");
  setWorld({ player: r.host, gravity: r.gravity, destruction: r.destruction });
  gravityBox.checked = r.gravity;
  destructionBox.value = r.destruction;
  showRoom();
  showScreen("sandboxScreen");
  try {
    // The signaling server makes the room and keeps the code for the players.
    const made = await host(r.host);
    r.code = made.code;
    showRoom();
  } catch (error) {
    show(document.getElementById("sandboxInfo"),
      "could not make a room: " + error.message + ". The sandbox still works on this computer.", "bad");
  } finally {
    starting = false;
  }
};

// The code and the players are the same for the host and for the players.
document.getElementById("joinForm").onsubmit = async function (e) {
  e.preventDefault();
  if (starting) return;
  starting = true;
  const name = document.getElementById("joinName").value.trim();
  const code = document.getElementById("joinCode").value.trim();
  show(joinText, "joining...", "wait");
  // The sandbox of the last room goes before the host sends this one.
  clearObjects();
  setDraft(null);
  setScript("");
  setWorld({ player: name });
  try {
    const hello = await join(code, name);
    joinRoom(Object.assign({ player: name, code: code, players: hello.players }, hello.room));
    hosting = false;
    setWorld({ gravity: room.gravity, destruction: room.destruction });
    gravityBox.checked = room.gravity;
    destructionBox.value = room.destruction;
    showRoom();
    show(joinText, "", "wait");
    showScreen("sandboxScreen");
  } catch (error) {
    show(joinText, "could not join: " + error.message, "bad");
  } finally {
    starting = false;
  }
};

function showRoom() {
  document.getElementById("sandboxTitle").textContent = room.name;
  const codeLine = document.getElementById("roomCodeLine");
  const codeText = document.getElementById("roomCodeText");
  codeText.textContent = room.code || "";
  codeLine.hidden = !room.code;

  const count = "Players: " + room.players.length + " of " + room.maxPlayers + ".";
  const names = room.players.map(function (player) {
    return player.name + (player.host ? " (host)" : "");
  }).join(", ");
  const what = hosting
    ? "You host this sandbox. Give the room code to the players who join."
    : "The host decides the rules, and every computer checks the objects.";
  show(document.getElementById("sandboxInfo"), what + " " + count + (names ? " " + names + "." : ""), "wait");

  // Only the host changes the rules or clears the sandbox.
  document.getElementById("rulesBox").hidden = !hosting;
}

// Leaving ends the sandbox for the host, because the sandbox lives on the host.
function endSandbox() {
  disconnect();
  clearObjects();
  setDraft(null);
  setScript("");
  leaveRoom();
  hosting = false;
  showScreen("startScreen");
}

document.getElementById("leave").onclick = function () {
  if (!confirm(hosting ? "Leave the sandbox? It ends for everyone." : "Leave the sandbox?")) return;
  endSandbox();
};

// The other players hear about changes in the room, or that the host is gone.
setNetListener(function (event) {
  if (event.type === "players") {
    if (room) showRoom();
  } else if (event.type === "rules") {
    if (!room) return;
    setWorld({ gravity: room.gravity, destruction: room.destruction });
    gravityBox.checked = room.gravity;
    destructionBox.value = room.destruction;
    show(createText, "The host changed the rules.", "wait");
  } else if (event.type === "reject") {
    show(createText, "the host rejected it: " + event.reason, "bad");
  } else if (event.type === "host-left") {
    alert("The host left, so the sandbox has ended.");
    endSandbox();
  } else if (event.type === "full") {
    alert("The sandbox is full.");
    endSandbox();
  } else if (event.type === "disconnected") {
    // The players who are already here keep their own connection, but the room
    // can no longer let anyone in, so its code is no longer shown.
    if (room) room.code = "";
    document.getElementById("roomCodeLine").hidden = true;
    show(document.getElementById("sandboxInfo"),
      "The signaling server is gone, so no new players can join. The players who are here stay connected.", "bad");
  } else if (event.type === "error") {
    show(createText, event.message, "bad");
  }
});

// ---------- Make an object ----------

lookMode.onchange = function () {
  showPad(lookMode.value === "drawing");
};

// The look comes from the AI chosen in "Look", or from your drawing.
async function makeLook(mode, text) {
  if (mode === "drawing") {
    const strokes = getStrokes();
    if (strokes.length === 0) throw new Error("draw the look first");
    return { name: text.trim().slice(0, 30) || "Drawing", look: { type: "drawing", strokes: strokes } };
  }
  // The AI picks the thing and the color, then Sketch-RNN draws it.
  if (mode === "sketch") {
    const choice = await generate(sketchAI, text, fixing);
    show(createText, "sketching: " + choice.category.replace(/_/g, " ") + "...", "wait");
    return { name: choice.name, look: { type: "drawing", strokes: await sketch(choice.category, choice.color) } };
  }
  const ai = lookAIs[mode];
  const data = await generate(ai, text, fixing);
  return { name: data.name, look: ai.toLook(data) };
}

function fixing(message) {
  show(createText, "the AI is fixing: " + message, "wait");
}

// The AI thinks twice, first about the look and then about the behavior.
// Both answers are put together into one object with one script, on the workbench.
createButton.onclick = async function () {
  createButton.disabled = true;
  setDraft(null);
  setScript("");
  const text = promptInput.value;
  let name = "";
  let look = {};
  let behavior = {};
  try {
    show(createText, "making the look...", "wait");
    const made = await makeLook(lookMode.value, text);
    name = made.name;
    look = made.look;
    show(createText, "the AI is choosing the behavior...", "wait");
    // A drawing without any text just stands still.
    behavior = text.trim() ? askedFor(await generate(behaviorAI, text, fixing), text) : {};
    const object = validate({ name: name, look: look, behavior: behavior });
    setDraft(object);
    show(createText, "accepted, it is on the workbench: " + object.name, "ok");
  } catch (error) {
    // A rejected script stays on the workbench, so you can fix it there.
    if (error.ai === behaviorAI) {
      behavior = error.data || {};
    } else if (error.ai && error.data) {
      name = error.data.name || name;
      look = error.ai.toLook ? error.ai.toLook(error.data) : error.data;
    }
    setScript(script(name, look, behavior));
    show(createText, "rejected: " + error.message, "bad");
  }
  createButton.disabled = false;
};

// The rules of the sandbox. Only the host can change them, and the players get the new ones.
gravityBox.onchange = function () {
  if (!hosting) {
    gravityBox.checked = room ? room.gravity : true;
    return;
  }
  setWorld({ gravity: gravityBox.checked });
  shareRules({ gravity: gravityBox.checked });
};
destructionBox.onchange = function () {
  if (!hosting) {
    destructionBox.value = room ? room.destruction : "all";
    return;
  }
  setWorld({ destruction: destructionBox.value });
  shareRules({ destruction: destructionBox.value });
};

document.getElementById("clearSandbox").onclick = function () {
  if (!hosting) return;
  if (!confirm("Remove all objects from the sandbox?")) return;
  // Every object goes for every player, one at a time.
  allObjects().forEach(function (object) { shareRemove(object); });
  clearObjects();
};

// The Clear button of the workbench.
document.getElementById("clear").onclick = function () {
  setDraft(null);
  setScript("");
  show(createText, "", "wait");
};

// ---------- The selected object in the sandbox ----------

const selectedBox = document.getElementById("selectedBox");

onSelect(function (o) {
  selectedBox.hidden = !o;
  if (o) document.getElementById("selectedName").textContent = (o.name || "an object") + ", made by " + (o.author || "?");
});

function deleteSelected() {
  if (!selected) return;
  // A player asks the host, and the object goes when the host agrees.
  if (isPlayer()) {
    shareRemove(selected);
    return;
  }
  removeObject(selected);
  shareRemove(selected);
}

document.getElementById("deleteSelected").onclick = deleteSelected;

// The Delete key deletes the selected object, but not while you write.
document.addEventListener("keydown", function (e) {
  if (e.key !== "Delete" || !selected) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
  deleteSelected();
});

// A copy of the selected object goes to the workbench, to change it and put it in again.
document.getElementById("copySelected").onclick = function () {
  setDraft(validate(JSON.parse(objectScript(selected))));
  show(createText, "copied to the workbench: " + selected.name, "ok");
};

check().catch(function (error) {
  show(apiText, "error: " + error.message, "bad");
});
