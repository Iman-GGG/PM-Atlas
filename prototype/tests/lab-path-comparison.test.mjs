import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { currentLabCaseRuntimePackage, labCaseRuntimePackages } from "../worker/lab/case-packages.ts";
import { buildBranchPathComparison } from "../worker/lab/path-comparison.ts";

function stateJson(week, spi, cpi, forecastCompletionWeek, status, outcomeClassification = null) {
  return JSON.stringify({
    week,
    scenario: { id: "scenario-2", status },
    performance: { spi, cpi, forecastCompletionWeek },
    totals: {},
    governance: {},
    riskTransitions: [],
    stakeholderTransitions: [],
    documentRevisions: [],
    outcomeClassification,
  });
}

const branch = {
  id: "branch-path",
  caseId: "car-control",
  caseVersion: "v6",
  contentHash: currentLabCaseRuntimePackage.contentHash,
  currentWeek: 19,
  currentRoundNumber: 2,
  lockVersion: 2,
  status: "completed",
  outcomeClassification: "near_mainline_success",
};

const rounds = [
  { roundNumber: 0, week: 17, scenarioId: "scenario-2", stateJson: stateJson(17, 0.92, 0.97, 35, "open"), stateHash: "00000000forkhash", ruleResultJson: null, submittedAt: null },
  { roundNumber: 1, week: 18, scenarioId: "scenario-2", stateJson: stateJson(18, 0.95, 0.98, 34, "open"), stateHash: "11111111roundone", ruleResultJson: JSON.stringify({ stateDiff: { managementActionsCompletedThisRound: 1, harmfulEffectsApplied: 0 } }), submittedAt: "2026-08-28 10:00:00" },
  { roundNumber: 2, week: 19, scenarioId: "scenario-2", stateJson: stateJson(19, 0.99, 1, 32, "closed", "near_mainline_success"), stateHash: "22222222roundtwo", ruleResultJson: JSON.stringify({ pathClassification: "near_mainline_success", stateDiff: { managementActionsCompletedThisRound: 2, harmfulEffectsApplied: 1 } }), submittedAt: "2026-08-28 10:05:00" },
];

const deltas = [
  { documentId: "D17", roundNumber: 1, week: 18, reason: "round_settlement", patchJson: JSON.stringify([{ op: "replace", path: "/a", value: 1 }, { op: "replace", path: "/b", value: 2 }]) },
  { documentId: "D24", roundNumber: 1, week: 18, reason: "round_settlement", patchJson: JSON.stringify([{ op: "replace", path: "/c", value: 3 }]) },
  { documentId: "D14", roundNumber: 2, week: 19, reason: "round_settlement", patchJson: JSON.stringify([{ op: "replace", path: "/d", value: 4 }]) },
];

test("builds one fork node and one commit node per settled round", () => {
  const comparison = buildBranchPathComparison(currentLabCaseRuntimePackage, branch, rounds, deltas);
  assert.equal(comparison.forkWeek, 17);
  assert.deepEqual(comparison.rounds.map((round) => [round.roundNumber, round.week, round.commitHash]), [
    [0, 17, "00000000"],
    [1, 18, "11111111"],
    [2, 19, "22222222"],
  ]);
  assert.deepEqual(comparison.rounds[1].documents, [
    { documentId: "D17", operationCount: 2 },
    { documentId: "D24", operationCount: 1 },
  ]);
  assert.equal(comparison.rounds[2].completedActions, 2);
  assert.equal(comparison.rounds[2].harmfulEffects, 1);
  assert.deepEqual(comparison.summary, { submittedRoundCount: 2, revisedDocumentCount: 3, operationCount: 4 });
});

test("rebuilds a same-week mainline checkpoint for every branch commit", () => {
  const comparison = buildBranchPathComparison(currentLabCaseRuntimePackage, branch, rounds, deltas);
  assert.deepEqual(comparison.rounds.map((round) => round.mainline.week), [17, 18, 19]);
  assert.deepEqual(comparison.rounds.map((round) => round.mainline.forecastCompletionWeek), [35, 33, 33]);
  assert.equal(comparison.rounds[2].branch.forecastCompletionWeek, 32);
  assert.equal(comparison.outcomeClassification, "near_mainline_success");
});

test("clamps post-W32 branch commits to the final archived mainline", () => {
  const afterArchiveBranch = { ...branch, currentWeek: 33, currentRoundNumber: 1, status: "active", outcomeClassification: null };
  const afterArchiveRounds = [
    { ...rounds[0], roundNumber: 0, week: 32 },
    { ...rounds[1], roundNumber: 1, week: 33, stateJson: stateJson(33, 0.88, 0.9, 34, "open") },
  ];
  const comparison = buildBranchPathComparison(currentLabCaseRuntimePackage, afterArchiveBranch, afterArchiveRounds, []);
  assert.deepEqual(comparison.rounds.map((round) => round.mainline.week), [32, 32]);
  assert.equal(comparison.mainline.week, 32);
  assert.equal(comparison.currentWeek, 33);
});

test("replays a historical branch against its own frozen case package", () => {
  const frozenRuntime = labCaseRuntimePackages.find((runtime) => runtime.caseVersion === "v4");
  assert.ok(frozenRuntime);
  const historicalBranch = { ...branch, caseVersion: "v4", contentHash: frozenRuntime.contentHash };
  const comparison = buildBranchPathComparison(frozenRuntime, historicalBranch, rounds, deltas);
  assert.equal(comparison.caseVersion, "v4");
  assert.equal(comparison.contentHash, frozenRuntime.contentHash);
  assert.equal(comparison.rounds.length, 3);
});

test("ignores malformed stored JSON instead of exposing or crashing on it", () => {
  const comparison = buildBranchPathComparison(currentLabCaseRuntimePackage, branch, [{ ...rounds[0], stateJson: "{", ruleResultJson: "[" }], [{ ...deltas[0], patchJson: "{" }]);
  assert.equal(comparison.rounds.length, 1);
  assert.equal(comparison.rounds[0].branch.spi, 1);
  assert.equal(comparison.summary.operationCount, 0);
});

test("renders a responsive Git-style graph with clickable document revisions", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(pageSource, /lab-v2-path-graph/);
  assert.match(pageSource, /COMMIT/);
  assert.match(pageSource, /setSelectedDocumentId\(document\.documentId\)/);
  assert.match(pageSource, /历史分支按绑定的冻结案例包回放/);
  assert.match(cssSource, /\.lab-v2-path-rails::before/);
  assert.match(cssSource, /@media \(max-width: 640px\)[\s\S]*\.lab-v2-path-graph > article \{ grid-template-columns: 52px minmax\(0, 1fr\)/);
  assert.doesNotMatch(cssSource, /\.lab-v2-path-graph[^}]*overflow-x:\s*auto/);
});
