
// SPDX-License-Identifier: MIT
// What we ask the AI. An object has two halves, its look and its behavior,
// and the AI makes each one on its own, so each task stays small.
//
// Each AI task has a schema (the form of the JSON answer), rules and example answers.
// A look task also has toLook(), which turns the answer into a look for the object script.

import { askAI } from "./ai.js";
import {
  shapes, moves, areas, effects, triggers, actions, targets, directions,
  maxParts, maxPoints, maxEffects, maxReactions,
  validateLook, validateBehavior
} from "./validate.js";
import { categories } from "./sketch.js";

// ---------- Looks ----------

// The AI builds the look from shapes.
const shapesAI = {
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      parts: {
        type: "array",
        minItems: 1,
        maxItems: maxParts,
        items: {
          type: "object",
          properties: {
            shape: { type: "string", enum: shapes },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            rotation: { type: "number" },
            color: { type: "string" },
            mirror: { type: "boolean" },
            points: {
              type: "array",
              maxItems: maxPoints,
              items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } }
            }
          },
          required: ["shape", "x", "y", "width", "color"]
        }
      }
    },
    required: ["name", "parts"]
  },

  rules:
    "You draw how objects look in a small 2D game. Answer only with JSON. " +
    "Only the look matters. Ignore any movement or behavior in the text. " +
    "An object is made of 1 to " + maxParts + " parts. Use small parts for details. " +
    "Each part is a shape in a box. x and y are the center of the box, from -40 to 40. " +
    "The center of the object is 0, 0. y grows down, so a negative y is higher. " +
    "width is the size of the box, 2 to 80. height is optional, the same as width if left out. " +
    "rotation is optional, in degrees. color: a CSS color like red or #ff8800. " +
    "mirror: true draws the part again on the other side, x becomes -x. " +
    "Use it for pairs like eyes, ears, arms, legs and wheels: write only the right one, with a positive x. " +
    "Shapes: circle, ring (only the edge), semicircle (round top, flat bottom), " +
    "rect (a thin rect is a line), roundrect, triangle (points up), star, heart, " +
    "drop (a teardrop pointing up, also a leaf or a flame), crescent (a moon), " +
    "arc (a curved line like a smile, rotation 180 for a frown), " +
    "polygon (also needs points: 3 to " + maxPoints + " corners [x, y], from -1 to 1 inside its box). " +
    "Ready made parts: eye (white with an iris in its color), wheel (a tire with a rim in its color), " +
    "window (glass with a frame in its color), flower (petals in its color). " +
    "Later parts are drawn on top of earlier parts.",

  // Example answers. They show the form and how to use details.
  examples: [
    {
      prompt: "a small house",
      answer: {
        name: "House",
        parts: [
          { shape: "rect", x: 18, y: -26, width: 6, height: 14, color: "gray" },
          { shape: "rect", x: 0, y: 12, width: 56, height: 40, color: "tan" },
          { shape: "polygon", x: 0, y: -18, width: 66, height: 24, color: "brown",
            points: [[-1, 1], [-0.6, -1], [0.6, -1], [1, 1]] },
          { shape: "rect", x: 0, y: 22, width: 12, height: 20, color: "saddlebrown" },
          { shape: "circle", x: 3, y: 23, width: 2, color: "gold" },
          { shape: "window", x: 17, y: 6, width: 12, color: "white", mirror: true }
        ]
      }
    },
    {
      prompt: "a red car",
      answer: {
        name: "Car",
        parts: [
          { shape: "semicircle", x: 0, y: -11, width: 44, height: 18, color: "red" },
          { shape: "semicircle", x: 0, y: -9, width: 34, height: 12, color: "lightblue" },
          { shape: "roundrect", x: 0, y: 4, width: 76, height: 20, color: "red" },
          { shape: "rect", x: 35, y: 0, width: 4, height: 5, color: "yellow" },
          { shape: "wheel", x: 22, y: 15, width: 18, color: "silver", mirror: true }
        ]
      }
    },
    {
      prompt: "a happy cat",
      answer: {
        name: "Cat",
        parts: [
          { shape: "triangle", x: 14, y: -20, width: 14, height: 16, rotation: 15, color: "orange", mirror: true },
          { shape: "circle", x: 0, y: 0, width: 50, height: 44, color: "orange" },
          { shape: "eye", x: 10, y: -4, width: 12, height: 10, color: "green", mirror: true },
          { shape: "triangle", x: 0, y: 6, width: 6, height: 4, rotation: 180, color: "pink" },
          { shape: "arc", x: 0, y: 11, width: 12, height: 4, color: "black" },
          { shape: "rect", x: 20, y: 8, width: 14, height: 2, rotation: -10, color: "dimgray", mirror: true }
        ]
      }
    },
    {
      prompt: "a bouncing red ball",
      answer: {
        name: "Ball",
        parts: [
          { shape: "circle", x: 0, y: 0, width: 30, color: "red" },
          { shape: "circle", x: -6, y: -6, width: 8, color: "white" }
        ]
      }
    }
  ],

  toLook: function (data) { return { type: "shapes", parts: data.parts }; }
};

