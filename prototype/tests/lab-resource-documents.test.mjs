import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";
import { buildDocumentPatch } from "../worker/lab/document-diff.ts";

const {
  baselineWorkload,
  documentPlan,
  scenarioPlan,
  schedulePlan,
  stakeholderPlan,
  workloadPlan,
} = privateLabCasePackage.sourceFiles;

const resourceDocumentIds = ["D11", "D12", "D17", "D23", "D24", "D25"];
const nonHumanResourceIds = [
  "vehicle_vendor",
  "security_quality",
  "cloud_tools_devices",
  "pilot_training_support",
];

function scenarioState(status = "closed") {
  return {
    week: 18,
    scenario: { id: "scenario-2", status },
    performance: { spi: 0.95, cpi: 0.98, forecastCompletionWeek: 33 },
    totals: { overdueCommunicationItems: 0, requirementsTraceabilityCoveragePercent: 100, unauthorizedScopeWorkPersonDays: 0 },
    governance: { ccbOpenItems: 0, scopeControlViolation: false },
    stakeholderTransitions: [],
  };
}

test("keeps the six resource documents separated by purpose and lifecycle", () => {
  const documents = resourceDocumentIds.map((id) => documentPlan.documents.find((document) => document.id === id));

  assert.deepEqual(documents.map((document) => [document.id, document.createdWeek, document.coverage]), [
    ["D11", 5, "supporting_key_versions"],
    ["D12", 1, "supporting_key_versions"],
    ["D17", 1, "dynamic_full_history"],
    ["D23", 4, "supporting_key_versions"],
    ["D24", 1, "dynamic_full_history"],
    ["D25", 4, "supporting_key_versions"],
  ]);
});

test("reconciles D23 and D25 resource requirements to the approved activity plan", () => {
  const coreAssignments = stakeholderPlan.stakeholders.filter((stakeholder) => stakeholder.resourceRoleId);
  const activityPersonDays = schedulePlan.activities.reduce((activityTotal, activity) => (
    activityTotal + Object.values(activity.plannedPersonDaysByRole).reduce((roleTotal, personDays) => roleTotal + personDays, 0)
  ), 0);
  const rolePersonDays = workloadPlan.roles.reduce((sum, role) => sum + role.plannedPersonDays, 0);

  assert.equal(workloadPlan.roles.length, 8);
  assert.equal(coreAssignments.length, 8);
  assert.equal(new Set(coreAssignments.map((stakeholder) => stakeholder.resourceRoleId)).size, 8);
  assert.equal(schedulePlan.activities.length, 35);
  assert.equal(activityPersonDays, 1024);
  assert.equal(rolePersonDays, 1024);
  assert.equal(schedulePlan.activities.every((activity) => (
    Object.values(activity.plannedPersonDaysByRole).some((personDays) => personDays > 0)
  )), true);
});

test("keeps D11 allocations limited to actual non-human resources rather than risk reserve", () => {
  const plannedCosts = new Map(workloadPlan.plannedNonLaborCosts.map((cost) => [
    cost.id,
    cost.entries.reduce((sum, entry) => sum + entry.amountCny, 0),
  ]));
  const allocatedResourceBudget = nonHumanResourceIds.reduce((sum, id) => sum + plannedCosts.get(id), 0);

  assert.deepEqual([...plannedCosts.keys()], [...nonHumanResourceIds, "risk_uncertainty"]);
  assert.equal(allocatedResourceBudget, 850_000);
  assert.equal(plannedCosts.get("risk_uncertainty"), 150_000);
  assert.equal(allocatedResourceBudget + plannedCosts.get("risk_uncertainty"), 1_000_000);
});

test("records W17 assignment and calendar differences as auditable business fields", () => {
  const scenarioTwo = scenarioPlan.scenarios.find((scenario) => scenario.id === "scenario-2");
  const w17 = baselineWorkload.weeks.find((week) => week.week === 17);
  const w18 = baselineWorkload.weeks.find((week) => week.week === 18);

  assert.ok(scenarioTwo.idealOutcome.documentRevisions.includes("D17"));
  assert.ok(scenarioTwo.idealOutcome.documentRevisions.includes("D24"));
  assert.equal(w17.rolePersonDays.vehicle_integration, 5);
  assert.equal(w18.rolePersonDays.backend, 6);
  assert.equal(w18.overtimePersonDays.backend, 1);

  const assignmentPatch = buildDocumentPatch("D17", scenarioState());
  const calendarPatch = buildDocumentPatch("D24", scenarioState());
  assert.equal(assignmentPatch.find((operation) => operation.path === "/assignments/vehicle_integration/status")?.value, "restored");
  assert.equal(assignmentPatch.find((operation) => operation.path === "/assignments/tech_lead/temporaryCoverage")?.value, "vehicle_interface_coordination");
  assert.equal(calendarPatch.find((operation) => operation.path === "/availability/vehicle_integration/W17-W18/status")?.value, "unavailable");
  assert.equal(calendarPatch.find((operation) => operation.path === "/capacity/backend/W18/approvedOvertimePersonDays")?.value, 1);
  assert.equal(calendarPatch.find((operation) => operation.path === "/capacity/forecastCompletionWeek")?.value, 33);
});

test("renders six compact resource views without duplicative black hero blocks", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const id of resourceDocumentIds) {
    assert.match(timeline, new RegExp(`selectedDocument\\.id === "${id}"`));
  }
  assert.match(timeline, /资源分解结构 · \{resourceBreakdownRows\.length\} 项/);
  assert.match(timeline, /活动级人员需求/);
  assert.match(timeline, /const nonHumanResourceDetails/);
  assert.doesNotMatch(timeline.match(/const nonHumanResourceDetails:[\s\S]+?^};/m)?.[0] ?? "", /risk_uncertainty/);
  assert.match(styles, /\.lab-v2-material-allocation-table/);
  assert.match(styles, /\.lab-v2-resource-calendar-table/);
  assert.match(styles, /\.lab-v2-resource-requirement-table/);
  assert.doesNotMatch(timeline, /lab-v2-(?:material-allocation|project-calendar|team-assignment|resource-breakdown|resource-calendar|resource-requirement)-hero/);
  assert.doesNotMatch(styles, /\.lab-v2-(?:material-allocation|project-calendar|team-assignment|resource-breakdown|resource-calendar|resource-requirement)-hero/);
});
