import { expect, test, type Page, type Route } from "@playwright/test";
import { publicLabCaseBaseline } from "../lib/lab/lab-case-public.generated";

type SetupOptions = {
  initialBranch?: boolean;
  materialsOpened?: boolean;
  roundNumber?: number;
};

const scenarioId = "scenario-1";
const branchId = "branch-e2e";
const materials = [
  { id: "mat-email", group: "primaryClues", type: "email", channel: "供应商邮件", title: "供应商延期通知" },
  { id: "mat-report", group: "corroboratingClues", type: "report", channel: "项目周报", title: "进度影响报告" },
  { id: "mat-alert", group: "dashboardAnomalies", type: "dashboard", channel: "项目仪表盘", title: "SPI 异常信号" },
];
const cards = [
  { id: "card-document", column: "evidence_document", referenceId: "D05", title: "变更日志" },
  { id: "card-tool", column: "tool_technique", referenceId: "tool:131", title: "变更控制" },
  { id: "card-stakeholder", column: "stakeholder", referenceId: "STK-01", title: "项目发起人" },
] as const;

function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

function branchState(roundNumber: number) {
  const week = 9 + roundNumber;
  const baselineWeek = (publicLabCaseBaseline.plans.baselineWorkload as { weeks: Array<Record<string, number>> }).weeks.find((item) => item.week === week)!;
  return {
    week,
    scenario: { id: scenarioId, status: roundNumber >= 2 ? "closed" : "open" },
    performance: {
      spi: roundNumber ? 0.97 + roundNumber * 0.01 : baselineWeek.spi,
      cpi: roundNumber ? 0.98 + roundNumber * 0.005 : baselineWeek.cpi,
      cumulativePlannedValueCny: baselineWeek.cumulativePlannedValueCny,
      cumulativeEarnedValueCny: baselineWeek.cumulativeEarnedValueCny,
      cumulativeActualCostCny: baselineWeek.cumulativeActualCostCny,
      budgetAtCompletionCny: 2_600_000,
      forecastCompletionWeek: roundNumber >= 2 ? 32 : 33,
    },
    totals: {
      incrementalActualCostCny: roundNumber * 12_000,
      incrementalWorkPersonDays: roundNumber * 4,
      overtimePersonDays: 0,
      blockedPersonDays: 0,
      coordinationAndWaitingPersonDays: 0,
      unauthorizedScopeWorkPersonDays: 0,
      overdueCommunicationItems: 0,
      requirementsTraceabilityCoveragePercent: roundNumber >= 2 ? 100 : 92,
    },
    governance: { ccbOpenItems: roundNumber >= 2 ? 0 : 1, scopeControlViolation: false },
    riskTransitions: [],
    stakeholderTransitions: [],
    documentRevisions: roundNumber ? ["D14"] : [],
    outcomeClassification: roundNumber >= 2 ? "near_mainline_success" : null,
  };
}

function roundResult(roundNumber: number) {
  return {
    rulesetVersion: 2,
    branchId,
    roundNumber,
    advancedToWeek: 9 + roundNumber,
    scenarioState: roundNumber >= 2 ? "closed" : "open",
    ...(roundNumber >= 2 ? { pathClassification: "near_mainline_success" } : {}),
    stateSnapshot: branchState(roundNumber),
    stateDiff: {
      managementActionsCompletedThisRound: 1,
      additionalActualCostCny: 12_000,
      incrementalWorkPersonDays: 4,
      harmfulEffectsApplied: 0,
      forecastCompletionWeek: roundNumber >= 2 ? 32 : 33,
      spi: roundNumber >= 2 ? 0.99 : 0.98,
      cpi: roundNumber >= 2 ? 0.99 : 0.985,
      requirementsTraceabilityCoveragePercent: roundNumber >= 2 ? 100 : 92,
    },
    documentDiffs: [{ documentId: "D14", operation: "replace", reason: "更新恢复预测" }],
    gaps: roundNumber >= 2 ? [] : [{ categories: ["scope_governance"], objectiveEffects: ["change_decision_pending"], actionTitle: "完成正式变更决策" }],
    idempotentReplay: false,
  };
}

