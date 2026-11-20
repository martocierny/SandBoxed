// SPDX-License-Identifier: MIT

export function getBenchmarkLookAI(mode, lookAIs) {
  if (mode !== "icon" && mode !== "shapes") {
    throw new Error("Unsupported benchmark look mode: " + mode);
  }
  const ai = lookAIs[mode];
  if (!ai || typeof ai.toLook !== "function") {
    throw new Error("Look mode is unavailable: " + mode);
  }
  return ai;
}
