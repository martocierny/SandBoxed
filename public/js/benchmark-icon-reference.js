// SPDX-License-Identifier: MIT
// Reference icons for the fixed icon-mode benchmark cases.

const referenceIcons = {
  "red-ball": ["🔴"],
  "bouncing-ball": ["🔵"],
  "glowing-tree": ["🌳", "🌲"],
  "touch-bomb": ["💣"],
  "animal-gun": ["🔫"],
  "apple-tree": ["🌳"]
};

export function checkIconReference(testId, look) {
  if (!look) {
    return { result: "not-run", explanation: "No accepted icon look was generated" };
  }
  if (!Object.prototype.hasOwnProperty.call(referenceIcons, testId)) {
    return { result: "not-scored", explanation: "No reference icons for this prompt" };
  }
  const references = referenceIcons[testId];
  if (typeof look.emoji !== "string") {
    return { result: "mismatch", explanation: "Generated look has no emoji" };
  }
  const matched = references.includes(look.emoji);
  return {
    result: matched ? "match" : "mismatch",
    explanation: matched
      ? "Matches the reference icon"
      : "Expected " + references.join(" or ") + "; received " + look.emoji
  };
}
