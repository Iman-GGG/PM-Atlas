import assert from "node:assert/strict";
import test from "node:test";

import { publicLabCaseBaseline } from "../lib/lab/lab-case-public.generated.ts";
import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";
import { settleRound } from "../worker/lab/settle-round.ts";

const scenario = privateLabCasePackage.sourceFiles.scenarioPlan.scenarios.find(({ id }) => id === "scenario-1");
const baselineWeeks = publicLabCaseBaseline.plans.baselineWorkload.weeks;
const budgetAtCompletionCny = publicLabCaseBaseline.plans.workload.budgetAtCompletionCny;

function initialState() {
  return {
    caseId: "car-control",
    caseVersion: "v1",
    contentHash: publicLabCaseBaseline.contentHash,
    mode: "learning",
    week: 9,
    baseline: baselineWeeks.find(({ week }) => week === 9),
    scenario: { id: scenario.id, status: "open", initialImpact: scenario.initialImpact },
  };
}

function settle(overrides = {}) {
  return settleRound({
    branchId: "branch-engine",
    roundNumber: 1,
    scenario,
    previousState: initialState(),
    selectedCardIds: scenario.minimumCorrectCardIds,
    connections: scenario.minimumCorrectConnections,
    nextBaseline: baselineWeeks.find(({ week }) => week === 10),
    budgetAtCompletionCny,
    ...overrides,
  });
}

test("settles the complete scenario-one minimum chain onto the near-mainline path", () => {
  const settled = settle();
  assert.equal(settled.result.advancedToWeek, 10);
  assert.equal(settled.result.scenarioState, "closed");
  assert.equal(settled.result.pathClassification, "near_mainline_success");
  assert.deepEqual(settled.result.gaps, []);
  assert.equal(settled.result.stateDiff.additionalActualCostCny, 0);
  assert.equal(settled.internalState.totals.requirementsTraceabilityCoveragePercent, 100);
  assert.deepEqual(new Set(settled.internalState.documentRevisions), new Set(["D05", "D13", "D21", "D26"]));
  assert.equal(JSON.stringify(settled.result).includes("minimumCorrectCardIds"), false);
});

test("keeps an incomplete action chain open and applies weekly degradation", () => {
  const settled = settle({
    selectedCardIds: ["S1-C02", "S1-C03"],
    connections: [{ fromCardId: "S1-C02", toCardId: "S1-C03" }],
  });
  assert.equal(settled.result.scenarioState, "open");
  assert.equal(settled.result.gaps.length, 6);
  assert.equal(settled.result.stateDiff.additionalActualCostCny, 3300);
  assert.equal(settled.internalState.totals.incrementalActualCostCny, 3300);
  assert.equal(settled.internalState.totals.requirementsTraceabilityCoveragePercent, 97);
});

test("stacks harmful effects once while uncontrolled behavior remains consecutive", () => {
  const harmfulSelection = ["S1-C01", "S1-C20", "S1-C21", "S1-C10"];
  const harmfulConnections = [
    { fromCardId: "S1-C01", toCardId: "S1-C20" },
    { fromCardId: "S1-C20", toCardId: "S1-C21" },
    { fromCardId: "S1-C21", toCardId: "S1-C10" },
  ];
  const first = settle({ selectedCardIds: harmfulSelection, connections: harmfulConnections });
  assert.equal(first.result.stateDiff.additionalActualCostCny, 30850);
  assert.equal(first.internalState.totals.unauthorizedScopeWorkPersonDays, 12);
  assert.equal(first.internalState.scenario.consecutiveUncontrolledDevelopmentRounds, 1);

  const second = settle({
    roundNumber: 2,
    previousState: first.internalState,
    selectedCardIds: harmfulSelection,
    connections: harmfulConnections,
    nextBaseline: baselineWeeks.find(({ week }) => week === 11),
  });
  assert.equal(second.result.stateDiff.additionalActualCostCny, 3300);
  assert.equal(second.internalState.totals.unauthorizedScopeWorkPersonDays, 12);
  assert.equal(second.internalState.scenario.consecutiveUncontrolledDevelopmentRounds, 2);
});
