// SPDX-License-Identifier: MIT
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { getBenchmarkLookAI } from "../public/js/benchmark-look-mode.js";
import { lookAIs } from "../public/js/prompts.js";
import { validate, validateLook } from "../public/js/validate.js";

// Node does not provide the browser CSS API used by shapes validation.
let installedCSS = false;
before(() => {
  if (typeof globalThis.CSS === "undefined") {
    globalThis.CSS = {
      supports(property, value) {
        return property === "color" && value === "red";
      }
    };
    installedCSS = true;
  }
});
after(() => {
  if (installedCSS) delete globalThis.CSS;
});

const providers = {
  icon: { toLook: data => ({ type: "icon", emoji: data.emoji, size: 60 }) },
  shapes: { toLook: data => ({ type: "shapes", parts: data.parts }) }
};

test("icon mode selects the icon generator", () => {
  assert.equal(getBenchmarkLookAI("icon", providers), providers.icon);
});

test("shapes mode selects the shapes generator", () => {
  assert.equal(getBenchmarkLookAI("shapes", providers), providers.shapes);
});

test("icon mode retains its look format", () => {
  const look = getBenchmarkLookAI("icon", providers).toLook({ emoji: "🔴" });
  assert.deepEqual(look, { type: "icon", emoji: "🔴", size: 60 });
});

test("shapes mode retains all generated parts", () => {
  const parts = [{ shape: "circle", x: 0, y: 0, width: 30, color: "red" }];
  const look = getBenchmarkLookAI("shapes", providers).toLook({ parts });
  assert.deepEqual(look, { type: "shapes", parts });
});

test("shapes mode uses the production look generator", () => {
  const parts = [{ shape: "circle", x: 0, y: 0, width: 30, color: "red" }];
  const look = getBenchmarkLookAI("shapes", lookAIs).toLook({ name: "Ball", parts });
  const validated = validateLook(look);
  assert.equal(validated.look.type, "shapes");
  assert.equal(validated.look.parts[0].color, "red");
});

test("icon mode uses the production look generator", () => {
  const look = getBenchmarkLookAI("icon", lookAIs).toLook({ name: "Ball", emoji: "🔴" });
  assert.equal(validateLook(look).look.type, "icon");
});

test("shapes mode passes final object validation", () => {
  const data = {
    name: "Ball",
    parts: [{ shape: "circle", x: 0, y: 0, width: 30, color: "red" }]
  };
  const look = getBenchmarkLookAI("shapes", lookAIs).toLook(data);
  const result = validate({ name: data.name, look, behavior: { move: { type: "none" } } });
  assert.equal(result.look.type, "shapes");
  assert.equal(result.parts.length, 1);
  assert.equal(result.parts[0].color, "red");
  assert.equal(result.move.type, "none");
});

test("invalid shapes fail final object validation", () => {
  const data = {
    name: "Ball",
    parts: [{ shape: "invalid", x: 0, y: 0, width: 30, color: "red" }]
  };
  const look = getBenchmarkLookAI("shapes", lookAIs).toLook(data);
  assert.throws(
    () => validate({ name: data.name, look, behavior: { move: { type: "none" } } }),
    /look: unknown shape/
  );
});

test("sketch mode is not included", () => {
  assert.throws(() => getBenchmarkLookAI("sketch", providers), /Unsupported benchmark look mode/);
});

test("unknown mode is rejected", () => {
  assert.throws(() => getBenchmarkLookAI("unknown", providers), /Unsupported benchmark look mode/);
});

test("inherited object keys are not valid modes", () => {
  assert.throws(() => getBenchmarkLookAI("toString", providers), /Unsupported benchmark look mode/);
});

test("missing mode provider is rejected", () => {
  assert.throws(() => getBenchmarkLookAI("shapes", { icon: providers.icon }), /Look mode is unavailable/);
});

test("mode provider must expose a look converter", () => {
  assert.throws(() => getBenchmarkLookAI("shapes", { shapes: {} }), /Look mode is unavailable/);
});
