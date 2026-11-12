// SPDX-License-Identifier: MIT
// The sandbox: the world seen from the side, its objects, the selected object,
// dragging objects and moving the view with the mouse.
// The world is much wider than the screen. The camera shows one part of it.

import { drawObject } from "./look.js";
import { launch, move } from "./behavior.js";
import { react, tick, touches, bury, moveBullets, drawBullets } from "./actions.js";
import { emit, moveParticles, drawParticles } from "./particles.js";
import { defaultHealth } from "./validate.js";

const canvas = document.getElementById("sandbox");
const ctx = canvas.getContext("2d");
let dragged = null;
let listener = null;

// The world and its rules. The host of the sandbox decides gravity and destruction:
// "all" objects can be destroyed, only objects of the same player ("own"), or "none".
// player is the name of the player on this computer, the author of new objects.
const world = {
  width: 3000,
  height: 270,
  ground: 258,
  gravity: true,
  destruction: "all",
  player: "",
  pointer: null,
  objects: [],
  bullets: [],
  dying: [],
  particles: [],
  isWorld: true,
  maxObjects: 40,
  add: addObject,
  remove: removeObject
};

// The camera: the left edge of the view in the world, and how wide the view is.
// The view always shows the whole height of the world.
const camera = { x: 0, width: 480, scale: 1, placed: false };

export function setWorld(changes) {
  Object.assign(world, changes);
}

// ---------- Objects ----------

// The object the player clicked. Other files can read it, select() changes it.
export let selected = null;

// The callback gets the new selected object, or null.
export function onSelect(callback) {
  listener = callback;
}

export function select(o) {
  if (selected === o) return;
  selected = o;
  if (listener) listener(o);
}

// A new object comes from the sky in the middle of the view, or at x and y.
export function addObject(object, x, y) {
  if (world.objects.length >= world.maxObjects) throw new Error("too many objects (max " + world.maxObjects + ")");
  const middle = camera.x + camera.width / 2 + (Math.random() - 0.5) * camera.width * 0.4;
  object.x = x === undefined ? Math.min(world.width - object.size, Math.max(object.size, middle)) : x;
  object.y = y === undefined ? object.size + 10 : y;
  object.time = 0;
  object.hp = object.health || defaultHealth;
  if (object.author === undefined) object.author = world.player;
  launch(object);
  world.objects.push(object);
}

export function removeObject(o) {
  world.objects = world.objects.filter(function (t) { return t !== o; });
  world.bullets = world.bullets.filter(function (b) { return b.from !== o; });
  if (selected === o) select(null);
  if (dragged === o) dragged = null;
}

export function objectById(id) {
  if (!id) return null;
  return world.objects.find(function (o) { return o.id === id; }) || null;
}

// A copy of the list, so a caller can walk it while objects come and go.
export function allObjects() {
  return world.objects.slice();
}

export function clearObjects() {
  world.objects = [];
  world.bullets = [];
  world.dying = [];
  world.particles = [];
  select(null);
}

// ---------- The view ----------

// The canvas has as many pixels as it has on the screen, so everything stays sharp.
function resize() {
  const box = canvas.getBoundingClientRect();
  if (box.width === 0) return;
  canvas.width = Math.round(box.width * devicePixelRatio);
  canvas.height = Math.round(box.height * devicePixelRatio);
  camera.scale = canvas.height / world.height;
  camera.width = Math.min(world.width, canvas.width / camera.scale);
  // The first view is the middle of the world.
  if (!camera.placed) {
    camera.x = (world.width - camera.width) / 2;
    camera.placed = true;
  }
  look(0);
}
new ResizeObserver(resize).observe(canvas);

// Move the view by dx in the world. It stays inside the world.
function look(dx) {
  camera.x = Math.min(world.width - camera.width, Math.max(0, camera.x + dx));
}

function loop() {
  world.objects.forEach(function (o) {
    o.time += 1;
    if (o !== dragged) move(o, world);
    tick(o, world);
    emit(o);
    moveParticles(o);
  });
  moveBullets(world);
  touches(world, dragged);
  bury(world);
  moveParticles(world);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(camera.scale, 0, 0, camera.scale, -camera.x * camera.scale, 0);
  // The ground.
  ctx.fillStyle = "#eee";
  ctx.fillRect(0, world.ground, world.width, world.height - world.ground);
  ctx.fillStyle = "#999";
  ctx.fillRect(0, world.ground, world.width, 0.5);
  world.objects.forEach(function (o) { drawObject(ctx, o, world.ground); });
  drawBullets(ctx, world);
  drawParticles(ctx, world, false);
  // Dashed circle around the selected object.
  if (selected) {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(selected.x, selected.y, selected.size + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // A thin bar at the bottom shows which part of the world is in view.
  ctx.setTransform(camera.scale, 0, 0, camera.scale, 0, 0);
  ctx.fillStyle = "#999";
  ctx.fillRect(camera.x / world.width * camera.width, world.height - 3, camera.width * camera.width / world.width, 2);
  requestAnimationFrame(loop);
}
loop();

// ---------- The mouse ----------

// The mouse in the world.
function mouse(e) {
  const box = canvas.getBoundingClientRect();
  return {
    x: camera.x + (e.clientX - box.left) / box.width * camera.width,
    y: (e.clientY - box.top) / box.height * world.height
  };
}

let panning = null;

// A click on an object selects it, is a reaction for it, and starts dragging it.
// A click on empty space starts moving the view.
canvas.onpointerdown = function (e) {
  const m = mouse(e);
  canvas.setPointerCapture(e.pointerId);
  dragged = world.objects.findLast(function (o) {
    return !o.dead && Math.hypot(o.x - m.x, o.y - m.y) < o.size + 4;
  }) || null;
  if (dragged) {
    react(dragged, "click", world);
  } else {
    panning = e.clientX;
    canvas.style.cursor = "grabbing";
  }
  select(dragged);
};
canvas.onpointermove = function (e) {
  if (panning !== null) {
    look((panning - e.clientX) / canvas.getBoundingClientRect().width * camera.width);
    panning = e.clientX;
  }
  world.pointer = mouse(e);
  if (!dragged) return;
  dragged.x = Math.min(world.width - dragged.size, Math.max(dragged.size, world.pointer.x));
  dragged.y = world.pointer.y;
  dragged.vx = 0;
  dragged.vy = 0;
  dragged.cx = undefined;
};
canvas.onpointerup = function () {
  dragged = null;
  panning = null;
  canvas.style.cursor = "";
};
canvas.onpointerleave = function () { world.pointer = null; };

// The mouse wheel or the touchpad moves the view to the sides.
canvas.onwheel = function (e) {
  e.preventDefault();
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  look(delta / canvas.getBoundingClientRect().width * camera.width);
};
