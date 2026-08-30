import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = new URL("../app/prototype-app.tsx", import.meta.url);
const timelineSource = new URL("../app/lab-timeline-page.tsx", import.meta.url);
const dashboardComponentsSource = new URL("../app/lab-dashboard-components.tsx", import.meta.url);
const projectTimelineSource = new URL("../app/lab-project-timeline.tsx", import.meta.url);
const stylesSource = new URL("../app/globals.css", import.meta.url);
const statsPageSource = new URL("../app/stats/stats-dashboard.tsx", import.meta.url);
const analyticsApiSource = new URL("../worker/analytics/api.ts", import.meta.url);
const labApiSource = new URL("../worker/lab/case-api.ts", import.meta.url);

async function readTimelineSource() {
  const sources = await Promise.all([
    timelineSource,
    dashboardComponentsSource,
    projectTimelineSource,
  ].map((source) => readFile(source, "utf8")));
  return sources.join("\n");
}

test("wires the project lab schedule page to mainline, takeover, and material APIs", async () => {
  const [app, timeline] = await Promise.all([
    readFile(appSource, "utf8"),
    readTimelineSource(),
  ]);

  assert.match(app, /page === "schedule"[\s\S]*<LabTimelinePage openBranchHistoryRequest=\{branchHistoryRequest\} resetLabDataRequest=\{labDataResetRequest\} \/>/);
  assert.match(app, /function AccountMenu/);
  assert.match(app, /\/api\/lab\/session/);
  assert.match(app, /\/signout-with-chatgpt\?return_to=/);
  assert.match(app, /onOpenTakeoverHistory/);
  assert.match(app, /session\.analyticsAdmin/);
  assert.match(app, /href="\/stats"/);
  assert.match(app, /删除我的实验室数据/);
  assert.match(app, /输入“删除”确认/);
  assert.match(app, /fetch\("\/api\/lab\/me\/data"/);
  assert.match(app, /confirmation: "DELETE_LAB_DATA"/);
  assert.match(timeline, /if \(resetLabDataRequest < 1\) return/);
  assert.match(timeline, /setBranches\(\[\]\)/);
  assert.match(timeline, /setSelectedKnowledgeReference\(null\)/);
  assert.match(app, /隐私与统计说明/);
  assert.match(app, /不记录页面输入、行动链具体内容或原始 IP/);
  assert.match(app, /可从账号菜单永久删除个人实验室数据/);
  assert.match(app, /if \(nextSection === "lab"\)[\s\S]*switchPage\("schedule"\)/);
  assert.match(app, /section === "lab" && page !== "schedule"/);
  assert.match(timeline, /\/mainline\?sections=\$\{mainlineSections\}/);
  assert.match(timeline, /const caseVersion = "v6"/);
  assert.match(timeline, /\/api\/lab\/cases\/\$\{caseId\}\/branches/);
  assert.match(timeline, /summary\.caseVersion\.toUpperCase\(\)/);
  assert.match(timeline, /projection\.branch\.caseVersion !== caseVersion/);
  assert.match(timeline, /projection\.branch\.caseVersion}\/mainline\?sections=/);
  assert.match(timeline, /JSON\.stringify\(\{ scenarioId: point\.scenarioId, idempotencyKey, \.\.\.\(retryFromBranchId/);
  assert.match(timeline, /\/materials\/\$\{encodeURIComponent\(material\.id\)\}\/view/);
  assert.match(timeline, /materials\?\.materials\.map/);
  assert.match(timeline, /openedMaterialCache\[material\.id\]/);
  assert.match(timeline, /lab-v2-material-loading/);
  assert.match(timeline, /历史判定正在升级/);
  assert.match(timeline, /selectedMaterial\.facts/);
  assert.match(timeline, /materials\?\.cardsUnlocked/);
  assert.match(timeline, /\/scenarios\/\$\{encodeURIComponent\(scenarioId\)\}\/draft/);
  assert.match(timeline, /method: "PUT"/);
  assert.match(timeline, /actionChains/);
  assert.match(timeline, /actionChainPools/);
  assert.match(timeline, /行动目标/);
  assert.match(timeline, /确定并新增行动链/);
  assert.match(timeline, /function cardDisplayId/);
  assert.match(timeline, /`T\$\{toolMatch\[1\]\}`/);
  assert.doesNotMatch(timeline, /DECISION REASONING|决策依据|AUTOMATIC REFERENCES|判断依据已自动关联/);
  assert.match(timeline, /const draftReady = actionChainComplete/);
  assert.match(timeline, /云端保存中/);
  assert.match(timeline, /\/api\/lab\/branches\/\$\{encodeURIComponent\(branch\.id\)\}\/rounds/);
  assert.match(timeline, /提交行动链并推进一周/);
  assert.match(timeline, /lab-v2-round-result/);
  assert.match(timeline, /仍需处理的管理缺口/);
  assert.match(timeline, /根据本回合行动链判定/);
  assert.match(timeline, /已识别/);
  assert.match(timeline, /尚缺/);
  assert.doesNotMatch(timeline, /分散在不同的行动链中/);
  assert.doesNotMatch(timeline, /所选管理动作尚未连接为完整闭环|connection_incomplete/);
  assert.match(timeline, /setBranchState\(result\.stateSnapshot\)/);
});

test("keeps the analytics dashboard private and records the requested aggregates", async () => {
  const [statsPage, analyticsApi, labApi] = await Promise.all([
    readFile(statsPageSource, "utf8"),
    readFile(analyticsApiSource, "utf8"),
    readFile(labApiSource, "utf8"),
  ]);

  assert.match(statsPage, /\/api\/analytics\/summary\?days=/);
  assert.match(statsPage, /已识别用户/);
  assert.match(statsPage, /今日活跃登录用户/);
  assert.match(statsPage, /AI 复盘使用/);
  assert.match(statsPage, /情景材料查看/);
  assert.match(analyticsApi, /isAnalyticsAdmin/);
  assert.match(analyticsApi, /ANALYTICS_ACCESS_DENIED/);
  assert.match(labApi, /recordAuthenticatedVisit/);
  assert.match(labApi, /recordAnalyticsEvent/);
});

test("renders the complete monochrome project control center", async () => {
  const [timeline, styles] = await Promise.all([
    readTimelineSource(),
    readFile(stylesSource, "utf8"),
  ]);

  assert.match(timeline, /type="range"/);
  assert.match(timeline, /从这里接手/);
  assert.match(timeline, /接手点 · \{scenarioLabel\(point\.scenarioId\)\}/);
  assert.match(timeline, /lab-v2-takeover-action/);
  assert.doesNotMatch(timeline, /lab-v2-takeover-callout/);
  assert.match(timeline, /publicSampleDocumentIds = new Set\(\["D05", "D26"\]\)/);
  assert.match(timeline, /登录查看具体内容/);
  assert.match(timeline, /apiJson<LabSession>\("\/api\/lab\/session"/);
  assert.match(timeline, /接手记录/);
  assert.match(timeline, /lab-v2-branch-history-drawer/);
  assert.match(timeline, /openBranchHistoryRequest/);
  assert.match(timeline, /lab-v2-branch-glyph/);
  assert.doesNotMatch(timeline, /lab-v2-branch-switcher/);
  assert.match(timeline, /const managementAreas:[\s\S]*项目干系人管理/);
  assert.match(timeline, /className="lab-v2-document-drawer"/);
  assert.match(timeline, /32 份项目文件/);
  assert.match(timeline, /selectedDocument\.id === "D30"/);
  assert.match(timeline, /干系人登记册 · W\{selectedWeek\} · 已识别/);
  assert.match(timeline, /当前\/目标参与/);
  assert.match(timeline, /参与责任与最近更新/);
  assert.match(timeline, /item\.identifiedWeek <= selectedWeek/);
  assert.match(styles, /\.lab-v2-stakeholder-register-table/);
  assert.match(styles, /\.lab-v2-data-table-wrap\.lab-v2-stakeholder-register-wrap[^}]*overflow-x: auto/);
  assert.match(timeline, /selectedDocument\.id === "D31"/);
  assert.doesNotMatch(timeline, /lab-v2-team-charter-hero/);
  assert.doesNotMatch(styles, /\.lab-v2-team-charter-hero/);
  assert.match(timeline, /共同价值观/);
  assert.match(timeline, /质量与安全红线/);
  assert.match(timeline, /章程修订规则/);
  assert.match(timeline, /function documentVersionActions[\s\S]*!normalized\.includes\("archived"\)[\s\S]*!normalized\.includes\("unchanged"\)/);
  assert.match(styles, /\.lab-v2-team-charter-values/);
  assert.match(timeline, /进度绩效指数 SPI/);
  assert.match(timeline, /成本绩效指数 CPI/);
  assert.match(timeline, /里程碑甘特图/);
  assert.match(timeline, /干系人 RACI 矩阵/);
  assert.match(timeline, /风险影响概率矩阵/);
  assert.match(timeline, /时标网络图/);
  assert.match(timeline, /完整 11 个一级工作包/);
  assert.match(timeline, /完整 35 项活动/);
  assert.match(timeline, /<TimeScaledNetwork/);
  assert.match(timeline, /onPointerMove=\{handlePointerMove\}/);
  assert.match(timeline, /network-hover-guides/);
  assert.match(timeline, /<WbsCards/);
  assert.match(timeline, /项二级子任务/);
  assert.match(timeline, /window\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(timeline, /event\.key === "ArrowLeft" \? -1 : 1/);
  assert.match(timeline, /compactTimelineVisible \?/);
  assert.match(timeline, /!currentWeekHasLabel/);
  assert.match(timeline, /getBoundingClientRect\(\)\.bottom <= stickyTop/);
  assert.match(timeline, /milestones\.slice\(1, -1\)\.map/);
  assert.match(timeline, /<WorkloadBars/);
  assert.match(timeline, /const windowSize = 21/);
  assert.match(timeline, /<SprintBurndown/);
  assert.match(timeline, /<CcbMemberIndicator/);
  assert.match(timeline, /changeControlBoard\.memberStakeholderIds/);
  assert.match(timeline, /stakeholderNames\(currentRaci\[role\]\)/);
  assert.match(timeline, /visibleChangeItems[\s\S]*changeStatusLabels/);
  assert.match(timeline, /D05 变更日志/);
  assert.match(timeline, /D21 需求文件/);
  assert.match(timeline, /D26 风险登记册/);
  assert.match(timeline, /H \$\{x\(point\.day\)\} V \$\{y\(point\.remaining\)\}/);
  assert.match(timeline, /workPackageId !== "WBS-1\.0" && personDays > 0/);
  assert.match(styles, /\.lab-v2-compact-timeline[^{]*\{[^}]*position: fixed/);
  assert.doesNotMatch(styles, /\.lab-v2-timeline-panel[^{]*\{[^}]*position: sticky/);
  assert.match(styles, /\.lab-v2-gantt[^}]*overflow: hidden/);
  assert.match(styles, /\.lab-v2-card-candidates/);
  assert.match(styles, /\.lab-v2-card-candidate[^}]*width: fit-content[^}]*border-radius: 999px/);
  assert.match(styles, /\.lab-v2-action-chain-composer/);
  assert.match(styles, /\.lab-v2-chain-pools/);
  assert.match(styles, /\.lab-v2-chain-pool > div > button[^}]*width: fit-content[^}]*border-radius: 999px/);
  assert.match(styles, /\.lab-v2-action-chain-list/);
  assert.doesNotMatch(styles, /\.lab-v2-connections/);
  assert.doesNotMatch(styles, /\.lab-v2-reasoning-fields|\.lab-v2-reference-editor|\.lab-v2-auto-references/);
  assert.match(styles, /\.lab-v2-draft-readiness/);
  assert.match(styles, /\.lab-v2-round-result/);
  assert.match(styles, /\.lab-v2-round-metrics/);
  assert.match(styles, /\.lab-v2-time-network[^}]*width: 100%/);
  assert.doesNotMatch(styles, /\.lab-v2-network-scroll[^}]*overflow: auto/);
  assert.doesNotMatch(styles, /\.lab-v2-time-network[^}]*min-width: 1380px/);
  assert.doesNotMatch(styles, /\.network-activities[^}]*stroke:/);
  assert.doesNotMatch(timeline, /className="network-group-line"/);
  assert.doesNotMatch(timeline, /className=\{`network-week-line/);
  assert.doesNotMatch(timeline, /workPackages\.slice\(0, (5|6)\)/);
  assert.doesNotMatch(timeline, /stakeholderState\.slice\(0, 14\)/);
  assert.doesNotMatch(timeline, /filter\(\(item\) => item\.isCritical\)\.slice/);
});

test("keeps evaluation answers out of the timeline client", async () => {
  const timeline = await readTimelineSource();

  assert.doesNotMatch(timeline, /requiredActionGroups|minimumCorrectSet|harmfulConsequences|terminalRules/);
});
