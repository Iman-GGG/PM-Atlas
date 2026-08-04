import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = new URL("../app/prototype-app.tsx", import.meta.url);
const timelineSource = new URL("../app/lab-timeline-page.tsx", import.meta.url);
const stylesSource = new URL("../app/globals.css", import.meta.url);

test("wires the project lab schedule page to mainline, takeover, and material APIs", async () => {
  const [app, timeline] = await Promise.all([
    readFile(appSource, "utf8"),
    readFile(timelineSource, "utf8"),
  ]);

  assert.match(app, /page === "schedule"[\s\S]*<LabTimelinePage \/>/);
  assert.match(app, /if \(nextSection === "lab"\)[\s\S]*switchPage\("schedule"\)/);
  assert.match(app, /section === "lab" && page !== "schedule"/);
  assert.match(timeline, /\/mainline\?sections=\$\{mainlineSections\}/);
  assert.match(timeline, /\/api\/lab\/cases\/\$\{caseId\}\/\$\{caseVersion\}\/branches/);
  assert.match(timeline, /JSON\.stringify\(\{ scenarioId: point\.scenarioId, idempotencyKey \}\)/);
  assert.match(timeline, /\/materials\/\$\{encodeURIComponent\(material\.id\)\}\/view/);
  assert.match(timeline, /materials\?\.materials\.map/);
  assert.match(timeline, /selectedMaterial\.facts/);
  assert.match(timeline, /materials\?\.cardsUnlocked/);
});

test("renders the complete monochrome project control center", async () => {
  const [timeline, styles] = await Promise.all([
    readFile(timelineSource, "utf8"),
    readFile(stylesSource, "utf8"),
  ]);

  assert.match(timeline, /type="range"/);
  assert.match(timeline, /从这里接手/);
  assert.match(timeline, /const managementAreas:[\s\S]*项目干系人管理/);
  assert.match(timeline, /className="lab-v2-document-drawer"/);
  assert.match(timeline, /32 份项目文件/);
  assert.match(timeline, /进度绩效指数 SPI/);
  assert.match(timeline, /成本绩效指数 CPI/);
  assert.match(timeline, /里程碑甘特图/);
  assert.match(timeline, /干系人 RACI 矩阵/);
  assert.match(timeline, /风险影响概率矩阵/);
  assert.match(timeline, /时标网络图/);
  assert.match(timeline, /完整 11 个一级工作包/);
  assert.match(timeline, /完整 35 项活动/);
  assert.match(timeline, /<TimeScaledNetwork/);
  assert.match(timeline, /<WbsCards/);
  assert.match(timeline, /项二级子任务/);
  assert.match(styles, /\.lab-v2-gantt[^}]*overflow: hidden/);
  assert.match(styles, /\.lab-v2-time-network[^}]*width: 100%/);
  assert.doesNotMatch(styles, /\.lab-v2-network-scroll[^}]*overflow: auto/);
  assert.doesNotMatch(styles, /\.lab-v2-time-network[^}]*min-width: 1380px/);
  assert.doesNotMatch(timeline, /workPackages\.slice\(0, (5|6)\)/);
  assert.doesNotMatch(timeline, /filter\(\(item\) => item\.isCritical\)\.slice/);
});

test("keeps evaluation answers out of the timeline client", async () => {
  const timeline = await readFile(timelineSource, "utf8");

  assert.doesNotMatch(timeline, /requiredActionGroups|minimumCorrectSet|harmfulConsequences|terminalRules/);
});
