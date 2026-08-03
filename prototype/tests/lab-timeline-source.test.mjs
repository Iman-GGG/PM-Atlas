import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = new URL("../app/prototype-app.tsx", import.meta.url);
const timelineSource = new URL("../app/lab-timeline-page.tsx", import.meta.url);

test("wires the project lab schedule page to takeover and material APIs", async () => {
  const [app, timeline] = await Promise.all([
    readFile(appSource, "utf8"),
    readFile(timelineSource, "utf8"),
  ]);

  assert.match(app, /page === "schedule"[\s\S]*<LabTimelinePage \/>/);
  assert.match(timeline, /\/api\/lab\/cases\/\$\{caseId\}\/\$\{caseVersion\}\/branches/);
  assert.match(timeline, /JSON\.stringify\(\{ scenarioId: point\.scenarioId, idempotencyKey \}\)/);
  assert.match(timeline, /\/materials\/\$\{encodeURIComponent\(material\.id\)\}\/view/);
  assert.match(timeline, /materials\?\.materials\.map/);
  assert.match(timeline, /selectedMaterial\.facts/);
  assert.match(timeline, /materials\?\.cardsUnlocked/);
});

test("keeps evaluation answers out of the timeline client", async () => {
  const timeline = await readFile(timelineSource, "utf8");

  assert.doesNotMatch(timeline, /requiredActionGroups|minimumCorrectSet|harmfulConsequences|terminalRules/);
});
