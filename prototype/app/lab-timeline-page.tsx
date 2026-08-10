"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

type TakeoverPoint = {
  scenarioId: string;
  week: number;
  label: string;
};

type CaseManifest = {
  caseId: string;
  caseVersion: string;
  totalWeeks: number;
  takeoverPoints: TakeoverPoint[];
};

type BaselineWeek = {
  week: number;
  sprint: string | null;
  plannedTeamPersonDays: number;
  cumulativePlannedValueCny: number;
  cumulativeEarnedValueCny: number;
  cumulativeActualCostCny: number;
  spi: number;
  cpi: number;
  rolePersonDays: Record<string, number>;
  workPackagePersonDays: Record<string, number>;
};

type WorkPackage = {
  id: string;
  title: string;
  startWeek: number;
  endWeek: number;
};

type ScheduleActivity = {
  id: string;
  parentId: string;
  title: string;
  startWeek: number;
  endWeek: number;
  predecessors?: Array<{ activityId: string; type: string; lagWeeks: number }>;
};

type Stakeholder = {
  id: string;
  title: string;
  initialEngagement: {
    power: number;
    interest: number;
    current: string;
    desired: string;
  };
};

type StakeholderEvent = {
  week: number;
  stakeholderId: string;
  current: string;
  desired?: string;
  evidence: string[];
};

type RaciRow = {
  workPackageId: string;
  A: string[];
  R: string[];
  C: string[];
  I: string[];
};

type ProjectDocument = {
  id: string;
  title: string;
  coverage: string;
  createdWeek: number;
};

type DocumentEvent = {
  id: string;
  week: number;
  reason: string;
  [key: string]: unknown;
};

type DocumentRelation = {
  id: string;
  fromDocumentId: string;
  toDocumentId: string;
  type: string;
  reason: string;
  effectiveWeek: number;
};

type ChangeControlBoard = {
  memberStakeholderIds: string[];
  quorum: number;
  chairStakeholderId: string;
  secretaryStakeholderId: string;
  decisionRules: string[];
};

type ChangeItem = {
  id: string;
  title: string;
  category: string;
  priority: string;
  requesterStakeholderId: string;
  ownerStakeholderId: string;
  submittedWeek: number;
  reviewWeek: number;
  decisionWeek: number;
  implementationCompletedWeek: number;
  closedWeek: number;
  decision: string;
  decisionSummary: string;
  impact: { scope: string; scheduleWeeks: number; costCny: number; quality: string; risk: string };
  affectedWbsIds: string[];
  affectedRequirementIds: string[];
  implementationResult: string;
};

type IssueItem = {
  id: string;
  title: string;
  category: string;
  severity: string;
  discoveredWeek: number;
  targetResolutionWeek: number;
  resolvedWeek: number;
  ownerStakeholderId: string;
  statusAfterResolution: string;
  resolution: string;
  linkedRequirementIds: string[];
  linkedRiskIds: string[];
  linkedChangeIds: string[];
};

type TestRound = {
  id: string;
  title: string;
  executionWeek: number;
  scope: string;
  coveredRequirementIds: string[];
  passed: number;
  failed: number;
  blocked: number;
  criticalDefects: number;
  result: string;
  releaseRecommendation: string;
};

type RiskItem = {
  id: string;
  title: string;
  owner: string;
  category: string;
  impactDimensions: string[];
  discoveredWeek: number;
  assessmentWeek: number;
  responseCompletedWeek: number;
  triggeredWeek: number | null;
  closedWeek: number;
  responseActions: string[];
  postTreatmentResult: string;
  inherent: { probability: number; impact: number };
  residual: { probability: number; impact: number };
};

type RequirementItem = {
  id: string;
  title: string;
  category: string;
  priority: "P0" | "P1" | "P2" | "P3";
  sourceStakeholderId: string;
  discoveredWeek: number;
  baselinedWeek?: number;
  implementationCompletedWeek?: number;
  verifiedWeek?: number;
  targetRelease: string;
  traceabilityStatus: "baselined" | "candidate_unplanned";
  primaryWbsId?: string;
  supportingWbsIds?: string[];
  proposedPrimaryWbsId?: string;
  proposedSupportingWbsIds?: string[];
  acceptanceCriteria: string[];
};

type RiskEvent = {
  week: number;
  riskIds: string[];
  toLifecycleState: string;
  controlStatus?: string;
};

type QualitySeries = {
  metricId: string;
  interpolation: "linear" | "step";
  anchors: Array<{ week: number; value: number | boolean }>;
};

type NetworkActivity = {
  activityId: string;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
};

type MainlineData = {
  workload: {
    budgetAtCompletionCny: number;
    roles: Array<{ id: string; title: string }>;
    workPackages: WorkPackage[];
  };
  schedule: { activities: ScheduleActivity[] };
  stakeholders: {
    stakeholders: Stakeholder[];
    mainlineEngagementEvents: StakeholderEvent[];
    workPackageRaci: RaciRow[];
  };
  documents: {
    documents: ProjectDocument[];
    mainlineEvents: DocumentEvent[];
    contentRevisions: DocumentEvent[];
    relations: DocumentRelation[];
    changeControlBoard: ChangeControlBoard;
    changeItems: ChangeItem[];
    issues: IssueItem[];
    testRounds: TestRound[];
  };
  requirements: {
    requirements: RequirementItem[];
  };
  risks: {
    initialRisks: RiskItem[];
    mainlineLifecycleEvents: RiskEvent[];
  };
  quality: { mainlineSeries: QualitySeries[] };
  baselineWorkload: {
    totalPlannedPersonDays: number;
    weeks: BaselineWeek[];
    scheduleNetwork: {
      deadlineWeek: number;
      calculatedProjectFinishWeek: number;
      criticalActivityIds: string[];
      activities: NetworkActivity[];
    };
  };
};

type MainlineResponse = {
  week: number | null;
  sections: MainlineData;
};

type BranchContext = {
  id: string;
  currentWeek: number;
  currentRoundNumber: number;
  status: string;
};

type MaterialSummary = {
  id: string;
  group: string;
  type: string;
  channel: string | null;
  title: string;
  opened: boolean;
};

type MaterialList = {
  openedCount: number;
  totalCount: number;
  cardsUnlocked: boolean;
  materials: MaterialSummary[];
};

type PublicCard = {
  id: string;
  column: "evidence_document" | "tool_technique" | "stakeholder";
  referenceId: string;
  title: string;
};

type ManagementActionChain = {
  id: string;
  title: string;
  documentCardIds: string[];
  toolTechniqueCardIds: string[];
  stakeholderCardIds: string[];
};

type ActionChainPools = Record<PublicCard["column"], string[]>;

type RoundDraft = {
  branchId: string;
  scenarioId: string;
  roundNumber: number;
  actionChains: ManagementActionChain[];
  updatedAt: string | null;
};

type BranchState = {
  week: number;
  scenario: { id: string; status: "open" | "closed" | "failed" };
  performance: {
    spi: number;
    cpi: number;
    cumulativePlannedValueCny: number;
    cumulativeEarnedValueCny: number;
    cumulativeActualCostCny: number;
    budgetAtCompletionCny?: number;
    forecastCompletionWeek: number;
  };
  totals: {
    incrementalActualCostCny: number;
    incrementalWorkPersonDays: number;
    overtimePersonDays: number;
    blockedPersonDays: number;
    coordinationAndWaitingPersonDays: number;
    unauthorizedScopeWorkPersonDays: number;
    overdueCommunicationItems: number;
    requirementsTraceabilityCoveragePercent: number;
  };
  governance: { ccbOpenItems: number; scopeControlViolation: boolean };
  riskTransitions: Array<Record<string, unknown>>;
  stakeholderTransitions: Array<Record<string, unknown>>;
  documentRevisions: string[];
  outcomeClassification: string | null;
};

type RoundGap = {
  categories: string[];
  objectiveEffects: string[];
  relatedActionIds?: string[];
  actionTitle?: string;
  recognizedCards?: PublicCard[];
  missingCards?: PublicCard[];
  cardsSplitAcrossChains?: boolean;
  missingPrerequisites?: Array<{ actionId: string; title: string }>;
  diagnosis?: "missing_cards" | "split_across_chains" | "prerequisite_incomplete" | "connection_incomplete";
};

type RoundResult = {
  branchId: string;
  roundNumber: number;
  advancedToWeek: number;
  scenarioState: "open" | "closed" | "failed";
  pathClassification?: string;
  stateSnapshot: BranchState;
  stateDiff: {
    managementActionsCompletedThisRound?: number;
    additionalActualCostCny?: number;
    incrementalWorkPersonDays?: number;
    harmfulEffectsApplied?: number;
    forecastCompletionWeek?: number;
    spi?: number;
    cpi?: number;
    requirementsTraceabilityCoveragePercent?: number;
  };
  documentDiffs: Array<{ documentId: string; operation: string; reason: string }>;
  gaps: RoundGap[];
  idempotentReplay: boolean;
};

type OpenedMaterial = {
  id: string;
  subject?: string;
  displayLabel?: string;
  channel?: string;
  facts?: string[];
  documentIds?: string[];
  [key: string]: unknown;
};

type BranchCreation = {
  branch: BranchContext;
  scenario: {
    id: string;
    week: number;
    title: string;
    entrySignals?: string[];
    availableMaterialCount?: number;
    cardsUnlocked?: boolean;
  };
};

type DashboardId =
  | "spi"
  | "cpi"
  | "bac"
  | "ac"
  | "gantt"
  | "workload"
  | "engagement"
  | "raci"
  | "risk-matrix"
  | "requirements"
  | "burndown"
  | "ccb"
  | "network"
  | "wbs"
  | "risk-status";

type ManagementArea = {
  id: string;
  index: string;
  title: string;
  shortTitle: string;
  documentIds: string[];
};

const caseId = "car-control";
const caseVersion = "v4";
const mainlineSections = "workload,schedule,stakeholders,documents,requirements,risks,quality,baselineWorkload";
const milestones = [
  { week: 1, label: "启动" },
  { week: 8, label: "范围基线" },
  { week: 12, label: "架构门" },
  { week: 20, label: "集成门" },
  { week: 28, label: "上线门" },
  { week: 32, label: "收尾" },
];
const ccbDutyByStakeholderId: Record<string, string> = {
  sponsor: "主席 / 最终审批",
  pm: "组织评审 / 记录决议",
  product_ba: "业务价值 / 范围影响",
  tech_lead: "技术方案 / 进度影响",
  devsecops: "安全 / 发布影响",
};
const scenarioLabels: Record<string, string> = {
  "scenario-1": "需求变更",
  "scenario-2": "供应与资源",
  "scenario-3": "安全发布",
};
const materialGroupLabels: Record<string, string> = {
  primaryClues: "主要线索",
  corroboratingClues: "交叉验证",
  dashboardAnomalies: "仪表盘告警",
};
const cardColumnLabels: Record<PublicCard["column"], string> = {
  evidence_document: "项目文件",
  tool_technique: "工具与技术",
  stakeholder: "干系人",
};
const cardColumnOrder: PublicCard["column"][] = ["evidence_document", "tool_technique", "stakeholder"];
const gapCategoryLabels: Record<string, string> = {
  evidence: "证据识别",
  communication: "沟通",
  scope_governance: "范围治理",
  analysis: "影响分析",
  approval: "审批",
  execution_decision: "执行决策",
  documentation: "文件更新",
  connection: "行动连接",
  procurement: "采购管理",
  resource: "资源安排",
  quality: "质量控制",
  safety: "安全控制",
  governance: "治理",
  monitoring: "监控",
};
const objectiveEffectLabels: Record<string, string> = {
  requirement_ambiguity_open: "需求边界仍不明确",
  R01_remains_triggered: "R01 仍处于已触发状态",
  scope_classification_unclear: "范围内外分类仍不明确",
  ccb_package_invalid: "CCB 审查材料暂不完整",
  ccb_returned: "CCB 材料被退回补充",
  one_rework_round_required: "至少需要增加一个返工回合",
  change_decision_pending: "变更决策仍待审批",
  ccb_item_open: "CCB 待办仍保持开放",
  v1_0_v1_1_boundary_open: "V1.0 与 V1.1 边界尚未关闭",
  scope_conflict_forecast: "范围冲突预测仍存在",
  risk_reduced_not_closed: "风险有所降低但尚未关闭",
  pilot_engagement_gap_open: "试点车主参与差距仍存在",
  selected_management_actions_not_connected_into_a_complete_chain: "所选管理动作尚未连接为完整闭环",
};
const pathClassificationLabels: Record<string, string> = {
  near_mainline_success: "近主线成功",
  detour_success: "绕路成功",
  delayed_success: "延期成功",
  scenario_failure: "情景失败",
};
function emptyActionChainPools(): ActionChainPools {
  return { evidence_document: [], tool_technique: [], stakeholder: [] };
}

function actionChainCardIds(chain: ManagementActionChain, column: PublicCard["column"]): string[] {
  if (column === "evidence_document") return chain.documentCardIds;
  if (column === "tool_technique") return chain.toolTechniqueCardIds;
  return chain.stakeholderCardIds;
}

function cardDisplayId(card: PublicCard): string {
  const toolMatch = /^tool:(\d{3})$/.exec(card.referenceId);
  return toolMatch ? `T${toolMatch[1]}` : card.referenceId;
}

