import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";

const { documentPlan, qualityPlan } = privateLabCasePackage.sourceFiles;

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

function passes(metric, value) {
  if (metric.operator === "equals") return value === metric.target;
  if (metric.operator === "greater_than_or_equal") return value >= metric.target;
  return value <= metric.target;
}

test("keeps D19 as the approved measurement definition and D18 as its measured record", () => {
  assert.deepEqual([document("D19").createdWeek, document("D19").coverage], [6, "supporting_key_versions"]);
  assert.deepEqual([document("D18").createdWeek, document("D18").coverage], [14, "supporting_key_versions"]);
  assert.deepEqual(versionWeeks("D19"), [8]);
  assert.deepEqual(versionWeeks("D18"), [20, 28, 32]);
});

test("defines one traceable series for every approved quality metric", () => {
  const definitions = [...qualityPlan.hardGates, ...qualityPlan.performanceMetrics];
  const definitionIds = definitions.map((metric) => metric.id);
  const seriesIds = qualityPlan.mainlineSeries.map((series) => series.metricId);

  assert.equal(definitions.length, 10);
  assert.equal(new Set(definitionIds).size, definitions.length);
  assert.deepEqual([...seriesIds].sort(), [...definitionIds].sort());
  assert.equal(qualityPlan.preMeasurementState, "not_measured");
  assert.equal(qualityPlan.scopeExclusionState, "not_applicable_by_approved_scope_change");
  assert.equal(qualityPlan.successRule, "all_applicable_hard_gates_pass");
});

test("keeps pre-measurement weeks empty and passes all applicable W32 hard gates", () => {
  for (const series of qualityPlan.mainlineSeries) {
    assert.ok(series.anchors[0].week >= 14);
    assert.equal(series.anchors.some((anchor) => anchor.week < series.anchors[0].week), false);
  }

  for (const gate of qualityPlan.hardGates.filter((metric) => metric.scope !== "remote_control_enabled")) {
    const series = qualityPlan.mainlineSeries.find((item) => item.metricId === gate.id);
    const finalValue = series.anchors.filter((anchor) => anchor.week <= 32).at(-1).value;
    assert.equal(passes(gate, finalValue), true, gate.id);
  }
});

test("uses D32 only as compact evidence instead of copying test execution details into D18", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(timeline, /selectedDocument\.id === "D18"/);
  assert.match(timeline, /selectedDocument\.id === "D19"/);
  assert.match(timeline, /这里只记录测量值、阈值和结论；测试范围与执行明细见 D32/);
  assert.match(timeline, /D19 保存批准的测量口径与阈值；测试用例和执行明细统一保存在 D32/);
  assert.doesNotMatch(timeline, /lab-v2-quality-(?:measurement|metric)-hero/);
  assert.match(styles, /\.lab-v2-document-data \.lab-v2-quality-result-table,[\s\S]+min-width: 0; table-layout: fixed;/);
  assert.doesNotMatch(timeline, /lab-v2-wide-register-wrap"[\s\S]{0,180}<table className="lab-v2-quality-(?:result|metric)-table"/);
});
