// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { askedFor } from "../public/js/prompts.js";

const still = { type: "none" };
function generated(traits = [], reactions = [], move = still, effects = []) {
  return { traits, reactions, move, effects };
}
function gun(prompt, reactions = []) {
  return askedFor(generated(["gun"], reactions), prompt);
}

// Default traits must remain usable when the prompt adds no conditions.
test("gun without restrictions keeps its preset", () => {
  const reaction = gun("a gun").reactions[0];
  assert.equal(reaction.do, "shoot");
  assert.equal(reaction.when, "timer");
  assert.equal(reaction.every, 1);
  assert.equal(reaction.tags, undefined);
});

test("animal-only targeting restricts the preset without a model reaction", () => {
  const result = gun("a gun that shoots only at animals");
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
});

test("animal targeting works with a definite article", () => {
  const result = gun("a gun that fires at the animals");
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
});

test("plant targeting restricts the preset", () => {
  const result = gun("a gun that shoots at plants");
  assert.deepEqual(result.reactions[0].tags, ["plant"]);
});

test("multiple supported target groups stay restricted", () => {
  const result = gun("a gun that shoots only at animals and plants");
  assert.deepEqual(result.reactions[0].tags, ["animal", "plant"]);
});

test("unsupported exclusive targets do not produce unrestricted shots", () => {
  const result = gun("a gun that shoots only at cats");
  assert.deepEqual(result.reactions, []);
});

test("a negated target cannot leave unrestricted shooting", () => {
  const result = gun("a gun that does not shoot at animals");
  assert.deepEqual(result.reactions, []);
});

test("unrelated mentions do not restrict the gun", () => {
  const result = gun("a gun next to animals that shoots upward");
  assert.equal(result.reactions[0].tags, undefined);
  assert.equal(result.reactions[0].toward, "up");
});

test("explicit shooting direction overrides the preset", () => {
  const result = gun("a gun that shoots to the left at animals");
  assert.equal(result.reactions[0].toward, "left");
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
});

test("model direction without prompt support is ignored for preset reactions", () => {
  const result = gun("a gun", [{ when: "timer", do: "shoot", toward: "right" }]);
  assert.equal(result.reactions[0].toward, "nearest");
});

test("model reactions cannot remove an explicit target restriction", () => {
  const result = gun("a gun that shoots only at animals", [{
    when: "timer", do: "shoot", tags: ["plant"], every: 20, toward: "left"
  }]);
  assert.equal(result.reactions.length, 1);
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
  assert.equal(result.reactions[0].every, 1);
  assert.equal(result.reactions[0].toward, "nearest");
});

test("explicit shooting timer replaces the preset interval", () => {
  const result = gun("a gun that shoots every 2 seconds at animals");
  assert.equal(result.reactions[0].every, 2);
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
});

test("an unqualified timer applies to a single timed preset", () => {
  const result = gun("a gun every 4 seconds");
  assert.equal(result.reactions[0].every, 4);
});

test("unrelated timed action cannot change the gun's interval", () => {
  const result = gun("a gun that shoots at animals and drops apples every 5 seconds", [
    { when: "timer", do: "spawn", emoji: "🍎", every: 5 }
  ]);
  assert.equal(result.reactions[0].every, 1);
  assert.equal(result.reactions[1].every, 5);
});

test("distinct action intervals stay with their own reaction", () => {
  const result = gun("a gun that shoots every 2 seconds and drops apples every 5 seconds", [
    { when: "timer", do: "spawn", emoji: "🍎", every: 5 }
  ]);
  assert.equal(result.reactions[0].every, 2);
  assert.equal(result.reactions[1].every, 5);
});

test("timer and target data from the model do not duplicate the preset", () => {
  const result = gun("a gun that shoots every 2 seconds at animals", [
    { when: "timer", do: "shoot", every: 2, tags: ["animal"] }
  ]);
  assert.equal(result.reactions.length, 1);
  assert.equal(result.reactions[0].every, 2);
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
});

test("a requested click reaction is retained", () => {
  const result = askedFor(generated([], [{ when: "click", do: "say", emoji: "👻" }]),
    "a ghost that says boo when clicked");
  assert.deepEqual(result.reactions, [{ when: "click", do: "say", emoji: "👻" }]);
});