function GapCardGroups({ cards }: { cards: PublicCard[] }) {
  return (
    <div className="lab-v2-gap-card-groups">
      {cardColumnOrder.map((column) => {
        const columnCards = cards.filter((card) => card.column === column);
        if (!columnCards.length) return null;
        return (
          <section key={column}>
            <small>{cardColumnLabels[column]}</small>
            <div>{columnCards.map((card) => <span key={card.id}><b>{cardDisplayId(card)}</b>{card.title}</span>)}</div>
          </section>
        );
      })}
    </div>
  );
}
const engagementScores: Record<string, number> = {
  unaware: 1,
  resistant: 2,
  neutral: 3,
  supportive: 4,
  leading: 5,
};
const managementAreas: ManagementArea[] = [
  { id: "integration", index: "01", title: "项目整合管理", shortTitle: "整合", documentIds: ["D03", "D05", "D08", "D09", "D10", "D13"] },
  { id: "scope", index: "02", title: "项目范围管理", shortTitle: "范围", documentIds: ["D02", "D16", "D21", "D22"] },
  { id: "schedule", index: "03", title: "项目进度管理", shortTitle: "进度", documentIds: ["D01", "D02", "D04", "D07", "D10", "D12", "D14", "D15", "D28", "D29"] },
  { id: "cost", index: "04", title: "项目成本管理", shortTitle: "成本", documentIds: ["D04", "D06"] },
  { id: "quality", index: "05", title: "项目质量管理", shortTitle: "质量", documentIds: ["D18", "D19", "D20", "D32"] },
  { id: "resource", index: "06", title: "项目资源管理", shortTitle: "资源", documentIds: ["D11", "D17", "D23", "D24", "D25", "D31"] },
  { id: "communication", index: "07", title: "项目沟通管理", shortTitle: "沟通", documentIds: ["D08", "D13", "D30"] },
  { id: "risk", index: "08", title: "项目风险管理", shortTitle: "风险", documentIds: ["D03", "D08", "D26", "D27"] },
  { id: "procurement", index: "09", title: "项目采购管理", shortTitle: "采购", documentIds: ["D05", "D08", "D13", "D25"] },
  { id: "stakeholder", index: "10", title: "项目干系人管理", shortTitle: "干系人", documentIds: ["D13", "D30"] },
];
const dashboardTitles: Record<DashboardId, string> = {
  spi: "进度绩效指数 SPI",
  cpi: "成本绩效指数 CPI",
  bac: "项目预算 BAC",
  ac: "项目实际花费 AC",
  gantt: "里程碑甘特图",
  workload: "项目工作量",
  engagement: "干系人参与度",
  raci: "干系人 RACI 矩阵",
  "risk-matrix": "风险影响概率矩阵",
  requirements: "需求状态统计",
  burndown: "当前迭代燃尽图",
  ccb: "CCB 待办项状态",
  network: "时标网络图",
  wbs: "WBS",
  "risk-status": "风险状态统计",
};

function branchFromHash(): { branchId: string; scenarioId: string } | null {
  if (typeof window === "undefined") return null;
  const query = window.location.hash.split("?", 2)[1];
  if (!query) return null;
  const parameters = new URLSearchParams(query);
  const branchId = parameters.get("branch");
  const scenarioId = parameters.get("scenario");
  return branchId && scenarioId ? { branchId, scenarioId } : null;
}

function signIn() {
  window.location.href = `/signin-with-chatgpt?return_to=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`;
}

async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    signIn();
    throw new Error("需要登录后继续");
  }
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "请求失败，请稍后重试");
  return body;
}

function formatMoney(value: number): string {
  return `${(value / 10000).toFixed(value >= 1000000 ? 0 : 1)} 万`;
}

function formatDraftTime(value: string): string {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const timestamp = new Date(normalized);
  if (Number.isNaN(timestamp.getTime())) return "刚刚";
  return timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function projectStage(week: number): string {
  if (week <= 8) return "需求与范围基线";
  if (week <= 12) return "架构、接口与安全基线";
  if (week <= 20) return "核心能力开发";
  if (week <= 28) return "集成测试与试点";
  return "上线、移交与收尾";
}

function interpolateSeries(series: QualitySeries | undefined, week: number): number | boolean | null {
  if (!series) return null;
  const anchors = [...series.anchors].sort((left, right) => left.week - right.week);
  if (week < anchors[0].week) return null;
  const previous = [...anchors].reverse().find((anchor) => anchor.week <= week) ?? anchors[0];
  if (series.interpolation === "step" || typeof previous.value === "boolean") return previous.value;
  const next = anchors.find((anchor) => anchor.week > week);
  if (!next || typeof next.value !== "number" || typeof previous.value !== "number") return previous.value;
  const ratio = (week - previous.week) / (next.week - previous.week);
  return previous.value + (next.value - previous.value) * ratio;
}

function documentActions(event: DocumentEvent, documentId: string): string[] {
  return Object.entries(event)
    .filter(([, value]) => Array.isArray(value) && value.includes(documentId))
    .map(([key]) => key);
}

function documentStatus(document: ProjectDocument, events: DocumentEvent[], week: number): string {
  if (document.createdWeek > week) return "未创建";
  const history = events.filter((event) => event.week <= week && documentActions(event, document.id).length > 0);
  const actions = history.flatMap((event) => documentActions(event, document.id));
  if (actions.some((action) => action.toLowerCase().includes("archived"))) return "已归档";
  const latestActions = history.length ? documentActions(history[history.length - 1], document.id) : [];
  if (latestActions.some((action) => action.toLowerCase().includes("baseline"))) return "已基线";
  if (latestActions.some((action) => action.toLowerCase().includes("approved"))) return "已批准";
  if (latestActions.length > 0) return "已更新";
  return "已创建";
}

function riskSeverity(probability: number, impact: number): string {
  const score = probability * impact;
  if (score >= 17) return "极高";
  if (score >= 10) return "高";
  if (score >= 5) return "中";
  return "低";
}

function requirementStatus(requirement: RequirementItem, week: number): string {
  if (requirement.traceabilityStatus === "candidate_unplanned") return "候选";
  if (requirement.verifiedWeek !== undefined && requirement.verifiedWeek <= week) return "已验证";
  if (requirement.implementationCompletedWeek !== undefined && requirement.implementationCompletedWeek <= week) return "开发完成";
  if (requirement.baselinedWeek !== undefined && requirement.baselinedWeek <= week) return "已基线";
  return "分析中";
}

function changeStatus(change: ChangeItem, week: number): "pending" | "review" | "execution" | "verification" | "closed" {
  if (week < change.reviewWeek) return "pending";
  if (week < change.decisionWeek) return "review";
  if (week < change.implementationCompletedWeek) return "execution";
  if (week < change.closedWeek) return "verification";
  return "closed";
}

const changeStatusLabels = {
  pending: "待评审",
  review: "审查中",
  execution: "已批准待执行",
  verification: "待验证关闭",
  closed: "已关闭",
};

const changeDecisionLabels: Record<string, string> = {
  approved: "批准",
  approved_for_later_version: "纳入后续版本",
  approved_phased_delivery: "批准分阶段交付",
};

function Sparkline({ values, target = 1 }: { values: number[]; target?: number }) {
  const width = 220;
  const height = 62;
  const minimum = Math.min(...values, target) - 0.015;
  const maximum = Math.max(...values, target) + 0.015;
  const span = Math.max(maximum - minimum, 0.01);
  const points = values.map((value, index) => {
    const pointX = values.length === 1 ? width : (index / (values.length - 1)) * width;
    const pointY = height - ((value - minimum) / span) * height;
    return `${pointX.toFixed(1)},${pointY.toFixed(1)}`;
  }).join(" ");
  const targetY = height - ((target - minimum) / span) * height;
  return (
    <svg className="lab-v2-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="趋势图">
      <line x1="0" x2={width} y1={targetY} y2={targetY} />
      <polyline points={points} />
    </svg>
  );
}

function WorkloadBars({ weeks, selectedWeek }: { weeks: BaselineWeek[]; selectedWeek: number }) {
  const windowSize = 21;
  const startWeek = Math.min(Math.max(1, selectedWeek - 10), Math.max(1, weeks.length - windowSize + 1));
  const visibleWeeks = weeks.slice(startWeek - 1, startWeek - 1 + windowSize);
  const maximum = Math.max(...visibleWeeks.map((item) => item.plannedTeamPersonDays), 1);
  return (
    <div className="lab-v2-workload-bars">
      <div>{visibleWeeks.map((item) => (
        <i key={item.week} className={item.week === selectedWeek ? "current" : item.week < selectedWeek ? "past" : "future"} title={`W${item.week}：${item.plannedTeamPersonDays} 人日`}>
          <b style={{ height: `${Math.max(8, item.plannedTeamPersonDays / maximum * 100)}%` }} />
        </i>
      ))}</div>
      <footer><span>W{visibleWeeks[0]?.week}</span><strong>当前 W{selectedWeek}</strong><span>W{visibleWeeks.at(-1)?.week}</span></footer>
    </div>
  );
}

function SprintBurndown({ started, secondWeek }: { started: boolean; secondWeek: boolean }) {
  const width = 260;
  const height = 88;
  const horizontalPadding = 8;
  const topPadding = 8;
  const bottomPadding = 18;
  const chartWidth = width - horizontalPadding * 2;
  const chartHeight = height - topPadding - bottomPadding;
  const totalWork = 34;
  const x = (day: number) => horizontalPadding + day / 12 * chartWidth;
  const y = (remaining: number) => topPadding + (1 - remaining / totalWork) * chartHeight;
  const idealPath = `M ${x(0)} ${y(34)} L ${x(5)} ${y(17)} L ${x(7)} ${y(17)} L ${x(12)} ${y(0)}`;
  const checkpoints = [
    { day: 0, remaining: 34 },
    { day: 1, remaining: 31 },
    { day: 2, remaining: 28 },
    { day: 3, remaining: 24 },
    { day: 4, remaining: 20 },
    { day: 5, remaining: 17 },
    { day: 7, remaining: 17 },
    { day: 8, remaining: 13 },
    { day: 9, remaining: 10 },
    { day: 10, remaining: 7 },
    { day: 11, remaining: 3 },
    { day: 12, remaining: 0 },
  ];
  const elapsedDay = started ? secondWeek ? 12 : 5 : 0;
  const visibleCheckpoints = checkpoints.filter((point) => point.day <= elapsedDay);
  const actualPath = visibleCheckpoints.slice(1).reduce(
    (path, point) => `${path} H ${x(point.day)} V ${y(point.remaining)}`,
    `M ${x(visibleCheckpoints[0].day)} ${y(visibleCheckpoints[0].remaining)}`,
  );
  const currentPoint = visibleCheckpoints.at(-1) ?? checkpoints[0];

  return (
    <svg className="lab-v2-burndown" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="两周迭代燃尽图，虚线为理想燃尽，实线为实际阶梯燃尽">
      <path className="ideal" d={idealPath} />
      <path className="actual" d={actualPath} />
      <circle cx={x(currentPoint.day)} cy={y(currentPoint.remaining)} r="3" />
      <text x={x(0)} y={height - 3}>起点</text>
      <text className="weekend" x={(x(5) + x(7)) / 2} y={height - 3}>周末</text>
      <text className="end" x={x(12)} y={height - 3}>清零</text>
    </svg>
  );
}

function CcbMemberIndicator({ members }: { members: Stakeholder[] }) {
  return (
    <span className="lab-v2-ccb-members" role="img" aria-label={`CCB 核心成员：${members.map((member) => member.title).join("、")}`}>
      <span className="lab-v2-ccb-people" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => <i key={index} />)}
      </span>
      <span className="lab-v2-ccb-tooltip" role="tooltip">
        <b>CCB 核心成员</b>
        {members.map((member) => <span key={member.id}><strong>{member.title}</strong><small>{ccbDutyByStakeholderId[member.id]}</small></span>)}
        <em>测试、法务与隐私负责人按变更议题列席</em>
      </span>
    </span>
  );
}

type NetworkLayoutActivity = ScheduleActivity & NetworkActivity & {
  lane: number;
  rowY: number;
};

function WbsCards({ workPackages, activities }: {
  workPackages: WorkPackage[];
  activities: ScheduleActivity[];
}) {
  return (
    <div className="lab-v2-wbs-cards">
        {workPackages.map((workPackage) => {
          const packageActivities = activities.filter((activity) => activity.parentId === workPackage.id);
          return (
            <details key={workPackage.id}>
              <summary>
                <span><strong>{workPackage.id}</strong><small>{workPackage.title}</small></span>
                <i>W{workPackage.startWeek}–W{workPackage.endWeek}</i>
                <b>展开</b>
              </summary>
              <ol>
                {packageActivities.map((activity, activityIndex) => {
                  return (
                    <li key={activity.id}>
                      <b>{String(activityIndex + 1).padStart(2, "0")}</b>
                      <span>{activity.title}</span>
                      <i>W{activity.startWeek}–W{activity.endWeek}</i>
                    </li>
                  );
                })}
              </ol>
            </details>
          );
        })}
    </div>
  );
}

