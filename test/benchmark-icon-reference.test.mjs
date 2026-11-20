// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { checkIconReference } from "../public/js/benchmark-icon-reference.js";

const matches = [
  ["red-ball", "🔴"],
  ["bouncing-ball", "🔵"],
  ["glowing-tree", "🌳"],
  ["glowing-tree", "🌲"],
  ["touch-bomb", "💣"],
  ["animal-gun", "🔫"],
  ["apple-tree", "🌳"]
];

for (const [id, emoji] of matches) {
  test(id + " matches " + emoji, () => {
    assert.equal(checkIconReference(id, { name: "Object", emoji }).result, "match");
  });
}

const mismatches = [
  ["red-ball", "⚽"],
  ["red-ball", "⚫️"],
  ["glowing-tree", "✨"],
  ["glowing-tree", "💡"],
  ["touch-bomb", "🔥"],
  ["touch-bomb", "⚡️"],
  ["apple-tree", "🍎"]
];

for (const [id, emoji] of mismatches) {
  test(id + " does not match " + emoji, () => {
    assert.equal(checkIconReference(id, { name: "Object", emoji }).result, "mismatch");
  });
}

test("missing look is not scored as a failure", () => {
  assert.equal(checkIconReference("red-ball", null).result, "not-run");
});

test("unknown prompt is explicitly unscored", () => {
  assert.equal(checkIconReference("new-case", { emoji: "🔴" }).result, "not-scored");
});

test("missing emoji is a mismatch", () => {
  assert.equal(checkIconReference("red-ball", {}).result, "mismatch");
});

test("object prototype keys are not treated as benchmark cases", () => {
  assert.equal(checkIconReference("toString", { emoji: "🔴" }).result, "not-scored");
});
