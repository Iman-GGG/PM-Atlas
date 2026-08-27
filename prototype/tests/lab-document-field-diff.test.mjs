import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { currentLabCaseRuntimePackage } from "../worker/lab/case-packages.ts";
import { compareDocumentPatches } from "../worker/lab/document-comparison.ts";
import { buildDocumentPatch } from "../worker/lab/document-diff.ts";

function scenarioThreeState() {
  return {
    week: 26,
    scenario: { id: "scenario-3", status: "closed" },
    performance: {
      spi: 0.99,
      cpi: 0.98,
      forecastCompletionWeek: 32,
      cumulativePlannedValueCny: 2_034_000,
      cumulativeEarnedValueCny: 2_013_660,
      cumulativeActualCostCny: 2_054_755,
    },
    totals: { overdueCommunicationItems: 0, requirementsTraceabilityCoveragePercent: 100, unauthorizedScopeWorkPersonDays: 0 },
    governance: { ccbOpenItems: 0, scopeControlViolation: false },
    stakeholderTransitions: [],
    riskTransitions: [
      { riskId: "R04", lifecycleState: "triggered", controlStatus: "active_controlled" },
      { riskId: "R10", fromLifecycleState: "monitoring", toLifecycleState: "closed", controlStatus: null },
    ],
  };
}

function storedPatch(documentId, operations, roundNumber = 1, week = 26) {
  return { documentId, roundNumber, week, reason: "round_settlement", operations };
}

test("compares D16 branch fields against the exact same-week mainline snapshot", () => {
  const operations = buildDocumentPatch("D16", scenarioThreeState());
  const fields = compareDocumentPatches("D16", currentLabCaseRuntimePackage, 26, [storedPatch("D16", operations)]);
  const byPath = new Map(fields.map((field) => [field.path, field]));

  assert.deepEqual(byPath.get("/scopeBaseline/version")?.mainline, { exists: true, resolved: true, value: "1.0" });
  assert.deepEqual(byPath.get("/scopeBaseline/version")?.branch, { exists: true, resolved: true, value: "1.1-branch" });
  assert.equal(byPath.get("/productScope/PSC-03/status")?.changeType, "modified");
  assert.equal(byPath.get("/scopeExclusions/EX-05/status")?.changeType, "added");
  assert.equal(byPath.has("/productScope/PSC-02/status"), false, "unchanged business fields must be omitted");
  assert.equal(fields.some((field) => field.path.startsWith("/branchMeta/")), false);
});

test("records a real remove when the branch closes a controlled risk", () => {
  const operations = buildDocumentPatch("D27", scenarioThreeState());
  const remove = operations.find((operation) => operation.path === "/riskSummary/current/R10/controlStatus");
  assert.deepEqual(remove, { op: "remove", path: "/riskSummary/current/R10/controlStatus" });

  const fields = compareDocumentPatches("D27", currentLabCaseRuntimePackage, 26, [storedPatch("D27", operations)]);
  const removed = fields.find((field) => field.path === "/riskSummary/current/R10/controlStatus");
  assert.equal(removed?.changeType, "removed");
  assert.deepEqual(removed?.mainline, { exists: true, resolved: true, value: "prepared" });
  assert.deepEqual(removed?.branch, { exists: false, resolved: true, value: null });
});

test("collapses repeated round patches to the current field value", () => {
  const fields = compareDocumentPatches("D28", currentLabCaseRuntimePackage, 18, [
    storedPatch("D28", [{ op: "replace", path: "/progress/spi", value: 0.9 }], 1, 17),
    storedPatch("D28", [{ op: "replace", path: "/progress/spi", value: 0.95 }], 2, 18),
  ]);
  assert.equal(fields.length, 1);
  assert.equal(fields[0].roundNumber, 2);
  assert.equal(fields[0].branch.value, 0.95);
});

test("marks an unmapped historical replace as unresolved instead of inventing a mainline value", () => {
  const fields = compareDocumentPatches("D09", currentLabCaseRuntimePackage, 10, [
    storedPatch("D09", [{ op: "replace", path: "/lessons/legacy/status", value: "shared" }], 1, 10),
  ]);
  assert.equal(fields[0].changeType, "modified");
  assert.deepEqual(fields[0].mainline, { exists: false, resolved: false, value: null });
});

test("ignores unsafe stored pointer segments", () => {
  const fields = compareDocumentPatches("D09", currentLabCaseRuntimePackage, 10, [
    storedPatch("D09", [{ op: "add", path: "/__proto__/polluted", value: true }], 1, 10),
  ]);
  assert.deepEqual(fields, []);
  assert.equal({}.polluted, undefined);
});

test("renders a responsive side-by-side field diff instead of the old path and arrow list", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(timeline, /FIELD DIFF \/ 逐字段比较/);
  assert.match(timeline, /documentDiffValue\(field\.mainline\)/);
  assert.match(timeline, /documentDiffValue\(field\.branch\)/);
  assert.match(timeline, /只显示当前仍然存在的业务差异/);
  assert.doesNotMatch(timeline, /<code>\{operation\.path\}<\/code> → \{String\(operation\.value\)\}/);
  assert.match(styles, /\.lab-v2-document-field-diff-table \.heading,[\s\S]+grid-template-columns: minmax\(180px, 0\.9fr\) minmax\(0, 1fr\) 34px minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]+\.lab-v2-document-field-diff-table article \{ grid-template-columns: 1fr; \}/);
});