function TimeScaledNetwork({
  activities,
  network,
  workPackages,
  selectedWeek,
}: {
  activities: ScheduleActivity[];
  network: MainlineData["baselineWorkload"]["scheduleNetwork"];
  workPackages: WorkPackage[];
  selectedWeek: number;
}) {
  const labelWidth = 190;
  const weekWidth = 36;
  const laneHeight = 34;
  const groupGap = 12;
  const topOffset = 42;
  const [hoverCell, setHoverCell] = useState<{ week: number; groupId: string } | null>(null);
  const layout = useMemo(() => {
    const networkById = new Map(network.activities.map((activity) => [activity.activityId, activity]));
    const layoutActivities: NetworkLayoutActivity[] = [];
    const groupBounds: Array<{ id: string; title: string; top: number; bottom: number }> = [];
    let currentY = topOffset;

    for (const workPackage of workPackages) {
      const groupedActivities = activities
        .filter((activity) => activity.parentId === workPackage.id)
        .sort((left, right) => left.startWeek - right.startWeek || left.endWeek - right.endWeek);
      const laneEnds: number[] = [];
      const groupTop = currentY;

      for (const activity of groupedActivities) {
        const networkActivity = networkById.get(activity.id);
        if (!networkActivity) continue;
        let lane = laneEnds.findIndex((endWeek) => endWeek < activity.startWeek);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(activity.endWeek);
        } else {
          laneEnds[lane] = activity.endWeek;
        }
        layoutActivities.push({ ...activity, ...networkActivity, lane, rowY: currentY + lane * laneHeight });
      }

      const laneCount = Math.max(laneEnds.length, 1);
      currentY += laneCount * laneHeight;
      groupBounds.push({ id: workPackage.id, title: workPackage.title, top: groupTop, bottom: currentY });
      currentY += groupGap;
    }

    return { activities: layoutActivities, groups: groupBounds, height: currentY + 12 };
  }, [activities, network.activities, workPackages]);
  const layoutById = new Map(layout.activities.map((activity) => [activity.id, activity]));
  const totalWidth = labelWidth + weekWidth * 32 + 18;
  const weekX = (week: number) => labelWidth + (week - 1) * weekWidth;
  const hoveredGroup = hoverCell ? layout.groups.find((group) => group.id === hoverCell.groupId) : null;
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = (event.clientX - bounds.left) / bounds.width * totalWidth;
    const pointerY = (event.clientY - bounds.top) / bounds.height * layout.height;
    if (pointerX < labelWidth || pointerY < 28) {
      setHoverCell(null);
      return;
    }
    const week = Math.min(32, Math.max(1, Math.floor((pointerX - labelWidth) / weekWidth) + 1));
    const group = layout.groups.find((item) => pointerY >= item.top && pointerY <= item.bottom);
    if (!group) {
      setHoverCell(null);
      return;
    }
    setHoverCell((current) => current?.week === week && current.groupId === group.id ? current : { week, groupId: group.id });
  };

  return (
    <div className="lab-v2-network-scroll">
      <svg
        className="lab-v2-time-network"
        viewBox={`0 0 ${totalWidth} ${layout.height}`}
        role="img"
        aria-label="完整项目时标网络图"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverCell(null)}
      >
        <defs>
          <marker id="lab-v2-network-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" />
          </marker>
        </defs>
        <rect className="network-background" x="0" y="0" width={totalWidth} height={layout.height} />
        {hoverCell && hoveredGroup ? (
          <g className="network-hover-guides" aria-hidden="true">
            <rect className="horizontal" x="0" y={hoveredGroup.top} width={totalWidth} height={hoveredGroup.bottom - hoveredGroup.top} />
            <rect className="vertical" x={weekX(hoverCell.week)} y="28" width={weekWidth} height={layout.height - 28} />
          </g>
        ) : null}
        {Array.from({ length: 32 }, (_, index) => index + 1).map((week) => (
          <g key={week}>
            <text className={`network-week-label ${week === selectedWeek ? "selected" : ""} ${hoverCell?.week === week ? "hovered" : ""}`} x={weekX(week) + weekWidth / 2} y="20">W{week}</text>
          </g>
        ))}
        {layout.groups.map((group) => (
          <g key={group.id}>
            <text className={`network-group-id ${hoverCell?.groupId === group.id ? "hovered" : ""}`} x="8" y={group.top + 13}>{group.id}</text>
            <text className={`network-group-title ${hoverCell?.groupId === group.id ? "hovered" : ""}`} x="8" y={group.top + 28}>{group.title}</text>
          </g>
        ))}
        <g className="network-connections">
          {layout.activities.flatMap((activity) => (activity.predecessors ?? []).flatMap((predecessor) => {
            const predecessorActivity = layoutById.get(predecessor.activityId);
            if (!predecessorActivity) return [];
            const startX = weekX(predecessorActivity.endWeek) + weekWidth / 2;
            const startY = predecessorActivity.rowY + 13;
            const endX = weekX(activity.startWeek) + weekWidth / 2;
            const endY = activity.rowY + 13;
            const turnX = Math.max(startX + 10, (startX + endX) / 2);
            const critical = predecessorActivity.isCritical && activity.isCritical;
            return [<path key={`${predecessor.activityId}-${activity.id}`} className={critical ? "critical" : ""} d={`M ${startX} ${startY} L ${turnX} ${startY} L ${turnX} ${endY} L ${endX} ${endY}`} />];
          }))}
        </g>
        <g className="network-activities">
          {layout.activities.map((activity) => {
            const nodeX = weekX(activity.startWeek) + 2;
            const nodeWidth = Math.max(30, (activity.endWeek - activity.startWeek + 1) * weekWidth - 4);
            const completed = activity.endWeek < selectedWeek;
            const active = activity.startWeek <= selectedWeek && activity.endWeek >= selectedWeek;
            return (
              <g key={activity.id} className={`${activity.isCritical ? "critical" : ""} ${completed ? "completed" : active ? "active" : "planned"}`}>
                <title>{`${activity.id} ${activity.title}；W${activity.startWeek}–W${activity.endWeek}；ES ${activity.earliestStart} / EF ${activity.earliestFinish} / LS ${activity.latestStart} / LF ${activity.latestFinish} / TF ${activity.totalFloat} / FF ${activity.freeFloat}`}</title>
                <rect x={nodeX} y={activity.rowY} width={nodeWidth} height="26" rx="4" />
                <text x={nodeX + 7} y={activity.rowY + 17}>{completed ? "✓ " : active ? "● " : ""}{activity.id}</text>
                {!activity.isCritical && nodeWidth >= 80 ? <text className="network-float" x={nodeX + nodeWidth - 7} y={activity.rowY + 17}>TF {activity.totalFloat}</text> : null}
              </g>
            );
          })}
        </g>
        <line className="network-now-line" x1={weekX(selectedWeek) + weekWidth / 2} x2={weekX(selectedWeek) + weekWidth / 2} y1="28" y2={layout.height} />
      </svg>
    </div>
  );
}

function DashboardCard({
  id,
  eyebrow,
  title,
  value,
  note,
  className = "",
  interactiveChildren = false,
  titleAccessory,
  onOpen,
  children,
}: {
  id: DashboardId;
  eyebrow: string;
  title: string;
  value?: string;
  note?: string;
  className?: string;
  interactiveChildren?: boolean;
  titleAccessory?: ReactNode;
  onOpen: (id: DashboardId) => void;
  children?: ReactNode;
}) {
  if (interactiveChildren) {
    return (
      <article className={`lab-v2-widget ${className}`}>
        <header><span>{eyebrow}</span><button type="button" aria-label={`打开${title}详细数据`} onClick={() => onOpen(id)}>↗</button></header>
        {titleAccessory ? <div className="lab-v2-widget-title"><h3>{title}</h3>{titleAccessory}</div> : <h3>{title}</h3>}
        {value && <strong className="lab-v2-widget-value">{value}</strong>}
        {children}
        {note && <footer>{note}</footer>}
      </article>
    );
  }
  return (
    <button className={`lab-v2-widget ${className}`} onClick={() => onOpen(id)}>
      <header><span>{eyebrow}</span><b>↗</b></header>
      {titleAccessory ? <div className="lab-v2-widget-title"><h3>{title}</h3>{titleAccessory}</div> : <h3>{title}</h3>}
      {value && <strong className="lab-v2-widget-value">{value}</strong>}
      {children}
      {note && <footer>{note}</footer>}
    </button>
  );
}

