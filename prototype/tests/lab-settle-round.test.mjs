import assert from "node:assert/strict";
import test from "node:test";

import { publicLabCaseBaseline } from "../lib/lab/lab-case-public.generated.ts";
import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";
import { settleRound } from "../worker/lab/settle-round.ts";

const scenario = privateLabCasePackage.sourceFiles.scenarioPlan.scenarios.find(({ id }) => id === "scenario-1");
const baselineWeeks = publicLabCaseBaseline.plans.baselineWorkload.weeks;
const budgetAtCompletionCny = publicLabCaseBaseline.plans.workload.budgetAtCompletionCny;
const visibleRequiredCards = scenario.cards.filter((card) => (
  card.column !== "execution_action" && card.satisfiesActionIds?.length
));

function actionChain(id, title, cardIds) {
  const cards = scenario.cards.filter((card) => cardIds.includes(card.id));
  return {
    id,
    title,
    documentCardIds: cards.filter((card) => card.column === "evidence_document").map((card) => card.id),
    toolTechniqueCardIds: cards.filter((card) => card.column === "tool_technique").map((card) => card.id),
    stakeholderCardIds: cards.filter((card) => card.column === "stakeholder").map((card) => card.id),
  };
}

function initialState() {
  return {
    caseId: "car-control",
    caseVersion: "v4",
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
    actionChains: [actionChain(
      "chain-complete-scope-change",
      "澄清需求并完成范围变更闭环",
      visibleRequiredCards.map((card) => card.id),
    )],
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

test("settles necessary actions directly from a complete three-pool action chain", () => {
  const settled = settle();
  assert.equal(settled.result.scenarioState, "closed");
  assert.equal(settled.result.pathClassification, "near_mainline_success");
  assert.deepEqual(settled.result.gaps, []);
});

test("keeps an incomplete action chain open and applies weekly degradation", () => {
  const settled = settle({
    actionChains: [{
      id: "chain-incomplete-clarification",
      title: "访谈试点车主",
      documentCardIds: ["S1-C02"],
      toolTechniqueCardIds: ["S1-C03"],
      stakeholderCardIds: ["S1-C10"],
    }],
  });
  assert.equal(settled.result.scenarioState, "open");
  assert.equal(settled.result.gaps.length, 6);
  assert.equal(settled.result.gaps[0].actionTitle, "澄清共享需求、使用场景与安全边界");
  assert.deepEqual(settled.result.gaps[0].recognizedCards.map((card) => card.referenceId), ["D21", "tool:002", "pilot_owner_representative"]);
  assert.deepEqual(
    settled.result.gaps[0].missingCards.map((card) => card.referenceId),
    ["product_ba", "devsecops"],
  );
  assert.equal(settled.result.gaps[0].diagnosis, "missing_cards");
  assert.deepEqual(settled.result.gaps[0].relatedActionIds, ["S1-A1"]);
  assert.equal(settled.result.stateDiff.additionalActualCostCny, 3300);
  assert.equal(settled.internalState.totals.incrementalActualCostCny, 3300);
  assert.equal(settled.internalState.totals.requirementsTraceabilityCoveragePercent, 97);
});

test("closes when all necessary actions are completed across multiple rounds without a separate connection gate", () => {
  const first = settle({
    actionChains: [actionChain(
      "chain-discover-and-assess",
      "澄清需求并完成影响评估",
      ["S1-C01", "S1-C02", "S1-C03", "S1-C04", "S1-C10", "S1-C11", "S1-C12", "S1-C13"],
    )],
  });
  assert.equal(first.result.scenarioState, "open");
  assert.deepEqual(new Set(first.internalState.scenario.completedActionIds), new Set(["S1-A1", "S1-A2", "S1-A3", "S1-A6"]));

  const second = settle({
    roundNumber: 2,
    previousState: first.internalState,
    actionChains: [actionChain(
      "chain-approve-and-decide",
      "完成审批并确认版本边界",
      ["S1-C01", "S1-C05", "S1-C11", "S1-C12", "S1-C13", "S1-C14"],
    )],
    nextBaseline: baselineWeeks.find(({ week }) => week === 11),
  });
  assert.equal(second.result.scenarioState, "closed");
  assert.equal(second.result.pathClassification, "detour_success");
  assert.deepEqual(second.result.gaps, []);
});

test("reuses previously submitted action chains when repairing a prerequisite completed under an older engine", () => {
  const first = settle({
    actionChains: [actionChain(
      "chain-old-engine-discovery",
      "完成需求澄清和影响评估",
      ["S1-C02", "S1-C03", "S1-C04", "S1-C10", "S1-C11", "S1-C12", "S1-C13"],
    )],
  });
  assert.deepEqual(new Set(first.internalState.scenario.completedActionIds), new Set(["S1-A1", "S1-A3", "S1-A6"]));

  const historicalBaselineChain = actionChain(
    "chain-old-engine-baseline",
    "对照批准基线并识别范围外变更",
    ["S1-C01", "S1-C02", "S1-C03", "S1-C11"],
  );
  const second = settle({
    roundNumber: 2,
    previousState: first.internalState,
    historicalActionChains: [historicalBaselineChain],
    actionChains: [actionChain(
      "chain-current-ccb",
      "形成正式变更请求并提交 CCB 审查",
      ["S1-C05", "S1-C11", "S1-C12", "S1-C13", "S1-C14", "S1-C15"],
    )],
    nextBaseline: baselineWeeks.find(({ week }) => week === 11),
  });

  assert.equal(second.result.scenarioState, "closed");
  assert.deepEqual(second.result.gaps, []);
  assert.deepEqual(
    new Set(second.internalState.scenario.completedActionIds),
    new Set(scenario.necessaryManagementActions.map((action) => action.id)),
  );
});

test("resolves same-round prerequisites independently of action configuration order", () => {
  const settled = settle({ scenario: { ...scenario, necessaryManagementActions: [...scenario.necessaryManagementActions].reverse() } });
  assert.equal(settled.result.scenarioState, "closed");
  assert.deepEqual(settled.result.gaps, []);
});

test("explains when complete supporting cards are split across action chains", () => {
  const settled = settle({
    actionChains: [
      {
        id: "chain-one",
        title: "先访谈试点车主",
        documentCardIds: ["S1-C02"],
        toolTechniqueCardIds: ["S1-C03"],
        stakeholderCardIds: ["S1-C10"],
      },
      {
        id: "chain-two",
        title: "再与产品和安全确认",
        documentCardIds: ["S1-C02"],
        toolTechniqueCardIds: ["S1-C03"],
        stakeholderCardIds: ["S1-C11", "S1-C13"],
      },
    ],
  });
  const clarificationGap = settled.result.gaps.find((gap) => gap.relatedActionIds.includes("S1-A1"));
  assert.ok(clarificationGap);
  assert.deepEqual(clarificationGap.missingCards, []);
  assert.equal(clarificationGap.cardsSplitAcrossChains, true);
  assert.equal(clarificationGap.diagnosis, "split_across_chains");
});

test("applies a selected harmful three-pool card only once", () => {
  const harmfulChain = actionChain(
    "chain-premature-compression",
    "先压缩进度",
    ["S1-C01", "S1-C20", "S1-C10"],
  );
  const first = settle({ actionChains: [harmfulChain] });
  assert.equal(first.result.stateDiff.additionalActualCostCny, 12600);

  const second = settle({
    roundNumber: 2,
    previousState: first.internalState,
    actionChains: [harmfulChain],
    nextBaseline: baselineWeeks.find(({ week }) => week === 11),
  });
  assert.equal(second.result.stateDiff.additionalActualCostCny, 3300);
  assert.deepEqual(second.internalState.scenario.appliedHarmfulCardIds, ["S1-C20"]);
});