// The AI picks one emoji. It is drawn from Twemoji pictures,
// so it looks the same for every player.
const iconAI = {
  schema: {
    type: "object",
    properties: { name: { type: "string" }, emoji: { type: "string" } },
    required: ["name", "emoji"]
  },
  rules:
    "You pick how objects look in a small 2D game. Answer only with JSON. " +
    "Pick the one emoji that shows the object best. Only one emoji, no text. " +
    "Only the look matters. Ignore any movement or behavior in the text.",
  examples: [
    { prompt: "a small house", answer: { name: "House", emoji: "🏠" } },
    { prompt: "a red car", answer: { name: "Car", emoji: "🚗" } },
    { prompt: "a happy cat", answer: { name: "Cat", emoji: "😺" } },
    { prompt: "a bouncing red ball", answer: { name: "Ball", emoji: "🔴" } }
  ],
  toLook: function (data) { return { type: "icon", emoji: data.emoji, size: 60 }; }
};

export const lookAIs = { shapes: shapesAI, icon: iconAI };

// The AI picks what Sketch-RNN should draw, and the color of the lines.
// The drawing itself comes later from sketch.js.
export const sketchAI = {
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      category: { type: "string", enum: categories },
      color: { type: "string" }
    },
    required: ["name", "category", "color"]
  },
  rules:
    "You choose a drawing for an object in a small 2D game. Answer only with JSON. " +
    "category: the thing from this list that is closest to the object: " + categories.join(", ") + ". " +
    "color: a CSS color for the lines, like red or #ff8800. Use black if the text has no color. " +
    "Only the look matters. Ignore any movement or behavior in the text.",
  examples: [
    { prompt: "a happy cat", answer: { name: "Cat", category: "cat", color: "black" } },
    { prompt: "a small red house", answer: { name: "House", category: "barn", color: "red" } },
    { prompt: "a blue racing car", answer: { name: "Car", category: "truck", color: "blue" } },
    { prompt: "a bouncing ball", answer: { name: "Ball", category: "soccer_ball", color: "black" } }
  ],
  check: function (data) {
    if (!categories.includes(data.category)) throw new Error("unknown category: " + data.category);
  }
};

// ---------- Behavior ----------

// Ready made kinds of objects. The AI only picks them, the code turns them into rules,
// and the player sees and can change these rules in the script.
const traits = {
  bomb: {
    health: 1,
    reactions: [
      { when: "touch", do: "explode", radius: 40, damage: 5 },
      { when: "destroyed", do: "explode", radius: 40, damage: 5 }
    ]
  },
  gun: { reactions: [{ when: "timer", every: 1, do: "shoot", toward: "nearest", speed: 6, damage: 1 }] },
  vehicle: { health: 5, solid: true, move: { type: "wander", speed: 4 } },
  flying: { move: { type: "patrol", area: "top", speed: 3 } },
  animal: { tags: ["animal"] },
  wall: { health: 10, solid: true },
  plant: { tags: ["plant"] },
  sky: { unbreakable: true, move: { type: "none", area: "top" } }
};
const traitNames = Object.keys(traits);
const still = { type: "none" };

