import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";
import { buildDocumentPatch } from "../worker/lab/document-diff.ts";

const documentPlan = privateLabCasePackage.sourceFiles.documentPlan;
const scenarioPlan = privateLabCasePackage.sourceFiles.scenarioPlan;

function revisionWeeks(documentId, events) {
  return events
    .filter((event) => Object.values(event).some((value) => Array.isArray(value) && value.includes(documentId)))
    .map((event) => event.week);
}

function currentStatus(item, week) {
  return [...item.statusEvents].reverse().find((event) => event.week <= week);
}

test("builds D03 as an evidence-backed time-sliced assumption log", () => {
  const document = documentPlan.documents.find((item) => item.id === "D03");
  const log = documentPlan.assumptionLog;
  assert.equal(document.createdWeek, 1);
  assert.equal(document.coverage, "dynamic_full_history");
  assert.equal(log.documentId, "D03");
  assert.equal(log.items.length, 10);
  assert.deepEqual(log.statusModel, ["open", "validated", "invalidated", "retired"]);

  const scopeAssumption = log.items.find((item) => item.id === "ASM-001");
  assert.equal(currentStatus(scopeAssumption, 8).status, "validated");
  assert.equal(currentStatus(scopeAssumption, 10).status, "invalidated");
  const securityAssumption = log.items.find((item) => item.id === "ASM-004");
  assert.equal(currentStatus(securityAssumption, 24).status, "validated");
  assert.equal(currentStatus(securityAssumption, 25).status, "invalidated");
  assert.equal(currentStatus(securityAssumption, 28).status, "retired");

  assert.deepEqual(revisionWeeks("D03", documentPlan.contentRevisions), [10, 13, 17, 21, 24, 25, 28]);
  assert.deepEqual(revisionWeeks("D03", documentPlan.mainlineEvents), [8, 12, 20, 32]);
});

test("builds D09 as an accumulating project-wide lessons learned register", () => {
  const document = documentPlan.documents.find((item) => item.id === "D09");
  const register = documentPlan.lessonsLearnedRegister;
  assert.equal(document.createdWeek, 1);
  assert.equal(document.coverage, "dynamic_full_history");
  assert.equal(register.items.length, 9);

  const lessonsAt = (week) => register.items.filter((item) => item.capturedWeek <= week);
  assert.equal(lessonsAt(1).length, 0);
  assert.equal(lessonsAt(8).length, 2);
  assert.equal(lessonsAt(20).length, 4);
  assert.equal(lessonsAt(24).length, 6);
  assert.equal(lessonsAt(28).length, 7);
  assert.equal(lessonsAt(29).length, 8);
  assert.equal(lessonsAt(32).length, 9);
  for (const lesson of register.items) {
    assert.ok(lesson.context);
    assert.ok(lesson.observation);
    assert.ok(lesson.impact);
    assert.ok(lesson.recommendation);
    assert.ok(lesson.evidenceDocumentIds.length > 0);
  }
  assert.deepEqual(revisionWeeks("D09", documentPlan.contentRevisions), [8, 16, 20, 22, 24, 29]);
  assert.deepEqual(revisionWeeks("D09", documentPlan.mainlineEvents), [28, 32]);
});

test("builds D10 with baseline, forecast, actual and gate evidence", () => {
  const list = documentPlan.milestoneList;
  assert.equal(list.documentId, "D10");
  assert.deepEqual(list.items.map((item) => item.baselineWeek), [1, 8, 12, 20, 28, 32]);

  const closeout = list.items.find((item) => item.id === "MS-06");
  assert.deepEqual(currentStatus(closeout, 17), {
    week: 17,
    status: "at_risk",
    forecastWeek: 35,
    actualWeek: null,
    evidence: "供应与资源事件的未缓解完工预测移至W35。",
  });
  assert.equal(currentStatus(closeout, 24).forecastWeek, 32);
  assert.equal(currentStatus(closeout, 32).actualWeek, 32);
  assert.equal(currentStatus(closeout, 32).status, "achieved");
  assert.deepEqual(revisionWeeks("D10", documentPlan.contentRevisions), [12, 24, 25]);
  assert.deepEqual(revisionWeeks("D10", documentPlan.mainlineEvents), [8, 20, 28, 32]);
});

test("records business-field branch deltas for all three new files", () => {
  const state = {
    week: 18,
    scenario: { id: "scenario-2", status: "open" },
    performance: { forecastCompletionWeek: 35 },
    totals: { overdueCommunicationItems: 0, requirementsTraceabilityCoveragePercent: 100, unauthorizedScopeWorkPersonDays: 0 },
    governance: { ccbOpenItems: 0, scopeControlViolation: false },
    stakeholderTransitions: [],
  };
  const assumptionPatch = buildDocumentPatch("D03", state);
  assert.deepEqual(assumptionPatch.find((operation) => operation.path === "/assumptions/ASM-003/status"), {
    op: "replace",
    path: "/assumptions/ASM-003/status",
    value: "invalidated",
  });
  const milestonePatch = buildDocumentPatch("D10", state);
  assert.equal(milestonePatch.find((operation) => operation.path === "/milestones/MS-06/currentForecastWeek")?.value, 35);

  const lessonPatch = buildDocumentPatch("D09", { ...state, scenario: { id: "scenario-3", status: "closed" }, outcomeClassification: "near_mainline_success" });
  assert.equal(lessonPatch.find((operation) => operation.path === "/lessons/BR-LES-S3/status")?.value, "shared");

  for (const scenario of scenarioPlan.scenarios) {
    const revisions = JSON.stringify(scenario.idealOutcome.documentRevisions);
    assert.match(revisions, /"D03"/);
    assert.match(revisions, /"D09"/);
  }
  assert.match(JSON.stringify(scenarioPlan.scenarios.find((scenario) => scenario.id === "scenario-2").idealOutcome.documentRevisions), /"D10"/);
});

test("renders dedicated D03, D09 and D10 file views", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(timeline, /selectedDocument\.id === "D03"/);
  assert.match(timeline, /假设日志 · W\{selectedWeek\}/);
  assert.match(timeline, /selectedDocument\.id === "D09"/);
  assert.match(timeline, /经验教训登记册 · W\{selectedWeek\}/);
  assert.match(timeline, /selectedDocument\.id === "D10"/);
  assert.match(timeline, /基准 \/ 预测 \/ 实际/);
  assert.match(styles, /\.lab-v2-assumption-table/);
  assert.match(styles, /\.lab-v2-lessons-table/);
  assert.match(styles, /\.lab-v2-milestone-table/);
  assert.doesNotMatch(timeline, /lab-v2-milestone-summary/);
  assert.doesNotMatch(styles, /\.lab-v2-milestone-summary/);
});