function comparison(roundNumber: number) {
  const metric = (week: number, status: string) => ({ week, spi: week === 9 ? 1 : 0.99, cpi: 0.99, forecastCompletionWeek: 32, status });
  const rounds = [{ roundNumber: 0, week: 9, commitHash: "fork00000000", submittedAt: null, scenarioStatus: "open", pathClassification: null, mainline: metric(9, "mainline"), branch: metric(9, "open"), documents: [], completedActions: 0, harmfulEffects: 0 }];
  for (let index = 1; index <= roundNumber; index += 1) {
    rounds.push({
      roundNumber: index,
      week: 9 + index,
      commitHash: `commit0000000${index}`,
      submittedAt: `2026-08-30T09:0${index}:00Z`,
      scenarioStatus: index >= 2 ? "closed" : "open",
      pathClassification: index >= 2 ? "near_mainline_success" : null,
      mainline: metric(9 + index, "mainline"),
      branch: { ...metric(9 + index, index >= 2 ? "closed" : "open"), spi: index >= 2 ? 0.99 : 0.98 },
      documents: [{ documentId: "D14", operationCount: 1 }],
      completedActions: 1,
      harmfulEffects: 0,
    });
  }
  return {
    caseVersion: "v6",
    contentHash: publicLabCaseBaseline.contentHash,
    forkWeek: 9,
    currentWeek: 9 + roundNumber,
    currentRoundNumber: roundNumber,
    branchStatus: roundNumber >= 2 ? "completed" : "active",
    outcomeClassification: roundNumber >= 2 ? "near_mainline_success" : null,
    mainline: metric(9 + roundNumber, "mainline"),
    branch: rounds.at(-1)!.branch,
    rounds,
    summary: { submittedRoundCount: roundNumber, revisedDocumentCount: roundNumber ? 1 : 0, operationCount: roundNumber },
  };
}