export function LabTimelinePage() {
  const [manifest, setManifest] = useState<CaseManifest | null>(null);
  const [mainline, setMainline] = useState<MainlineData | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedWidget, setSelectedWidget] = useState<DashboardId | null>(null);
  const [requirementPriorityFilter, setRequirementPriorityFilter] = useState<"ALL" | RequirementItem["priority"]>("ALL");
  const [riskDetailFilter, setRiskDetailFilter] = useState<"ALL" | "OPEN" | "HIGH" | "CLOSED">("ALL");
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState("D14");
  const [managementFilter, setManagementFilter] = useState<string | null>(null);
  const [branch, setBranch] = useState<BranchContext | null>(null);
  const [branchState, setBranchState] = useState<BranchState | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarioTitle, setScenarioTitle] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialList | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<OpenedMaterial | null>(null);
  const [cards, setCards] = useState<PublicCard[]>([]);
  const [actionChains, setActionChains] = useState<ManagementActionChain[]>([]);
  const [actionTarget, setActionTarget] = useState("");
  const [actionChainPools, setActionChainPools] = useState<ActionChainPools>(emptyActionChainPools);
  const [editingActionChainId, setEditingActionChainId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [draftLoadedKey, setDraftLoadedKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [submittingRound, setSubmittingRound] = useState(false);
  const [loadingScenarioId, setLoadingScenarioId] = useState<string | null>(null);
  const [openingMaterialId, setOpeningMaterialId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compactTimelineVisible, setCompactTimelineVisible] = useState(false);
  const idempotencyKeys = useRef(new Map<string, string>());
  const roundIdempotencyKeys = useRef(new Map<string, string>());
  const draftLoadingKeyRef = useRef<string | null>(null);
  const timelinePanelRef = useRef<HTMLElement | null>(null);

  const loadMaterials = async (branchId: string, nextScenarioId: string) => {
    const list = await apiJson<MaterialList>(
      `/api/lab/branches/${encodeURIComponent(branchId)}/scenarios/${encodeURIComponent(nextScenarioId)}/materials`,
    );
    setMaterials(list);
    if (list.cardsUnlocked) {
      const projection = await apiJson<{ branch: BranchContext; scenario: { cards: PublicCard[]; title: string }; state: BranchState | null; lastRoundResult: RoundResult | null }>(
        `/api/lab/branches/${encodeURIComponent(branchId)}/scenarios/${encodeURIComponent(nextScenarioId)}/projection`,
      );
      setBranch(projection.branch);
      setBranchState(projection.state);
      setRoundResult(projection.lastRoundResult);
      setSelectedWeek(projection.branch.currentWeek);
      setCards(projection.scenario.cards);
      setScenarioTitle(projection.scenario.title);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const [nextManifest, mainlineResponse] = await Promise.all([
          apiJson<CaseManifest>(`/api/lab/cases/${caseId}/${caseVersion}`),
          apiJson<MainlineResponse>(`/api/lab/cases/${caseId}/${caseVersion}/mainline?sections=${mainlineSections}`),
        ]);
        if (cancelled) return;
        setManifest(nextManifest);
        setMainline(mainlineResponse.sections);
        const restored = branchFromHash();
        if (!restored) return;
        const projection = await apiJson<{ branch: BranchContext; scenario: { title: string; cards: PublicCard[] }; state: BranchState | null; lastRoundResult: RoundResult | null }>(
          `/api/lab/branches/${encodeURIComponent(restored.branchId)}/scenarios/${encodeURIComponent(restored.scenarioId)}/projection`,
        );
        if (cancelled) return;
        setBranch(projection.branch);
        setBranchState(projection.state);
        setRoundResult(projection.lastRoundResult);
        setSelectedWeek(projection.branch.currentWeek);
        setScenarioId(restored.scenarioId);
        setScenarioTitle(projection.scenario.title);
        setCards(projection.scenario.cards);
        await loadMaterials(restored.branchId, restored.scenarioId);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "无法加载项目实验室");
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.matches("input, textarea, select")) return;
      event.preventDefault();
      const weekDelta = event.key === "ArrowLeft" ? -1 : 1;
      setSelectedWeek((currentWeek) => Math.min(manifest?.totalWeeks ?? 32, Math.max(1, currentWeek + weekDelta)));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [manifest?.totalWeeks]);

  useEffect(() => {
    const updateCompactTimeline = () => {
      const timelinePanel = timelinePanelRef.current;
      if (!timelinePanel) {
        setCompactTimelineVisible(false);
        return;
      }
      const stickyTop = window.innerWidth <= 660 ? 0 : 68;
      setCompactTimelineVisible(timelinePanel.getBoundingClientRect().bottom <= stickyTop);
    };
    updateCompactTimeline();
    window.addEventListener("scroll", updateCompactTimeline, { passive: true });
    window.addEventListener("resize", updateCompactTimeline);
    return () => {
      window.removeEventListener("scroll", updateCompactTimeline);
      window.removeEventListener("resize", updateCompactTimeline);
    };
  }, [mainline]);

  const takeover = async (point: TakeoverPoint) => {
    setSelectedWeek(point.week);
    setLoadingScenarioId(point.scenarioId);
    setError(null);
    try {
      let idempotencyKey = idempotencyKeys.current.get(point.scenarioId);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        idempotencyKeys.current.set(point.scenarioId, idempotencyKey);
      }
      const created = await apiJson<BranchCreation>(`/api/lab/cases/${caseId}/${caseVersion}/branches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId: point.scenarioId, idempotencyKey }),
      });
      setBranch(created.branch);
      setBranchState(null);
      setScenarioId(created.scenario.id);
      setScenarioTitle(created.scenario.title);
      setSelectedMaterial(null);
      setCards([]);
      setActionChains([]);
      setActionTarget("");
      setActionChainPools(emptyActionChainPools());
      setEditingActionChainId(null);
      setDraftLoadedKey(null);
      draftLoadingKeyRef.current = null;
      setDraftStatus("idle");
      setDraftUpdatedAt(null);
      setActionMessage(null);
      setRoundResult(null);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#lab-schedule?branch=${encodeURIComponent(created.branch.id)}&scenario=${encodeURIComponent(created.scenario.id)}`,
      );
      await loadMaterials(created.branch.id, created.scenario.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法创建个人分支");
    } finally {
      setLoadingScenarioId(null);
    }
  };

  const openMaterial = async (material: MaterialSummary) => {
    if (!branch || !scenarioId) return;
    setOpeningMaterialId(material.id);
    setError(null);
    try {
      const opened = await apiJson<{
        material: OpenedMaterial;
        openedCount: number;
        totalCount: number;
        cardsUnlocked: boolean;
        cards: PublicCard[];
      }>(
        `/api/lab/branches/${encodeURIComponent(branch.id)}/scenarios/${encodeURIComponent(scenarioId)}/materials/${encodeURIComponent(material.id)}/view`,
        { method: "POST" },
      );
      setSelectedMaterial(opened.material);
      setMaterials((current) => current ? {
        ...current,
        openedCount: opened.openedCount,
        totalCount: opened.totalCount,
        cardsUnlocked: opened.cardsUnlocked,
        materials: current.materials.map((item) => item.id === material.id ? { ...item, opened: true } : item),
      } : current);
      if (opened.cardsUnlocked) setCards(opened.cards);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法打开材料");
    } finally {
      setOpeningMaterialId(null);
    }
  };

  const weekState = useMemo(() => {
    const baselineWeek = mainline?.baselineWorkload.weeks.find((item) => item.week === selectedWeek) ?? null;
    if (!baselineWeek || !branch || !branchState || selectedWeek !== branch.currentWeek) return baselineWeek;
    return {
      ...baselineWeek,
      cumulativePlannedValueCny: branchState.performance.cumulativePlannedValueCny,
      cumulativeEarnedValueCny: branchState.performance.cumulativeEarnedValueCny,
      cumulativeActualCostCny: branchState.performance.cumulativeActualCostCny,
      spi: branchState.performance.spi,
      cpi: branchState.performance.cpi,
    };
  }, [branch, branchState, mainline, selectedWeek]);
  const visibleWeeks = useMemo(() => mainline?.baselineWorkload.weeks.filter((item) => item.week <= selectedWeek) ?? [], [mainline, selectedWeek]);
  const activeWorkPackages = useMemo(() => mainline?.workload.workPackages.filter((item) => item.startWeek <= selectedWeek && item.endWeek >= selectedWeek) ?? [], [mainline, selectedWeek]);
  const activeActivities = useMemo(() => mainline?.schedule.activities.filter((item) => item.startWeek <= selectedWeek && item.endWeek >= selectedWeek) ?? [], [mainline, selectedWeek]);
  const currentTakeoverPoint = manifest?.takeoverPoints.find((point) => point.week === selectedWeek) ?? null;
  const currentWeekHasLabel = milestones.some((milestone) => milestone.week === selectedWeek)
    || manifest?.takeoverPoints.some((point) => point.week === selectedWeek);

  const stakeholderState = useMemo(() => {
    if (!mainline) return [];
    const currentById = new Map(mainline.stakeholders.stakeholders.map((item) => [item.id, item.initialEngagement.current]));
    for (const event of mainline.stakeholders.mainlineEngagementEvents.filter((item) => item.week <= selectedWeek)) {
      currentById.set(event.stakeholderId, event.current);
    }
    if (branch && branchState && selectedWeek === branch.currentWeek) {
      for (const transition of branchState.stakeholderTransitions) {
        if (typeof transition.stakeholderId === "string" && typeof transition.state === "string") {
          currentById.set(transition.stakeholderId, transition.state);
        }
      }
    }
    return mainline.stakeholders.stakeholders.map((item) => ({ ...item, current: currentById.get(item.id) ?? item.initialEngagement.current }));
  }, [branch, branchState, mainline, selectedWeek]);

  const engagementPercent = useMemo(() => {
    if (!stakeholderState.length) return 0;
    const score = stakeholderState.reduce((sum, item) => sum + (engagementScores[item.current] ?? 1), 0);
    return Math.round(score / (stakeholderState.length * 5) * 100);
  }, [stakeholderState]);

  const riskState = useMemo(() => {
    if (!mainline) return [];
    const lifecycleById = new Map(mainline.risks.initialRisks.map((risk) => [risk.id, "identified"]));
    for (const event of mainline.risks.mainlineLifecycleEvents.filter((item) => item.week <= selectedWeek)) {
      for (const riskId of event.riskIds) lifecycleById.set(riskId, event.toLifecycleState);
    }
    if (branch && branchState && selectedWeek === branch.currentWeek) {
      for (const transition of branchState.riskTransitions) {
        if (typeof transition.riskId === "string" && typeof transition.toLifecycleState === "string") {
          lifecycleById.set(transition.riskId, transition.toLifecycleState);
        }
      }
    }
    return mainline.risks.initialRisks
      .filter((risk) => risk.discoveredWeek <= selectedWeek)
      .map((risk) => ({
        ...risk,
        lifecycle: lifecycleById.get(risk.id) ?? "identified",
        currentAssessment: risk.responseCompletedWeek <= selectedWeek ? risk.residual : risk.inherent,
      }));
  }, [branch, branchState, mainline, selectedWeek]);

  const requirementState = useMemo(() => {
    if (!mainline) return [];
    return mainline.requirements.requirements.filter((requirement) => requirement.discoveredWeek <= selectedWeek);
  }, [mainline, selectedWeek]);

  const allDocumentEvents = useMemo(() => {
    if (!mainline) return [];
    return [...mainline.documents.mainlineEvents, ...mainline.documents.contentRevisions].sort((left, right) => left.week - right.week);
  }, [mainline]);

  const documentState = useMemo(() => {
    if (!mainline) return [];
    return mainline.documents.documents.map((document) => {
      const history = allDocumentEvents.filter((event) => event.week <= selectedWeek && documentActions(event, document.id).length > 0);
      const branchUpdated = Boolean(branch && branchState && selectedWeek === branch.currentWeek && branchState.documentRevisions.includes(document.id));
      const visibleHistory = branchUpdated
        ? [...history, { id: `branch-${branch?.currentRoundNumber ?? 0}-${document.id}`, week: branch?.currentWeek ?? selectedWeek, reason: "个人分支回合结算更新" }]
        : history;
      return {
        ...document,
        status: branchUpdated ? "分支已更新" : documentStatus(document, allDocumentEvents, selectedWeek),
        history: visibleHistory,
        version: document.createdWeek <= selectedWeek ? 1 + visibleHistory.length : 0,
      };
    });
  }, [allDocumentEvents, branch, branchState, mainline, selectedWeek]);

  const selectedDocument = documentState.find((document) => document.id === selectedDocumentId) ?? documentState[0];
  const relatedDocumentIds = useMemo(() => {
    if (!mainline || !selectedDocument) return new Set<string>();
    return new Set(mainline.documents.relations
      .filter((relation) => relation.effectiveWeek <= selectedWeek && (relation.fromDocumentId === selectedDocument.id || relation.toDocumentId === selectedDocument.id))
      .flatMap((relation) => [relation.fromDocumentId, relation.toDocumentId]));
  }, [mainline, selectedDocument, selectedWeek]);
  const filteredDocuments = managementFilter
    ? documentState.filter((document) => managementAreas.find((area) => area.id === managementFilter)?.documentIds.includes(document.id))
    : documentState;

  const cardsByColumn = useMemo(() => Object.fromEntries(
    Object.keys(cardColumnLabels).map((column) => [column, cards.filter((card) => card.column === column)]),
  ) as Record<PublicCard["column"], PublicCard[]>, [cards]);
  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const draftKey = branch && scenarioId ? `${branch.id}:${branch.currentRoundNumber + 1}:${scenarioId}` : null;

  useEffect(() => {
    if (!branch || branch.status !== "active" || !scenarioId || !materials?.cardsUnlocked || cards.length === 0 || !draftKey) return;
    if (draftLoadedKey === draftKey || draftLoadingKeyRef.current === draftKey) return;
    draftLoadingKeyRef.current = draftKey;
    setDraftStatus("loading");
    const loadDraft = async () => {
      try {
        const draft = await apiJson<RoundDraft>(
          `/api/lab/branches/${encodeURIComponent(branch.id)}/scenarios/${encodeURIComponent(scenarioId)}/draft`,
        );
        setActionChains(draft.actionChains);
        setActionTarget("");
        setActionChainPools(emptyActionChainPools());
        setEditingActionChainId(null);
        setDraftUpdatedAt(draft.updatedAt);
        setDraftLoadedKey(draftKey);
        setDraftStatus("saved");
      } catch (caught) {
        setDraftStatus("error");
        setActionMessage(caught instanceof Error ? caught.message : "无法读取行动链草稿");
      } finally {
        draftLoadingKeyRef.current = null;
      }
    };
    void loadDraft();
  }, [branch, cards, draftKey, draftLoadedKey, materials?.cardsUnlocked, scenarioId]);

  useEffect(() => {
    if (!branch || branch.status !== "active" || !scenarioId || !draftKey || draftLoadedKey !== draftKey || !materials?.cardsUnlocked) return;
    const saveTimer = window.setTimeout(() => {
      setDraftStatus("saving");
      void apiJson<RoundDraft>(
        `/api/lab/branches/${encodeURIComponent(branch.id)}/scenarios/${encodeURIComponent(scenarioId)}/draft`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedRoundNumber: branch.currentRoundNumber + 1,
            actionChains,
          }),
        },
      ).then((saved) => {
        setDraftUpdatedAt(saved.updatedAt);
        setDraftStatus("saved");
      }).catch((caught) => {
        setDraftStatus("error");
        setActionMessage(caught instanceof Error ? caught.message : "行动链草稿保存失败");
      });
    }, 700);
    return () => window.clearTimeout(saveTimer);
  }, [actionChains, branch, draftKey, draftLoadedKey, materials?.cardsUnlocked, scenarioId]);

  const toggleCardSelection = (card: PublicCard) => {
    setActionMessage(null);
    setActionChainPools((current) => ({
      ...current,
      [card.column]: current[card.column].includes(card.id)
        ? current[card.column].filter((cardId) => cardId !== card.id)
        : [...current[card.column], card.id],
    }));
  };

  const resetActionChainEditor = () => {
    setActionTarget("");
    setActionChainPools(emptyActionChainPools());
    setEditingActionChainId(null);
    setActionMessage(null);
  };

  const confirmActionChain = () => {
    const title = actionTarget.trim();
    if (!title) {
      setActionMessage("请先写清这条行动链要解决的行动目标。");
      return;
    }
    if (cardColumnOrder.some((column) => actionChainPools[column].length === 0)) {
      setActionMessage("每条行动链都需要至少 1 个项目文件、1 个工具与技术和 1 个干系人。");
      return;
    }
    const chain: ManagementActionChain = {
      id: editingActionChainId ?? `chain-${crypto.randomUUID()}`,
      title,
      documentCardIds: actionChainPools.evidence_document,
      toolTechniqueCardIds: actionChainPools.tool_technique,
      stakeholderCardIds: actionChainPools.stakeholder,
    };
    setActionChains((current) => editingActionChainId
      ? current.map((item) => item.id === editingActionChainId ? chain : item)
      : [...current, chain]);
    resetActionChainEditor();
  };

  const editActionChain = (chain: ManagementActionChain) => {
    setActionTarget(chain.title);
    setActionChainPools({
      evidence_document: chain.documentCardIds,
      tool_technique: chain.toolTechniqueCardIds,
      stakeholder: chain.stakeholderCardIds,
    });
    setEditingActionChainId(chain.id);
    setActionMessage(null);
  };

  const duplicateActionChain = (chain: ManagementActionChain) => {
    const duplicate = {
      ...chain,
      id: `chain-${crypto.randomUUID()}`,
      title: `${chain.title.slice(0, 76)}（副本）`,
      documentCardIds: [...chain.documentCardIds],
      toolTechniqueCardIds: [...chain.toolTechniqueCardIds],
      stakeholderCardIds: [...chain.stakeholderCardIds],
    };
    setActionChains((current) => {
      const index = current.findIndex((item) => item.id === chain.id);
      const next = [...current];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  };

  const moveActionChain = (chainId: string, direction: -1 | 1) => {
    setActionChains((current) => {
      const index = current.findIndex((chain) => chain.id === chainId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      return reordered;
    });
  };

  const removeActionChain = (chainId: string) => {
    setActionChains((current) => current.filter((chain) => chain.id !== chainId));
    if (editingActionChainId === chainId) resetActionChainEditor();
  };

  const actionChainComplete = actionChains.length > 0;
  const actionChainEditorComplete = actionTarget.trim().length > 0
    && cardColumnOrder.every((column) => actionChainPools[column].length > 0);
  const draftReady = actionChainComplete;

  const submitActionChain = async () => {
    if (!branch || !scenarioId || !draftReady || submittingRound || branch.status !== "active") return;
    const roundNumber = branch.currentRoundNumber + 1;
    const keyScope = `${branch.id}:${roundNumber}`;
    let idempotencyKey = roundIdempotencyKeys.current.get(keyScope);
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      roundIdempotencyKeys.current.set(keyScope, idempotencyKey);
    }
    setSubmittingRound(true);
    setActionMessage(null);
    try {
      const result = await apiJson<RoundResult>(`/api/lab/branches/${encodeURIComponent(branch.id)}/rounds`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          expectedRoundNumber: roundNumber,
          idempotencyKey,
          actionChains,
        }),
      });
      const nextStatus = result.scenarioState === "open" ? "active" : result.scenarioState === "closed" ? "completed" : "failed";
      setRoundResult(result);
      setBranch((current) => current ? {
        ...current,
        currentWeek: result.advancedToWeek,
        currentRoundNumber: result.roundNumber,
        status: nextStatus,
      } : current);
      setBranchState(result.stateSnapshot);
      setSelectedWeek(result.advancedToWeek);
      setDraftLoadedKey(null);
      draftLoadingKeyRef.current = null;
      setDraftStatus("idle");
      setDraftUpdatedAt(null);
      if (result.scenarioState === "open") {
        setActionChains([]);
        resetActionChainEditor();
      }
    } catch (caught) {
      setActionMessage(caught instanceof Error ? caught.message : "行动链提交失败，请重试");
    } finally {
      setSubmittingRound(false);
    }
  };

  if (!mainline || !manifest || !weekState) {
    return <main className="lab-v2-page"><div className="lab-v2-loading"><i /><strong>正在装载 32 周项目主线</strong><span>读取绩效、风险、干系人与项目文件状态…</span></div></main>;
  }

  const progressPercent = weekState.cumulativeEarnedValueCny / mainline.workload.budgetAtCompletionCny * 100;
  const completedRiskCount = riskState.filter((risk) => risk.lifecycle === "closed").length;
  const openRiskCount = riskState.length - completedRiskCount;
  const blockerDefects = interpolateSeries(mainline.quality.mainlineSeries.find((series) => series.metricId === "blocker_defects"), selectedWeek);
  const requirementTotal = requirementState.length;
  const requirementBaselined = requirementState.filter((requirement) => requirement.baselinedWeek !== undefined && requirement.baselinedWeek <= selectedWeek).length;
  const requirementCompleted = requirementState.filter((requirement) => requirement.implementationCompletedWeek !== undefined && requirement.implementationCompletedWeek <= selectedWeek).length;
  const requirementVerified = requirementState.filter((requirement) => requirement.verifiedWeek !== undefined && requirement.verifiedWeek <= selectedWeek).length;
  const requirementCandidates = requirementState.filter((requirement) => requirement.traceabilityStatus === "candidate_unplanned").length;
  const nextGate = milestones.find((milestone) => milestone.week > selectedWeek);
  const stakeholderById = new Map(mainline.stakeholders.stakeholders.map((stakeholder) => [stakeholder.id, stakeholder]));
  const stakeholderNames = (stakeholderIds: string[]) => stakeholderIds.map((stakeholderId) => stakeholderById.get(stakeholderId)?.title ?? stakeholderId);
  const ccbMembers = mainline.documents.changeControlBoard.memberStakeholderIds.map((stakeholderId) => stakeholderById.get(stakeholderId)).filter((stakeholder): stakeholder is Stakeholder => Boolean(stakeholder));
  const visibleChangeItems = mainline.documents.changeItems
    .filter((change) => change.submittedWeek <= selectedWeek)
    .map((change) => ({ ...change, currentStatus: changeStatus(change, selectedWeek) }));
  const openChangeItems = visibleChangeItems.filter((change) => change.currentStatus !== "closed");
  const closedChangeItems = visibleChangeItems.filter((change) => change.currentStatus === "closed");
  const latestChangeItem = visibleChangeItems.at(-1);
  const visibleIssues = mainline.documents.issues.filter((issue) => issue.discoveredWeek <= selectedWeek);
  const visibleTestRounds = mainline.documents.testRounds.filter((testRound) => testRound.executionWeek <= selectedWeek);
  const requirementDetailItems = requirementState.filter((requirement) => requirementPriorityFilter === "ALL" || requirement.priority === requirementPriorityFilter);
  const riskDetailItems = riskState.filter((risk) => {
    if (riskDetailFilter === "OPEN") return risk.lifecycle !== "closed";
    if (riskDetailFilter === "CLOSED") return risk.lifecycle === "closed";
    if (riskDetailFilter === "HIGH") return risk.lifecycle !== "closed" && risk.currentAssessment.probability * risk.currentAssessment.impact >= 10;
    return true;
  });
  const currentSprintNumber = selectedWeek < 9 ? 0 : Math.min(10, Math.floor((selectedWeek - 9) / 2) + 1);
  const sprintProgress = selectedWeek < 9 ? 0 : ((selectedWeek - 9) % 2 + 1) / 2;
  const sprintRemaining = Math.round(34 * (1 - sprintProgress));
  const primaryWorkPackageId = Object.entries(weekState.workPackagePersonDays)
    .filter(([workPackageId, personDays]) => workPackageId !== "WBS-1.0" && personDays > 0)
    .sort((left, right) => right[1] - left[1])[0]?.[0]
    ?? activeWorkPackages.find((item) => item.id !== "WBS-1.0")?.id
    ?? activeWorkPackages[0]?.id;
  const currentRaci = mainline.stakeholders.workPackageRaci.find((row) => row.workPackageId === primaryWorkPackageId) ?? mainline.stakeholders.workPackageRaci[0];
  const currentRaciWorkPackage = mainline.workload.workPackages.find((item) => item.id === currentRaci.workPackageId);
  const criticalNow = mainline.baselineWorkload.scheduleNetwork.activities.filter((activity) => activity.isCritical && activity.earliestStart <= selectedWeek && activity.earliestFinish >= selectedWeek);
  const dashboardDetailFacts: Record<DashboardId, string[]> = {
    spi: [`当前 SPI ${weekState.spi.toFixed(3)}`, `累计挣值 ${formatMoney(weekState.cumulativeEarnedValueCny)}`, `累计计划价值 ${formatMoney(weekState.cumulativePlannedValueCny)}`],
    cpi: [`当前 CPI ${weekState.cpi.toFixed(3)}`, `累计实际成本 ${formatMoney(weekState.cumulativeActualCostCny)}`, `BAC ${formatMoney(mainline.workload.budgetAtCompletionCny)}`],
    bac: [`批准预算 ${formatMoney(mainline.workload.budgetAtCompletionCny)}`, `当前完成度 ${progressPercent.toFixed(1)}%`, `预算基线贯穿 W1–W32`],
    ac: [`累计 AC ${formatMoney(weekState.cumulativeActualCostCny)}`, `本周团队投入 ${weekState.plannedTeamPersonDays} 人日`, `剩余预算 ${formatMoney(mainline.workload.budgetAtCompletionCny - weekState.cumulativeActualCostCny)}`],
    gantt: [`当前活跃工作包 ${activeWorkPackages.length} 个`, `当前活跃活动 ${activeActivities.length} 项`, `下一阶段门 ${nextGate ? `W${nextGate.week} ${nextGate.label}` : "项目已收尾"}`],
    workload: [`全项目计划工作量 ${mainline.baselineWorkload.totalPlannedPersonDays} 人日`, `本周计划 ${weekState.plannedTeamPersonDays} 人日`, `当前投入峰值 ${Math.max(...visibleWeeks.map((item) => item.plannedTeamPersonDays))} 人日/周`],
    engagement: [`总体参与度 ${engagementPercent}%`, `领先参与 ${stakeholderState.filter((item) => item.current === "leading").length} 人`, `支持参与 ${stakeholderState.filter((item) => item.current === "supportive").length} 人`],
    raci: [`当前工作包 ${currentRaci.workPackageId}`, `A：${stakeholderNames(currentRaci.A).join("、")}`, `R：${stakeholderNames(currentRaci.R).join("、")}`],
    "risk-matrix": [`本周累计发现 ${riskState.length} 项`, `开放风险 ${openRiskCount} 项，已关闭 ${completedRiskCount} 项`, `高影响开放风险 ${riskState.filter((risk) => risk.lifecycle !== "closed" && risk.currentAssessment.impact >= 4).length} 项`],
    requirements: [`当前已发现需求 ${requirementTotal} 项`, `已基线 ${requirementBaselined}，候选 ${requirementCandidates}`, `开发完成 ${requirementCompleted}，已验证 ${requirementVerified}`, `阻断缺陷 ${typeof blockerDefects === "number" ? Math.round(blockerDefects) : 0} 个`],
    burndown: [currentSprintNumber ? `当前 S${currentSprintNumber}` : "尚未进入迭代", `迭代剩余 ${sprintRemaining} 点`, `当前周 W${selectedWeek}`],
    ccb: [`累计变更 ${visibleChangeItems.length} 项`, `当前待办 ${openChangeItems.length} 项`, `已关闭 ${closedChangeItems.length} 项`, latestChangeItem ? `最近决议：${changeDecisionLabels[latestChangeItem.decision]}` : "尚无变更请求"],
    network: [`当前关键活动 ${criticalNow.length} 项`, `关键活动总数 ${mainline.baselineWorkload.scheduleNetwork.criticalActivityIds.length}`, `主线预测完工 W${mainline.baselineWorkload.scheduleNetwork.calculatedProjectFinishWeek}`],
    wbs: [`工作包总数 ${mainline.workload.workPackages.length}`, `进行中 ${activeWorkPackages.length}`, `已完成 ${mainline.workload.workPackages.filter((item) => item.endWeek < selectedWeek).length}`],
    "risk-status": [`累计发现风险 ${riskState.length} 项`, `监控中 ${riskState.filter((risk) => risk.lifecycle === "monitoring").length} 项`, `已关闭 ${completedRiskCount} 项`, `本周新增 ${riskState.filter((risk) => risk.discoveredWeek === selectedWeek).length} 项`],
  };

  return (
    <main className="lab-v2-page">
      <section className="lab-v2-project-head">
        <div>
          <span>PROJECT LAB / LEARNING MODE</span>
          <h1>车主远程控车应用项目</h1>
          <p>完整主线回放 · 8 人团队 · 32 周 · BAC 260 万</p>
        </div>
        <div className="lab-v2-head-status">
          <span>当前观察位置</span>
          <strong>W{selectedWeek.toString().padStart(2, "0")}</strong>
          <small>{projectStage(selectedWeek)}</small>
        </div>
      </section>

      <section ref={timelinePanelRef} className="lab-v2-timeline-panel" aria-label="项目主线进度条">
        <header>
          <div><span>MAINLINE / 最短成功路径</span><strong>拖动进度条，观察项目状态与文件版本同步变化</strong></div>
          <div className="lab-v2-playback-status"><i />主线回放 · ← → 切换周</div>
        </header>
        <div className="lab-v2-range-wrap">
          <div className="lab-v2-range-fill" style={{ width: `${((selectedWeek - 1) / 31) * 100}%` }} />
          <input
            type="range"
            min="1"
            max="32"
            step="1"
            value={selectedWeek}
            onChange={(event) => setSelectedWeek(Number(event.target.value))}
            aria-label="项目周次"
          />
          {milestones.map((milestone) => (
            <button
              key={milestone.week}
              className={`lab-v2-milestone ${selectedWeek >= milestone.week ? "passed" : ""}`}
              style={{ left: `${((milestone.week - 1) / 31) * 100}%` }}
              onClick={() => setSelectedWeek(milestone.week)}
            >
              <i /><span>W{milestone.week}</span><small>{milestone.label}</small>
            </button>
          ))}
          {manifest.takeoverPoints.map((point) => (
            <button
              key={point.scenarioId}
              className={`lab-v2-takeover-marker ${selectedWeek === point.week ? "active" : ""}`}
              style={{ left: `${((point.week - 1) / 31) * 100}%` }}
              onClick={() => setSelectedWeek(point.week)}
              aria-label={`查看第${point.week}周接手点`}
            >
              <span>接手点</span><b>W{point.week}</b>
            </button>
          ))}
          {!currentWeekHasLabel && (
            <div className="lab-v2-current-week-label" style={{ left: `${((selectedWeek - 1) / 31) * 100}%` }}>
              <b>W{selectedWeek}</b>
            </div>
          )}
        </div>
        <div className="lab-v2-timeline-meta">
          <span>W01</span>
          <strong>{progressPercent.toFixed(1)}% 项目价值已完成</strong>
          <span>W32</span>
        </div>
        {currentTakeoverPoint && !branch && (
          <div className="lab-v2-takeover-callout">
            <div><span>SCENARIO AVAILABLE</span><strong>{scenarioLabels[currentTakeoverPoint.scenarioId]}</strong><small>在 W{currentTakeoverPoint.week} 复制主线状态，建立你的个人分支。</small></div>
            <button disabled={loadingScenarioId !== null} onClick={() => void takeover(currentTakeoverPoint)}>
              {loadingScenarioId === currentTakeoverPoint.scenarioId ? "正在创建分支…" : "从这里接手 →"}
            </button>
          </div>
        )}
      </section>

      {compactTimelineVisible && (
        <section className="lab-v2-compact-timeline" aria-label={`吸顶项目时间轴，当前第 ${selectedWeek} 周`}>
          <span>W01</span>
          <div>
            <i style={{ width: `${((selectedWeek - 1) / 31) * 100}%` }} />
            <input
              type="range"
              min="1"
              max="32"
              step="1"
              value={selectedWeek}
              onChange={(event) => setSelectedWeek(Number(event.target.value))}
              aria-label="吸顶项目周次"
            />
            {milestones.slice(1, -1).map((milestone) => (
              <button
                key={milestone.week}
                className={selectedWeek >= milestone.week ? "passed" : ""}
                style={{ left: `${((milestone.week - 1) / 31) * 100}%` }}
                onClick={() => setSelectedWeek(milestone.week)}
                aria-label={`跳转到 W${milestone.week} ${milestone.label}`}
              >
                <i /><span>{milestone.label}</span>
              </button>
            ))}
            <mark style={{ left: `${((selectedWeek - 1) / 31) * 100}%` }}>
              {selectedWeek !== 1 && selectedWeek !== 32 ? <b>W{selectedWeek}</b> : null}
            </mark>
          </div>
          <span>W32</span>
        </section>
      )}

      {error && <div className="lab-v2-error" role="alert"><strong>暂时无法继续</strong><span>{error}</span></div>}

      <section className="lab-v2-dashboard-heading">
        <div><span>PROJECT CONTROL CENTER</span><h2>项目总仪表盘</h2></div>
        <p>所有指标均为主线在 W{selectedWeek} 的状态。点击任一仪表查看详细数据。</p>
      </section>

      <section className="lab-v2-dashboard-grid">
        <DashboardCard id="spi" eyebrow="EARNED VALUE" title="SPI" value={weekState.spi.toFixed(3)} note={weekState.spi >= 1 ? "进度符合基线" : "轻微落后，主线可控"} onOpen={setSelectedWidget}>
          <Sparkline values={visibleWeeks.map((item) => item.spi)} />
        </DashboardCard>
        <DashboardCard id="cpi" eyebrow="EARNED VALUE" title="CPI" value={weekState.cpi.toFixed(3)} note={weekState.cpi >= 1 ? "成本效率良好" : "成本效率需关注"} onOpen={setSelectedWidget}>
          <Sparkline values={visibleWeeks.map((item) => item.cpi)} />
        </DashboardCard>
        <DashboardCard id="bac" eyebrow="COST BASELINE" title="BAC" value={formatMoney(mainline.workload.budgetAtCompletionCny)} note="批准项目预算" onOpen={setSelectedWidget}>
          <div className="lab-v2-progress"><i style={{ width: `${progressPercent}%` }} /></div>
        </DashboardCard>
        <DashboardCard id="ac" eyebrow="ACTUAL COST" title="AC" value={formatMoney(weekState.cumulativeActualCostCny)} note={`预算消耗 ${(weekState.cumulativeActualCostCny / mainline.workload.budgetAtCompletionCny * 100).toFixed(1)}%`} onOpen={setSelectedWidget}>
          <div className="lab-v2-cost-comparison"><i style={{ width: `${weekState.cumulativeActualCostCny / mainline.workload.budgetAtCompletionCny * 100}%` }} /><b style={{ left: `${progressPercent}%` }} /></div>
        </DashboardCard>

        <DashboardCard id="gantt" eyebrow="SCHEDULE" title="里程碑甘特图" className="full gantt-widget" note={`完整 11 个一级工作包 · ${activeWorkPackages.length} 个进行中`} onOpen={setSelectedWidget}>
          <div className="lab-v2-gantt">
            <div className="lab-v2-gantt-axis"><span>一级 WBS</span><i>{[1, 4, 8, 12, 16, 20, 24, 28, 32].map((week) => <b key={week} style={{ left: `${((week - 0.5) / 32) * 100}%` }}>W{week}</b>)}</i></div>
            {mainline.workload.workPackages.map((item) => {
              const completed = item.endWeek < selectedWeek;
              const active = item.startWeek <= selectedWeek && item.endWeek >= selectedWeek;
              return (
                <div key={item.id} className={completed ? "done" : active ? "active" : "planned"}>
                  <span><b>{completed ? "✓" : active ? "●" : "○"}</b><i><strong>{item.id}</strong><small>{item.title}</small></i></span>
                  <em><b style={{ left: `${((item.startWeek - 1) / 32) * 100}%`, width: `${((item.endWeek - item.startWeek + 1) / 32) * 100}%` }} /></em>
                </div>
              );
            })}
            <mark><i style={{ left: `${((selectedWeek - 0.5) / 32) * 100}%` }} /></mark>
          </div>
        </DashboardCard>
        <DashboardCard id="workload" eyebrow="CAPACITY" title="项目工作量" value={`${weekState.plannedTeamPersonDays} 人日`} note={`当前周前后各 10 周 · 共 21 周 · 全项目 ${mainline.baselineWorkload.totalPlannedPersonDays} 人日`} onOpen={setSelectedWidget}>
          <WorkloadBars weeks={mainline.baselineWorkload.weeks} selectedWeek={selectedWeek} />
        </DashboardCard>
        <DashboardCard id="engagement" eyebrow="STAKEHOLDERS" title="干系人参与度" value={`${engagementPercent}%`} note={`${stakeholderState.filter((item) => item.current === "leading").length} 人处于领导参与`} onOpen={setSelectedWidget}>
          <div className="lab-v2-engagement-dots">{stakeholderState.map((item) => <i key={item.id} className={item.current} title={`${item.title}：${item.current}`} />)}</div>
        </DashboardCard>

        <DashboardCard id="raci" eyebrow="RESPONSIBILITY" title="RACI 矩阵" className="wide" note={`当周主要工作包 ${currentRaci.workPackageId} · ${currentRaciWorkPackage?.title ?? "项目治理"}`} onOpen={setSelectedWidget}>
          <div className="lab-v2-raci">
            {(["A", "R", "C", "I"] as const).map((role) => <div key={role}><b>{role}</b><span>{stakeholderNames(currentRaci[role]).slice(0, role === "C" || role === "I" ? 3 : 2).join(" / ") || "—"}</span></div>)}
          </div>
        </DashboardCard>
        <DashboardCard id="risk-matrix" eyebrow="RISK EXPOSURE" title="风险影响概率矩阵" note={`${openRiskCount} 项风险仍在监控`} onOpen={setSelectedWidget}>
          <div className="lab-v2-risk-matrix">
            {Array.from({ length: 25 }, (_, cellIndex) => {
              const probability = 5 - Math.floor(cellIndex / 5);
              const impact = cellIndex % 5 + 1;
              const count = riskState.filter((risk) => risk.lifecycle !== "closed" && risk.currentAssessment.probability === probability && risk.currentAssessment.impact === impact).length;
              return <i key={`${probability}-${impact}`} className={probability * impact >= 12 ? "high" : probability * impact >= 6 ? "medium" : "low"}>{count || ""}</i>;
            })}
          </div>
        </DashboardCard>
        <DashboardCard id="requirements" eyebrow="SCOPE CONTROL" title="需求状态统计" value={`${requirementVerified}/${requirementTotal}`} note={`${requirementBaselined} 条已进入基线${requirementCandidates ? ` · ${requirementCandidates} 条候选` : ""}`} onOpen={setSelectedWidget}>
          <div className="lab-v2-stacked"><i style={{ width: `${requirementTotal ? requirementVerified / requirementTotal * 100 : 0}%` }} /><b style={{ width: `${requirementTotal ? Math.max(0, requirementCompleted - requirementVerified) / requirementTotal * 100 : 0}%` }} /><em /></div>
          <div className="lab-v2-legend"><span>已验证 {requirementVerified}</span><span>开发完成 {requirementCompleted}</span><span>总计 {requirementTotal}</span></div>
        </DashboardCard>

        <DashboardCard id="burndown" eyebrow="ITERATION" title="当前迭代燃尽图" value={currentSprintNumber ? `S${currentSprintNumber}` : "未开始"} note={currentSprintNumber ? `剩余 ${sprintRemaining} 点` : "W9 进入首个开发迭代"} onOpen={setSelectedWidget}>
          <SprintBurndown started={currentSprintNumber > 0} secondWeek={sprintProgress === 1} />
        </DashboardCard>
        <DashboardCard id="ccb" eyebrow="GOVERNANCE" title="CCB 待办项" className="ccb-widget" titleAccessory={<CcbMemberIndicator members={ccbMembers} />} value={String(openChangeItems.length)} note={`${visibleChangeItems.length} 项累计变更 · ${closedChangeItems.length} 项已关闭`} onOpen={setSelectedWidget}>
          <div className="lab-v2-ccb-list">
            {visibleChangeItems.slice(-4).map((change) => <i key={change.id} className={change.currentStatus}><b>{change.id}</b><span>{change.title}</span><em>{changeStatusLabels[change.currentStatus]}</em></i>)}
            {!visibleChangeItems.length && <p>当前尚无正式变更请求</p>}
          </div>
        </DashboardCard>
        <DashboardCard id="network" eyebrow="SCHEDULE NETWORK" title="时标网络图" className="full network-widget" note={`完整 35 项活动 · ${mainline.baselineWorkload.scheduleNetwork.criticalActivityIds.length} 项关键活动 · W32 完工`} onOpen={setSelectedWidget}>
          <TimeScaledNetwork activities={mainline.schedule.activities} network={mainline.baselineWorkload.scheduleNetwork} workPackages={mainline.workload.workPackages} selectedWeek={selectedWeek} />
        </DashboardCard>
        <DashboardCard id="wbs" eyebrow="DELIVERABLES" title="WBS" className="full wbs-widget" interactiveChildren note={`11 个一级工作包 · 点击卡片展开 ${mainline.schedule.activities.length} 项二级子任务`} onOpen={setSelectedWidget}>
          <WbsCards workPackages={mainline.workload.workPackages} activities={mainline.schedule.activities} />
        </DashboardCard>
        <DashboardCard id="risk-status" eyebrow="RISK REGISTER" title="风险状态统计" value={`${openRiskCount} 开放`} note={`${completedRiskCount}/${riskState.length} 已关闭`} onOpen={setSelectedWidget}>
          <div className="lab-v2-risk-status"><i style={{ width: `${riskState.length ? completedRiskCount / riskState.length * 100 : 0}%` }} /></div>
          <div className="lab-v2-legend"><span>已关闭 {completedRiskCount}</span><span>监控中 {openRiskCount}</span></div>
        </DashboardCard>
      </section>

      <section className="lab-v2-management">
        <header><div><span>10 MANAGEMENT AREAS</span><h2>管理领域</h2></div><p>点击领域卡片，在项目文件抽屉中查看该领域当前可用文件。</p></header>
        <div>
          {managementAreas.map((area) => {
            const createdCount = documentState.filter((document) => area.documentIds.includes(document.id) && document.createdWeek <= selectedWeek).length;
            return (
              <button key={area.id} onClick={() => { setManagementFilter(area.id); setDocumentDrawerOpen(true); }}>
                <span>{area.index}</span><strong>{area.title}</strong><small>{createdCount}/{area.documentIds.length} 份文件可用</small><i>→</i>
              </button>
            );
          })}
        </div>
      </section>

      {branch && (
        <section className="lab-v2-branch-workspace">
          <header>
            <div><span>PERSONAL BRANCH / W{branch.currentWeek} / ROUND {branch.currentRoundNumber}</span><h2>{scenarioTitle}</h2><p>事件材料需要逐项打开；系统只呈现客观事实，不提示正确答案。</p></div>
            <div><strong>{materials?.openedCount ?? 0}/{materials?.totalCount ?? 0}</strong><span>材料已查看</span><small>{branch.status !== "active" ? "情景结算完成" : materials?.cardsUnlocked ? "三类卡池已解锁" : "继续观察线索"}</small></div>
          </header>
          <div className="lab-v2-material-layout">
            <aside>
              <span>项目经理收件箱</span>
              {materials?.materials.map((material) => (
                <button
                  key={material.id}
                  className={`${material.opened ? "opened" : ""} ${selectedMaterial?.id === material.id ? "active" : ""}`}
                  disabled={openingMaterialId !== null}
                  onClick={() => void openMaterial(material)}
                >
                  <i>{material.opened ? "✓" : "·"}</i><span><small>{materialGroupLabels[material.group] ?? material.type}</small><strong>{material.title}</strong><em>{material.channel ?? "项目仪表盘"}</em></span><b>{openingMaterialId === material.id ? "读取中" : "打开"}</b>
                </button>
              ))}
            </aside>
            <article>
              {selectedMaterial ? (
                <>
                  <span>{selectedMaterial.id} / 已记录查看</span>
                  <h3>{selectedMaterial.subject ?? selectedMaterial.displayLabel ?? "项目状态信号"}</h3>
                  <small>{selectedMaterial.channel ? `来源：${selectedMaterial.channel}` : "来源：项目仪表盘"}</small>
                  {selectedMaterial.facts?.length ? <ul>{selectedMaterial.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}
                  {selectedMaterial.documentIds?.length ? <div className="lab-v2-material-docs">{selectedMaterial.documentIds.map((documentId) => <button key={documentId} onClick={() => { setSelectedDocumentId(documentId); setManagementFilter(null); setDocumentDrawerOpen(true); }}>{documentId} 查看关联文件</button>)}</div> : null}
                </>
              ) : <div className="lab-v2-empty-material"><b>01</b><h3>打开第一条工作材料</h3><p>从邮件、消息、报告和异常数据中识别项目发生了什么。</p></div>}
            </article>
          </div>
          <div className={`lab-v2-action-cards ${materials?.cardsUnlocked ? "unlocked" : ""}`}>
            <header>
              <div><span>ACTION CHAIN</span><h3>{materials?.cardsUnlocked ? "定义目标并创建管理行动链" : "查看全部材料后解锁行动链"}</h3></div>
              <strong>{materials?.cardsUnlocked ? branch.status !== "active" ? "情景已结算" : draftStatus === "loading" ? "读取草稿" : draftStatus === "saving" ? "云端保存中" : draftStatus === "error" ? "保存失败" : draftUpdatedAt ? `已保存 ${formatDraftTime(draftUpdatedAt)}` : "云端草稿" : "LOCKED"}</strong>
            </header>
            {materials?.cardsUnlocked ? (
              <>
                {roundResult && (
                  <section className={`lab-v2-round-result ${roundResult.scenarioState}`}>
                    <header>
                      <div><span>ROUND {roundResult.roundNumber} / OBJECTIVE RESULT</span><h4>{roundResult.scenarioState === "open" ? "项目已推进一周，情景尚未闭环" : roundResult.scenarioState === "closed" ? "情景已经闭环" : "情景触发失败条件"}</h4></div>
                      <strong>W{roundResult.advancedToWeek}</strong>
                    </header>
                    <div className="lab-v2-round-metrics">
                      <span><small>SPI</small><b>{roundResult.stateSnapshot.performance.spi.toFixed(3)}</b></span>
                      <span><small>CPI</small><b>{roundResult.stateSnapshot.performance.cpi.toFixed(3)}</b></span>
                      <span><small>当回合成本</small><b>+{formatMoney(roundResult.stateDiff.additionalActualCostCny ?? 0)}</b></span>
                      <span><small>预测完工</small><b>W{roundResult.stateSnapshot.performance.forecastCompletionWeek}</b></span>
                      <span><small>需求追踪覆盖</small><b>{roundResult.stateSnapshot.totals.requirementsTraceabilityCoveragePercent}%</b></span>
                    </div>
                    {roundResult.pathClassification && <p className="lab-v2-path-result">路径结果：<b>{pathClassificationLabels[roundResult.pathClassification] ?? roundResult.pathClassification}</b></p>}
                    {roundResult.gaps.length ? (
                      <div className="lab-v2-round-gaps">
                        <span>仍需处理的管理缺口 · 根据本回合行动链判定</span>
                        {roundResult.gaps.map((gap, gapIndex) => {
                          const recognizedCards = gap.recognizedCards ?? [];
                          const missingCards = gap.missingCards ?? [];
                          const missingPrerequisites = gap.missingPrerequisites ?? [];
                          const hasDetailedDiagnosis = Boolean(
                            gap.actionTitle
                            || recognizedCards.length
                            || missingCards.length
                            || gap.cardsSplitAcrossChains
                            || missingPrerequisites.length,
                          );
                          return (
                            <article key={`${gap.categories.join("-")}-${gapIndex}`}>
                              <div className="lab-v2-gap-summary">
                                <small>{gap.categories.map((category) => gapCategoryLabels[category] ?? category).join(" / ")}</small>
                                <b>{gap.actionTitle ?? "行动链尚未形成完整闭环"}</b>
                                <p>{gap.objectiveEffects.map((effect) => objectiveEffectLabels[effect] ?? effect.replaceAll("_", " ")).join("；")}</p>
                              </div>
                              {hasDetailedDiagnosis ? (
                                <div className="lab-v2-gap-diagnosis">
                                  <section><strong>已识别</strong>{recognizedCards.length ? <GapCardGroups cards={recognizedCards} /> : <p>本回合尚未识别到支持该动作的卡片。</p>}</section>
                                  {missingCards.length > 0 && <section className="missing"><strong>尚缺</strong><GapCardGroups cards={missingCards} /></section>}
                                  {gap.cardsSplitAcrossChains && <section className="notice"><strong>组合问题</strong><p>所需卡片已经选齐，但分散在不同的行动链中；请将它们放入同一条行动链。</p></section>}
                                  {missingPrerequisites.length > 0 && <section className="notice"><strong>前置动作</strong><p>需要先完成：{missingPrerequisites.map((item) => item.title).join("；")}</p></section>}
                                  {gap.diagnosis === "connection_incomplete" && !missingCards.length && !missingPrerequisites.length && !gap.cardsSplitAcrossChains && <section className="notice"><strong>判定状态</strong><p>所需卡片已选齐，但尚未形成有效连接；如果它们已位于同一条行动链，这是系统判定异常，不是漏选。</p></section>}
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    ) : <p className="lab-v2-no-gaps">本回合未留下管理缺口。</p>}
                    {roundResult.documentDiffs.length > 0 && <footer>分支文件已更新：{roundResult.documentDiffs.map((diff) => diff.documentId).join("、")}</footer>}
                  </section>
                )}
                <div className="lab-v2-card-candidates">
                  {cardColumnOrder.map((column) => (
                    <section key={column}>
                      <span>{cardColumnLabels[column]} · {cardsByColumn[column].length}</span>
                      {cardsByColumn[column].map((card) => {
                        const selected = actionChainPools[column].includes(card.id);
                        const usageCount = actionChains.filter((chain) => actionChainCardIds(chain, column).includes(card.id)).length;
                        return (
                          <button key={card.id} type="button" disabled={branch.status !== "active"} className={selected ? "selected" : ""} onClick={() => toggleCardSelection(card)}>
                            <small>{cardDisplayId(card)}</small><strong>{card.title}</strong><i>{selected ? "已加入本链" : usageCount ? `已用于 ${usageCount} 条 · 再次加入` : "+ 加入本链"}</i>
                          </button>
                        );
                      })}
                    </section>
                  ))}
                </div>

                <section className="lab-v2-action-chain-composer">
                  <header><div><span>01 / DEFINE AN ACTION</span><h4>{editingActionChainId ? "编辑行动链" : "创建一条行动链"}</h4></div><p>写明行动目标，再从三个固定卡池中选择本次需要的资源和参与者。</p></header>
                  <label className="lab-v2-chain-title-field">
                    <span>行动目标 <b>{actionTarget.length}/80</b></span>
                    <input value={actionTarget} maxLength={80} disabled={branch.status !== "active"} placeholder="例如：确认延期影响并形成供应商恢复计划" onChange={(event) => setActionTarget(event.target.value)} />
                    <small>这段文字会作为行动链名称，用于表达你的管理意图；不会按关键词计分。</small>
                  </label>
                  <div className="lab-v2-chain-pools">
                    {cardColumnOrder.map((column) => (
                      <section key={column} className="lab-v2-chain-pool">
                        <header><span>{cardColumnLabels[column]}</span><b>{actionChainPools[column].length}</b></header>
                        <div>
                          {actionChainPools[column].map((cardId) => {
                            const card = cardById.get(cardId);
                            return card ? <button key={cardId} type="button" disabled={branch.status !== "active"} onClick={() => toggleCardSelection(card)}><small>{cardDisplayId(card)}</small><strong>{card.title}</strong><i>×</i></button> : null;
                          })}
                          {!actionChainPools[column].length && <p>从上方“{cardColumnLabels[column]}”卡池选择</p>}
                        </div>
                      </section>
                    ))}
                  </div>
                  <footer className="lab-v2-chain-composer-actions">
                    <span>{actionChainEditorComplete ? "三个卡池已就绪" : "行动目标和三个卡池都需要填写"}</span>
                    {editingActionChainId && <button type="button" disabled={branch.status !== "active"} onClick={resetActionChainEditor}>取消编辑</button>}
                    <button type="button" className="confirm" disabled={branch.status !== "active"} onClick={confirmActionChain}>{editingActionChainId ? "确定修改" : "确定并新增行动链"}</button>
                  </footer>
                  {actionMessage && <p className="lab-v2-action-message">{actionMessage}</p>}
                </section>

                <section className="lab-v2-action-chain-list">
                  <header><div><span>FIXED ACTION CHAINS</span><h4>已生成的行动链</h4></div><strong>{actionChains.length} 条</strong></header>
                  {actionChains.length ? actionChains.map((chain, index) => (
                    <article key={chain.id} className={editingActionChainId === chain.id ? "editing" : ""}>
                      <header>
                        <b>{String(index + 1).padStart(2, "0")}</b>
                        <div><small>ACTION TARGET</small><h5>{chain.title}</h5></div>
                        <nav>
                          <button type="button" title="上移" disabled={branch.status !== "active" || index === 0} onClick={() => moveActionChain(chain.id, -1)}>↑</button>
                          <button type="button" title="下移" disabled={branch.status !== "active" || index === actionChains.length - 1} onClick={() => moveActionChain(chain.id, 1)}>↓</button>
                          <button type="button" disabled={branch.status !== "active"} onClick={() => editActionChain(chain)}>编辑</button>
                          <button type="button" disabled={branch.status !== "active"} onClick={() => duplicateActionChain(chain)}>复制</button>
                          <button type="button" className="danger" disabled={branch.status !== "active"} onClick={() => removeActionChain(chain.id)}>删除</button>
                        </nav>
                      </header>
                      <div className="lab-v2-action-chain-groups">
                        {cardColumnOrder.map((column) => (
                          <section key={column}><span>{cardColumnLabels[column]}</span><div>{actionChainCardIds(chain, column).map((cardId) => { const card = cardById.get(cardId); return <b key={cardId}><small>{card ? cardDisplayId(card) : cardId}</small>{card?.title ?? cardId}</b>; })}</div></section>
                        ))}
                      </div>
                    </article>
                  )) : <p className="lab-v2-chain-empty">还没有固定的行动链。完成上方编辑区并点击“确定”后，新行动链会出现在这里，编辑区会自动清空。</p>}
                </section>

                <footer className={`lab-v2-draft-readiness ${draftReady ? "ready" : ""}`}>
                  <div><span>{draftReady ? "行动链已就绪" : "还不能提交"}</span><strong>{draftReady ? "已固定行动链，可以推进项目一周" : "请先完成并固定至少 1 条行动链"}</strong></div>
                  <button type="button" disabled={!draftReady || submittingRound || branch.status !== "active"} onClick={() => void submitActionChain()}>{submittingRound ? "正在结算项目状态…" : branch.status !== "active" ? "情景已结算" : "提交行动链并推进一周"}</button>
                </footer>
              </>
            ) : <p>仍有 {(materials?.totalCount ?? 0) - (materials?.openedCount ?? 0)} 条材料未查看。</p>}
          </div>
        </section>
      )}

      <button className={`lab-v2-drawer-tab ${documentDrawerOpen ? "open" : ""}`} onClick={() => setDocumentDrawerOpen((current) => !current)}>
        <i>32</i><span>项目文件</span><b>{documentState.filter((document) => document.createdWeek <= selectedWeek).length}</b>
      </button>

      {documentDrawerOpen && (
        <div className="lab-v2-drawer-backdrop" onClick={() => setDocumentDrawerOpen(false)}>
          <aside className="lab-v2-document-drawer" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>PROJECT FILE DRAWER / W{selectedWeek}</span><h2>32 份项目文件</h2><p>{managementFilter ? `${managementAreas.find((area) => area.id === managementFilter)?.title}筛选` : "全部文件"} · 选择文件查看当前版本和历史。</p></div>
              <button onClick={() => setDocumentDrawerOpen(false)}>关闭</button>
            </header>
            <div className="lab-v2-document-layout">
              <nav>
                <div className="lab-v2-document-filter"><button className={!managementFilter ? "active" : ""} onClick={() => setManagementFilter(null)}>全部 32</button>{managementAreas.map((area) => <button key={area.id} className={managementFilter === area.id ? "active" : ""} onClick={() => setManagementFilter(area.id)}>{area.shortTitle}</button>)}</div>
                <div className="lab-v2-document-list">
                  {filteredDocuments.map((document) => (
                    <button
                      key={document.id}
                      className={`${selectedDocument?.id === document.id ? "active" : ""} ${relatedDocumentIds.has(document.id) ? "related" : ""} ${document.status === "未创建" ? "locked" : ""}`}
                      onClick={() => setSelectedDocumentId(document.id)}
                    >
                      <b>{document.id}</b><span><strong>{document.title}</strong><small>v{document.version} · {document.status}</small></span><i />
                    </button>
                  ))}
                </div>
              </nav>
              <article>
                {selectedDocument && (
                  <>
                    <div className="lab-v2-document-title"><span>{selectedDocument.id} / W{selectedWeek} 主线版本</span><h3>{selectedDocument.title}</h3><div><b>{selectedDocument.status}</b><i>v{selectedDocument.version}</i><small>创建于 W{selectedDocument.createdWeek}</small></div></div>
                    {selectedDocument.status === "未创建" ? <div className="lab-v2-document-locked"><strong>该文件尚未创建</strong><p>将时间轴拖动到 W{selectedDocument.createdWeek} 后查看首个版本。</p></div> : <>
                      <section className="lab-v2-document-summary"><span>当前内容摘要</span><dl><div><dt>文件用途</dt><dd>{selectedDocument.coverage === "dynamic_full_history" ? "动态管理文件，保留完整更新历史" : "支持性文件，在关键阶段形成版本"}</dd></div><div><dt>当前阶段</dt><dd>{projectStage(selectedWeek)}</dd></div><div><dt>最近变更</dt><dd>{selectedDocument.history[selectedDocument.history.length - 1]?.reason ?? `W${selectedDocument.createdWeek} 创建初始版本`}</dd></div><div><dt>版本依据</dt><dd>主线事件、阶段门审批与关联文件变化</dd></div></dl></section>
                      {selectedDocument.id === "D05" && (
                        <section className="lab-v2-document-data">
                          <span>变更日志 · W{selectedWeek}</span>
                          <div className="lab-v2-data-table-wrap">
                            <table className="lab-v2-change-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>编号</th><th>变更事项</th><th>提出</th><th>状态</th><th>决议</th><th>进度/成本影响</th><th>负责人</th><th>关闭</th></tr></thead>
                              <tbody>{visibleChangeItems.map((change) => <tr key={change.id}><td>{change.id}</td><td><strong>{change.title}</strong><small>{change.decisionSummary}</small></td><td>W{change.submittedWeek}</td><td>{changeStatusLabels[change.currentStatus]}</td><td>{changeDecisionLabels[change.decision]}</td><td>{change.impact.scheduleWeeks ? `+${change.impact.scheduleWeeks}周` : "不延期"} / {formatMoney(change.impact.costCny)}</td><td>{stakeholderById.get(change.ownerStakeholderId)?.title}</td><td>{change.currentStatus === "closed" ? `W${change.closedWeek}` : "—"}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {selectedDocument.id === "D08" && (
                        <section className="lab-v2-document-data">
                          <span>问题日志 · W{selectedWeek}</span>
                          <div className="lab-v2-data-table-wrap">
                            <table className="lab-v2-issue-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>编号</th><th>问题</th><th>严重度</th><th>发现</th><th>负责人</th><th>处理结果</th><th>关闭</th></tr></thead>
                              <tbody>{visibleIssues.map((issue) => <tr key={issue.id}><td>{issue.id}</td><td>{issue.title}</td><td>{issue.severity}</td><td>W{issue.discoveredWeek}</td><td>{stakeholderById.get(issue.ownerStakeholderId)?.title}</td><td>{selectedWeek >= issue.resolvedWeek ? issue.resolution : "处理中"}</td><td>{selectedWeek >= issue.resolvedWeek ? `W${issue.resolvedWeek}` : "—"}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {selectedDocument.id === "D21" && (
                        <section className="lab-v2-document-data">
                          <span>需求文件 · W{selectedWeek}</span>
                          <div className="lab-v2-data-table-wrap">
                            <table className="lab-v2-requirements-file-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>编号</th><th>需求陈述</th><th>来源</th><th>优先级</th><th>验收标准</th><th>发现</th><th>基线</th></tr></thead>
                              <tbody>{requirementState.map((requirement) => <tr key={requirement.id}><td>{requirement.id}</td><td>{requirement.title}</td><td>{stakeholderById.get(requirement.sourceStakeholderId)?.title}</td><td>{requirement.priority}</td><td>{requirement.acceptanceCriteria.join("；")}</td><td>W{requirement.discoveredWeek}</td><td>{requirement.baselinedWeek && requirement.baselinedWeek <= selectedWeek ? `W${requirement.baselinedWeek}` : requirement.traceabilityStatus === "candidate_unplanned" ? "后续版本" : "—"}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {selectedDocument.id === "D22" && (
                        <section className="lab-v2-document-data">
                          <span>需求跟踪矩阵 · W{selectedWeek}</span>
                          <div className="lab-v2-data-table-wrap">
                            <table className="lab-v2-requirement-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>编号</th><th>需求</th><th>优先级</th><th>状态</th><th>主要WBS</th><th>支持WBS</th><th>目标版本</th></tr></thead>
                              <tbody>{requirementState.map((requirement) => <tr key={requirement.id}><td>{requirement.id}</td><td>{requirement.title}</td><td>{requirement.priority}</td><td>{requirementStatus(requirement, selectedWeek)}</td><td>{requirement.primaryWbsId ?? requirement.proposedPrimaryWbsId}</td><td>{(requirement.supportingWbsIds ?? requirement.proposedSupportingWbsIds ?? []).join("、")}</td><td>{requirement.targetRelease}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {selectedDocument.id === "D26" && (
                        <section className="lab-v2-document-data">
                          <span>风险登记册 · W{selectedWeek}</span>
                          <div className="lab-v2-data-table-wrap">
                            <table className="lab-v2-risk-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>编号</th><th>风险</th><th>等级</th><th>影响范围</th><th>发现</th><th>执行措施</th><th>负责人</th><th>关闭</th><th>处理后结果</th></tr></thead>
                              <tbody>{riskState.map((risk) => <tr key={risk.id}><td>{risk.id}</td><td>{risk.title}</td><td>{riskSeverity(risk.currentAssessment.probability, risk.currentAssessment.impact)}</td><td>{risk.impactDimensions.join("、")}</td><td>W{risk.discoveredWeek}</td><td>{risk.responseActions.join("；")}</td><td>{risk.owner}</td><td>{risk.lifecycle === "closed" ? `W${risk.closedWeek}` : "—"}</td><td>{risk.lifecycle === "closed" ? risk.postTreatmentResult : "持续监控中"}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {selectedDocument.id === "D32" && (
                        <section className="lab-v2-document-data">
                          <span>测试与评估文件 · W{selectedWeek}</span>
                          <div className="lab-v2-data-table-wrap">
                            <table className="lab-v2-test-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>轮次</th><th>测试范围</th><th>通过</th><th>失败</th><th>阻塞</th><th>严重缺陷</th><th>评估与发布建议</th></tr></thead>
                              <tbody>{visibleTestRounds.map((testRound) => <tr key={testRound.id}><td>{testRound.id}<small>W{testRound.executionWeek}</small></td><td><strong>{testRound.title}</strong><small>{testRound.scope}</small></td><td>{testRound.passed}</td><td>{testRound.failed}</td><td>{testRound.blocked}</td><td>{testRound.criticalDefects}</td><td>{testRound.releaseRecommendation}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      <section className="lab-v2-document-relations"><span>关联文件</span><div>{mainline.documents.relations.filter((relation) => relation.effectiveWeek <= selectedWeek && (relation.fromDocumentId === selectedDocument.id || relation.toDocumentId === selectedDocument.id)).map((relation) => { const relatedId = relation.fromDocumentId === selectedDocument.id ? relation.toDocumentId : relation.fromDocumentId; const related = documentState.find((document) => document.id === relatedId); return <button key={relation.id} onClick={() => setSelectedDocumentId(relatedId)}><b>{relatedId}</b><span>{related?.title}</span><small>{relation.reason}</small></button>; })}</div></section>
                      <section className="lab-v2-document-history"><span>版本历史</span><ol><li><b>v1</b><div><strong>W{selectedDocument.createdWeek} · 创建</strong><p>形成首个可引用版本。</p></div></li>{selectedDocument.history.map((historyEvent, historyIndex) => <li key={historyEvent.id}><b>v{historyIndex + 2}</b><div><strong>W{historyEvent.week} · {documentActions(historyEvent, selectedDocument.id).join(" / ")}</strong><p>{historyEvent.reason}</p></div></li>)}</ol></section>
                    </>}
                  </>
                )}
              </article>
            </div>
          </aside>
        </div>
      )}

      {selectedWidget && (
        <div className="lab-v2-modal-backdrop" onClick={() => setSelectedWidget(null)}>
          <section className={`lab-v2-widget-modal ${["ccb", "raci", "requirements", "risk-matrix", "risk-status"].includes(selectedWidget) ? "detailed" : ""}`} onClick={(event) => event.stopPropagation()}>
            <header><div><span>W{selectedWeek} / DASHBOARD DETAIL</span><h2>{dashboardTitles[selectedWidget]}</h2></div><button onClick={() => setSelectedWidget(null)}>关闭</button></header>
            {selectedWidget === "ccb" ? (
              <div className="lab-v2-detail-content">
                <div className="lab-v2-detail-metrics"><span><b>{openChangeItems.length}</b>当前待办</span><span><b>{closedChangeItems.length}</b>已关闭</span><span><b>{visibleChangeItems.length}</b>累计变更</span><span><b>{mainline.documents.changeControlBoard.quorum}</b>法定人数</span></div>
                <div className="lab-v2-detail-table"><table><thead><tr><th>编号</th><th>变更事项</th><th>提交</th><th>状态</th><th>决议</th><th>负责人</th></tr></thead><tbody>{visibleChangeItems.map((change) => <tr key={change.id}><td>{change.id}</td><td><strong>{change.title}</strong><small>{change.decisionSummary}</small></td><td>W{change.submittedWeek}</td><td>{changeStatusLabels[change.currentStatus]}</td><td>{changeDecisionLabels[change.decision]}</td><td>{stakeholderById.get(change.ownerStakeholderId)?.title}</td></tr>)}</tbody></table></div>
                <button className="lab-v2-detail-document-link" onClick={() => { setSelectedWidget(null); setSelectedDocumentId("D05"); setManagementFilter(null); setDocumentDrawerOpen(true); }}>打开 D05 变更日志 →</button>
              </div>
            ) : selectedWidget === "raci" ? (
              <div className="lab-v2-detail-content">
                <div className="lab-v2-detail-focus"><span>当周主要工作包</span><strong>{currentRaci.workPackageId} · {currentRaciWorkPackage?.title}</strong><small>依据W{selectedWeek}各活跃工作包计划投入，选择投入最高的非治理工作包。</small></div>
                <div className="lab-v2-raci-detail">{(["A", "R", "C", "I"] as const).map((role) => <section key={role}><b>{role}</b><span>{role === "A" ? "最终负责" : role === "R" ? "负责执行" : role === "C" ? "提供咨询" : "需要知会"}</span><div>{stakeholderNames(currentRaci[role]).map((name) => <i key={name}>{name}</i>)}</div></section>)}</div>
              </div>
            ) : selectedWidget === "requirements" ? (
              <div className="lab-v2-detail-content">
                <div className="lab-v2-detail-metrics"><span><b>{requirementTotal}</b>已发现</span><span><b>{requirementBaselined}</b>已基线</span><span><b>{requirementCompleted}</b>开发完成</span><span><b>{requirementVerified}</b>已验证</span></div>
                <div className="lab-v2-detail-toolbar"><span>优先级筛选</span>{(["ALL", "P0", "P1", "P2", "P3"] as const).map((priority) => <button key={priority} className={requirementPriorityFilter === priority ? "active" : ""} onClick={() => setRequirementPriorityFilter(priority)}>{priority === "ALL" ? "全部" : priority}</button>)}</div>
                <div className="lab-v2-detail-table"><table><thead><tr><th>需求</th><th>状态</th><th>优先级</th><th>来源</th><th>主要WBS</th></tr></thead><tbody>{requirementDetailItems.map((requirement) => <tr key={requirement.id}><td><strong>{requirement.id}</strong><small>{requirement.title}</small></td><td>{requirementStatus(requirement, selectedWeek)}</td><td>{requirement.priority}</td><td>{stakeholderById.get(requirement.sourceStakeholderId)?.title}</td><td>{requirement.primaryWbsId ?? requirement.proposedPrimaryWbsId}</td></tr>)}</tbody></table></div>
                <div className="lab-v2-detail-links"><button onClick={() => { setSelectedWidget(null); setSelectedDocumentId("D21"); setDocumentDrawerOpen(true); }}>D21 需求文件</button><button onClick={() => { setSelectedWidget(null); setSelectedDocumentId("D22"); setDocumentDrawerOpen(true); }}>D22 跟踪矩阵</button></div>
              </div>
            ) : selectedWidget === "risk-matrix" || selectedWidget === "risk-status" ? (
              <div className="lab-v2-detail-content">
                <div className="lab-v2-detail-metrics"><span><b>{riskState.length}</b>累计发现</span><span><b>{openRiskCount}</b>开放</span><span><b>{completedRiskCount}</b>已关闭</span><span><b>{riskState.filter((risk) => risk.lifecycle !== "closed" && risk.currentAssessment.probability * risk.currentAssessment.impact >= 10).length}</b>高风险</span></div>
                <div className="lab-v2-detail-toolbar"><span>风险筛选</span>{(["ALL", "OPEN", "HIGH", "CLOSED"] as const).map((filter) => <button key={filter} className={riskDetailFilter === filter ? "active" : ""} onClick={() => setRiskDetailFilter(filter)}>{{ ALL: "全部", OPEN: "开放", HIGH: "高风险", CLOSED: "已关闭" }[filter]}</button>)}</div>
                <div className="lab-v2-detail-table"><table><thead><tr><th>风险</th><th>等级</th><th>状态</th><th>发现</th><th>负责人</th><th>应对与结果</th></tr></thead><tbody>{riskDetailItems.map((risk) => <tr key={risk.id}><td><strong>{risk.id}</strong><small>{risk.title}</small></td><td>{riskSeverity(risk.currentAssessment.probability, risk.currentAssessment.impact)}</td><td>{risk.lifecycle === "closed" ? "已关闭" : risk.lifecycle === "monitoring" ? "监控中" : "处理中"}</td><td>W{risk.discoveredWeek}</td><td>{risk.owner}</td><td>{risk.lifecycle === "closed" ? risk.postTreatmentResult : risk.responseActions.join("；")}</td></tr>)}</tbody></table></div>
                <button className="lab-v2-detail-document-link" onClick={() => { setSelectedWidget(null); setSelectedDocumentId("D26"); setManagementFilter(null); setDocumentDrawerOpen(true); }}>打开 D26 风险登记册 →</button>
              </div>
            ) : <div>{dashboardDetailFacts[selectedWidget].map((fact, index) => <article key={fact}><span>{String(index + 1).padStart(2, "0")}</span><strong>{fact}</strong></article>)}</div>}
            <footer>数据来自当前主线状态。拖动项目进度条后，该仪表详情会同步更新。</footer>
          </section>
        </div>
      )}
    </main>
  );
}
