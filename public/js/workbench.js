// SPDX-License-Identifier: MIT
// The workbench: a new object waits here before it goes into the sandbox.
// Change its script and the object changes right away. The script is checked by the same
// rules as the AI answers. "Put into sandbox" sends a copy of it into the sandbox.

import { show } from "./ui.js";
import { validate } from "./validate.js";
import { script, objectScript, behaviorOf } from "./script.js";
import { drawObject } from "./look.js";
import { emit, moveParticles } from "./particles.js";
import { addObject, select } from "./sandbox.js";
import { isPlayer, shareObject } from "./net.js";

const preview = document.getElementById("preview");
const previewCtx = preview.getContext("2d");
const scriptInput = document.getElementById("script");
const scriptText = document.getElementById("scriptText");
const putButton = document.getElementById("put");

// The preview shows at least 200 by 150 of the world, with a bit of ground.
// A big object gets a bigger view, so it always fits.
const view = { width: 200, height: 150, ground: 135 };
let draft = null;

export function getDraft() {
  return draft;
}

// A new object on the workbench, for example from the AI. null empties the workbench.
export function setDraft(o) {
  draft = o;
  if (o) {
    o.time = 0;
    place(o);
    scriptInput.value = objectScript(o);
    show(scriptText, "on the workbench: " + o.name, "ok");
  } else {
    show(scriptText, "", "wait");
  }
  putButton.disabled = !o;
}

export function setScript(text) {
  scriptInput.value = text;
}

// The object stands in the middle of the preview, on the ground.
function place(o) {
  view.width = Math.max(200, o.size * 2.6);
  view.height = view.width * 0.75;
  view.ground = view.height * 0.9;
  o.x = view.width / 2;
  o.y = Math.min(view.ground - o.bottom, view.height / 2 + 20);
}

// A changed script changes the object on the workbench, or makes a new one.
function applyScript() {
  try {
    const data = validate(JSON.parse(scriptInput.value));
    if (draft) {
      Object.keys(draft).forEach(function (key) { if (key !== "time" && key !== "particles") delete draft[key]; });
      Object.assign(draft, data);
      place(draft);
    } else {
      draft = data;
      draft.time = 0;
      place(draft);
    }
    putButton.disabled = false;
    show(scriptText, "on the workbench: " + draft.name, "ok");
  } catch (error) {
    show(scriptText, "not applied: " + error.message, "bad");
  }
}

scriptInput.oninput = applyScript;

// A copy of the object goes into the sandbox, so the workbench can make more of them.
// A player does not put it in directly: the host checks it and sends it to everyone.
putButton.onclick = function () {
  try {
    const object = validate(JSON.parse(scriptInput.value));
    if (isPlayer()) {
      shareObject(object);
      show(scriptText, "sent to the host, waiting for an answer: " + object.name, "wait");
      return;
    }
    addObject(object);
    select(object);
    shareObject(object);
    show(scriptText, "put into the sandbox: " + object.name, "ok");
  } catch (error) {
    show(scriptText, "rejected: " + error.message, "bad");
  }
};

// Give the object on the workbench a new look through its script, for example a drawing.
// Returns the status text and its type.
export function applyLook(look) {
  const name = draft ? draft.name : "Drawing";
  const behavior = draft ? behaviorOf(draft) : {};
  scriptInput.value = script(name, look, behavior);
  applyScript();
  return [scriptText.textContent, scriptText.className];
}

// The preview shows the object with its effects. It does not move around and does not react.
function loop() {
  previewCtx.setTransform(1, 0, 0, 1, 0, 0);
  previewCtx.clearRect(0, 0, preview.width, preview.height);
  previewCtx.setTransform(preview.width / view.width, 0, 0, preview.height / view.height, 0, 0);
  previewCtx.fillStyle = "#eee";
  previewCtx.fillRect(0, view.ground, view.width, view.height - view.ground);
  if (draft) {
    draft.time += 1;
    emit(draft);
    moveParticles(draft);
    drawObject(previewCtx, draft, view.ground);
  }
  requestAnimationFrame(loop);
}
loop();