export const behaviorAI = {
  schema: {
    type: "object",
    properties: {
      traits: { type: "array", maxItems: 3, items: { type: "string", enum: traitNames } },
      move: {
        type: "object",
        properties: { type: { type: "string", enum: moves }, speed: { type: "number" }, area: { type: "string", enum: areas } },
        required: ["type"]
      },
      effects: {
        type: "array",
        maxItems: maxEffects,
        items: {
          type: "object",
          properties: { type: { type: "string", enum: effects }, speed: { type: "number" }, color: { type: "string" } },
          required: ["type"]
        }
      },
      reactions: {
        type: "array",
        maxItems: maxReactions,
        items: {
          type: "object",
          properties: {
            when: { type: "string", enum: triggers },
            do: { type: "string", enum: actions },
            every: { type: "number" },
            emoji: { type: "string" },
            color: { type: "string" },
            radius: { type: "number" },
            damage: { type: "number" },
            target: { type: "string", enum: targets },
            toward: { type: "string", enum: directions },
            speed: { type: "number" },
            tags: { type: "array", maxItems: 3, items: { type: "string" } },
            move: { type: "string", enum: moves }
          },
          required: ["when", "do"]
        }
      }
    },
    required: ["traits", "move", "effects", "reactions"]
  },

  rules:
    "You decide how objects behave in a small 2D game. It is seen from the side: " +
    "the ground is at the bottom and the sky at the top. Answer only with JSON. " +
    "Most objects just stand on the ground: no traits, move none, no effects, no reactions. " +
    "Add something only when the text asks for it with clear words, or when the object is clearly of that kind. " +
    "Words about the look, like happy, wise, small or red, are not a reason. " +
    "traits are ready made kinds: bomb (explodes when touched), gun (shoots at the nearest thing), " +
    "vehicle (drives around), flying (flies at the top, like a helicopter), animal, " +
    "wall (hard and solid, also a house or a rock), plant, sky (stays in the sky, like the sun or a cloud). " +
    "move: none, wander (walks around), bounce, orbit, float, jump, follow (follows the mouse), " +
    "patrol (goes left and right), fly (flies around). speed: 1 to 10. area top keeps it in the sky. " +
    "effects, up to " + maxEffects + ": spin, pulse, wobble, shake, squash, blink, fade, glow, rainbow, " +
    "sparkles, smoke, fire, bubbles, hearts, snow, trail. An effect may have a color. " +
    "reactions, up to " + maxReactions + ": when is click, touch, wall, timer (every: 1 to 30 seconds), " +
    "hurt or destroyed. do is jump, spin, grow, burst, say (one emoji), hide, explode (radius, damage), " +
    "damage, destroy or push (target: self, other or near), shoot (toward: nearest, left, right, up or down) " +
    "or spawn (one emoji, for example an apple). " +
    "Shoot and push can use speed: 1 to 10. Shoot, damage, destroy and push can use tags: " +
    "up to 3 lowercase group names (e.g. animal) to limit their targets. " +
    "Spawn can use move: one of the movement types listed above.",

  examples: [
    { prompt: "a small house", answer: { traits: ["wall"], move: still, effects: [], reactions: [] } },
    { prompt: "a happy cat", answer: { traits: ["animal"], move: still, effects: [], reactions: [] } },
    { prompt: "a bouncing red ball", answer: { traits: [], move: { type: "bounce", speed: 5 }, effects: [], reactions: [] } },
    { prompt: "a helicopter", answer: { traits: ["flying"], move: still, effects: [], reactions: [] } },
    { prompt: "a bomb", answer: { traits: ["bomb"], move: still, effects: [], reactions: [] } },
    { prompt: "a gun", answer: { traits: ["gun"], move: still, effects: [], reactions: [] } },
    {
      prompt: "a floating ghost that says boo when you click it",
      answer: { traits: [], move: { type: "float", speed: 3 }, effects: [], reactions: [{ when: "click", do: "say", emoji: "👻" }] }
    },
    { prompt: "a burning torch", answer: { traits: [], move: still, effects: [{ type: "fire" }], reactions: [] } }
  ],

  check: function (data) {
    validateBehavior(data);
    (data.traits || []).forEach(function (name) {
      if (!traitNames.includes(name)) throw new Error("unknown trait: " + name);
    });
  }
};