test("a happy cat does not receive unrelated reactions", () => {
  const result = askedFor(generated(["animal"], [
    { when: "timer", do: "shoot", every: 1 }, { when: "touch", do: "explode" }
  ]), "a happy cat");
  assert.deepEqual(result.reactions, []);
  assert.deepEqual(result.tags, ["animal"]);
});

test("a shooting action can imply a timer when no trigger is specified", () => {
  const result = askedFor(generated([], [{ when: "timer", do: "shoot" }]), "a laser that shoots");
  assert.equal(result.reactions[0].when, "timer");
});

test("a click-triggered request does not retain automatic shooting", () => {
  const result = gun("a gun that shoots when clicked", [
    { when: "click", do: "shoot", toward: "nearest" }
  ]);
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["click"]);
});

test("a click-triggered request does not fire without a matching model reaction", () => {
  const result = gun("a gun that shoots when clicked");
  assert.deepEqual(result.reactions, []);
});

test("a mismatched model trigger cannot override an explicit trigger", () => {
  const result = askedFor(generated([], [{ when: "timer", do: "shoot" }]), "a laser that shoots when clicked");
  assert.deepEqual(result.reactions, []);
});

test("an unrelated location before the shooting verb is not a target restriction", () => {
  const result = gun("a gun at animals that shoots upward");
  assert.equal(result.reactions[0].tags, undefined);
});

test("direct-object targeting is recognized", () => {
  assert.deepEqual(gun("a gun that shoots animals").reactions[0].tags, ["animal"]);
});

test("targeting a narrower class does not turn into unrestricted shooting", () => {
  assert.deepEqual(gun("a gun that shoots at cats").reactions, []);
});

test("shooting only to the left changes its direction", () => {
  assert.equal(gun("a gun that shoots only to the left").reactions[0].toward, "left");
});

test("decimal timer intervals do not split reaction clauses", () => {
  assert.equal(gun("a gun that shoots every 2.5 seconds").reactions[0].every, 2.5);
});

test("a prompt-grounded timer spawn retains the requested interval", () => {
  const result = askedFor(generated([], [{ when: "timer", do: "spawn", emoji: "🍎" }]),
    "a tree that drops apples every 5 seconds");
  assert.equal(result.reactions[0].every, 5);
});

test("the model's reaction object is not mutated", () => {
  const model = { when: "timer", do: "shoot", toward: "right", tags: ["plant"] };
  gun("a gun that shoots only at animals", [model]);
  assert.deepEqual(model, { when: "timer", do: "shoot", toward: "right", tags: ["plant"] });
});

test("a gun that fires when the user clicks does not fire automatically", () => {
  const result = gun("a gun that shoots when you click it", [
    { when: "click", do: "shoot", toward: "nearest" }
  ]);
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["click"]);
});

test("a gun with a click condition but no explicit shooting verb has no timer", () => {
  const result = gun("a gun that fires only when clicked", [
    { when: "click", do: "shoot" }
  ]);
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["click"]);
});

test("a gun specified as click activated without a shooting verb has no timer", () => {
  const result = gun("a gun when clicked", [{ when: "click", do: "shoot" }]);
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["click"]);
});

test("action-specific target groups also apply to pushing", () => {
  const result = askedFor(generated([], [
    { when: "touch", do: "push", target: "other" }
  ]), "a robot that pushes animals when touched");
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
});

test("the bomb trait retains its default reactions", () => {
  const result = askedFor(generated(["bomb"]), "a bomb");
  assert.deepEqual(result.reactions.map(function (r) { return r.when + ":" + r.do; }),
    ["touch:explode", "destroyed:explode"]);
});

test("unrelated model effects are still removed", () => {
  const result = askedFor(generated([], [], still, [{ type: "blink" }]), "a red ball");
  assert.deepEqual(result.effects, []);
});

test("requested bouncing movement is unchanged", () => {
  const result = askedFor(generated([], [], { type: "bounce", speed: 5 }), "a bouncing blue ball");
  assert.deepEqual(result.move, { type: "bounce", speed: 5 });
});

