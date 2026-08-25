import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";
import { buildDocumentPatch } from "../worker/lab/document-diff.ts";

const { baselineWorkload, documentPlan, schedulePlan, scenarioPlan } = privateLabCasePackage.sourceFiles;

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

test("builds D14 as a resource-loaded schedule baseline with controlled rolling versions", () => {
  const document = documentPlan.documents.find((item) => item.id === "D14");
  const plan = schedulePlan.projectSchedulePlan;

  assert.equal(document.createdWeek, 6);
  assert.equal(document.coverage, "dynamic_full_history");
  assert.equal(plan.documentId, "D14");
  assert.equal(plan.baselineWeek, 8);
  assert.equal(plan.calendar.plannedFinishWeek, 32);
  assert.equal(plan.baseline.activityCount, 35);
  assert.equal(plan.baseline.milestoneCount, 6);
  assert.equal(plan.baseline.criticalActivityCount, 14);
  assert.equal(plan.baseline.totalPlannedPersonDays, 1024);
  assert.deepEqual(plan.versionEvents.map((event) => [event.week, event.version]), [
    [6, "0.1"], [8, "1.0"], [12, "1.1"], [20, "1.2"], [28, "1.3"], [32, "1.4"],
  ]);
  assert.deepEqual(plan.versionEvents.filter((event) => event.baselineChanged).map((event) => event.week), [8]);
  assert.deepEqual(versionWeeks("D14"), [8, 12, 20, 28, 32]);
});

test("keeps the W32 baseline separate from W35, W33 and recovered forecasts", () => {
  const plan = schedulePlan.projectSchedulePlan;
  const statusByWeek = new Map(plan.statusEvents.map((event) => [event.week, event]));

  assert.equal(statusByWeek.get(17).forecastFinishWeek, 35);
  assert.equal(statusByWeek.get(17).forecastVarianceWeeks, 3);
  assert.equal(statusByWeek.get(18).forecastFinishWeek, 33);
  assert.equal(statusByWeek.get(20).forecastFinishWeek, 33);
  assert.equal(statusByWeek.get(24).forecastFinishWeek, 32);
  assert.equal(statusByWeek.get(32).actualFinishWeek, 32);
  assert.equal(plan.versionEvents.find((event) => event.week === 20).baselineChanged, false);
  assert.ok(plan.versionEvents.find((event) => event.week === 20).approvedChangeIds.includes("CR-004"));
});

test("reconciles D14 activity, milestone, network and workload totals to the shared sources", () => {
  const plan = schedulePlan.projectSchedulePlan;

  assert.equal(schedulePlan.activities.length, plan.baseline.activityCount);
  assert.equal(documentPlan.milestoneList.items.length, plan.baseline.milestoneCount);
  assert.equal(baselineWorkload.scheduleNetwork.criticalActivityIds.length, plan.baseline.criticalActivityCount);
  assert.equal(baselineWorkload.totalPlannedPersonDays, plan.baseline.totalPlannedPersonDays);
  assert.equal(baselineWorkload.scheduleNetwork.calculatedProjectFinishWeek, plan.calendar.plannedFinishWeek);
  assert.equal(baselineWorkload.scheduleNetwork.activities.length, 33);
});

test("records real schedule fields only for the W17 schedule disruption branch", () => {
  const scenarioOne = scenarioPlan.scenarios.find((scenario) => scenario.id === "scenario-1");
  const scenarioTwo = scenarioPlan.scenarios.find((scenario) => scenario.id === "scenario-2");
  const scenarioThree = scenarioPlan.scenarios.find((scenario) => scenario.id === "scenario-3");
  assert.equal(scenarioOne.idealOutcome.documentRevisions.includes("D14"), false);
  assert.equal(scenarioTwo.idealOutcome.documentRevisions.includes("D14"), true);
  assert.equal(scenarioThree.idealOutcome.documentRevisions.includes("D14"), false);

  const patch = buildDocumentPatch("D14", {
    week: 18,
    scenario: { id: "scenario-2", status: "closed" },
    performance: { spi: 0.95, cpi: 0.98, forecastCompletionWeek: 33 },
    totals: { overdueCommunicationItems: 0, requirementsTraceabilityCoveragePercent: 100, unauthorizedScopeWorkPersonDays: 0 },
    governance: { ccbOpenItems: 0, scopeControlViolation: false },
    stakeholderTransitions: [],
  });
  assert.equal(patch.find((operation) => operation.path === "/scheduleStatus/forecastCompletionWeek")?.value, 33);
  assert.equal(patch.find((operation) => operation.path === "/scheduleStatus/forecastVarianceWeeks")?.value, 1);
  assert.equal(patch.find((operation) => operation.path === "/scheduleBaseline/finishWeek")?.value, 32);
  assert.equal(patch.find((operation) => operation.path === "/scheduleBaseline/changeStatus")?.value, "unchanged");
  assert.equal(patch.find((operation) => operation.path === "/activities/WBS-8.2/forecastStatus")?.value, "recovery_plan_active");
});

test("renders the dedicated D14 baseline, gantt, CPM and forecast-history views", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(timeline, /selectedDocument\.id === "D14"/);
  assert.match(timeline, /PROJECT SCHEDULE/);
  assert.match(timeline, /32周工作包进度图/);
  assert.match(timeline, /详细活动进度模型/);
  assert.match(timeline, /预测演进 · 不等同于基线变更/);
  assert.match(timeline, /进度基线未变化/);
  assert.match(styles, /\.lab-v2-schedule-hero/);
  assert.match(styles, /\.lab-v2-schedule-gantt/);
  assert.match(styles, /\.lab-v2-schedule-activity-table/);
  assert.match(styles, /\.lab-v2-schedule-status-history/);
});
