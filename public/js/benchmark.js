// SPDX-License-Identifier: MIT
// A small, repeatable benchmark using the same generation pipeline as the game.
// Does not change the game's prompts or provider settings.

import { getSettings, currentAI } from "./ai.js";
import { lookAIs, behaviorAI, askedFor, generate } from "./prompts.js";
import { validate } from "./validate.js";

const benchmarkVersion = "0.2";
const cases = [
  { id: "red-ball", prompt: "a red ball" },
  { id: "bouncing-ball", prompt: "a bouncing blue ball" },
  { id: "glowing-tree", prompt: "a glowing tree" },
  { id: "touch-bomb", prompt: "a bomb that explodes when touched" },
  { id: "animal-gun", prompt: "a gun that shoots only at animals" },
  { id: "apple-tree", prompt: "a tree that drops apples every 5 seconds" }
];

const runButton = document.getElementById("run");
const stopButton = document.getElementById("stop");
const jsonButton = document.getElementById("json");
const csvButton = document.getElementById("csv");
const tableBody = document.getElementById("results");
const progress = document.getElementById("progress");
const summary = document.getElementById("summary");
const selectedModel = document.getElementById("selectedModel");
let rows = [];
let stopping = false;

function modelName(settings) {
  if (settings.ai === "browser") {
    return ({ small: "Qwen 2.5 1.5B", medium: "Llama 3.2 3B", large: "Qwen 2.5 7B" })[settings.size] || "Browser model (unknown size)";
  }
  if (settings.ai === "server") return settings.model || "Unknown server model";
  if (settings.ai === "chrome") return "Chrome built-in model (version unknown)";
  return "Unknown provider";
}

function statusOf(retried, failed) {
  if (failed) return "failed";
  return retried ? "retry" : "first-pass";
}

function expectedBehavior(id, behavior) {
  if (!behavior) return { result: "not-run", explanation: "No final behavior" };
  const reactions = behavior.reactions || [];
  const effects = behavior.effects || [];
  const matching = (when, action) => reactions.filter(function (r) { return r.when === when && r.do === action; });
  let ok = false;
  let explanation = "";
  if (id === "red-ball") {
    ok = behavior.move.type === "none" && reactions.length === 0 && effects.length === 0;
    explanation = "Stationary with no unrequested effects or reactions";
  } else if (id === "bouncing-ball") {
    ok = behavior.move.type === "bounce";
    explanation = "Movement type is bounce";
  } else if (id === "glowing-tree") {
    ok = effects.some(function (e) { return e.type === "glow"; });
    explanation = "Includes the glow effect";
  } else if (id === "touch-bomb") {
    ok = matching("touch", "explode").length > 0;
    explanation = "Explodes on touch";
  } else if (id === "animal-gun") {
    const shots = reactions.filter(function (r) { return r.do === "shoot"; });
    ok = shots.length > 0 && shots.every(function (r) {
      return Array.isArray(r.tags) && r.tags.length === 1 && r.tags[0] === "animal";
    });
    explanation = "Every shooting reaction is restricted to animals";
  } else if (id === "apple-tree") {
    ok = matching("timer", "spawn").some(function (r) {
      return r.every === 5 && (r.emoji === "🍎" || r.emoji === "🍏");
    });
    explanation = "Spawns an apple every five seconds";
  }
  return { result: ok ? "pass" : "fail", explanation: explanation };
}

async function runStage(ai, prompt) {
  let retried = false;
  const started = performance.now();
  try {
    const data = await generate(ai, prompt, function () { retried = true; });
    return { status: statusOf(retried, false), retried: retried, ms: Math.round(performance.now() - started), data: data, error: "" };
  } catch (error) {
    return { status: statusOf(retried, true), retried: retried, ms: Math.round(performance.now() - started), data: null, error: String(error.message || error) };
  }
}

async function runCase(testCase, repeat, metadata) {
  const started = performance.now();
  const lookStage = await runStage(lookAIs.icon, testCase.prompt);
  let behaviorStage = { status: "not-run", retried: false, ms: null, data: null, error: "" };
  let filteredBehavior = null;
  let normalizedBehavior = null;
  let validation = "not-run";
  let error = lookStage.error;
  if (lookStage.data) {
    behaviorStage = await runStage(behaviorAI, testCase.prompt);
    error = behaviorStage.error;
    if (behaviorStage.data) {
      try {
        filteredBehavior = askedFor(behaviorStage.data, testCase.prompt);
        const valid = validate({
          name: lookStage.data.name,
          look: lookAIs.icon.toLook(lookStage.data),
          behavior: filteredBehavior
        });
        normalizedBehavior = {
          move: valid.move,
          effects: valid.effects,
          reactions: valid.reactions
        };
        if (valid.tags) normalizedBehavior.tags = valid.tags;
        if (valid.health) normalizedBehavior.health = valid.health;
        if (valid.solid) normalizedBehavior.solid = valid.solid;
        validation = "pass";
      } catch (problem) {
        validation = "fail";
        error = String(problem.message || problem);
      }
    }
  }
  return {
    benchmarkVersion: benchmarkVersion,
    timestamp: new Date().toISOString(),
    codeRef: metadata.codeRef,
    provider: metadata.provider,
    model: metadata.model,
    hardware: metadata.hardware,
    testId: testCase.id,
    prompt: testCase.prompt,
    repeat: repeat,
    lookStatus: lookStage.status,
    lookRetried: lookStage.retried,
    lookMs: lookStage.ms,
    behaviorStatus: behaviorStage.status,
    behaviorRetried: behaviorStage.retried,
    behaviorMs: behaviorStage.ms,
    validation: validation,
    expectedBehavior: validation === "pass" ? expectedBehavior(testCase.id, normalizedBehavior) : { result: "not-run", explanation: "Final object not accepted" },
    totalMs: Math.round(performance.now() - started),
    generatedLook: lookStage.data,
    generatedBehavior: behaviorStage.data,
    afterAskedFor: filteredBehavior,
    finalBehavior: normalizedBehavior,
    error: error
  };
}

function addCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  row.appendChild(cell);
}

function renderRow(item) {
  const row = document.createElement("tr");
  addCell(row, String(item.repeat));
  addCell(row, item.prompt);
  addCell(row, item.lookStatus);
  addCell(row, item.behaviorStatus);
  addCell(row, item.validation);
  addCell(row, item.expectedBehavior.result);
  addCell(row, String(item.totalMs));
  const cell = document.createElement("td");
  const detail = document.createElement("details");
  const heading = document.createElement("summary");
  heading.textContent = "JSON + notes";
  const output = document.createElement("pre");
  output.textContent = JSON.stringify({
    expectedCheck: item.expectedBehavior,
    error: item.error,
    look: item.generatedLook,
    generatedBehavior: item.generatedBehavior,
    afterAskedFor: item.afterAskedFor,
    finalBehavior: item.finalBehavior
  }, null, 2);
  detail.append(heading, output);
  cell.appendChild(detail);
  row.appendChild(cell);
  tableBody.appendChild(row);
}

function showSummary() {
  const accepted = rows.filter(function (r) { return r.validation === "pass"; }).length;
  const matched = rows.filter(function (r) { return r.expectedBehavior.result === "pass"; }).length;
  const retries = rows.filter(function (r) { return r.lookRetried || r.behaviorRetried; }).length;
  summary.textContent = rows.length + " runs; " + accepted + " accepted; " + matched +
    " passed the limited behavior check; " + retries + " needed at least one validation retry.";
}

async function start() {
  stopping = false;
  rows = [];
  tableBody.textContent = "";
  jsonButton.disabled = true;
  csvButton.disabled = true;
  const settings = Object.assign({}, getSettings());
  const metadata = {
    provider: settings.ai,
    model: modelName(settings),
    hardware: document.getElementById("hardware").value.trim() || "not specified",
    codeRef: document.getElementById("codeRef").value.trim() || "not recorded"
  };
  const repeats = Math.max(1, Math.min(5, Number(document.getElementById("repeats").value) || 3));
  document.getElementById("repeats").value = String(repeats);
  runButton.disabled = true;
  stopButton.disabled = false;
  try {
    progress.textContent = "Checking the selected model...";
    const aiStatus = await currentAI().status(settings);
    if (aiStatus.state !== "available") {
      throw new Error("Selected AI is not ready (" + aiStatus.state + "). Open SandBoxed, select/download the model there, then return here.");
    }
    const total = cases.length * repeats;
    outer: for (let repeat = 1; repeat <= repeats; repeat++) {
      for (const testCase of cases) {
        if (stopping) break outer;
        progress.textContent = "Run " + (rows.length + 1) + "/" + total + ": " + testCase.prompt;
        const item = await runCase(testCase, repeat, metadata);
        rows.push(item);
        renderRow(item);
        showSummary();
        jsonButton.disabled = false;
        csvButton.disabled = false;
      }
    }
    progress.textContent = stopping ? "Stopped after " + rows.length + " runs." : "Finished " + rows.length + " runs.";
  } catch (error) {
    progress.textContent = "Cannot run: " + String(error.message || error);
  } finally {
    runButton.disabled = false;
    stopButton.disabled = true;
  }
}

function download(filename, content, type) {
  const file = new Blob([content], { type: type });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  let valueText = value === null || value === undefined ? "" : String(value);
  // Prevent spreadsheet apps from interpreting model-controlled text as formulas.
  if (/^[\s]*[=+@\-\t\r]/.test(valueText)) valueText = "'" + valueText;
  return '"' + valueText.replace(/"/g, '""') + '"';
}

const columns = ["timestamp", "benchmarkVersion", "codeRef", "provider", "model", "hardware", "testId", "prompt", "repeat", "lookStatus", "lookRetried", "lookMs", "behaviorStatus", "behaviorRetried", "behaviorMs", "validation", "totalMs", "expectedResult", "expectedExplanation", "error"];

runButton.onclick = start;
stopButton.onclick = function () { stopping = true; progress.textContent = "Stopping after the current test case..."; };
jsonButton.onclick = function () { download("sandboxed-benchmark.json", JSON.stringify(rows, null, 2), "application/json"); };
csvButton.onclick = function () {
  const lines = [columns.map(csvCell).join(",")];
  rows.forEach(function (row) {
    const flat = Object.assign({}, row, {
      expectedResult: row.expectedBehavior.result,
      expectedExplanation: row.expectedBehavior.explanation
    });
    lines.push(columns.map(function (key) { return csvCell(flat[key]); }).join(","));
  });
  download("sandboxed-benchmark.csv", lines.join("\r\n"), "text/csv;charset=utf-8");
};
selectedModel.textContent = "Current selection: " + modelName(getSettings()) + " (" + getSettings().ai + ").";