async function installLabApi(page: Page, options: SetupOptions = {}) {
  const state = {
    branchExists: Boolean(options.initialBranch),
    openedMaterialIds: new Set(options.materialsOpened ? materials.map((item) => item.id) : []),
    roundNumber: options.roundNumber ?? 0,
    draft: [] as unknown[],
    draftWrites: 0,
  };

  await page.route("**/api/lab/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const branch = {
      id: branchId,
      caseVersion: "v6",
      parentBranchId: null,
      branchName: null,
      currentWeek: 9 + state.roundNumber,
      currentRoundNumber: state.roundNumber,
      status: state.roundNumber >= 2 ? "completed" : "active",
    };

    if (path === "/api/lab/session") return json(route, { authenticated: true, analyticsAdmin: false });
    if (path === "/api/lab/cases/car-control/v6") return json(route, {
      caseId: publicLabCaseBaseline.caseId,
      caseVersion: publicLabCaseBaseline.caseVersion,
      totalWeeks: publicLabCaseBaseline.totalWeeks,
      takeoverPoints: publicLabCaseBaseline.takeoverPoints,
    });
    if (path === "/api/lab/cases/car-control/v6/mainline") return json(route, { week: null, sections: publicLabCaseBaseline.plans });
    if (path === "/api/lab/cases/car-control/branches" && method === "GET") return json(route, {
      branches: state.branchExists ? [{ ...branch, forkWeek: 9, scenarioId, outcomeClassification: state.roundNumber >= 2 ? "near_mainline_success" : null, createdAt: "2026-08-30T09:00:00Z" }] : [],
    });
    if (path === "/api/lab/cases/car-control/v6/branches" && method === "POST") {
      state.branchExists = true;
      return json(route, { branch, scenario: { id: scenarioId, week: 9, title: "需求变更", availableMaterialCount: materials.length, cardsUnlocked: false } });
    }
    if (path.endsWith(`/scenarios/${scenarioId}/projection`)) return json(route, {
      branch,
      scenario: { id: scenarioId, title: "需求变更", cards: state.openedMaterialIds.size === materials.length ? cards : [] },
      state: branchState(state.roundNumber),
      lastRoundResult: state.roundNumber ? roundResult(state.roundNumber) : null,
    });
    if (path.endsWith(`/scenarios/${scenarioId}/materials`) && method === "GET") return json(route, {
      openedCount: state.openedMaterialIds.size,
      totalCount: materials.length,
      cardsUnlocked: state.openedMaterialIds.size === materials.length,
      materials: materials.map((item) => ({ ...item, opened: state.openedMaterialIds.has(item.id), ...(state.openedMaterialIds.has(item.id) ? { content: { id: item.id, subject: item.title, channel: item.channel, facts: [`${item.title}已确认`], documentIds: ["D14"] } } : {}) })),
    });
    if (/\/materials\/[^/]+\/view$/.test(path) && method === "POST") {
      const materialId = path.split("/").at(-2)!;
      state.openedMaterialIds.add(materialId);
      const item = materials.find((material) => material.id === materialId)!;
      return json(route, {
        material: { id: item.id, subject: item.title, channel: item.channel, facts: [`${item.title}已确认`], documentIds: ["D14"] },
        openedCount: state.openedMaterialIds.size,
        totalCount: materials.length,
        cardsUnlocked: state.openedMaterialIds.size === materials.length,
        cards: state.openedMaterialIds.size === materials.length ? cards : [],
      });
    }
    if (path.endsWith(`/scenarios/${scenarioId}/draft`) && method === "GET") return json(route, { branchId, scenarioId, roundNumber: state.roundNumber + 1, actionChains: state.draft, updatedAt: null });
    if (path.endsWith(`/scenarios/${scenarioId}/draft`) && method === "PUT") {
      state.draftWrites += 1;
      state.draft = request.postDataJSON().actionChains;
      return json(route, { branchId, scenarioId, roundNumber: state.roundNumber + 1, actionChains: state.draft, updatedAt: "2026-08-30T09:10:00Z" });
    }
    if (path.endsWith("/rounds") && method === "POST") {
      state.roundNumber += 1;
      state.draft = [];
      return json(route, roundResult(state.roundNumber));
    }
    if (path.endsWith("/comparison")) return json(route, comparison(state.roundNumber));
    if (/\/documents\/[^/]+$/.test(path)) return json(route, {
      mainlineWeek: 9,
      branchWeek: 9 + state.roundNumber,
      patches: state.roundNumber ? [{ roundNumber: 1, week: 10, reason: "更新恢复预测", operations: [{ op: "replace", path: "/status", value: "at_risk" }] }] : [],
      fields: state.roundNumber ? [{ path: "/status", changeType: "modified", roundNumber: 1, week: 10, reason: "更新恢复预测", mainline: { exists: true, resolved: true, value: "on_track" }, branch: { exists: true, resolved: true, value: "at_risk" } }] : [],
      summary: state.roundNumber ? { added: 0, modified: 1, removed: 0 } : { added: 0, modified: 0, removed: 0 },
    });
    if (path.endsWith("/reviews/scenario") && method === "POST") return json(route, { review: {
      summary: "能够依据材料形成闭环行动，并在第二回合恢复到主线路径。",
      strengths: [{ claim: "完整读取材料", evidenceRefs: ["mat-email", "mat-report", "mat-alert"], impact: "关键事实得到交叉验证。" }],
      improvements: [{ claim: "更早准备审批", evidenceRefs: ["ROUND-1"], impact: "可以减少一次额外回合。" }],
      mainlineDifferences: [{ claim: "分支晚一周完成变更闭环", evidenceRefs: ["D14"], impact: "产生少量管理成本。" }],
      capabilityProfile: { signalRecognition: "mature", riskAndRootCauseDiagnosis: "developing", actionCompletenessAndMinimality: "mature", timingAndTradeoff: "developing", communicationAndGovernance: "mature" },
      recommendedKnowledgeIds: ["T131"],
      retrySuggestion: "在第一回合同时准备 CCB 决策材料。",
    } });
    return json(route, {});
  });
  return state;
}