test("unrequested timed reactions do not block the preset's requested interval", () => {
  const result = gun("a gun every 2 seconds", [
    { when: "timer", do: "spawn", emoji: "🍎" }
  ]);
  assert.equal(result.reactions.length, 1);
  assert.equal(result.reactions[0].every, 2);
});

test("a separate effect after 'and' does not become a target group", () => {
  const result = gun("a gun that shoots only at animals and glows");
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
});

test("a gun aimed at animals uses the animal group", () => {
  const result = gun("a gun aimed at animals");
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
});

test("a gun targeting animals uses the animal group", () => {
  const result = gun("a gun targeting animals");
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
});


test("a gun that never shoots has no shooting reaction", () => {
  assert.deepEqual(gun("a gun that never shoots").reactions, []);
});

test("a gun that does not shoot has no shooting reaction", () => {
  assert.deepEqual(gun("a gun that does not shoot").reactions, []);
});

test("shooting exclusions cannot turn into unrestricted shots", () => {
  assert.deepEqual(gun("a gun that shoots at everything except animals").reactions, []);
  assert.deepEqual(gun("a gun that shoots at no animals").reactions, []);
});

test("unrepresentable empty target has no shooting reaction", () => {
  assert.deepEqual(gun("a gun that shoots at nothing").reactions, []);
});

test("another action's trigger must not suppress the shooting preset", () => {
  const result = gun("a gun that shoots at animals and explodes on touch");
  assert.deepEqual(result.reactions[0].tags, ["animal"]);
  assert.equal(result.reactions[0].do, "shoot");
});

test("an unrelated touch trigger cannot authorize a model's touch shooting", () => {
  const result = gun("a gun that shoots at animals and explodes on touch", [
    { when: "touch", do: "shoot", tags: ["animal"] }
  ]);
  assert.deepEqual(result.reactions.map(function (r) { return r.when + ":" + r.do; }), ["timer:shoot"]);
});

test("if touched is treated as a requested touch trigger", () => {
  const result = gun("a gun that shoots if touched", [
    { when: "touch", do: "shoot" }
  ]);
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["touch"]);
});


test("unknown exclusive targets cannot fall back to unrestricted shooting", () => {
  assert.deepEqual(gun("a gun that shoots only enemies").reactions, []);
  assert.deepEqual(gun("a gun that shoots only oranges").reactions, []);
});

test("non-animal target exclusion cannot turn into unrestricted shooting", () => {
  assert.deepEqual(gun("a gun that shoots at non-animals").reactions, []);
});

test("an unrecognized conditional trigger cannot become automatic shooting", () => {
  assert.deepEqual(gun("a gun that shoots whenever animals approach").reactions, []);
});

test("direction-only restrictions do not suppress shooting", () => {
  assert.equal(gun("a gun that shoots only upward").reactions[0].toward, "up");
});

test("touch-triggered bombs retain the destroyed preset for chain reactions", () => {
  const result = askedFor(generated(["bomb"]), "a bomb that explodes when touched");
  assert.deepEqual(result.reactions.map(function (r) { return r.when + ":" + r.do; }),
    ["touch:explode", "destroyed:explode"]);
});

test("a model's duplicate bomb reactions do not displace the presets", () => {
  const result = askedFor(generated(["bomb"], [
    { when: "touch", do: "explode", radius: 10, damage: 1 },
    { when: "destroyed", do: "explode", radius: 10, damage: 1 }
  ]), "a bomb that explodes when touched");
  assert.deepEqual(result.reactions.map(function (r) { return [r.when, r.do, r.radius, r.damage]; }), [
    ["touch", "explode", 40, 5], ["destroyed", "explode", 40, 5]
  ]);
});

test("non-preset destroyed reactions do not bypass an explicit touch trigger", () => {
  const result = askedFor(generated([], [
    { when: "touch", do: "explode" },
    { when: "destroyed", do: "explode" }
  ]), "a device that explodes when touched");
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["touch"]);
});