// The words that ask for each move, effect and reaction. A word matches from its start,
// so "bounc" finds bounce, bouncing and bouncy.
const words = {
  // Moves.
  bounce: ["bounc", "boing", "ricochet"],
  wander: ["wander", "walk", "roam", "stroll", "crawl", "run around", "move around", "moving around", "drive", "driving"],
  orbit: ["orbit", "circl", "revolv", "go round", "goes round", "around in a circle"],
  float: ["float", "hover", "drift", "levitat"],
  jump: ["jump", "hop", "leap"],
  follow: ["follow", "chase", "track"],
  patrol: ["patrol", "back and forth", "left and right", "guard"],
  fly: ["fly", "flies", "flying", "soar"],
  // Effects.
  spin: ["spin", "rotat", "turn", "twirl", "whirl"],
  pulse: ["puls", "throb", "beat", "breath", "grow and shrink", "grows and shrinks"],
  wobble: ["wobbl", "sway", "swing", "rocking", "wiggl"],
  shake: ["shak", "trembl", "shiver", "vibrat", "jitter"],
  squash: ["squash", "squish", "stretch", "jelly", "wobbly"],
  blink: ["blink", "flash", "flicker"],
  fade: ["fade", "fading", "transparent", "see-through", "translucent"],
  glow: ["glow", "shin", "bright", "neon", "radiant", "light up", "lights up"],
  rainbow: ["rainbow", "colorful", "colourful", "multicolor", "changing color", "changes color"],
  sparkles: ["sparkl", "glitter", "twinkl", "magic"],
  smoke: ["smok", "steam", "fume"],
  fire: ["fire", "burn", "flame", "flaming", "blaz", "on fire"],
  bubbles: ["bubbl", "foam", "fizz"],
  hearts: ["heart", "love"],
  snow: ["snow", "frost", "winter"],
  trail: ["trail", "streak"],
  // When a reaction happens.
  click: ["click", "tap", "press", "poke", "pet"],
  touch: ["touch", "hit", "bump", "collid", "meet"],
  wall: ["wall", "edge", "side", "ground", "land"],
  timer: ["every", "sometimes", "often", "second", "from time to time"],
  hurt: ["hurt", "hit", "damag", "shot", "attack"],
  destroyed: ["destroy", "dies", "die ", "killed", "broken", "breaks"],
  // What a reaction does.
  grow: ["grow", "bigger", "swell", "inflat", "puff"],
  burst: ["burst", "spark", "pop", "firework", "confetti"],
  say: ["say", "talk", "speak", "shout", "greet", "wave", "laugh", "sing", "boo", "meow", "bark", "hello", "hi "],
  hide: ["hide", "hides", "disappear", "vanish", "invisible"],
  explode: ["explod", "blow up", "blows up", "boom", "bomb"],
  damage: ["hurt", "damag", "harm", "attack", "bite", "bites", "hit"],
  destroy: ["destroy", "kill", "eat", "smash", "crush", "break"],
  push: ["push", "knock", "kick", "throw", "shove"],
  shoot: ["shoot", "shot", "fire at", "fires at", "gun", "laser", "bullet"],
  spawn: ["drop", "lay", "lays", "spawn", "make", "makes", "create", "produce"]
};