async function openBranch(page: Page, options: SetupOptions = {}) {
  const state = await installLabApi(page, { initialBranch: true, materialsOpened: true, ...options });
  await page.goto(`/#lab-schedule?branch=${branchId}&scenario=${scenarioId}`);
  await expect(page.getByRole("heading", { name: "需求变更", exact: true })).toBeVisible();
  await expect(page.getByText(state.roundNumber >= 2 ? "情景结算完成" : "三类卡池已解锁")).toBeVisible();
  return state;
}

async function createActionChain(page: Page, title: string) {
  for (const cardTitle of ["变更日志", "变更控制", "项目发起人"]) {
    const candidate = page.locator(".lab-v2-card-candidate").filter({ hasText: cardTitle });
    await expect(candidate).toHaveCount(1);
    await candidate.locator("button.card-choice").click();
  }
  await page.getByPlaceholder("例如：确认延期影响并形成供应商恢复计划").fill(title);
  await page.getByRole("button", { name: "确定并新增行动链" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("逐项阅读情景材料后才解锁行动链", async ({ page }) => {
  await installLabApi(page);
  await page.goto("/#lab-schedule");
  await page.getByRole("button", { name: "查看第9周接手点" }).click();
  await page.getByRole("button", { name: "从这里接手 →" }).click();

  for (const material of materials) {
    await page.getByRole("button", { name: new RegExp(material.title) }).click();
    await expect(page.getByText(`${material.title}已确认`)).toBeVisible();
  }

  await expect(page.getByText("3/3", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "定义目标并创建管理行动链" })).toBeVisible();
});

test("行动链必须包含目标及三个固定卡池", async ({ page }) => {
  const state = await openBranch(page);
  await createActionChain(page, "形成供应商延期的正式恢复计划");
  await expect(page.getByText("行动链已就绪")).toBeVisible();
  await expect.poll(() => state.draftWrites).toBeGreaterThan(0);
});

test("多回合提交会先保留缺口并在下一回合闭环", async ({ page }) => {
  await openBranch(page);
  await createActionChain(page, "第一回合识别延期并提交影响分析");
  await page.getByRole("button", { name: "提交行动链并推进一周" }).click();
  await expect(page.getByRole("heading", { name: "项目已推进一周，情景尚未闭环" })).toBeVisible();
  await expect(page.getByText("完成正式变更决策")).toBeVisible();

  await createActionChain(page, "第二回合完成审批并关闭范围影响");
  await page.getByRole("button", { name: "提交行动链并推进一周" }).click();
  await expect(page.getByRole("dialog", { name: "需求变更结局与复盘" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "近主线成功", level: 1 })).toBeVisible();
});

test("项目文件抽屉展示主线与分支逐字段差异", async ({ page }) => {
  await openBranch(page, { roundNumber: 1 });
  await page.getByRole("button", { name: /项目文件/ }).click();
  await expect(page.getByRole("heading", { name: "32 份项目文件" })).toBeVisible();
  await expect(page.getByText("FIELD DIFF / 逐字段比较")).toBeVisible();
  await expect(page.getByText("主线 ↔ 个人分支")).toBeVisible();
  await expect(page.getByText("存在风险", { exact: true })).toBeVisible();
});

test("情景结局可生成基于已结算事实的结构化复盘", async ({ page }) => {
  await openBranch(page, { roundNumber: 2 });
  await expect(page.getByRole("dialog", { name: "需求变更结局与复盘" })).toBeVisible();
  await page.getByRole("button", { name: "生成 AI 复盘" }).click();
  await expect(page.getByText("能够依据材料形成闭环行动，并在第二回合恢复到主线路径。")).toBeVisible();
  await expect(page.getByRole("heading", { name: "能力画像" })).toBeVisible();
  await expect(page.getByRole("button", { name: "T131", exact: true })).toBeVisible();
});