test("a clicked bomb retains destroyed preset without an unwanted touch trigger", () => {
  const result = askedFor(generated(["bomb"], [
    { when: "click", do: "explode" }
  ]), "a bomb that explodes when clicked");
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["destroyed", "click"]);
});

test("only when touched excludes the destruction preset", () => {
  const result = askedFor(generated(["bomb"]), "a bomb that explodes only when touched");
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["touch"]);
});

test("only when clicked excludes other bomb triggers", () => {
  const result = askedFor(generated(["bomb"], [{ when: "click", do: "explode" }]),
    "a bomb that only explodes when clicked");
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["click"]);
});

test("explicit destruction exclusion preserves a requested touch explosion", () => {
  const result = askedFor(generated(["bomb"]), "a bomb that explodes when touched but not when destroyed");
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["touch"]);
});

test("another action's exclusive trigger does not disable the bomb chain reaction", () => {
  const result = askedFor(generated(["bomb"], [{ when: "click", do: "shoot" }]),
    "a bomb that shoots only when clicked and explodes when touched");
  assert.deepEqual(result.reactions.map(function (r) { return r.when + ":" + r.do; }),
    ["touch:explode", "destroyed:explode", "click:shoot"]);
});

test("an exclusive trigger following an explosion does not disable the bomb preset", () => {
  const result = askedFor(generated(["bomb"], [{ when: "click", do: "shoot" }]),
    "a bomb that explodes when touched and shoots only when clicked");
  assert.deepEqual(result.reactions.map(function (r) { return r.when + ":" + r.do; }),
    ["touch:explode", "destroyed:explode", "click:shoot"]);
});


test("a bomb that never explodes has no explosion reactions", () => {
  const result = askedFor(generated(["bomb"]), "a bomb that never explodes");
  assert.deepEqual(result.reactions, []);
});

test("a bomb that does not explode has no explosion reactions", () => {
  const result = askedFor(generated(["bomb"]), "a bomb that does not explode");
  assert.deepEqual(result.reactions, []);
});

test("a negative destroyed clause keeps touch explosions", () => {
  const result = askedFor(generated(["bomb"]),
    "a bomb that explodes when touched but doesn't explode when destroyed");
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["touch"]);
});

test("a spelled-out destroyed exclusion keeps touch explosions", () => {
  const result = askedFor(generated(["bomb"]),
    "a bomb that explodes when touched but does not explode when destroyed");
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["touch"]);
});

test("a negative touch clause keeps the destroyed bomb preset", () => {
  const result = askedFor(generated(["bomb"]),
    "a bomb that does not explode when touched but explodes when destroyed");
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["destroyed"]);
});

test("a global explosion exclusion does not remove an unrelated shooting reaction", () => {
  const result = askedFor(generated(["bomb"], [{ when: "click", do: "shoot" }]),
    "a bomb that never explodes and shoots when clicked");
  assert.deepEqual(result.reactions.map(function (r) { return r.when + ":" + r.do; }),
    ["click:shoot"]);
});

test("a negative destruction clause only removes destruction-triggered explosions", () => {
  const result = askedFor(generated([], [
    { when: "touch", do: "explode" }, { when: "destroyed", do: "explode" }
  ]), "a device that explodes when touched but not when destroyed");
  assert.deepEqual(result.reactions.map(function (r) { return r.when; }), ["touch"]);
});


test("negating a destroyed explosion leaves the bomb's touch preset", () => {
  const result = askedFor(generated(["bomb"]), "a bomb that does not explode when destroyed");
  assert.deepEqual(result.reactions.map(function (r) { return r.when + ":" + r.do; }),
    ["touch:explode"]);
});

test("a negated destruction clause before an explicit touch clause retains touch", () => {
  const result = askedFor(generated(["bomb"]),
    "a bomb that never explodes when destroyed but explodes when touched");
  assert.deepEqual(result.reactions.map(function (r) { return r.when + ":" + r.do; }),
    ["touch:explode"]);
});

test("a negated touch clause leaves the bomb's destroyed preset", () => {
  const result = askedFor(generated(["bomb"]), "a bomb that does not explode when touched");
  assert.deepEqual(result.reactions.map(function (r) { return r.when + ":" + r.do; }),
    ["destroyed:explode"]);
});