// The words that tell the kind of an object.
const traitWords = {
  bomb: ["bomb", "explos", "dynamite", "tnt", "grenade", "boom"],
  gun: ["gun", "shoot", "cannon", "turret", "blaster", "pistol", "rifle", "laser"],
  vehicle: ["car", "truck", "bus", "tractor", "vehicle", "tank", "train", "van", "jeep", "bulldozer",
    "ambulance", "firetruck", "motorbike", "drive", "driving"],
  flying: ["fly", "flies", "flying", "helicopter", "plane", "airplane", "jet", "drone", "ufo", "balloon",
    "bird", "kite", "rocket"],
  animal: ["animal", "cat", "kitten", "dog", "puppy", "cow", "pig", "horse", "sheep", "rabbit", "bunny",
    "fox", "wolf", "bear", "lion", "tiger", "elephant", "monkey", "mouse", "frog", "duck", "chicken",
    "hen", "snake", "turtle", "squirrel", "deer", "giraffe", "zebra", "kangaroo", "penguin", "owl", "bird"],
  wall: ["wall", "fence", "rock", "stone", "brick", "block", "crate", "box", "barrier", "house",
    "castle", "tower", "building", "barn"],
  plant: ["tree", "plant", "flower", "bush", "grass", "cactus", "mushroom"],
  sky: ["sun", "cloud", "moon", "sky"]
};

function mentions(text, list) {
  return list.some(function (word) { return new RegExp("\\b" + word).test(text); });
}

// Keep only what the player asked for: each trait, move, effect and reaction needs its words
// in the text. This stops the AI from adding things that nobody wanted, like a happy cat that pulses.
// The traits are then turned into rules.
export function askedFor(data, text) {
  const t = " " + text.toLowerCase() + " ";
  const behavior = { move: still, effects: [], reactions: [] };
  (data.traits || []).forEach(function (name) {
    if (traits[name] && mentions(t, traitWords[name])) addTrait(behavior, traits[name]);
  });
  const move = data.move || still;
  if (move.type !== "none" && mentions(t, words[move.type])) behavior.move = move;
  (data.effects || []).forEach(function (e) {
    if (mentions(t, words[e.type])) behavior.effects.push(e);
  });
  (data.reactions || []).forEach(function (r) {
    if (mentions(t, words[r.when]) && mentions(t, words[r.do])) behavior.reactions.push(r);
  });
  // The same reaction twice is kept once, and there are limits.
  const seen = new Set();
  behavior.reactions = behavior.reactions.filter(function (r) {
    const key = r.when + " " + r.do;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, maxReactions);
  behavior.effects = behavior.effects.slice(0, maxEffects);
  return behavior;
}

function addTrait(behavior, trait) {
  const copy = JSON.parse(JSON.stringify(trait));
  if (copy.move && behavior.move.type === "none" && !behavior.move.area) behavior.move = copy.move;
  if (copy.health) behavior.health = Math.max(behavior.health || 0, copy.health);
  if (copy.unbreakable) behavior.unbreakable = true;
  if (copy.solid) behavior.solid = true;
  if (copy.tags) behavior.tags = Array.from(new Set((behavior.tags || []).concat(copy.tags))).slice(0, 3);
  behavior.reactions = behavior.reactions.concat(copy.reactions || []);
}

// ---------- Asking ----------

// Ask the AI, and once more with the error if the answer is rejected.
// onFix() is called before the second try. Returns the answer that passed the check.
// A rejected answer goes with the error, so the player can fix it by hand.
export async function generate(ai, text, onFix) {
  const messages = [{ role: "system", content: ai.rules }];
  ai.examples.forEach(function (example) {
    messages.push({ role: "user", content: example.prompt });
    messages.push({ role: "assistant", content: JSON.stringify(example.answer) });
  });
  messages.push({ role: "user", content: text });
  // A look task is checked by the look it makes.
  const check = ai.check || function (data) { validateLook(ai.toLook(data)); };
  let data;
  try {
    data = await askAI(messages, ai.schema);
    try {
      check(data);
    } catch (error) {
      if (onFix) onFix(error.message);
      messages.push({ role: "assistant", content: JSON.stringify(data) });
      messages.push({ role: "user", content: "That was rejected: " + error.message + ". Answer again with fixed JSON." });
      data = await askAI(messages, ai.schema);
      check(data);
    }
    return data;
  } catch (error) {
    error.ai = ai;
    error.data = data;
    throw error;
  }
}