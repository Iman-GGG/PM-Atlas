import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";
import { buildDocumentPatch } from "../worker/lab/document-diff.ts";

const { documentPlan, qualityPlan, riskPlan, scenarioPlan } = privateLabCasePackage.sourceFiles;

function document(id) {
  return documentPlan.documents.find((item) => item.id === id);
}

function versionWeeks(documentId) {
  return documentPlan.mainlineEvents
    .filter((event) => Object.entries(event).some(([key, value]) => (
      Array.isArray(value)
      && value.includes(documentId)
      && !key.toLowerCase().includes("archived")
      && !key.toLowerCase().includes("unchanged")
    )))
    .map((event) => event.week);
}

function scenarioState(scenarioId) {
  const scenario = scenarioPlan.scenarios.find((item) => item.id === scenarioId);
  return {
    week: scenario.idealOutcome.advanceToWeek,
    scenario: { id: scenarioId, status: "closed" },
    performance: {
      spi: scenario.idealOutcome.performanceAtAdvanceWeek?.spi ?? 1,
      cpi: scenario.idealOutcome.performanceAtAdvanceWeek?.cpi ?? 1,
      forecastCompletionWeek: scenario.idealOutcome.forecastCompletionWeek ?? 32,
    },
    totals: { overdueCommunicationItems: 0, requirementsTraceabilityCoveragePercent: 100, unauthorizedScopeWorkPersonDays: 0 },
    governance: { ccbOpenItems: 0, scopeControlViolation: false },
    riskTransitions: scenario.idealOutcome.riskTransitions ?? [],
    stakeholderTransitions: [],
  };
}

test("keeps D20 and D27 on their approved dynamic lifecycles", () => {
  assert.deepEqual([document("D20").createdWeek, document("D20").coverage, versionWeeks("D20")], [14, "dynamic_full_history", [20, 28, 32]]);
  assert.deepEqual([document("D27").createdWeek, document("D27").coverage, versionWeeks("D27")], [4, "dynamic_full_history", [8, 12, 20, 28, 32]]);
});

test("keeps the W25 security finding as a quality release blocker until approved scope treatment", () => {
  const openAtW25 = documentPlan.issues.filter((issue) => issue.discoveredWeek <= 25 && issue.resolvedWeek > 25);
  assert.deepEqual(openAtW25.map((issue) => issue.id), ["ISS-007"]);
  assert.equal(openAtW25[0].severity, "critical");
  assert.deepEqual(openAtW25[0].linkedRiskIds, ["R04", "R10"]);

  const remoteControlGate = qualityPlan.hardGates.find((metric) => metric.scope === "remote_control_enabled");
  assert.ok(remoteControlGate);
  assert.equal(qualityPlan.successRule, "all_applicable_hard_gates_pass");
});

test("derives the final risk report from lifecycle events without duplicating the register", () => {
  const lifecycleById = new Map(riskPlan.initialRisks.map((risk) => [risk.id, "identified"]));
  for (const event of riskPlan.mainlineLifecycleEvents.filter((item) => item.week <= 32)) {
    for (const riskId of event.riskIds) lifecycleById.set(riskId, event.toLifecycleState);
  }
  assert.equal(riskPlan.initialRisks.length, 10);
  assert.equal([...lifecycleById.values()].every((state) => state === "closed"), true);
});

test("writes auditable D20 and D27 business deltas for the W25 branch", () => {
  const state = scenarioState("scenario-3");
  const qualityPatch = buildDocumentPatch("D20", state);
  const riskPatch = buildDocumentPatch("D27", state);

  assert.equal(qualityPatch.find((operation) => operation.path === "/qualityGates/remote_control/result")?.value, "failed_blocked");
  assert.equal(qualityPatch.find((operation) => operation.path === "/releaseScope/read_only_vehicle_status/status")?.value, "approved_for_release");
  assert.equal(qualityPatch.find((operation) => operation.path === "/releaseRecommendation")?.value, "release_read_only_on_schedule_disable_remote_control");
  assert.equal(riskPatch.find((operation) => operation.path === "/riskSummary/current/R04/lifecycleState")?.value, "triggered");
  assert.equal(riskPatch.find((operation) => operation.path === "/riskSummary/current/R10/lifecycleState")?.value, "closed");
  assert.equal(riskPatch.find((operation) => operation.path === "/riskSummary/managementConclusion")?.value, "safe_minimum_scope_delivered_on_schedule");
});

test("renders compact D20 and D27 report views without black summaries or desktop overflow", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const id of ["D20", "D27"]) assert.match(timeline, new RegExp(`selectedDocument\\.id === "${id}"`));
  for (const table of ["lab-v2-quality-trend-table", "lab-v2-risk-trend-table", "lab-v2-risk-focus-table"]) {
    assert.match(timeline, new RegExp(`<table className="${table}"`));
    assert.doesNotMatch(timeline, new RegExp(`lab-v2-wide-register-wrap"[\\s\\S]{0,180}<table className="${table}"`));
  }
  assert.match(timeline, /D20 只汇总趋势、例外、残余风险和发布建议，不复制 D18 的完整测量表或 D32 的测试执行明细/);
  assert.match(timeline, /D27 只汇总风险趋势、最高暴露项和整体结论；风险原因、应对措施及逐项历史保留在 D26/);
  assert.match(styles, /\.lab-v2-quality-trend-table,[\s\S]+\.lab-v2-risk-focus-table \{ width: 100%; min-width: 0;/);
  assert.doesNotMatch(timeline, /lab-v2-(?:quality|risk)-report-hero/);
});
