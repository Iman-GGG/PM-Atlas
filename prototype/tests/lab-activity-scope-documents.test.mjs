import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";
import { buildDocumentPatch } from "../worker/lab/document-diff.ts";

const { documentPlan, schedulePlan, scenarioPlan } = privateLabCasePackage.sourceFiles;

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

function currentStatus(item, week) {
  return [...item.statusEvents].reverse().find((event) => event.week <= week);
}

test("builds D02 from the complete approved 35-activity decomposition", () => {
  const document = documentPlan.documents.find((item) => item.id === "D02");
  assert.equal(document.createdWeek, 6);
  assert.equal(document.coverage, "supporting_key_versions");
  assert.equal(schedulePlan.activityList.documentId, "D02");
  assert.equal(schedulePlan.activityList.approvedWeek, 8);
  assert.equal(schedulePlan.activities.length, 35);
  assert.equal(new Set(schedulePlan.activities.map((activity) => activity.id)).size, 35);
  assert.equal(schedulePlan.activities.filter((activity) => activity.type === "level_of_effort").length, 1);
  assert.equal(schedulePlan.activities.filter((activity) => activity.type === "recurring").length, 1);

  for (const activity of schedulePlan.activities) {
    assert.ok(activity.parentId);
    assert.ok(activity.plannedPersonDaysByRole);
    assert.ok(Object.values(activity.plannedPersonDaysByRole).reduce((sum, value) => sum + value, 0) > 0);
    assert.ok(activity.acceptanceCriteria.length > 0);
  }
  assert.deepEqual(versionWeeks("D02"), [8]);
  assert.equal(documentPlan.contentRevisions.some((revision) => JSON.stringify(revision).includes('"D02"')), false);
});

test("builds D16 as a controlled scope baseline revised only by approved scope change", () => {
  const statement = documentPlan.projectScopeStatement;
  assert.equal(statement.documentId, "D16");
  assert.deepEqual(statement.baselineEvents.map((event) => [event.week, event.version]), [[3, "0.1"], [8, "1.0"], [28, "1.1"]]);
  assert.equal(statement.productScopeItems.length, 6);
  assert.equal(statement.deliverables.length, 8);
  assert.equal(statement.constraints.length, 7);
  assert.equal(statement.acceptanceCriteria.length, 7);

  const remoteControl = statement.productScopeItems.find((item) => item.id === "PSC-03");
  assert.equal(currentStatus(remoteControl, 8).status, "baselined_included");
  assert.equal(currentStatus(remoteControl, 28).status, "deferred_from_v1_0");
  assert.equal(statement.exclusions.filter((item) => item.effectiveWeek <= 27).length, 3);
  assert.equal(statement.exclusions.filter((item) => item.effectiveWeek <= 28).length, 5);
  assert.deepEqual(versionWeeks("D16"), [8, 28]);

  const w28 = documentPlan.mainlineEvents.find((event) => event.week === 28);
  assert.deepEqual(w28.rebaselinedDocumentIds, ["D16"]);
  assert.deepEqual(w28.unchangedBaselinedDocumentIds, ["D21"]);
});

test("preserves scope in scenarios one and two but records business scope fields in scenario three", () => {
  const scenarioOne = scenarioPlan.scenarios.find((scenario) => scenario.id === "scenario-1");
  const scenarioTwo = scenarioPlan.scenarios.find((scenario) => scenario.id === "scenario-2");
  const scenarioThree = scenarioPlan.scenarios.find((scenario) => scenario.id === "scenario-3");
  assert.ok(scenarioOne.idealOutcome.unchangedBaselines.includes("D16"));
  assert.equal(scenarioOne.idealOutcome.documentRevisions.includes("D16"), false);
  assert.equal(scenarioTwo.idealOutcome.documentRevisions.includes("D16"), false);
  assert.ok(scenarioThree.idealOutcome.documentRevisions.includes("D16"));

  const patch = buildDocumentPatch("D16", {
    week: 26,
    scenario: { id: "scenario-3", status: "closed" },
    performance: { forecastCompletionWeek: 32 },
    totals: { overdueCommunicationItems: 0, requirementsTraceabilityCoveragePercent: 100, unauthorizedScopeWorkPersonDays: 0 },
    governance: { ccbOpenItems: 0, scopeControlViolation: false },
    stakeholderTransitions: [],
  });
  assert.equal(patch.find((operation) => operation.path === "/productScope/PSC-03/status")?.value, "deferred_from_v1_0");
  assert.equal(patch.find((operation) => operation.path === "/scopeApproval/status")?.value, "ccb_approved");
});

test("renders dedicated activity-list and scope-statement views without false unchanged versions", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(timeline, /selectedDocument\.id === "D02"/);
  assert.match(timeline, /ACTIVITY LIST/);
  assert.match(timeline, /三点估算/);
  assert.match(timeline, /selectedDocument\.id === "D16"/);
  assert.match(timeline, /PROJECT SCOPE STATEMENT/);
  assert.match(timeline, /明确不包含/);
  assert.match(timeline, /范围基线演进/);
  assert.match(timeline, /!normalized\.includes\("archived"\) && !normalized\.includes\("unchanged"\)/);
  assert.match(styles, /\.lab-v2-activity-list-table/);
  assert.match(styles, /\.lab-v2-scope-components/);
  assert.match(styles, /\.lab-v2-scope-boundaries/);
});
