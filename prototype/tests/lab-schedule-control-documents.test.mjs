import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";
import { buildDocumentPatch } from "../worker/lab/document-diff.ts";

const { baselineWorkload, documentPlan, schedulePlan } = privateLabCasePackage.sourceFiles;

function document(id) {
  return documentPlan.documents.find((item) => item.id === id);
}

function branchState(scenarioId = "scenario-2") {
  return {
    week: 18,
    scenario: { id: scenarioId, status: "closed" },
    performance: {
      spi: 0.95,
      cpi: 0.98,
      forecastCompletionWeek: 33,
      cumulativePlannedValueCny: 1_288_475,
      cumulativeEarnedValueCny: 1_224_051,
      cumulativeActualCostCny: 1_249_031,
    },
    totals: { overdueCommunicationItems: 0, requirementsTraceabilityCoveragePercent: 100, unauthorizedScopeWorkPersonDays: 0 },
    governance: { ccbOpenItems: 0, scopeControlViolation: false },
    stakeholderTransitions: [],
  };
}

test("keeps the five schedule-control documents at their approved lifecycles", () => {
  assert.deepEqual(["D01", "D07", "D15", "D28", "D29"].map((id) => {
    const item = document(id);
    return [item.id, item.createdWeek, item.coverage];
  }), [
    ["D01", 6, "supporting_key_versions"],
    ["D07", 5, "supporting_key_versions"],
    ["D15", 6, "supporting_key_versions"],
    ["D28", 2, "dynamic_full_history"],
    ["D29", 4, "dynamic_full_history"],
  ]);
});

test("derives activity attributes, duration estimates and network values from one schedule source", () => {
  const discreteActivities = schedulePlan.activities.filter((activity) => activity.type === "discrete");
  const networkById = new Map(baselineWorkload.scheduleNetwork.activities.map((activity) => [activity.activityId, activity]));

  assert.equal(schedulePlan.activities.length, 35);
  assert.equal(discreteActivities.length, 33);
  assert.equal(baselineWorkload.scheduleNetwork.activities.length, 33);
  assert.equal(baselineWorkload.scheduleNetwork.criticalActivityIds.length, 14);
  assert.equal(baselineWorkload.scheduleNetwork.calculatedProjectFinishWeek, 32);
  assert.equal(discreteActivities.every((activity) => activity.durationWeeks && networkById.has(activity.id)), true);
  for (const activity of discreteActivities) {
    const { optimistic, mostLikely, pessimistic } = activity.durationWeeks;
    const expected = (optimistic + 4 * mostLikely + pessimistic) / 6;
    assert.ok(Math.abs(networkById.get(activity.id).expectedDuration - expected) < 0.01);
  }
});

test("keeps progress actuals and forecasts separate from the W32 baseline", () => {
  const week32 = baselineWorkload.weeks.find((week) => week.week === 32);
  const statusByWeek = new Map(schedulePlan.projectSchedulePlan.statusEvents.map((event) => [event.week, event]));

  assert.equal(week32.cumulativePlannedValueCny, 2_600_000);
  assert.equal(week32.cumulativeEarnedValueCny, 2_600_000);
  assert.equal(week32.spi, 1);
  assert.equal(statusByWeek.get(17).forecastFinishWeek, 35);
  assert.equal(statusByWeek.get(18).forecastFinishWeek, 33);
  assert.equal(statusByWeek.get(24).forecastFinishWeek, 32);
  assert.equal(schedulePlan.projectSchedulePlan.calendar.plannedFinishWeek, 32);
});

test("writes auditable D28 and D29 business fields for a branch snapshot", () => {
  const progressPatch = buildDocumentPatch("D28", branchState());
  const forecastPatch = buildDocumentPatch("D29", branchState());

  assert.equal(progressPatch.find((operation) => operation.path === "/progress/dataDateWeek")?.value, 18);
  assert.equal(progressPatch.find((operation) => operation.path === "/progress/cumulativeEarnedValueCny")?.value, 1_224_051);
  assert.equal(forecastPatch.find((operation) => operation.path === "/forecast/completionWeek")?.value, 33);
  assert.equal(forecastPatch.find((operation) => operation.path === "/forecast/varianceWeeks")?.value, 1);
  assert.equal(forecastPatch.find((operation) => operation.path === "/forecast/basis")?.value, "staged_interface_mock_parallel_backup_handoff");
});

test("renders five dedicated schedule-control views without wide desktop tables or duplicate hero blocks", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const id of ["D01", "D07", "D15", "D28", "D29"]) {
    assert.match(timeline, new RegExp(`selectedDocument\\.id === "${id}"`));
  }
  for (const table of [
    "lab-v2-activity-attribute-table",
    "lab-v2-duration-estimate-table",
    "lab-v2-network-register-table",
    "lab-v2-schedule-data-table",
    "lab-v2-forecast-milestone-table",
  ]) {
    assert.match(timeline, new RegExp(`<table className="${table}"`));
    assert.doesNotMatch(timeline, new RegExp(`lab-v2-wide-register-wrap"[\\s\\S]{0,180}<table className="${table}"`));
  }
  assert.match(styles, /\.lab-v2-activity-attribute-table,[\s\S]+\.lab-v2-forecast-milestone-table \{ width: 100%; min-width: 0;/);
  assert.doesNotMatch(timeline, /lab-v2-(?:activity-attribute|duration-estimate|network-register|schedule-data|schedule-forecast)-hero/);
});
