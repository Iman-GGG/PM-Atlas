import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";

const { documentPlan, schedulePlan, scenarioPlan, stakeholderPlan, workloadPlan } = privateLabCasePackage.sourceFiles;

test("derives D04 estimate basis from the approved schedule and workload sources", () => {
  const document = documentPlan.documents.find((item) => item.id === "D04");
  const discreteActivities = schedulePlan.activities.filter((activity) => activity.type === "discrete");

  assert.deepEqual(document, {
    id: "D04",
    title: "估算依据",
    coverage: "supporting_key_versions",
    createdWeek: 5,
  });
  assert.equal(discreteActivities.length, 33);
  assert.equal(discreteActivities.every((activity) => activity.durationWeeks), true);
  assert.equal(schedulePlan.projectSchedulePlan.calendar.workDaysPerWeek, 5);
  assert.equal(schedulePlan.projectSchedulePlan.baseline.totalPlannedPersonDays, 1024);
  assert.deepEqual(schedulePlan.dependencyPolicy.supportedTypes, ["FS", "SS"]);
  assert.equal(schedulePlan.dependencyPolicy.levelOfEffortAndRecurringExcludedFromCriticalPath, true);
});

test("reconciles D06 bottom-up cost estimates to BAC and keeps later-version changes separate", () => {
  const document = documentPlan.documents.find((item) => item.id === "D06");
  const laborCostCny = workloadPlan.roles.reduce((sum, role) => sum + role.plannedPersonDays * role.standardDayRateCny, 0);
  const nonLaborCostCny = workloadPlan.plannedNonLaborCosts.reduce((sum, cost) => (
    sum + cost.entries.reduce((entrySum, entry) => entrySum + entry.amountCny, 0)
  ), 0);
  const riskReserve = workloadPlan.plannedNonLaborCosts.find((cost) => cost.id === "risk_uncertainty");
  const riskReserveCny = riskReserve.entries.reduce((sum, entry) => sum + entry.amountCny, 0);

  assert.equal(document.createdWeek, 4);
  assert.equal(document.coverage, "dynamic_full_history");
  assert.equal(laborCostCny, 1_600_000);
  assert.equal(nonLaborCostCny, 1_000_000);
  assert.equal(riskReserveCny, 150_000);
  assert.equal(laborCostCny + nonLaborCostCny, workloadPlan.budgetAtCompletionCny);

  const laterVersionChange = documentPlan.changeItems.find((change) => change.id === "CR-002");
  const preBaselineChange = documentPlan.changeItems.find((change) => change.id === "CR-001");
  assert.ok(preBaselineChange.decisionWeek < schedulePlan.projectSchedulePlan.baseline.approvedWeek);
  assert.equal(laterVersionChange.decision, "approved_for_later_version");
  assert.equal(laterVersionChange.impact.costCny, 180_000);
  assert.ok(scenarioPlan.scenarios.find((scenario) => scenario.id === "scenario-1").requiredObservations.some((item) => item.id === "D06"));
});

test("limits D13 source records to key approvals, decisions and high-severity escalations", () => {
  const document = documentPlan.documents.find((item) => item.id === "D13");
  const highSeverityIssues = documentPlan.issues.filter((issue) => issue.severity === "high" || issue.severity === "critical");

  assert.equal(document.createdWeek, 1);
  assert.equal(document.coverage, "dynamic_full_history");
  assert.deepEqual(stakeholderPlan.stageGates.map((gate) => gate.week), [8, 12, 20, 28, 32]);
  assert.equal(highSeverityIssues.length, 5);
  assert.equal(documentPlan.changeItems.length, 8);
  assert.equal(scenarioPlan.scenarios.every((scenario) => scenario.idealOutcome.documentRevisions.includes("D13")), true);
});

test("renders dedicated minimal D04, D06 and D13 views without black hero blocks", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(timeline, /selectedDocument\.id === "D04"/);
  assert.match(timeline, /期望工期 = \(O \+ 4M \+ P\) \/ 6/);
  assert.match(timeline, /selectedDocument\.id === "D06"/);
  assert.match(timeline, /已批准的当前版本成本影响/);
  assert.match(timeline, /selectedDocument\.id === "D13"/);
  assert.match(timeline, /关键沟通记录 · W\{selectedWeek\}/);
  assert.match(timeline, /issue\.severity === "high" \|\| issue\.severity === "critical"/);
  assert.match(styles, /\.lab-v2-estimate-method-table/);
  assert.match(styles, /\.lab-v2-cost-metrics/);
  assert.match(styles, /\.lab-v2-communication-table/);
  assert.doesNotMatch(timeline, /lab-v2-(?:estimate|cost|communication)-hero/);
  assert.doesNotMatch(styles, /\.lab-v2-(?:estimate|cost|communication)-hero/);
});
