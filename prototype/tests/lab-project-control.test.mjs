import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  projectExceptionCounts,
  projectHealthStatus,
  sortProjectExceptions,
} from "../lib/lab/project-control.ts";

const timelineSource = new URL("../app/lab-timeline-page.tsx", import.meta.url);

function exception(id, priority, primaryAreaId = "risk") {
  return {
    id,
    priority,
    primaryAreaId,
    areaIds: [primaryAreaId],
    title: id,
    evidence: "authoritative evidence",
    response: "controlled response",
    owner: "owner",
    documentIds: ["D26"],
  };
}

test("ranks control exceptions deterministically and derives one project health state", () => {
  const exceptions = [exception("low", "P3"), exception("blocker", "P0", "quality"), exception("high", "P1")];
  assert.deepEqual(sortProjectExceptions(exceptions).map((item) => item.id), ["blocker", "high", "low"]);
  assert.equal(projectHealthStatus(exceptions), "blocked");
  assert.equal(projectHealthStatus([exception("high", "P1")]), "at_risk");
  assert.equal(projectHealthStatus([exception("watch", "P2")]), "watch");
  assert.equal(projectHealthStatus([]), "healthy");
  assert.deepEqual(projectExceptionCounts(exceptions), { P0: 1, P1: 1, P2: 0, P3: 1 });
});

test("reuses the dashboard detail modal for health and management-area details", async () => {
  const timeline = await readFile(timelineSource, "utf8");
  assert.match(timeline, /className=\{`lab-v2-project-health \$\{currentProjectHealth\}`\}/);
  assert.match(timeline, /setSelectedWidget\("health"\)/);
  assert.doesNotMatch(timeline, /<DashboardCard id="health"/);
  assert.match(timeline, /selectedManagementAreaSummary \? \(/);
  assert.match(timeline, /异常优先级/);
  assert.match(timeline, /projectHealthStatus\(rankedProjectExceptions\)/);
  assert.match(timeline, /qualityHardGateFailed/);
  assert.match(timeline, /forecastVarianceWeeks > 0/);
  assert.match(timeline, /weekState\.cpi < 0\.98/);
  assert.match(timeline, /riskSeverity\(risk\.currentAssessment\.probability/);
  assert.match(timeline, /stakeholder\.current !== stakeholder\.desired/);
  assert.doesNotMatch(timeline, /setManagementFilter\(area\.id\); setDocumentDrawerOpen\(true\)/);
});
