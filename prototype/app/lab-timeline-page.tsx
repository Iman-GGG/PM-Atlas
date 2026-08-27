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

type LabSession = { authenticated: boolean };

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
  overtimePersonDays: Record<string, number>;
  workPackagePersonDays: Record<string, number>;
};

type WorkPackage = {
  id: string;
  title: string;
  startWeek: number;
  endWeek: number;
};

type CostRole = {
  id: string;
  title: string;
  plannedPersonDays: number;
  standardDayRateCny: number;
};

type PlannedNonLaborCost = {
  id: string;
  title: string;
  entries: Array<{ week: number; amountCny: number }>;
};

type ScheduleActivity = {
  id: string;
  parentId: string;
  title: string;
  type: "discrete" | "level_of_effort" | "recurring";
  startWeek: number;
  endWeek: number;
  durationWeeks?: { optimistic: number; mostLikely: number; pessimistic: number };
  occurrenceWeeks?: number[];
  predecessors?: Array<{ activityId: string; type: string; lagWeeks: number }>;
  plannedPersonDaysByRole: Record<string, number>;
  acceptanceCriteria: string[];
};

type ActivityListPolicy = {
  documentId: "D02";
  createdWeek: number;
  approvedWeek: number;
  sourceDocumentIds: string[];
  decompositionBasis: string;
  inclusionRule: string;
  changeRule: string;
  statusModel: Array<"not_started" | "in_progress" | "waiting_next_occurrence" | "completed">;
  typeDefinitions: Array<{ type: ScheduleActivity["type"]; label: string; definition: string }>;
};

type SchedulePlanStatusEvent = {
  week: number;
  health: "planning" | "on_track" | "at_risk" | "recovery_approved" | "recovered" | "completed";
  forecastFinishWeek: number;
  actualFinishWeek: number | null;
  forecastVarianceWeeks: number;
  evidence: string;
};

type ProjectSchedulePlan = {
  documentId: "D14";
  createdWeek: number;
  baselineWeek: number;
  scheduleModelId: string;
  purpose: string;
  sourceDocumentIds: string[];
  calendar: {
    plannedStartWeek: number;
    plannedFinishWeek: number;
    deadlineWeek: number;
    workDaysPerWeek: number;
    dataDateRule: string;
  };
  baseline: {
    version: string;
    approvedWeek: number;
    activityCount: number;
    milestoneCount: number;
    criticalActivityCount: number;
    totalPlannedPersonDays: number;
    resourceLoaded: boolean;
    criticalityRule: string;
    approvalEvidence: string;
  };
  versionEvents: Array<{
    week: number;
    version: string;
    status: string;
    baselineChanged: boolean;
    approvedChangeIds: string[];
    decision: string;
  }>;
  statusEvents: SchedulePlanStatusEvent[];
  controlRules: Array<{ id: string; title: string; rule: string }>;
  resourceSchedulingNotes: string[];
};

type Stakeholder = {
  id: string;
  title: string;
  identifiedWeek: number;
  projectRole: string;
  organization: string;
  group: "governance" | "core_team" | "business" | "external";
  resourceRoleId?: string;
  expectations: string[];
  informationNeeds: string[];
  primaryCommunicationTouchpointId: string;
  engagementOwnerStakeholderId: string;
  identificationBasis: string;
  initialEngagement: {
    power: number;
    interest: number;
    current: string;
    desired: string;
  };
};

type CommunicationTouchpoint = {
  id: string;
  title: string;
  cadence: "weekly" | "biweekly" | "specified_weeks" | "activity_driven";
  startWeek?: number;
  endWeek?: number;
  weeks?: number[];
};

type StageGate = {
  id: string;
  week: number;
  title: string;
  decisionOwner: string;
  presenters: string[];
  requiredSignoffs: string[];
  evidenceTitles: string[];
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

type TeamCharter = {
  documentId: string;
  version: string;
  effectiveWeek: number;
  facilitatorStakeholderId: string;
  agreedByStakeholderIds: string[];
  purpose: string;
  mission: string;
  values: Array<{ id: string; title: string; agreement: string }>;
  decisionRights: Array<{ area: string; ownerStakeholderId: string; consultedStakeholderIds: string[]; rule: string }>;
  workingAgreements: Array<{ id: string; title: string; agreement: string }>;
  communicationAgreements: Array<{ id: string; channel: string; cadence: string; responseRule: string; recordDocumentId: string }>;
  qualityAndSafetyGuardrails: string[];
  conflictResolutionSteps: Array<{ step: number; ownerStakeholderId: string; timebox: string; rule: string }>;
  handoverProtocol: { trigger: string; ownerRule: string; requiredContents: string[]; recordDocumentId: string };
  amendmentRule: { trigger: string; decisionRule: string; recordDocumentId: string };
};

type AssumptionStatusEvent = {
  week: number;
  status: "open" | "validated" | "invalidated" | "retired";
  evidence: string;
};

type AssumptionItem = {
  id: string;
  statement: string;
  category: string;
  identifiedWeek: number;
  ownerStakeholderId: string;
  validationMethod: string;
  targetValidationWeek: number;
  impactIfFalse: string;
  statusEvents: AssumptionStatusEvent[];
  linkedRiskIds: string[];
  linkedRequirementIds: string[];
  linkedWbsIds: string[];
  linkedDocumentIds: string[];
};

type AssumptionLog = {
  documentId: "D03";
  statusModel: AssumptionStatusEvent["status"][];
  items: AssumptionItem[];
};

type LessonLearnedItem = {
  id: string;
  title: string;
  category: string;
  observedWeek: number;
  capturedWeek: number;
  ownerStakeholderId: string;
  context: string;
  observation: string;
  impact: string;
  recommendation: string;
  status: "captured" | "adopted" | "shared";
  adoptedWeek: number;
  linkedIssueIds: string[];
  linkedRiskIds: string[];
  linkedChangeIds: string[];
  applicablePhase: string;
  evidenceDocumentIds: string[];
};

type LessonsLearnedRegister = {
  documentId: "D09";
  statusModel: LessonLearnedItem["status"][];
  items: LessonLearnedItem[];
};

type MilestoneStatusEvent = {
  week: number;
  status: "planned" | "at_risk" | "achieved_with_conditions" | "achieved";
  forecastWeek: number;
  actualWeek: number | null;
  evidence: string;
};

type MilestoneItem = {
  id: string;
  title: string;
  baselineWeek: number;
  ownerStakeholderId: string;
  acceptanceCriteria: string;
  relatedWbsIds: string[];
  evidenceDocumentIds: string[];
  statusEvents: MilestoneStatusEvent[];
};

type MilestoneList = {
  documentId: "D10";
  statusModel: MilestoneStatusEvent["status"][];
  items: MilestoneItem[];
};

type ScopeStatusEvent = {
  week: number;
  status: "draft_included" | "baselined_included" | "deferred_from_v1_0";
  evidence: string;
};

type ProjectScopeStatement = {
  documentId: "D16";
  purpose: string;
  productScopeDescription: string;
  projectScopeDescription: string;
  statusModel: ScopeStatusEvent["status"][];
  baselineEvents: Array<{ week: number; version: string; status: string; decision: string; approvedChangeId: string | null }>;
  productScopeItems: Array<{
    id: string;
    title: string;
    description: string;
    relatedRequirementIds: string[];
    relatedWbsIds: string[];
    statusEvents: ScopeStatusEvent[];
  }>;
  deliverables: Array<{
    id: string;
    title: string;
    definedWeek: number;
    targetWeek: number;
    relatedWbsIds: string[];
    acceptanceSummary: string;
    evidenceDocumentIds: string[];
  }>;
  exclusions: Array<{ id: string; effectiveWeek: number; title: string; reason: string; destination: string }>;
  constraints: Array<{ id: string; title: string; description: string }>;
  assumptionIds: string[];
  acceptanceCriteria: Array<{ id: string; criterion: string; evidenceDocumentIds: string[] }>;
  changeControlRule: string;
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
  ownerStakeholderId?: string;
  category: string;
  impactDimensions: string[];
  discoveredWeek: number;
  assessmentWeek: number;
  responseCompletedWeek: number;
  triggeredWeek: number | null;
  closedWeek: number;
  responseActions: string[];
  postTreatmentResult: string;
  severityOverride?: string;
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

type QualityMetricDefinition = {
  id: string;
  operator: "equals" | "greater_than_or_equal" | "less_than_or_equal";
  target: number | boolean;
  unit?: "people" | "ratio" | "seconds" | "score_out_of_5";
  scope?: "remote_control_enabled";
};

type QualityPlan = {
  preMeasurementState: "not_measured";
  scopeExclusionState: "not_applicable_by_approved_scope_change";
  hardGates: QualityMetricDefinition[];
  performanceMetrics: QualityMetricDefinition[];
  mainlineSeries: QualitySeries[];
  successRule: "all_applicable_hard_gates_pass";
};

type NetworkActivity = {
  activityId: string;
  expectedDuration: number;
  durationVariance: number;
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
    personDaysPerPersonWeek: number;
    roles: CostRole[];
    plannedNonLaborCosts: PlannedNonLaborCost[];
    roleWorkPackagePersonDays: Record<string, Record<string, number>>;
    workPackages: WorkPackage[];
  };
  schedule: {
    activityList: ActivityListPolicy;
    projectSchedulePlan: ProjectSchedulePlan;
    activities: ScheduleActivity[];
    dependencyPolicy: {
      supportedTypes: string[];
      levelOfEffortAndRecurringExcludedFromCriticalPath: boolean;
    };
    resourceSchedulingPolicy: {
      defaultBufferWeeks: number;
      outsideWindowCostPerWeek: number;
      approvedOvertime: Array<{ week: number; roleId: string; extraPersonDays: number; reason: string }>;
    };
  };
  stakeholders: {
    stakeholders: Stakeholder[];
    mainlineEngagementEvents: StakeholderEvent[];
    communicationTouchpoints: CommunicationTouchpoint[];
    stageGates: StageGate[];
    workPackageRaci: RaciRow[];
  };
  documents: {
    documents: ProjectDocument[];
    mainlineEvents: DocumentEvent[];
    contentRevisions: DocumentEvent[];
    relations: DocumentRelation[];
    changeControlBoard: ChangeControlBoard;
    teamCharter: TeamCharter;
    assumptionLog: AssumptionLog;
    lessonsLearnedRegister: LessonsLearnedRegister;
    milestoneList: MilestoneList;
    projectScopeStatement: ProjectScopeStatement;
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
  quality: QualityPlan;
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
  caseVersion: string;
  currentWeek: number;
  currentRoundNumber: number;
  status: string;
};

type BranchSummary = BranchContext & {
  forkWeek: number;
  scenarioId: string;
  outcomeClassification: string | null;
  createdAt: string;
};

type MaterialSummary = {
  id: string;
  group: string;
  type: string;
  channel: string | null;
  title: string;
  opened: boolean;
  content?: OpenedMaterial;
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
  diagnosis?: "missing_cards" | "split_across_chains" | "prerequisite_incomplete";
};

type RoundResult = {
  rulesetVersion?: number;
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

type DocumentPatch = { roundNumber: number; week: number; reason: string; operations: Array<{ op: string; path: string; value: string | number | boolean }> };
type BranchComparison = {
  forkWeek: number; currentWeek: number; outcomeClassification: string | null;
  mainline: { spi: number; cpi: number; forecastCompletionWeek: number };
  branch: { spi: number; cpi: number; forecastCompletionWeek: number; status: string } | null;
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
const caseVersion = "v5";
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
const engagementStateLabels: Record<string, string> = {
  unaware: "未意识到",
  resistant: "抵制",
  neutral: "中立",
  supportive: "支持",
  leading: "领导",
};
const assumptionStatusLabels: Record<AssumptionStatusEvent["status"], string> = {
  open: "待验证",
  validated: "已验证",
  invalidated: "已失效",
  retired: "已退役",
};
const assumptionCategoryLabels: Record<string, string> = {
  scope: "范围",
  supplier: "供应",
  resource: "资源",
  security: "安全",
  quality: "质量",
  technical: "技术",
  stakeholder: "干系人",
  operations: "运营",
  compliance: "合规",
  requirements: "需求",
  release: "发布",
};
const lessonStatusLabels: Record<LessonLearnedItem["status"], string> = {
  captured: "已记录",
  adopted: "已采纳",
  shared: "已共享",
};
const milestoneStatusLabels: Record<MilestoneStatusEvent["status"], string> = {
  planned: "按计划",
  at_risk: "存在风险",
  achieved_with_conditions: "有条件达成",
  achieved: "已达成",
};
const activityTypeLabels: Record<ScheduleActivity["type"], string> = {
  discrete: "离散活动",
  level_of_effort: "人力投入型",
  recurring: "重复活动",
};
const activityStatusLabels = {
  not_started: "未开始",
  in_progress: "进行中",
  waiting_next_occurrence: "等待下次发生",
  completed: "已完成",
} as const;
const nonHumanResourceDetails: Record<string, { group: string; relatedWbsIds: string[] }> = {
  vehicle_vendor: { group: "外部服务", relatedWbsIds: ["WBS-8.0"] },
  security_quality: { group: "外部服务", relatedWbsIds: ["WBS-9.0", "WBS-10.0"] },
  cloud_tools_devices: { group: "环境与工具", relatedWbsIds: ["WBS-3.0", "WBS-9.0", "WBS-10.0"] },
  pilot_training_support: { group: "试点与支持", relatedWbsIds: ["WBS-11.0"] },
};
const scheduleHealthLabels: Record<SchedulePlanStatusEvent["health"], string> = {
  planning: "编制中",
  on_track: "按计划",
  at_risk: "存在进度风险",
  recovery_approved: "恢复方案已批准",
  recovered: "预测已恢复",
  completed: "按基线完成",
};
const scopeStatusLabels: Record<ScopeStatusEvent["status"], string> = {
  draft_included: "草案纳入",
  baselined_included: "基线纳入",
  deferred_from_v1_0: "移出 V1.0",
};
const qualityMetricLabels: Record<string, string> = {
  open_high_or_critical_security_findings: "未关闭高危及严重安全发现",
  blocker_defects: "阻断缺陷",
  remote_control_audit_revocation_expiry_complete: "远程控制审计、撤销与凭证过期链路",
  pilot_users_completed: "完成试点的用户",
  vehicle_status_success_rate: "车况查询成功率",
  vehicle_status_p95_seconds: "车况查询 P95 响应时间",
  remote_control_success_rate: "远程控制成功率",
  core_test_pass_rate: "核心测试通过率",
  pilot_satisfaction: "试点满意度",
  service_availability: "服务可用性",
};
const qualityMeasurementProfiles: Record<string, { method: string; ownerId: string; evidence: string }> = {
  open_high_or_critical_security_findings: { method: "按独立安全测试发现项的严重度和关闭状态计数", ownerId: "devsecops", evidence: "D32 / 安全测试" },
  blocker_defects: { method: "按缺陷等级统计当前未关闭阻断项", ownerId: "qa", evidence: "D32 / 缺陷记录" },
  remote_control_audit_revocation_expiry_complete: { method: "验证审计、授权撤销和凭证过期链路是否全部通过", ownerId: "devsecops", evidence: "D32 / 安全回归" },
  pilot_users_completed: { method: "统计完成核心流程的去重试点用户", ownerId: "operations_support", evidence: "D32 / 试点验收" },
  vehicle_status_success_rate: { method: "车况查询成功请求占有效请求的比例", ownerId: "qa", evidence: "D32 / 性能测试" },
  vehicle_status_p95_seconds: { method: "统计车况查询端到端响应时间 P95", ownerId: "qa", evidence: "D32 / 性能测试" },
  remote_control_success_rate: { method: "远程控制成功请求占有效请求的比例", ownerId: "qa", evidence: "D32 / 功能回归" },
  core_test_pass_rate: { method: "通过用例占已执行用例的比例", ownerId: "qa", evidence: "D32 / 测试轮次" },
  pilot_satisfaction: { method: "汇总试点用户五分制问卷平均分", ownerId: "product_ba", evidence: "D32 / 试点验收" },
  service_availability: { method: "可用服务时间占计划服务时间的比例", ownerId: "operations_support", evidence: "D32 / 运营验证" },
};
const qualityResultLabels = {
  not_measured: "尚未测量",
  not_applicable: "不适用",
  passed: "达标",
  failed: "未达标",
} as const;
const riskLifecycleLabels: Record<string, string> = {
  identified: "已识别",
  assessed: "已评估",
  response_approved: "应对已批准",
  monitoring: "监控中",
  triggered: "已触发",
  closed: "已关闭",
};
const riskControlStatusLabels: Record<string, string> = {
  prepared: "控制已准备",
  active_uncontrolled: "已触发 / 未受控",
  active_partially_controlled: "部分受控",
  active_controlled: "受控",
  pending_execution: "待执行",
};
const riskImpactDimensionLabels: Record<string, string> = {
  scope: "范围",
  schedule: "进度",
  cost: "成本",
  quality: "质量",
  resource: "资源",
  safety: "安全",
  stakeholder: "干系人",
};
const stakeholderGroupLabels: Record<Stakeholder["group"], string> = {
  governance: "治理",
  core_team: "核心团队",
  business: "业务支持",
  external: "外部",
};
const communicationCadenceLabels: Record<CommunicationTouchpoint["cadence"], string> = {
  weekly: "每周",
  biweekly: "每两周",
  specified_weeks: "指定周",
  activity_driven: "按活动",
};
function communicationTouchpointSchedule(touchpoint?: CommunicationTouchpoint): string {
  if (!touchpoint) return "未设置";
  if (touchpoint.weeks?.length) return `${communicationCadenceLabels[touchpoint.cadence]} · W${touchpoint.weeks.join("/W")}`;
  if (touchpoint.startWeek && touchpoint.endWeek) return `${communicationCadenceLabels[touchpoint.cadence]} · W${touchpoint.startWeek}–W${touchpoint.endWeek}`;
  return communicationCadenceLabels[touchpoint.cadence];
}

function formatQualityValue(value: number | boolean | null, unit?: QualityMetricDefinition["unit"]): string {
  if (value === null) return qualityResultLabels.not_measured;
  if (typeof value === "boolean") return value ? "已完成" : "未完成";
  if (unit === "ratio") return `${(value * 100).toFixed(1)}%`;
  if (unit === "seconds") return `${value.toFixed(1)} 秒`;
  if (unit === "people") return `${Math.round(value)} 人`;
  if (unit === "score_out_of_5") return `${value.toFixed(2).replace(/0$/, "")} / 5`;
  return `${Math.round(value)} 项`;
}

function qualityTargetLabel(metric: QualityMetricDefinition): string {
  const operator = metric.operator === "equals" ? "=" : metric.operator === "greater_than_or_equal" ? "≥" : "≤";
  return `${operator} ${formatQualityValue(metric.target, metric.unit)}`;
}

function evaluateQualityMetric(metric: QualityMetricDefinition, value: number | boolean | null, notApplicable: boolean): keyof typeof qualityResultLabels {
  if (notApplicable) return "not_applicable";
  if (value === null) return "not_measured";
  if (metric.operator === "equals") return value === metric.target ? "passed" : "failed";
  if (typeof value !== "number" || typeof metric.target !== "number") return "failed";
  if (metric.operator === "greater_than_or_equal") return value >= metric.target ? "passed" : "failed";
  return value <= metric.target ? "passed" : "failed";
}
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

const publicSampleDocumentIds = new Set(["D05", "D26"]);

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

async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit, redirectOnUnauthorized = true): Promise<T> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    if (redirectOnUnauthorized) signIn();
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

function documentVersionActions(event: DocumentEvent, documentId: string): string[] {
  return documentActions(event, documentId).filter((action) => {
    const normalized = action.toLowerCase();
    return !normalized.includes("archived") && !normalized.includes("unchanged");
  });
}

function activityStatus(activity: ScheduleActivity, week: number): keyof typeof activityStatusLabels {
  if (week < activity.startWeek) return "not_started";
  if (week >= activity.endWeek) return "completed";
  if (activity.type === "recurring" && !activity.occurrenceWeeks?.includes(week)) return "waiting_next_occurrence";
  return "in_progress";
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

function riskSeverity(probability: number, impact: number, severityOverride?: string): string {
  if (severityOverride) return "极高";
  const score = probability * impact;
  if (score >= 17) return "极高";
  if (score >= 10) return "高";
  if (score >= 5) return "中";
  return "低";
}

function latestQualityMeasurement(series: QualitySeries | undefined, week: number): { week: number; value: number | boolean } | null {
  return series?.anchors.filter((anchor) => anchor.week <= week).at(-1) ?? null;
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

export function LabTimelinePage({ openBranchHistoryRequest = 0 }: { openBranchHistoryRequest?: number }) {
  const [manifest, setManifest] = useState<CaseManifest | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [mainline, setMainline] = useState<MainlineData | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedWidget, setSelectedWidget] = useState<DashboardId | null>(null);
  const [requirementPriorityFilter, setRequirementPriorityFilter] = useState<"ALL" | RequirementItem["priority"]>("ALL");
  const [riskDetailFilter, setRiskDetailFilter] = useState<"ALL" | "OPEN" | "HIGH" | "CLOSED">("ALL");
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false);
  const [branchHistoryOpen, setBranchHistoryOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState("D14");
  const [managementFilter, setManagementFilter] = useState<string | null>(null);
  const [branch, setBranch] = useState<BranchContext | null>(null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [branchState, setBranchState] = useState<BranchState | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarioTitle, setScenarioTitle] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialList | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [openedMaterialCache, setOpenedMaterialCache] = useState<Record<string, OpenedMaterial>>({});
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
  const [documentPatches, setDocumentPatches] = useState<DocumentPatch[]>([]);
  const [branchComparison, setBranchComparison] = useState<BranchComparison | null>(null);
  const [aiReview, setAiReview] = useState<Record<string, unknown> | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [submittingRound, setSubmittingRound] = useState(false);
  const [loadingScenarioId, setLoadingScenarioId] = useState<string | null>(null);
  const [openingMaterialIds, setOpeningMaterialIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [compactTimelineVisible, setCompactTimelineVisible] = useState(false);
  const idempotencyKeys = useRef(new Map<string, string>());
  const roundIdempotencyKeys = useRef(new Map<string, string>());
  const draftLoadingKeyRef = useRef<string | null>(null);
  const timelinePanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (openBranchHistoryRequest < 1) return;
    setDocumentDrawerOpen(false);
    setBranchHistoryOpen(true);
  }, [openBranchHistoryRequest]);

  const loadMaterials = async (branchId: string, nextScenarioId: string) => {
    const list = await apiJson<MaterialList>(
      `/api/lab/branches/${encodeURIComponent(branchId)}/scenarios/${encodeURIComponent(nextScenarioId)}/materials`,
    );
    setMaterials(list);
    const restoredContents = Object.fromEntries(list.materials.flatMap((material) => (
      material.content ? [[material.id, material.content] as const] : []
    )));
    if (Object.keys(restoredContents).length > 0) {
      setOpenedMaterialCache((current) => ({ ...current, ...restoredContents }));
    }
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

  const refreshBranches = async () => {
    try {
      const response = await apiJson<{ branches: BranchSummary[] }>(`/api/lab/cases/${caseId}/branches`, undefined, false);
      setBranches(response.branches);
    } catch {
      setBranches([]);
    }
  };

  useEffect(() => {
    if (!branch || !selectedDocumentId) { setDocumentPatches([]); setBranchComparison(null); return; }
    void Promise.all([
      apiJson<{ patches: DocumentPatch[] }>(`/api/lab/branches/${encodeURIComponent(branch.id)}/documents/${encodeURIComponent(selectedDocumentId)}`),
      apiJson<BranchComparison>(`/api/lab/branches/${encodeURIComponent(branch.id)}/comparison`),
    ]).then(([diff, comparison]) => { setDocumentPatches(diff.patches); setBranchComparison(comparison); }).catch(() => {});
  }, [branch, selectedDocumentId, branch?.currentRoundNumber]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const [nextManifest, mainlineResponse, session] = await Promise.all([
          apiJson<CaseManifest>(`/api/lab/cases/${caseId}/${caseVersion}`),
          apiJson<MainlineResponse>(`/api/lab/cases/${caseId}/${caseVersion}/mainline?sections=${mainlineSections}`),
          apiJson<LabSession>("/api/lab/session", undefined, false),
        ]);
        if (cancelled) return;
        setManifest(nextManifest);
        setMainline(mainlineResponse.sections);
        setAuthenticated(session.authenticated);
        if (session.authenticated) void refreshBranches();
        const restored = branchFromHash();
        if (!restored) return;
        const projection = await apiJson<{ branch: BranchContext; scenario: { title: string; cards: PublicCard[] }; state: BranchState | null; lastRoundResult: RoundResult | null }>(
          `/api/lab/branches/${encodeURIComponent(restored.branchId)}/scenarios/${encodeURIComponent(restored.scenarioId)}/projection`,
        );
        if (cancelled) return;
        if (projection.branch.caseVersion !== caseVersion) {
          const [historicalManifest, historicalMainline] = await Promise.all([
            apiJson<CaseManifest>(`/api/lab/cases/${caseId}/${projection.branch.caseVersion}`),
            apiJson<MainlineResponse>(`/api/lab/cases/${caseId}/${projection.branch.caseVersion}/mainline?sections=${mainlineSections}`),
          ]);
          if (cancelled) return;
          setManifest(historicalManifest);
          setMainline(historicalMainline.sections);
        }
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
    if (!authenticated) {
      signIn();
      return;
    }
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
      setSelectedMaterialId(null);
      setOpenedMaterialCache({});
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
      setAiReview(null);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#lab-schedule?branch=${encodeURIComponent(created.branch.id)}&scenario=${encodeURIComponent(created.scenario.id)}`,
      );
      await loadMaterials(created.branch.id, created.scenario.id);
      await refreshBranches();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法创建个人分支");
    } finally {
      setLoadingScenarioId(null);
    }
  };

  const leaveBranch = (targetWeek?: number) => {
    setBranch(null);
    setBranchState(null);
    setScenarioId(null);
    setScenarioTitle(null);
    setMaterials(null);
    setSelectedMaterialId(null);
    setOpenedMaterialCache({});
    setCards([]);
    setActionChains([]);
    setRoundResult(null);
    setBranchComparison(null);
    setDocumentPatches([]);
    setAiReview(null);
    setActionMessage(null);
    setSelectedWeek(targetWeek ?? selectedWeek);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#lab-schedule`);
    if (manifest?.caseVersion !== caseVersion) window.location.reload();
  };

  const switchBranch = (summary: BranchSummary) => {
    window.location.hash = `lab-schedule?branch=${encodeURIComponent(summary.id)}&scenario=${encodeURIComponent(summary.scenarioId)}`;
    window.location.reload();
  };

  const openMaterial = async (material: MaterialSummary) => {
    if (!branch || !scenarioId) return;
    setSelectedMaterialId(material.id);
    if (openedMaterialCache[material.id]) return;
    setOpeningMaterialIds((current) => current.includes(material.id) ? current : [...current, material.id]);
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
      setOpenedMaterialCache((current) => ({ ...current, [material.id]: opened.material }));
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
      setOpeningMaterialIds((current) => current.filter((materialId) => materialId !== material.id));
    }
  };

  const selectedMaterialSummary = selectedMaterialId
    ? materials?.materials.find((material) => material.id === selectedMaterialId) ?? null
    : null;
  const selectedMaterial = selectedMaterialId
    ? openedMaterialCache[selectedMaterialId] ?? (selectedMaterialSummary ? {
      id: selectedMaterialSummary.id,
      subject: selectedMaterialSummary.title,
      ...(selectedMaterialSummary.channel ? { channel: selectedMaterialSummary.channel } : {}),
    } : null)
    : null;
  const selectedMaterialLoading = Boolean(
    selectedMaterialId && openingMaterialIds.includes(selectedMaterialId) && !openedMaterialCache[selectedMaterialId],
  );

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
  const nextTakeoverPoint = branch
    ? manifest?.takeoverPoints.find((point) => point.week > branch.currentWeek) ?? null
    : null;
  const currentWeekHasLabel = milestones.some((milestone) => milestone.week === selectedWeek)
    || manifest?.takeoverPoints.some((point) => point.week === selectedWeek);

  const stakeholderState = useMemo(() => {
    if (!mainline) return [];
    const currentById = new Map(mainline.stakeholders.stakeholders.map((item) => [item.id, item.initialEngagement.current]));
    const desiredById = new Map(mainline.stakeholders.stakeholders.map((item) => [item.id, item.initialEngagement.desired]));
    const latestEventById = new Map<string, StakeholderEvent>();
    for (const event of mainline.stakeholders.mainlineEngagementEvents.filter((item) => item.week <= selectedWeek)) {
      currentById.set(event.stakeholderId, event.current);
      if (event.desired) desiredById.set(event.stakeholderId, event.desired);
      latestEventById.set(event.stakeholderId, event);
    }
    const branchUpdatedStakeholderIds = new Set<string>();
    if (branch && branchState && selectedWeek === branch.currentWeek) {
      for (const transition of branchState.stakeholderTransitions) {
        if (typeof transition.stakeholderId === "string" && typeof transition.state === "string") {
          currentById.set(transition.stakeholderId, transition.state);
          branchUpdatedStakeholderIds.add(transition.stakeholderId);
        }
      }
    }
    const touchpointById = new Map(mainline.stakeholders.communicationTouchpoints.map((touchpoint) => [touchpoint.id, touchpoint]));
    return mainline.stakeholders.stakeholders
      .filter((item) => item.identifiedWeek <= selectedWeek)
      .map((item) => {
        const latestEvent = latestEventById.get(item.id);
        return {
          ...item,
          current: currentById.get(item.id) ?? item.initialEngagement.current,
          desired: desiredById.get(item.id) ?? item.initialEngagement.desired,
          primaryTouchpoint: touchpointById.get(item.primaryCommunicationTouchpointId),
          lastUpdatedWeek: branchUpdatedStakeholderIds.has(item.id) ? branch?.currentWeek ?? selectedWeek : latestEvent?.week ?? item.identifiedWeek,
          lastEvidence: branchUpdatedStakeholderIds.has(item.id) ? ["个人分支回合结算"] : latestEvent?.evidence ?? [item.identificationBasis],
        };
      });
  }, [branch, branchState, mainline, selectedWeek]);

  const engagementPercent = useMemo(() => {
    if (!stakeholderState.length) return 0;
    const score = stakeholderState.reduce((sum, item) => sum + (engagementScores[item.current] ?? 1), 0);
    return Math.round(score / (stakeholderState.length * 5) * 100);
  }, [stakeholderState]);

  const riskState = useMemo(() => {
    if (!mainline) return [];
    const lifecycleById = new Map(mainline.risks.initialRisks.map((risk) => [risk.id, "identified"]));
    const controlStatusById = new Map<string, string | null>();
    const branchAssessmentById = new Map<string, { probability: number; impact: number }>();
    for (const event of mainline.risks.mainlineLifecycleEvents.filter((item) => item.week <= selectedWeek)) {
      for (const riskId of event.riskIds) {
        lifecycleById.set(riskId, event.toLifecycleState);
        if (event.controlStatus !== undefined) controlStatusById.set(riskId, event.controlStatus ?? null);
      }
    }
    if (branch && branchState && selectedWeek === branch.currentWeek) {
      for (const transition of branchState.riskTransitions) {
        if (typeof transition.riskId !== "string") continue;
        const lifecycle = typeof transition.toLifecycleState === "string"
          ? transition.toLifecycleState
          : typeof transition.lifecycleState === "string" ? transition.lifecycleState : null;
        if (lifecycle) lifecycleById.set(transition.riskId, lifecycle);
        if (typeof transition.controlStatus === "string" || transition.controlStatus === null) controlStatusById.set(transition.riskId, transition.controlStatus);
        const assessment = transition.assessmentChange ?? transition.assessment;
        if (assessment && typeof assessment === "object") {
          const candidate = assessment as Record<string, unknown>;
          if (typeof candidate.probability === "number" && typeof candidate.impact === "number") {
            branchAssessmentById.set(transition.riskId, { probability: candidate.probability, impact: candidate.impact });
          }
        }
      }
    }
    return mainline.risks.initialRisks
      .filter((risk) => risk.discoveredWeek <= selectedWeek)
      .map((risk) => ({
        ...risk,
        lifecycle: lifecycleById.get(risk.id) ?? "identified",
        controlStatus: controlStatusById.get(risk.id) ?? null,
        currentAssessment: branchAssessmentById.get(risk.id) ?? (risk.responseCompletedWeek <= selectedWeek ? risk.residual : risk.inherent),
      }));
  }, [branch, branchState, mainline, selectedWeek]);

  const requirementState = useMemo(() => {
    if (!mainline) return [];
    return mainline.requirements.requirements.filter((requirement) => requirement.discoveredWeek <= selectedWeek);
  }, [mainline, selectedWeek]);

  const assumptionState = useMemo(() => {
    if (!mainline) return [];
    return mainline.documents.assumptionLog.items
      .filter((assumption) => assumption.identifiedWeek <= selectedWeek)
      .map((assumption) => {
        const currentEvent = [...assumption.statusEvents].reverse().find((event) => event.week <= selectedWeek) ?? assumption.statusEvents[0];
        return { ...assumption, currentEvent };
      });
  }, [mainline, selectedWeek]);

  const lessonState = useMemo(() => {
    if (!mainline) return [];
    return mainline.documents.lessonsLearnedRegister.items.filter((lesson) => lesson.capturedWeek <= selectedWeek);
  }, [mainline, selectedWeek]);

  const milestoneState = useMemo(() => {
    if (!mainline) return [];
    return mainline.documents.milestoneList.items.map((milestone) => {
      const currentEvent = [...milestone.statusEvents].reverse().find((event) => event.week <= selectedWeek) ?? milestone.statusEvents[0];
      return { ...milestone, currentEvent };
    });
  }, [mainline, selectedWeek]);

  const activityListState = useMemo(() => {
    if (!mainline || selectedWeek < mainline.schedule.activityList.createdWeek) return [];
    return mainline.schedule.activities.map((activity) => {
      const roleEntries = Object.entries(activity.plannedPersonDaysByRole).sort((left, right) => right[1] - left[1]);
      return {
        ...activity,
        currentStatus: activityStatus(activity, selectedWeek),
        leadRoleId: roleEntries[0]?.[0] ?? "",
        totalPersonDays: roleEntries.reduce((sum, [, personDays]) => sum + personDays, 0),
      };
    });
  }, [mainline, selectedWeek]);

  const schedulePlanState = useMemo(() => {
    if (!mainline || selectedWeek < mainline.schedule.projectSchedulePlan.createdWeek) return null;
    const plan = mainline.schedule.projectSchedulePlan;
    const currentVersion = [...plan.versionEvents].reverse().find((event) => event.week <= selectedWeek) ?? plan.versionEvents[0];
    const currentStatus = [...plan.statusEvents].reverse().find((event) => event.week <= selectedWeek) ?? plan.statusEvents[0];
    const networkByActivityId = new Map(mainline.baselineWorkload.scheduleNetwork.activities.map((activity) => [activity.activityId, activity]));
    const activities = mainline.schedule.activities.map((activity) => ({
      ...activity,
      currentStatus: activityStatus(activity, selectedWeek),
      network: networkByActivityId.get(activity.id) ?? null,
    }));
    return {
      ...plan,
      currentVersion,
      currentStatus,
      activities,
      visibleVersionEvents: plan.versionEvents.filter((event) => event.week <= selectedWeek),
      visibleStatusEvents: plan.statusEvents.filter((event) => event.week <= selectedWeek),
    };
  }, [mainline, selectedWeek]);

  const scopeState = useMemo(() => {
    if (!mainline) return null;
    const statement = mainline.documents.projectScopeStatement;
    const currentBaseline = [...statement.baselineEvents].reverse().find((event) => event.week <= selectedWeek) ?? statement.baselineEvents[0];
    return {
      ...statement,
      currentBaseline,
      productScopeItems: statement.productScopeItems.map((item) => ({
        ...item,
        currentEvent: [...item.statusEvents].reverse().find((event) => event.week <= selectedWeek) ?? item.statusEvents[0],
      })),
      exclusions: statement.exclusions.filter((item) => item.effectiveWeek <= selectedWeek),
    };
  }, [mainline, selectedWeek]);

  const allDocumentEvents = useMemo(() => {
    if (!mainline) return [];
    return [...mainline.documents.mainlineEvents, ...mainline.documents.contentRevisions].sort((left, right) => left.week - right.week);
  }, [mainline]);

  const documentState = useMemo(() => {
    if (!mainline) return [];
    return mainline.documents.documents.map((document) => {
      const history = allDocumentEvents.filter((event) => event.week <= selectedWeek && documentVersionActions(event, document.id).length > 0);
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
  const selectedDocumentContentLocked = authenticated === false && !publicSampleDocumentIds.has(selectedDocument?.id ?? "");
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

  const requestAiReview = async () => {
    if (!branch || branch.status === "active" || aiReviewLoading) return;
    setAiReviewLoading(true);
    try {
      const response = await apiJson<{ review: Record<string, unknown> }>(`/api/lab/branches/${encodeURIComponent(branch.id)}/reviews/scenario`, { method: "POST" });
      setAiReview(response.review);
    } catch (caught) {
      setActionMessage(caught instanceof Error ? caught.message : "AI 复盘暂时不可用");
    } finally { setAiReviewLoading(false); }
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
  const roleById = new Map(mainline.workload.roles.map((role) => [role.id, role]));
  const workPackageById = new Map(mainline.workload.workPackages.map((workPackage) => [workPackage.id, workPackage]));
  const activityStatusCounts = Object.fromEntries(Object.keys(activityStatusLabels).map((status) => [status, activityListState.filter((activity) => activity.currentStatus === status).length])) as Record<keyof typeof activityStatusLabels, number>;
  const teamCharter = mainline.documents.teamCharter;
  const stakeholderNames = (stakeholderIds: string[]) => stakeholderIds.map((stakeholderId) => stakeholderById.get(stakeholderId)?.title ?? stakeholderId);
  const ccbMembers = mainline.documents.changeControlBoard.memberStakeholderIds.map((stakeholderId) => stakeholderById.get(stakeholderId)).filter((stakeholder): stakeholder is Stakeholder => Boolean(stakeholder));
  const visibleChangeItems = mainline.documents.changeItems
    .filter((change) => change.submittedWeek <= selectedWeek)
    .map((change) => ({ ...change, currentStatus: changeStatus(change, selectedWeek) }));
  const openChangeItems = visibleChangeItems.filter((change) => change.currentStatus !== "closed");
  const closedChangeItems = visibleChangeItems.filter((change) => change.currentStatus === "closed");
  const latestChangeItem = visibleChangeItems.at(-1);
  const visibleIssues = mainline.documents.issues.filter((issue) => issue.discoveredWeek <= selectedWeek);
  const discreteEstimateActivityCount = mainline.schedule.activities.filter((activity) => activity.type === "discrete" && activity.durationWeeks).length;
  const estimateMethodRows = [
    {
      id: "EST-M01",
      target: `${discreteEstimateActivityCount} 项离散活动工期`,
      method: "三点估算（PERT）",
      rule: "期望工期 = (O + 4M + P) / 6；方差 = ((P - O) / 6)²",
      source: "D02 / D07",
    },
    {
      id: "EST-M02",
      target: "人工成本",
      method: "自下而上估算",
      rule: "计划人日 × 标准日费率，按角色汇总",
      source: "D17 / D25",
    },
    {
      id: "EST-M03",
      target: "非人工成本",
      method: "自下而上估算",
      rule: "按资源类别和预计发生周汇总",
      source: "D11 / D25",
    },
  ];
  const estimateBasisRows = [
    {
      id: "BAS-01",
      parameter: "工作周换算",
      value: `1 周 = ${mainline.schedule.projectSchedulePlan.calendar.workDaysPerWeek} 个工作日`,
      boundary: "工期、人日和资源容量统一使用该口径。",
    },
    {
      id: "BAS-02",
      parameter: "关键路径适用范围",
      value: `${discreteEstimateActivityCount} 项离散活动`,
      boundary: `只使用 ${mainline.schedule.dependencyPolicy.supportedTypes.join(" / ")} 关系；人力投入型和重复活动不进入关键路径。`,
    },
    {
      id: "BAS-03",
      parameter: "资源装载",
      value: `${mainline.schedule.projectSchedulePlan.baseline.totalPlannedPersonDays} 计划人日`,
      boundary: "角色投入必须与 WBS 和批准进度基线对账。",
    },
    {
      id: "BAS-04",
      parameter: "变更控制",
      value: "仅使用已批准变更",
      boundary: "候选需求和待决变更不自动改写工期、成本或范围基线。",
    },
  ];
  const scheduleNetworkByActivityId = new Map(mainline.baselineWorkload.scheduleNetwork.activities.map((activity) => [activity.activityId, activity]));
  const discreteScheduleActivities = mainline.schedule.activities.filter((activity) => activity.type === "discrete" && activity.durationWeeks);
  const activityAttributeRows = discreteScheduleActivities.map((activity) => {
    const network = scheduleNetworkByActivityId.get(activity.id);
    const parallelRelations = activity.predecessors?.filter((predecessor) => predecessor.type === "SS") ?? [];
    const lagRelations = activity.predecessors?.filter((predecessor) => predecessor.lagWeeks !== 0) ?? [];
    return {
      ...activity,
      controlAttribute: network?.isCritical ? "零总浮动；延误会改变完工预测" : `可用总浮动 ${network?.totalFloat ?? 0} 周`,
      parallelRule: parallelRelations.length ? `与 ${parallelRelations.map((relation) => relation.activityId).join(" / ")} 并行启动` : activity.predecessors?.length ? "前置完成后启动" : "项目启动后可开始",
      leadLag: lagRelations.length ? lagRelations.map((relation) => `${relation.activityId} ${relation.type} +${relation.lagWeeks}周`).join("；") : "无提前量或滞后量",
    };
  });
  const durationEstimateRows = discreteScheduleActivities.map((activity) => {
    const network = scheduleNetworkByActivityId.get(activity.id);
    const estimate = activity.durationWeeks!;
    const standardDeviation = (estimate.pessimistic - estimate.optimistic) / 6;
    return {
      ...activity,
      expectedDuration: network?.expectedDuration ?? (estimate.optimistic + 4 * estimate.mostLikely + estimate.pessimistic) / 6,
      standardDeviation,
      variance: network?.durationVariance ?? standardDeviation ** 2,
    };
  });
  const scheduleNetworkRows = discreteScheduleActivities.map((activity) => ({
    ...activity,
    network: scheduleNetworkByActivityId.get(activity.id)!,
  }));
  const scheduleDataRows = mainline.schedule.activities
    .map((activity) => ({
      ...activity,
      currentStatus: activityStatus(activity, selectedWeek),
      network: scheduleNetworkByActivityId.get(activity.id) ?? null,
    }))
    .filter((activity) => (
      activity.startWeek === selectedWeek
      || activity.endWeek === selectedWeek
      || Boolean(activity.network?.isCritical && activity.startWeek <= selectedWeek && activity.endWeek >= selectedWeek)
      || (activity.type !== "discrete" && activity.startWeek <= selectedWeek && activity.endWeek >= selectedWeek)
    ));
  const visibleScheduleStatusEvents = mainline.schedule.projectSchedulePlan.statusEvents.filter((event) => event.week <= selectedWeek);
  const currentScheduleStatusEvent = visibleScheduleStatusEvents.at(-1) ?? null;
  const previousScheduleStatusEvent = visibleScheduleStatusEvents.at(-2) ?? null;
  const branchForecastActive = Boolean(branch && branchState && selectedWeek === branch.currentWeek);
  const forecastCompletionWeek = branchForecastActive ? branchState!.performance.forecastCompletionWeek : currentScheduleStatusEvent?.forecastFinishWeek ?? 32;
  const forecastVarianceWeeks = forecastCompletionWeek - mainline.schedule.projectSchedulePlan.calendar.plannedFinishWeek;
  const forecastEvidence = branchForecastActive
    ? `个人分支 W${branch!.currentWeek} 回合快照；基线仍为 W${mainline.schedule.projectSchedulePlan.calendar.plannedFinishWeek}。`
    : currentScheduleStatusEvent?.evidence ?? "初始预测依据批准的活动网络、资源日历和 W32 完工约束。";
  const activeCriticalActivityIds = scheduleNetworkRows
    .filter((activity) => activity.network.isCritical && activity.startWeek <= selectedWeek && activity.endWeek >= selectedWeek)
    .map((activity) => activity.id);
  const openScheduleRiskIds = riskState
    .filter((risk) => risk.lifecycle !== "closed" && risk.impactDimensions.includes("schedule"))
    .map((risk) => risk.id);
  const forecastMilestoneRows = milestoneState.filter((milestone) => milestone.currentEvent.forecastWeek !== milestone.baselineWeek);
  const laborCostRows = mainline.workload.roles.map((role) => ({
    ...role,
    subtotalCny: role.plannedPersonDays * role.standardDayRateCny,
  }));
  const totalLaborCostCny = laborCostRows.reduce((sum, role) => sum + role.subtotalCny, 0);
  const nonLaborCostRows = mainline.workload.plannedNonLaborCosts.map((cost) => ({
    ...cost,
    weeks: cost.entries.map((entry) => entry.week),
    subtotalCny: cost.entries.reduce((sum, entry) => sum + entry.amountCny, 0),
  }));
  const totalNonLaborCostCny = nonLaborCostRows.reduce((sum, cost) => sum + cost.subtotalCny, 0);
  const riskReserveCny = nonLaborCostRows.find((cost) => cost.id === "risk_uncertainty")?.subtotalCny ?? 0;
  const approvedCurrentReleaseCostChanges = visibleChangeItems.filter((change) => (
    change.decisionWeek > mainline.schedule.projectSchedulePlan.baseline.approvedWeek
    && change.decisionWeek <= selectedWeek
    && (change.decision === "approved" || change.decision === "approved_phased_delivery")
  ));
  const approvedCurrentReleaseCostImpactCny = approvedCurrentReleaseCostChanges.reduce((sum, change) => sum + change.impact.costCny, 0);
  const latestCostEstimateCny = mainline.workload.budgetAtCompletionCny + approvedCurrentReleaseCostImpactCny;
  const projectCalendarRows = [
    {
      id: "CAL-01",
      type: "项目基线周期",
      window: `W${mainline.schedule.projectSchedulePlan.calendar.plannedStartWeek}–W${mainline.schedule.projectSchedulePlan.calendar.plannedFinishWeek}`,
      rule: `每周 ${mainline.schedule.projectSchedulePlan.calendar.workDaysPerWeek} 个工作日`,
      owner: "项目经理",
      source: "D14",
    },
    {
      id: "CAL-02",
      type: "迭代节奏",
      window: "W9–W28",
      rule: "S1–S10，每两周一个迭代",
      owner: "技术负责人",
      source: "D14",
    },
    ...mainline.stakeholders.stageGates.map((gate) => ({
      id: gate.id,
      type: "阶段门",
      window: `W${gate.week}`,
      rule: gate.title,
      owner: stakeholderById.get(gate.decisionOwner)?.title ?? gate.decisionOwner,
      source: "D10 / D13",
    })),
  ];
  const nonHumanResourcePlans = nonLaborCostRows.filter((cost) => Boolean(nonHumanResourceDetails[cost.id]));
  const resourceBreakdownRows = [
    ...mainline.workload.roles.map((role) => ({
      id: `RBS-P-${role.id}`,
      level: "人员 / 核心团队",
      resource: role.title,
      resourceId: role.id,
      controlBoundary: "派工与交接见 D17；逐周容量见 D24。",
    })),
    ...nonHumanResourcePlans.map((resource) => ({
      id: `RBS-N-${resource.id}`,
      level: `非人力 / ${nonHumanResourceDetails[resource.id].group}`,
      resource: resource.title,
      resourceId: resource.id,
      controlBoundary: "需求窗口见 D25；分配记录见 D11。",
    })),
  ];
  const activityResourceRequirementRows = mainline.schedule.activities.map((activity) => {
    const roleRequirements = Object.entries(activity.plannedPersonDaysByRole)
      .filter(([, personDays]) => personDays > 0)
      .map(([roleId, personDays]) => `${roleById.get(roleId)?.title ?? roleId} ${personDays}人日`);
    return {
      ...activity,
      roleRequirements,
      totalPersonDays: Object.values(activity.plannedPersonDaysByRole).reduce((sum, personDays) => sum + personDays, 0),
    };
  });
  const nonHumanRequirementRows = nonHumanResourcePlans.map((resource) => ({
    id: resource.id,
    title: resource.title,
    group: nonHumanResourceDetails[resource.id].group,
    weeks: resource.weeks,
    relatedWbsIds: nonHumanResourceDetails[resource.id].relatedWbsIds,
  }));
  const materialAllocationRows = nonHumanResourcePlans.map((resource) => {
    const allocatedEntries = resource.entries.filter((entry) => entry.week <= selectedWeek);
    const allocatedCny = allocatedEntries.reduce((sum, entry) => sum + entry.amountCny, 0);
    const nextEntry = resource.entries.find((entry) => entry.week > selectedWeek);
    return {
      ...resource,
      group: nonHumanResourceDetails[resource.id].group,
      relatedWbsIds: nonHumanResourceDetails[resource.id].relatedWbsIds,
      allocatedCny,
      remainingCny: resource.subtotalCny - allocatedCny,
      nextWeek: nextEntry?.week ?? null,
      status: allocatedCny === resource.subtotalCny ? "已完成" : allocatedCny > 0 ? "部分分配" : "待分配",
    };
  });
  const teamAssignmentRows = mainline.workload.roles.map((role) => {
    const stakeholder = mainline.stakeholders.stakeholders.find((item) => item.resourceRoleId === role.id);
    const primaryWorkPackages = Object.entries(mainline.workload.roleWorkPackagePersonDays[role.id] ?? {})
      .filter(([, personDays]) => personDays > 0)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([workPackageId]) => workPackageId);
    const resourceInterrupted = role.id === "vehicle_integration" && selectedWeek >= 17;
    const assignmentStatus = !resourceInterrupted
      ? "已派工"
      : selectedWeek === 17
        ? "临时不可用"
        : selectedWeek < 20
          ? "替补执行中"
          : "已恢复";
    const handoverStatus = !resourceInterrupted
      ? "不适用"
      : selectedWeek === 17
        ? "待启动"
        : selectedWeek < 20
          ? "结构化交接中"
          : "交接完成";
    return {
      role,
      stakeholder,
      primaryWorkPackages,
      assignmentStatus,
      handoverStatus,
      evidence: resourceInterrupted ? "ISS-004 / CR-004" : "D17 / D31",
    };
  });
  const resourceCalendarRows = mainline.workload.roles.map((role) => {
    const plannedPersonDays = weekState.rolePersonDays[role.id] ?? 0;
    const overtimePersonDays = weekState.overtimePersonDays?.[role.id] ?? 0;
    const isUnavailable = role.id === "vehicle_integration" && (selectedWeek === 17 || selectedWeek === 18);
    const availablePersonDays = isUnavailable ? 0 : mainline.workload.personDaysPerPersonWeek + overtimePersonDays;
    const balancePersonDays = availablePersonDays - plannedPersonDays;
    return {
      role,
      plannedPersonDays,
      availablePersonDays,
      balancePersonDays,
      status: isUnavailable ? "不可用" : balancePersonDays < 0 ? "存在缺口" : balancePersonDays === 0 ? "满载" : "有余量",
      exception: isUnavailable
        ? "ISS-004：W17–W18 不可用"
        : overtimePersonDays > 0
          ? `批准加班 ${overtimePersonDays} 人日`
          : "无当前例外",
    };
  });
  const communicationRecords = [
    ...(teamCharter.effectiveWeek <= selectedWeek ? [{
      id: "COM-W1",
      week: teamCharter.effectiveWeek,
      type: "协作生效",
      subject: "团队协作与沟通规则生效",
      conclusion: "D31 团队章程生效；后续关键决策、审批、承诺和升级进入 D13。",
      owner: stakeholderById.get(teamCharter.facilitatorStakeholderId)?.title ?? teamCharter.facilitatorStakeholderId,
      participants: stakeholderNames(teamCharter.agreedByStakeholderIds).join("、"),
      evidence: "D31",
    }] : []),
    ...mainline.stakeholders.stageGates.filter((gate) => gate.week <= selectedWeek).map((gate) => ({
      id: `COM-${gate.id}`,
      week: gate.week,
      type: "阶段门",
      subject: gate.title,
      conclusion: "阶段门通过，后续工作按已批准结论执行。",
      owner: stakeholderById.get(gate.decisionOwner)?.title ?? gate.decisionOwner,
      participants: stakeholderNames(gate.requiredSignoffs).join("、"),
      evidence: `${gate.id} / ${gate.evidenceTitles.slice(0, 3).join(" / ")}${gate.evidenceTitles.length > 3 ? ` 等 ${gate.evidenceTitles.length} 项` : ""}`,
    })),
    ...visibleChangeItems.map((change) => {
      const decided = change.decisionWeek <= selectedWeek;
      return {
        id: `COM-${change.id}`,
        week: decided ? change.decisionWeek : change.submittedWeek,
        type: "变更审查",
        subject: `${change.id} ${change.title}`,
        conclusion: decided ? change.decisionSummary : `已提交评审，计划 W${change.decisionWeek} 形成决策。`,
        owner: stakeholderById.get(change.ownerStakeholderId)?.title ?? change.ownerStakeholderId,
        participants: `提出：${stakeholderById.get(change.requesterStakeholderId)?.title ?? change.requesterStakeholderId}`,
        evidence: `D05 / ${change.id}`,
      };
    }),
    ...visibleIssues.filter((issue) => issue.severity === "high" || issue.severity === "critical").map((issue) => {
      const resolved = issue.resolvedWeek <= selectedWeek;
      return {
        id: `COM-${issue.id}`,
        week: resolved ? issue.resolvedWeek : issue.discoveredWeek,
        type: "问题升级",
        subject: `${issue.id} ${issue.title}`,
        conclusion: resolved ? issue.resolution : `已升级，目标 W${issue.targetResolutionWeek} 完成处置。`,
        owner: stakeholderById.get(issue.ownerStakeholderId)?.title ?? issue.ownerStakeholderId,
        participants: "必要专业负责人和受影响责任人",
        evidence: ["D08", issue.id, ...issue.linkedChangeIds].join(" / "),
      };
    }),
  ].sort((left, right) => right.week - left.week || right.id.localeCompare(left.id));
  const visibleTestRounds = mainline.documents.testRounds.filter((testRound) => testRound.executionWeek <= selectedWeek);
  const remoteControlScopeItem = scopeState?.productScopeItems.find((item) => item.id === "PSC-03");
  const branchRemoteControlDeferred = Boolean(
    branch
    && branchState
    && selectedWeek === branch.currentWeek
    && branchState.scenario.id === "scenario-3"
    && branchState.scenario.status === "closed",
  );
  const remoteControlApplicable = remoteControlScopeItem?.currentEvent.status !== "deferred_from_v1_0" && !branchRemoteControlDeferred;
  const qualityMetricDefinitions = [
    ...mainline.quality.hardGates.map((metric) => ({ ...metric, category: "硬性质量门" })),
    ...mainline.quality.performanceMetrics.map((metric) => ({ ...metric, category: "绩效指标" })),
  ];
  const qualityMeasurementRows = qualityMetricDefinitions.map((metric) => {
    const series = mainline.quality.mainlineSeries.find((item) => item.metricId === metric.id);
    const measuredAnchor = latestQualityMeasurement(series, selectedWeek);
    const notApplicable = metric.scope === "remote_control_enabled" && !remoteControlApplicable;
    const result = evaluateQualityMetric(metric, measuredAnchor?.value ?? null, notApplicable);
    const evidenceRound = measuredAnchor
      ? visibleTestRounds.filter((testRound) => testRound.executionWeek <= measuredAnchor.week).at(-1)
      : null;
    const profile = qualityMeasurementProfiles[metric.id];
    return {
      ...metric,
      title: qualityMetricLabels[metric.id] ?? metric.id,
      profile,
      measuredWeek: notApplicable ? branchRemoteControlDeferred ? selectedWeek : remoteControlScopeItem?.currentEvent.week ?? null : measuredAnchor?.week ?? null,
      actual: notApplicable ? null : measuredAnchor?.value ?? null,
      result,
      evidence: notApplicable
        ? branchRemoteControlDeferred ? "个人分支 D16 · 批准远程控制移出 V1.0" : `D16 · ${remoteControlScopeItem?.currentEvent.evidence ?? "批准范围变更"}`
        : [profile?.evidence, evidenceRound?.id].filter(Boolean).join(" / "),
    };
  });
  const qualityResultCounts = Object.fromEntries(Object.keys(qualityResultLabels).map((result) => [
    result,
    qualityMeasurementRows.filter((row) => row.result === result).length,
  ])) as Record<keyof typeof qualityResultLabels, number>;
  const qualityReportWeeks = [...new Set([14, 20, 28, 32, selectedWeek])]
    .filter((week) => week >= 14 && week <= selectedWeek)
    .sort((left, right) => left - right);
  const qualityTrendRows = qualityReportWeeks.map((week) => {
    const remoteControlStatus = week === selectedWeek && branchRemoteControlDeferred ? "deferred_from_v1_0" : [...(mainline.documents.projectScopeStatement.productScopeItems.find((item) => item.id === "PSC-03")?.statusEvents ?? [])]
      .reverse()
      .find((event) => event.week <= week)?.status;
    const results = qualityMetricDefinitions.map((metric) => evaluateQualityMetric(
      metric,
      latestQualityMeasurement(mainline.quality.mainlineSeries.find((series) => series.metricId === metric.id), week)?.value ?? null,
      metric.scope === "remote_control_enabled" && remoteControlStatus === "deferred_from_v1_0",
    ));
    const seriousOpenIssues = mainline.documents.issues.filter((issue) => (
      issue.discoveredWeek <= week
      && issue.resolvedWeek > week
      && (issue.severity === "high" || issue.severity === "critical")
      && ["quality", "performance", "security"].includes(issue.category)
    )).length;
    return {
      week,
      measured: results.filter((result) => result === "passed" || result === "failed").length,
      passed: results.filter((result) => result === "passed").length,
      failed: results.filter((result) => result === "failed").length,
      notApplicable: results.filter((result) => result === "not_applicable").length,
      seriousOpenIssues,
    };
  });
  const qualityReportMetricFailures = qualityMeasurementRows.filter((metric) => metric.result === "failed");
  const qualityReportIssueFailures = visibleIssues.filter((issue) => (
    issue.resolvedWeek > selectedWeek
    && (issue.severity === "high" || issue.severity === "critical")
    && ["quality", "performance", "security"].includes(issue.category)
  ));
  const qualityReleaseBlockingIssues = qualityReportIssueFailures.filter((issue) => !(issue.id === "ISS-007" && !remoteControlApplicable));
  const qualityHardGateRows = qualityMeasurementRows.filter((metric) => metric.category === "硬性质量门");
  const qualityHardGateEvidenceMissing = qualityHardGateRows.some((metric) => metric.result === "not_measured");
  const qualityHardGateFailed = qualityHardGateRows.some((metric) => metric.result === "failed");
  const latestQualityTestRound = visibleTestRounds.at(-1) ?? null;
  const qualityReleaseRecommendation = qualityReleaseBlockingIssues.length || qualityHardGateFailed || latestQualityTestRound?.result === "failed_gate"
    ? "存在未关闭严重问题或未通过硬性质量门；受影响能力不得发布，完成修复和复测后重新评审。"
    : qualityHardGateEvidenceMissing
      ? "硬性质量门证据尚未齐备；可以继续计划内开发与验证，但不能形成发布批准。"
      : !remoteControlApplicable
        ? "只读车况能力可按批准范围发布；远程控制保持关闭，并转入 V1.1 完成安全修复和复测。"
        : qualityReportMetricFailures.length
          ? "硬性质量门已通过；其余未达标指标继续改进并在下一阶段门复核。"
          : selectedWeek >= 32
            ? "批准范围满足质量门和上线验证要求，可完成正式上线、运营移交与收尾。"
            : "当前批准范围达到阶段质量要求，可进入下一阶段。";
  const qualityReportStatus = qualityReleaseBlockingIssues.length || qualityHardGateFailed || latestQualityTestRound?.result === "failed_gate"
    ? "阻断受影响能力"
    : qualityHardGateEvidenceMissing ? "证据待齐" : !remoteControlApplicable ? "按批准范围通过" : "阶段通过";
  const qualityResidualRisks = riskState
    .filter((risk) => risk.lifecycle !== "closed" && risk.impactDimensions.some((dimension) => dimension === "quality" || dimension === "safety"))
    .sort((left, right) => right.currentAssessment.probability * right.currentAssessment.impact - left.currentAssessment.probability * left.currentAssessment.impact)
    .slice(0, 3);
  const openRiskRows = riskState
    .filter((risk) => risk.lifecycle !== "closed")
    .sort((left, right) => {
      const severityDifference = Number(Boolean(right.severityOverride)) - Number(Boolean(left.severityOverride));
      return severityDifference || right.currentAssessment.probability * right.currentAssessment.impact - left.currentAssessment.probability * left.currentAssessment.impact;
    });
  const highOpenRiskCount = openRiskRows.filter((risk) => ["高", "极高"].includes(riskSeverity(risk.currentAssessment.probability, risk.currentAssessment.impact, risk.severityOverride))).length;
  const criticalOpenRiskCount = openRiskRows.filter((risk) => riskSeverity(risk.currentAssessment.probability, risk.currentAssessment.impact, risk.severityOverride) === "极高").length;
  const riskReportWeeks = [...new Set([4, 8, 12, 20, 28, 32, selectedWeek])]
    .filter((week) => week >= 4 && week <= selectedWeek)
    .sort((left, right) => left - right);
  const riskTrendRows = riskReportWeeks.map((week) => {
    const rows = week === selectedWeek ? riskState : (() => {
      const lifecycleById = new Map(mainline.risks.initialRisks.map((risk) => [risk.id, "identified"]));
      for (const event of mainline.risks.mainlineLifecycleEvents.filter((item) => item.week <= week)) {
        for (const riskId of event.riskIds) lifecycleById.set(riskId, event.toLifecycleState);
      }
      return mainline.risks.initialRisks.filter((risk) => risk.discoveredWeek <= week).map((risk) => ({
        ...risk,
        lifecycle: lifecycleById.get(risk.id) ?? "identified",
        currentAssessment: risk.responseCompletedWeek <= week ? risk.residual : risk.inherent,
      }));
    })();
    const open = rows.filter((risk) => risk.lifecycle !== "closed");
    return {
      week,
      identified: rows.length,
      open: open.length,
      high: open.filter((risk) => ["高", "极高"].includes(riskSeverity(risk.currentAssessment.probability, risk.currentAssessment.impact, risk.severityOverride))).length,
      medium: open.filter((risk) => riskSeverity(risk.currentAssessment.probability, risk.currentAssessment.impact, risk.severityOverride) === "中").length,
      closed: rows.length - open.length,
    };
  });
  const riskReportConclusion = criticalOpenRiskCount
    ? "存在极高风险，必须升级治理并维持相关安全与质量门。"
    : highOpenRiskCount
      ? "存在高风险，继续执行已批准应对并跟踪其对阶段门的影响。"
      : openRiskRows.length
        ? "剩余风险处于中低等级，按既定责任持续监控。"
        : "所有已识别风险均已关闭，可按项目收尾程序归档。";
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
              {loadingScenarioId === currentTakeoverPoint.scenarioId ? "正在创建分支…" : authenticated ? "从这里接手 →" : "登录并从这里接手 →"}
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
                  className={`${material.opened ? "opened" : ""} ${selectedMaterialId === material.id ? "active" : ""}`}
                  disabled={openingMaterialIds.includes(material.id)}
                  onClick={() => void openMaterial(material)}
                >
                  <i>{material.opened ? "✓" : "·"}</i><span><small>{materialGroupLabels[material.group] ?? material.type}</small><strong>{material.title}</strong><em>{material.channel ?? "项目仪表盘"}</em></span><b>{openingMaterialIds.includes(material.id) ? "读取中" : material.opened ? "查看" : "打开"}</b>
                </button>
              ))}
            </aside>
            <article>
              {selectedMaterial ? (
                <>
                  <span>{selectedMaterial.id} / {selectedMaterialLoading ? "正在记录查看" : "已记录查看"}</span>
                  <h3>{selectedMaterial.subject ?? selectedMaterial.displayLabel ?? "项目状态信号"}</h3>
                  <small>{selectedMaterial.channel ? `来源：${selectedMaterial.channel}` : "来源：项目仪表盘"}</small>
                  {selectedMaterialLoading ? <div className="lab-v2-material-loading"><i /><i /><i /></div> : null}
                  {!selectedMaterialLoading && selectedMaterial.facts?.length ? <ul>{selectedMaterial.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul> : null}
                  {!selectedMaterialLoading && selectedMaterial.documentIds?.length ? <div className="lab-v2-material-docs">{selectedMaterial.documentIds.map((documentId) => <button key={documentId} onClick={() => { setSelectedDocumentId(documentId); setManagementFilter(null); setDocumentDrawerOpen(true); }}>{documentId} 查看关联文件</button>)}</div> : null}
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
                    {roundResult.rulesetVersion !== 2 ? (
                      <div className="lab-v2-legacy-result"><strong>历史判定正在升级</strong><p>这条结果由旧版规则保存。你已经提交的行动链不会丢失；下一次提交时，系统会把历史行动链一起重新识别，不再把已完成的前置动作判成遗漏。</p></div>
                    ) : roundResult.gaps.length ? (
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
                                  {missingPrerequisites.length > 0 && <section className="notice"><strong>前置动作</strong><p>需要先完成：{missingPrerequisites.map((item) => item.title).join("；")}</p></section>}
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

      {branch && branchComparison && <section className="lab-v2-branch-workspace">
        <header><div><span>PATH COMPARISON / Git 式路径比较</span><h2>主线与个人分支</h2><p>从 W{branchComparison.forkWeek} 分叉；项目状态仍仅由服务端确定性规则结算。</p></div><div><strong>{branchComparison.outcomeClassification ?? "进行中"}</strong><span>路径结论</span></div></header>
        <div className="lab-v2-detail-metrics"><span><b>{branchComparison.mainline.spi.toFixed(2)}</b>主线 SPI</span><span><b>{branchComparison.branch?.spi?.toFixed(2) ?? "—"}</b>分支 SPI</span><span><b>W{branchComparison.mainline.forecastCompletionWeek}</b>主线完工</span><span><b>W{branchComparison.branch?.forecastCompletionWeek ?? "—"}</b>分支预测</span></div>
        {branch.status !== "active" && <div className="lab-v2-gap"><strong>情景结局与规则复盘</strong><p>{branch.status === "failed" ? "路径未满足终局约束；请依据本回合缺口、文件差异和客观指标复盘。" : "情景已闭环；比较进度、成本、治理和文件更新，识别绕路或延误来源。"}</p><button type="button" disabled={aiReviewLoading} onClick={() => void requestAiReview()}>{aiReviewLoading ? "正在生成 AI 复盘…" : "生成 AI 结构化复盘"}</button>{aiReview && <div><p>{String(aiReview.summary ?? "")}</p><small>{String(aiReview.retrySuggestion ?? "")}</small></div>}<nav className="lab-v2-branch-next-actions"><button type="button" onClick={() => leaveBranch(branch.currentWeek)}>返回主线</button>{nextTakeoverPoint && <button type="button" className="primary" onClick={() => leaveBranch(nextTakeoverPoint.week)}>开始下一情景 · W{nextTakeoverPoint.week}</button>}</nav></div>}
      </section>}

      <button className={`lab-v2-drawer-tab history ${branchHistoryOpen ? "open" : ""}`} onClick={() => { setDocumentDrawerOpen(false); setBranchHistoryOpen((current) => !current); }}>
        <i className="lab-v2-branch-glyph" aria-hidden="true"><em className="trunk" /><em className="fork" /><em className="node top" /><em className="node middle" /><em className="node bottom" /></i><span>接手记录</span><b>{branches.length}</b>
      </button>

      {branchHistoryOpen && <div className="lab-v2-drawer-backdrop" onClick={() => setBranchHistoryOpen(false)}>
        <aside className="lab-v2-branch-history-drawer" onClick={(event) => event.stopPropagation()}>
          <header><div><span>TAKEOVER HISTORY</span><h2>接手记录</h2><p>每次接手形成独立分支；点击记录可切换并回看当时的行动和结局。</p></div><button type="button" onClick={() => setBranchHistoryOpen(false)}>关闭</button></header>
          {branch && <button className="lab-v2-history-mainline" type="button" onClick={() => { setBranchHistoryOpen(false); leaveBranch(branch.currentWeek); }}>返回项目主线</button>}
          <div className="lab-v2-branch-history-list">{branches.length ? branches.map((summary) => <button key={summary.id} type="button" className={branch?.id === summary.id ? "active" : ""} onClick={() => switchBranch(summary)}><i>W{summary.forkWeek}</i><span><strong>{scenarioLabels[summary.scenarioId] ?? summary.scenarioId}</strong><small>{summary.caseVersion.toUpperCase()} · {summary.status === "active" ? `进行中 · 回合 ${summary.currentRoundNumber}` : summary.status === "completed" ? `已完成 · ${pathClassificationLabels[summary.outcomeClassification ?? ""] ?? "已闭环"}` : "已失败 · 可回看"}</small></span><b>{branch?.id === summary.id ? "当前" : "打开"}</b></button>) : <p>还没有接手记录。请先在 W9、W17 或 W25 从主线创建分支。</p>}</div>
        </aside>
      </div>}

      <button className={`lab-v2-drawer-tab ${documentDrawerOpen ? "open" : ""}`} onClick={() => { setBranchHistoryOpen(false); setDocumentDrawerOpen((current) => !current); }}>
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
                      className={`${selectedDocument?.id === document.id ? "active" : ""} ${relatedDocumentIds.has(document.id) ? "related" : ""} ${document.status === "未创建" ? "locked" : ""} ${authenticated === false && !publicSampleDocumentIds.has(document.id) ? "content-locked" : ""}`}
                      onClick={() => setSelectedDocumentId(document.id)}
                    >
                      <b>{document.id}</b><span><strong>{document.title}</strong><small>{authenticated === false && !publicSampleDocumentIds.has(document.id) ? "登录查看内容" : `v${document.version} · ${document.status}`}</small></span><i>{authenticated === false && !publicSampleDocumentIds.has(document.id) ? "锁" : ""}</i>
                    </button>
                  ))}
                </div>
              </nav>
              <article>
                {selectedDocument && (
                  <>
                    <div className="lab-v2-document-title"><span>{selectedDocument.id} / W{selectedWeek} 主线版本</span><h3>{selectedDocument.title}</h3><div><b>{selectedDocument.status}</b><i>v{selectedDocument.version}</i><small>创建于 W{selectedDocument.createdWeek}</small></div></div>
                    {selectedDocument.status === "未创建" ? <div className="lab-v2-document-locked"><strong>该文件尚未创建</strong><p>将时间轴拖动到 W{selectedDocument.createdWeek} 后查看首个版本。</p></div> : selectedDocumentContentLocked ? <div className="lab-v2-document-locked"><strong>登录查看具体内容</strong><p>项目文件目录保持开放；登录后可查看当前内容、版本历史、关联文件和个人分支差异。</p><button type="button" onClick={signIn}>登录并解锁项目文件</button></div> : <>
                      <section className="lab-v2-document-summary"><span>当前内容摘要</span><dl><div><dt>文件用途</dt><dd>{selectedDocument.coverage === "dynamic_full_history" ? "动态管理文件，保留完整更新历史" : "支持性文件，在关键阶段形成版本"}</dd></div><div><dt>当前阶段</dt><dd>{projectStage(selectedWeek)}</dd></div><div><dt>最近变更</dt><dd>{selectedDocument.history[selectedDocument.history.length - 1]?.reason ?? `W${selectedDocument.createdWeek} 创建初始版本`}</dd></div><div><dt>版本依据</dt><dd>主线事件、阶段门审批与关联文件变化</dd></div></dl></section>
                      {branch && documentPatches.length > 0 && <section className="lab-v2-document-summary"><span>主线 ↔ 个人分支字段差异</span><dl>{documentPatches.flatMap((patch) => patch.operations.map((operation) => <div key={`${patch.roundNumber}:${operation.path}`}><dt>W{patch.week} {operation.op}</dt><dd><code>{operation.path}</code> → {String(operation.value)}</dd></div>))}</dl></section>}
                      {selectedDocument.id === "D01" && (
                        <section className="lab-v2-document-data lab-v2-document-stack lab-v2-schedule-control-document">
                          <div className="lab-v2-schedule-control-metrics">
                            <span><b>{activityAttributeRows.length}</b>离散活动</span>
                            <span><b>{activityAttributeRows.filter((activity) => activity.controlAttribute.startsWith("零总浮动")).length}</b>零浮动活动</span>
                            <span><b>{activityAttributeRows.filter((activity) => activity.parallelRule.startsWith("与")).length}</b>允许并行启动</span>
                            <span><b>{activityAttributeRows.filter((activity) => activity.leadLag !== "无提前量或滞后量").length}</b>含滞后关系</span>
                          </div>
                          <section>
                            <span>活动控制属性 · 不重复 D02 的清单、工期和完成标准</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-activity-attribute-table">
                                <colgroup><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>活动 / WBS</th><th>关键性与浮动约束</th><th>并行启动约束</th><th>提前量 / 滞后量</th></tr></thead>
                                <tbody>{activityAttributeRows.map((activity) => <tr key={activity.id}><td>{activity.id}<small>{activity.title}</small></td><td>{activity.controlAttribute}</td><td>{activity.parallelRule}</td><td>{activity.leadLag}</td></tr>)}</tbody>
                              </table>
                            </div>
                            <p className="lab-v2-document-note">关系和活动编号来自 D02；浮动来自 D15。没有批准依据的限制日期、提前量或额外假设不写入本文件。</p>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D02" && (
                        <section className="lab-v2-activity-list">
                          <div className="lab-v2-activity-list-metrics">
                            <span><b>{activityListState.length}</b>全部活动</span>
                            <span><b>{activityStatusCounts.in_progress}</b>进行中</span>
                            <span><b>{activityStatusCounts.waiting_next_occurrence}</b>等待发生</span>
                            <span><b>{activityStatusCounts.completed}</b>已完成</span>
                          </div>
                          <div className="lab-v2-data-table-wrap lab-v2-wide-register-wrap">
                            <table className="lab-v2-activity-list-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>活动 / WBS</th><th>活动名称</th><th>类型</th><th>计划窗口 / 估算</th><th>当前状态</th><th>前置关系</th><th>主责投入</th><th>完成标准</th></tr></thead>
                              <tbody>{activityListState.map((activity) => <tr key={activity.id}><td><strong>{activity.id}</strong><small>{activity.parentId} · {workPackageById.get(activity.parentId)?.title}</small></td><td>{activity.title}</td><td>{activityTypeLabels[activity.type]}</td><td>W{activity.startWeek}–W{activity.endWeek}<small>{activity.durationWeeks ? `三点估算 ${activity.durationWeeks.optimistic}/${activity.durationWeeks.mostLikely}/${activity.durationWeeks.pessimistic} 周` : activity.occurrenceWeeks ? `发生于 W${activity.occurrenceWeeks.join(" / W")}` : "持续投入"}</small></td><td><strong>{activityStatusLabels[activity.currentStatus]}</strong></td><td>{activity.predecessors?.length ? activity.predecessors.map((predecessor) => `${predecessor.activityId} ${predecessor.type}${predecessor.lagWeeks ? `+${predecessor.lagWeeks}` : ""}`).join("；") : "无"}</td><td>{roleById.get(activity.leadRoleId)?.title ?? activity.leadRoleId}<small>合计 {activity.totalPersonDays} 人日</small></td><td>{activity.acceptanceCriteria.join("；")}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {selectedDocument.id === "D03" && (
                        <section className="lab-v2-document-data">
                          <span>假设日志 · W{selectedWeek} · {assumptionState.length} 项已识别</span>
                          <div className="lab-v2-data-table-wrap lab-v2-wide-register-wrap">
                            <table className="lab-v2-assumption-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>编号 / 类别</th><th>假设陈述</th><th>负责人</th><th>识别 / 目标</th><th>当前状态</th><th>验证方法</th><th>若不成立的影响</th><th>最新证据</th><th>关联项</th></tr></thead>
                              <tbody>{assumptionState.map((assumption) => <tr key={assumption.id}><td><strong>{assumption.id}</strong><small>{assumptionCategoryLabels[assumption.category] ?? assumption.category}</small></td><td>{assumption.statement}</td><td>{stakeholderById.get(assumption.ownerStakeholderId)?.title ?? assumption.ownerStakeholderId}</td><td>W{assumption.identifiedWeek}<small>目标 W{assumption.targetValidationWeek}</small></td><td><strong>{assumptionStatusLabels[assumption.currentEvent.status]}</strong><small>W{assumption.currentEvent.week} 更新</small></td><td>{assumption.validationMethod}</td><td>{assumption.impactIfFalse}</td><td>{assumption.currentEvent.evidence}</td><td><strong>{assumption.linkedRiskIds.join(" / ") || "—"}</strong><small>{[...assumption.linkedRequirementIds, ...assumption.linkedDocumentIds].join(" / ")}</small></td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {selectedDocument.id === "D04" && (
                        <section className="lab-v2-document-data lab-v2-document-stack">
                          <section>
                            <span>估算方法与适用边界</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-estimate-method-table">
                                <colgroup><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>编号</th><th>估算对象</th><th>方法</th><th>计算规则</th><th>数据来源</th></tr></thead>
                                <tbody>{estimateMethodRows.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.target}</td><td>{row.method}</td><td>{row.rule}</td><td>{row.source}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                          <section>
                            <span>关键参数与控制口径</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-estimate-basis-table">
                                <colgroup><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>编号</th><th>参数</th><th>批准口径</th><th>适用边界</th></tr></thead>
                                <tbody>{estimateBasisRows.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.parameter}</td><td>{row.value}</td><td>{row.boundary}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                        </section>
                      )}
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
                      {selectedDocument.id === "D06" && (
                        <section className="lab-v2-document-data lab-v2-document-stack lab-v2-cost-estimate">
                          <div className="lab-v2-cost-metrics">
                            <span><b>{formatMoney(mainline.workload.budgetAtCompletionCny)}</b>{selectedWeek >= mainline.schedule.projectSchedulePlan.baseline.approvedWeek ? "批准 BAC" : "拟议 BAC"}</span>
                            <span><b>{formatMoney(totalLaborCostCny)}</b>人工估算</span>
                            <span><b>{formatMoney(totalNonLaborCostCny)}</b>非人工估算<small>含风险与不确定性 {formatMoney(riskReserveCny)}</small></span>
                            <span><b>{formatMoney(latestCostEstimateCny)}</b>最新估算<small>含已批准当前版本影响 {formatMoney(approvedCurrentReleaseCostImpactCny)}</small></span>
                          </div>
                          <section>
                            <span>人工成本 · 自下而上</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-cost-role-table">
                                <colgroup><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>角色</th><th>计划人日</th><th>标准日费率</th><th>小计</th></tr></thead>
                                <tbody>{laborCostRows.map((role) => <tr key={role.id}><td>{role.title}</td><td>{role.plannedPersonDays}</td><td>{formatMoney(role.standardDayRateCny)}</td><td>{formatMoney(role.subtotalCny)}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                          <section>
                            <span>非人工成本 · 类别与发生周</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-cost-nonlabor-table">
                                <colgroup><col /><col /><col /></colgroup>
                                <thead><tr><th>类别</th><th>预计发生周</th><th>估算</th></tr></thead>
                                <tbody>{nonLaborCostRows.map((cost) => <tr key={cost.id}><td>{cost.title}</td><td>W{cost.weeks.join(" / W")}</td><td>{formatMoney(cost.subtotalCny)}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                          <section>
                            <span>已批准的当前版本成本影响</span>
                            {approvedCurrentReleaseCostChanges.length ? <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-cost-change-table">
                                <colgroup><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>变更</th><th>决策周</th><th>决议</th><th>成本影响</th></tr></thead>
                                <tbody>{approvedCurrentReleaseCostChanges.map((change) => <tr key={change.id}><td>{change.id}<small>{change.title}</small></td><td>W{change.decisionWeek}</td><td>{changeDecisionLabels[change.decision]}</td><td>{formatMoney(change.impact.costCny)}</td></tr>)}</tbody>
                              </table>
                            </div> : <p className="lab-v2-register-empty">当前数据日期前没有已批准并纳入当前版本的成本变更。</p>}
                            <p className="lab-v2-document-note">最新估算用于影响判断，不等于重设 BAC；成本基线只有经过 D05 正式批准后才变更。</p>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D07" && (
                        <section className="lab-v2-document-data lab-v2-document-stack lab-v2-schedule-control-document">
                          <div className="lab-v2-schedule-control-metrics">
                            <span><b>{durationEstimateRows.length}</b>三点估算活动</span>
                            <span><b>{durationEstimateRows.reduce((sum, activity) => sum + activity.expectedDuration, 0).toFixed(1)}</b>期望工期合计<small>非项目总工期</small></span>
                            <span><b>{Math.max(...durationEstimateRows.map((activity) => activity.standardDeviation)).toFixed(2)}</b>最大标准差</span>
                            <span><b>W8</b>批准版本</span>
                          </div>
                          <section>
                            <span>持续时间估算 · PERT 结果与客观不确定性</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-duration-estimate-table">
                                <colgroup><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>活动 / WBS</th><th>O / M / P（周）</th><th>PERT 期望工期</th><th>不确定性</th></tr></thead>
                                <tbody>{durationEstimateRows.map((activity) => <tr key={activity.id}><td>{activity.id}<small>{activity.title}</small></td><td>{activity.durationWeeks!.optimistic} / {activity.durationWeeks!.mostLikely} / {activity.durationWeeks!.pessimistic}</td><td>{activity.expectedDuration.toFixed(2)} 周</td><td>标准差 {activity.standardDeviation.toFixed(2)}<small>方差 {activity.variance.toFixed(4)}</small></td></tr>)}</tbody>
                              </table>
                            </div>
                            <p className="lab-v2-document-note">估算方法和假设只在 D04 维护；本文件仅保存计算结果。人力投入型和重复活动不进入 PERT 与关键路径计算。</p>
                          </section>
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
                      {selectedDocument.id === "D09" && (
                        <section className="lab-v2-document-data">
                          <span>经验教训登记册 · W{selectedWeek} · {lessonState.length} 项已沉淀</span>
                          <div className="lab-v2-data-table-wrap lab-v2-wide-register-wrap">
                            <table className="lab-v2-lessons-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>编号 / 类别</th><th>经验主题</th><th>观察 / 收录</th><th>负责人 / 状态</th><th>情境与观察</th><th>影响</th><th>后续建议</th><th>适用阶段 / 证据</th></tr></thead>
                              <tbody>{lessonState.map((lesson) => <tr key={lesson.id}><td><strong>{lesson.id}</strong><small>{assumptionCategoryLabels[lesson.category] ?? lesson.category}</small></td><td>{lesson.title}</td><td>W{lesson.observedWeek}<small>收录 W{lesson.capturedWeek}</small></td><td>{stakeholderById.get(lesson.ownerStakeholderId)?.title ?? lesson.ownerStakeholderId}<small>{lessonStatusLabels[lesson.status]} · W{lesson.adoptedWeek}</small></td><td>{lesson.context}<small>{lesson.observation}</small></td><td>{lesson.impact}</td><td>{lesson.recommendation}</td><td>{lesson.applicablePhase}<small>{[...lesson.linkedIssueIds, ...lesson.linkedRiskIds, ...lesson.linkedChangeIds, ...lesson.evidenceDocumentIds].join(" / ")}</small></td></tr>)}</tbody>
                            </table>
                          </div>
                          {!lessonState.length && <p className="lab-v2-register-empty">当前周尚未完成正式复盘；经验教训登记册保留空白模板。</p>}
                        </section>
                      )}
                      {selectedDocument.id === "D10" && (
                        <section className="lab-v2-document-data">
                          <span>里程碑清单 · W{selectedWeek} · 基准 / 预测 / 实际</span>
                          <div className="lab-v2-data-table-wrap lab-v2-fit-table-wrap">
                            <table className="lab-v2-milestone-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>编号 / 里程碑</th><th>基准周</th><th>预测周</th><th>实际周</th><th>状态 / 负责人</th><th>验收标准</th><th>最新结论 / 证据</th></tr></thead>
                              <tbody>{milestoneState.map((milestone) => <tr key={milestone.id}><td><strong>{milestone.id}</strong><small>{milestone.title}</small></td><td>W{milestone.baselineWeek}</td><td>W{milestone.currentEvent.forecastWeek}</td><td>{milestone.currentEvent.actualWeek === null ? "—" : `W${milestone.currentEvent.actualWeek}`}</td><td><strong>{milestoneStatusLabels[milestone.currentEvent.status]}</strong><small>{stakeholderById.get(milestone.ownerStakeholderId)?.title ?? milestone.ownerStakeholderId}</small></td><td>{milestone.acceptanceCriteria}</td><td>{milestone.currentEvent.evidence}<small>{[...milestone.relatedWbsIds, ...milestone.evidenceDocumentIds].join(" / ")}</small></td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {selectedDocument.id === "D11" && (
                        <section className="lab-v2-document-data lab-v2-document-stack">
                          <section>
                            <span>非人力资源分配 · W{selectedWeek}</span>
                            <div className="lab-v2-data-table-wrap lab-v2-fit-table-wrap">
                              <table className="lab-v2-material-allocation-table">
                                <colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>资源</th><th>类别</th><th>对应WBS</th><th>计划分配周</th><th>累计已分配</th><th>剩余</th><th>状态 / 下一窗口</th></tr></thead>
                                <tbody>{materialAllocationRows.map((resource) => <tr key={resource.id}><td>{resource.id}<small>{resource.title}</small></td><td>{resource.group}</td><td>{resource.relatedWbsIds.join(" / ")}</td><td>W{resource.weeks.join(" / W")}</td><td>{formatMoney(resource.allocatedCny)}</td><td>{formatMoney(resource.remainingCny)}</td><td>{resource.status}<small>{resource.nextWeek ? `下一次 W${resource.nextWeek}` : "无后续分配"}</small></td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D12" && (
                        <section className="lab-v2-document-data lab-v2-document-stack">
                          <div className="lab-v2-resource-metrics">
                            <span><b>W1–W32</b>项目周期</span>
                            <span><b>{mainline.schedule.projectSchedulePlan.calendar.workDaysPerWeek}</b>工作日 / 周</span>
                            <span><b>10</b>双周迭代</span>
                            <span><b>{mainline.stakeholders.stageGates.length}</b>阶段门</span>
                          </div>
                          <section>
                            <span>受控项目日历</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-project-calendar-table">
                                <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>编号</th><th>类型</th><th>窗口</th><th>日历事项</th><th>责任人</th><th>依据</th></tr></thead>
                                <tbody>{projectCalendarRows.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.type}</td><td>{row.window}</td><td>{row.rule}</td><td>{row.owner}</td><td>{row.source}</td></tr>)}</tbody>
                              </table>
                            </div>
                            <p className="lab-v2-document-note">当前基线没有项目级停工日；个人不可用和批准加班只在 D24 资源日历维护。</p>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D13" && (
                        <section className="lab-v2-document-data lab-v2-document-stack">
                          <section>
                            <span>关键沟通记录 · W{selectedWeek} · {communicationRecords.length} 项</span>
                            <div className="lab-v2-data-table-wrap lab-v2-wide-register-wrap">
                              <table className="lab-v2-communication-table">
                                <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>周次 / 类型</th><th>主题</th><th>决策、承诺或升级结论</th><th>负责人</th><th>必要参与方</th><th>证据</th></tr></thead>
                                <tbody>{communicationRecords.map((record) => <tr key={record.id}><td>W{record.week}<small>{record.type}</small></td><td>{record.subject}</td><td>{record.conclusion}</td><td>{record.owner}</td><td>{record.participants}</td><td>{record.evidence}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D14" && schedulePlanState && (
                        <section className="lab-v2-project-schedule">
                          <div className={`lab-v2-schedule-hero ${schedulePlanState.currentStatus.health}`}>
                            <span>PROJECT SCHEDULE / {schedulePlanState.scheduleModelId} / DATA DATE W{selectedWeek}</span>
                            <div className="lab-v2-schedule-hero-main">
                              <div><small>当前受控版本</small><strong>v{schedulePlanState.currentVersion.version}</strong><i>{schedulePlanState.currentVersion.status}</i></div>
                              <div><small>进度基线</small><strong>W{schedulePlanState.calendar.plannedStartWeek}–W{schedulePlanState.calendar.plannedFinishWeek}</strong><i>W{schedulePlanState.baseline.approvedWeek} 批准</i></div>
                              <div><small>当前完工预测</small><strong>W{schedulePlanState.currentStatus.forecastFinishWeek}</strong><i>{schedulePlanState.currentStatus.forecastVarianceWeeks ? `较基线 +${schedulePlanState.currentStatus.forecastVarianceWeeks} 周` : "与基线一致"}</i></div>
                              <div><small>进度健康度</small><strong>{scheduleHealthLabels[schedulePlanState.currentStatus.health]}</strong><i>SPI {weekState?.spi.toFixed(2) ?? "—"}</i></div>
                            </div>
                            <p>{schedulePlanState.currentStatus.evidence}</p>
                            <footer><b>基线版本 {schedulePlanState.baseline.version}</b><span>{schedulePlanState.currentVersion.baselineChanged ? "本版本建立/修订基线" : "本版本未改变W32基线"}</span></footer>
                          </div>

                          <div className="lab-v2-schedule-metrics">
                            <span><b>{schedulePlanState.baseline.activityCount}</b>活动</span>
                            <span><b>{schedulePlanState.baseline.criticalActivityCount}</b>零浮动活动</span>
                            <span><b>{schedulePlanState.baseline.milestoneCount}</b>里程碑</span>
                            <span><b>{schedulePlanState.baseline.totalPlannedPersonDays}</b>计划人日</span>
                            <span><b>{formatMoney(weekState?.cumulativePlannedValueCny ?? 0)}</b>累计PV</span>
                            <span><b>{formatMoney(weekState?.cumulativeEarnedValueCny ?? 0)}</b>累计EV</span>
                          </div>

                          <section className="lab-v2-schedule-section">
                            <span>32周工作包进度图 · 基线窗口 / 数据日期</span>
                            <div className="lab-v2-schedule-gantt-wrap">
                              <div className="lab-v2-schedule-gantt">
                                <div className="lab-v2-schedule-gantt-weeks"><b>工作包</b><div>{Array.from({ length: 32 }, (_, index) => <i key={index}>W{index + 1}</i>)}</div></div>
                                {mainline.workload.workPackages.map((workPackage) => (
                                  <div className="lab-v2-schedule-gantt-row" key={workPackage.id}>
                                    <strong>{workPackage.id}<small>{workPackage.title}</small></strong>
                                    <div>
                                      <i className="baseline-bar" style={{ gridColumn: `${workPackage.startWeek} / ${workPackage.endWeek + 1}` }}><em>{workPackage.startWeek}–{workPackage.endWeek}</em></i>
                                      <i className="data-date" style={{ gridColumn: `${selectedWeek} / ${selectedWeek + 1}` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <p className="lab-v2-schedule-caption">横条表示批准的工作包计划窗口；竖线表示当前数据日期。工作包横条不是实际完成证明，活动状态仍需依据D28进度数据和验收证据更新。</p>
                          </section>

                          <section className="lab-v2-schedule-section">
                            <span>详细活动进度模型 · CPM / 计划窗口状态</span>
                            <div className="lab-v2-data-table-wrap lab-v2-wide-register-wrap">
                              <table className="lab-v2-schedule-activity-table">
                                <colgroup><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>活动 / WBS</th><th>活动名称</th><th>类型</th><th>基线窗口</th><th>期望工期</th><th>逻辑关系</th><th>总/自由浮动</th><th>关键性 / 当前窗口</th></tr></thead>
                                <tbody>{schedulePlanState.activities.map((activity) => <tr key={activity.id} className={activity.network?.isCritical ? "critical" : ""}>
                                  <td><strong>{activity.id}</strong><small>{activity.parentId}</small></td>
                                  <td>{activity.title}</td>
                                  <td>{activityTypeLabels[activity.type]}</td>
                                  <td>W{activity.startWeek}–W{activity.endWeek}</td>
                                  <td>{activity.network ? `${activity.network.expectedDuration.toFixed(2)}周` : activity.type === "recurring" ? `W${activity.occurrenceWeeks?.join(" / W")}` : "持续投入"}<small>{activity.network ? `方差 ${activity.network.durationVariance.toFixed(4)}` : "不进入CPM"}</small></td>
                                  <td>{activity.predecessors?.length ? activity.predecessors.map((predecessor) => `${predecessor.activityId} ${predecessor.type}${predecessor.lagWeeks ? `+${predecessor.lagWeeks}` : ""}`).join("；") : "无"}</td>
                                  <td>{activity.network ? `${activity.network.totalFloat} / ${activity.network.freeFloat} 周` : "—"}</td>
                                  <td><strong>{activity.network?.isCritical ? "关键活动" : activity.network ? "非关键活动" : "不参与CPM"}</strong><small>{activityStatusLabels[activity.currentStatus]}</small></td>
                                </tr>)}</tbody>
                              </table>
                            </div>
                            <p className="lab-v2-schedule-caption">“关键活动”表示当前批准基线下总浮动为0，并不代表风险最高；预测变化后必须重新计算，而不能沿用静态标签。</p>
                          </section>

                          <section className="lab-v2-schedule-section">
                            <span>里程碑基线与当前预测</span>
                            <div className="lab-v2-schedule-milestones">{milestoneState.map((milestone) => <article key={milestone.id} className={milestone.currentEvent.status}><b>{milestone.id}</b><strong>{milestone.title}</strong><div><span>基线 W{milestone.baselineWeek}</span><span>预测 W{milestone.currentEvent.forecastWeek}</span><span>{milestone.currentEvent.actualWeek === null ? "实际 —" : `实际 W${milestone.currentEvent.actualWeek}`}</span></div><p>{milestone.currentEvent.evidence}</p></article>)}</div>
                          </section>

                          <div className="lab-v2-schedule-governance">
                            <section><span>进度控制规则</span>{schedulePlanState.controlRules.map((rule) => <article key={rule.id}><b>{rule.id}</b><div><strong>{rule.title}</strong><p>{rule.rule}</p></div></article>)}</section>
                            <section><span>资源排程说明</span><ol>{schedulePlanState.resourceSchedulingNotes.map((note, index) => <li key={note}><b>{String(index + 1).padStart(2, "0")}</b><p>{note}</p></li>)}</ol><footer>{schedulePlanState.calendar.dataDateRule}</footer></section>
                          </div>

                          <section className="lab-v2-schedule-section">
                            <span>预测演进 · 不等同于基线变更</span>
                            <ol className="lab-v2-schedule-status-history">{schedulePlanState.visibleStatusEvents.map((event) => <li key={event.week}><b>W{event.week}</b><div><strong>{scheduleHealthLabels[event.health]} · 预测W{event.forecastFinishWeek}</strong><p>{event.evidence}</p><small>{event.forecastVarianceWeeks ? `较W32基线 +${event.forecastVarianceWeeks} 周` : event.actualFinishWeek ? `实际完成 W${event.actualFinishWeek}` : "预测与W32基线一致"}</small></div></li>)}</ol>
                          </section>

                          <section className="lab-v2-schedule-section">
                            <span>受控版本演进</span>
                            <ol className="lab-v2-schedule-version-history">{schedulePlanState.visibleVersionEvents.map((event) => <li key={event.version}><b>v{event.version}</b><div><strong>W{event.week} · {event.status}</strong><p>{event.decision}</p><small>{event.baselineChanged ? "进度基线建立/修订" : "进度基线未变化"}{event.approvedChangeIds.length ? ` · ${event.approvedChangeIds.join(" / ")}` : ""}</small></div></li>)}</ol>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D15" && (
                        <section className="lab-v2-document-data lab-v2-document-stack lab-v2-schedule-control-document">
                          <div className="lab-v2-schedule-control-metrics">
                            <span><b>{scheduleNetworkRows.length}</b>网络活动</span>
                            <span><b>{scheduleNetworkRows.filter((activity) => activity.network.isCritical).length}</b>零浮动活动</span>
                            <span><b>W{mainline.baselineWorkload.scheduleNetwork.calculatedProjectFinishWeek}</b>网络完工</span>
                            <span><b>{mainline.schedule.dependencyPolicy.supportedTypes.join(" / ")}</b>关系类型</span>
                          </div>
                          <section>
                            <span>活动逻辑网络 · CPM 早晚日期与浮动</span>
                            <div className="lab-v2-network-keyline" aria-label="零浮动活动按最早开始周排序">
                              {scheduleNetworkRows.filter((activity) => activity.network.isCritical).sort((left, right) => left.network.earliestStart - right.network.earliestStart).map((activity) => <i key={activity.id}><b>{activity.id}</b><small>W{activity.network.earliestStart}–W{activity.network.earliestFinish}</small></i>)}
                            </div>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-network-register-table">
                                <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>活动 / 节点</th><th>前置关系</th><th>最早开始 / 完成</th><th>最晚开始 / 完成</th><th>总 / 自由浮动</th><th>关键性</th></tr></thead>
                                <tbody>{scheduleNetworkRows.map((activity) => <tr key={activity.id} className={activity.network.isCritical ? "critical" : ""}><td>{activity.id}<small>{activity.title}</small></td><td>{activity.predecessors?.length ? activity.predecessors.map((predecessor) => `${predecessor.activityId} ${predecessor.type}${predecessor.lagWeeks ? ` +${predecessor.lagWeeks}` : ""}`).join("；") : "起点"}</td><td>W{activity.network.earliestStart} / W{activity.network.earliestFinish}</td><td>W{activity.network.latestStart} / W{activity.network.latestFinish}</td><td>{activity.network.totalFloat} / {activity.network.freeFloat} 周</td><td>{activity.network.isCritical ? "零浮动" : "非关键"}</td></tr>)}</tbody>
                              </table>
                            </div>
                            <p className="lab-v2-document-note">网络只包含 33 项离散活动；D01 提供关系约束说明，D07 提供工期，D14 保存批准基线。人力投入型和重复活动不进入 CPM。</p>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D16" && scopeState && (
                        <section className="lab-v2-scope-statement">
                          <section className="lab-v2-scope-section">
                            <span>产品范围组成</span>
                            <div className="lab-v2-scope-components">{scopeState.productScopeItems.map((item) => <article key={item.id} className={item.currentEvent.status}><b>{item.id}</b><small>{scopeStatusLabels[item.currentEvent.status]}</small><strong>{item.title}</strong><p>{item.description}</p><i>{item.relatedRequirementIds.join(" / ")}</i><em>{item.currentEvent.evidence}</em></article>)}</div>
                          </section>
                          <section className="lab-v2-scope-section">
                            <span>主要可交付成果</span>
                            <div className="lab-v2-data-table-wrap lab-v2-fit-table-wrap">
                              <table className="lab-v2-scope-deliverables-table">
                                <colgroup><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>编号 / 可交付成果</th><th>目标周</th><th>对应WBS</th><th>验收摘要</th><th>证据文件</th></tr></thead>
                                <tbody>{scopeState.deliverables.map((deliverable) => <tr key={deliverable.id}><td><strong>{deliverable.id}</strong><small>{deliverable.title}</small></td><td>W{deliverable.targetWeek}</td><td>{deliverable.relatedWbsIds.join(" / ")}</td><td>{deliverable.acceptanceSummary}</td><td>{deliverable.evidenceDocumentIds.join(" / ")}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                          <div className="lab-v2-scope-boundaries">
                            <section><span>明确不包含</span>{scopeState.exclusions.map((exclusion) => <article key={exclusion.id}><b>{exclusion.id} · W{exclusion.effectiveWeek}</b><strong>{exclusion.title}</strong><p>{exclusion.reason}</p><small>去向：{exclusion.destination}</small></article>)}</section>
                            <section><span>项目约束</span>{scopeState.constraints.map((constraint) => <article key={constraint.id}><b>{constraint.id}</b><strong>{constraint.title}</strong><p>{constraint.description}</p></article>)}</section>
                          </div>
                          <section className="lab-v2-scope-section">
                            <span>项目与产品验收条件</span>
                            <ol className="lab-v2-scope-acceptance">{scopeState.acceptanceCriteria.map((criterion) => <li key={criterion.id}><b>{criterion.id}</b><p>{criterion.criterion}<small>{criterion.evidenceDocumentIds.join(" / ")}</small></p></li>)}</ol>
                          </section>
                          <div className="lab-v2-scope-governance"><span>范围变更规则</span><p>{scopeState.changeControlRule}</p><div><small>关键假设</small>{scopeState.assumptionIds.map((assumptionId) => <i key={assumptionId}>{assumptionId}</i>)}</div></div>
                          <section className="lab-v2-scope-section">
                            <span>范围基线演进</span>
                            <ol className="lab-v2-scope-baselines">{scopeState.baselineEvents.filter((event) => event.week <= selectedWeek).map((event) => <li key={event.version}><b>v{event.version}</b><div><strong>W{event.week} · {event.status}</strong><p>{event.decision}</p>{event.approvedChangeId && <small>{event.approvedChangeId}</small>}</div></li>)}</ol>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D17" && (
                        <section className="lab-v2-document-data lab-v2-document-stack">
                          <section>
                            <span>核心团队派工 · W{selectedWeek}</span>
                            <div className="lab-v2-data-table-wrap lab-v2-fit-table-wrap">
                              <table className="lab-v2-team-assignment-table">
                                <colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>角色 / 派工对象</th><th>所属组织</th><th>责任范围</th><th>主要WBS</th><th>生效窗口</th><th>当前状态</th><th>交接 / 依据</th></tr></thead>
                                <tbody>{teamAssignmentRows.map((assignment) => <tr key={assignment.role.id}><td>{assignment.role.id}<small>{assignment.stakeholder?.title ?? assignment.role.title}</small></td><td>{assignment.stakeholder?.organization ?? "核心项目团队"}</td><td>{assignment.stakeholder?.projectRole ?? assignment.role.title}</td><td>{assignment.primaryWorkPackages.join(" / ")}</td><td>W1–W32</td><td>{assignment.assignmentStatus}</td><td>{assignment.handoverStatus}<small>{assignment.evidence}</small></td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D18" && (
                        <section className="lab-v2-document-data lab-v2-quality-document">
                          <span>质量控制测量结果 · W{selectedWeek}</span>
                          <div className="lab-v2-quality-metrics">
                            <span><b>{qualityMeasurementRows.length - qualityResultCounts.not_measured - qualityResultCounts.not_applicable}</b>已测量</span>
                            <span><b>{qualityResultCounts.passed}</b>达标</span>
                            <span><b>{qualityResultCounts.failed}</b>未达标</span>
                            <span><b>{qualityResultCounts.not_applicable}</b>不适用</span>
                          </div>
                          <div className="lab-v2-data-table-wrap lab-v2-fit-table-wrap">
                            <table className="lab-v2-quality-result-table">
                              <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>指标</th><th>类型</th><th>实测值 / 周</th><th>批准阈值</th><th>结论</th><th>责任与证据</th></tr></thead>
                              <tbody>{qualityMeasurementRows.map((metric) => <tr key={metric.id} className={metric.result}>
                                <td><strong>{metric.title}</strong><small>{metric.id}</small></td>
                                <td>{metric.category}</td>
                                <td>{metric.result === "not_applicable" ? "范围变更后不适用" : formatQualityValue(metric.actual, metric.unit)}<small>{metric.measuredWeek ? `W${metric.measuredWeek}` : "—"}</small></td>
                                <td>{qualityTargetLabel(metric)}</td>
                                <td><strong>{qualityResultLabels[metric.result]}</strong></td>
                                <td>{stakeholderById.get(metric.profile?.ownerId ?? "")?.title ?? metric.profile?.ownerId}<small>{metric.evidence || "D32"}</small></td>
                              </tr>)}</tbody>
                            </table>
                          </div>
                          <p className="lab-v2-document-note">这里只记录测量值、阈值和结论；测试范围与执行明细见 D32，综合质量判断见 D20。</p>
                        </section>
                      )}
                      {selectedDocument.id === "D19" && (
                        <section className="lab-v2-document-data lab-v2-quality-document">
                          <span>质量测量指标 · {selectedWeek < 8 ? "W6 创建 / 待 W8 批准" : "W8 已批准"}</span>
                          <div className="lab-v2-data-table-wrap lab-v2-fit-table-wrap">
                            <table className="lab-v2-quality-metric-table">
                              <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>指标</th><th>类型</th><th>测量口径</th><th>批准阈值</th><th>责任人</th><th>适用范围 / 证据</th></tr></thead>
                              <tbody>{qualityMetricDefinitions.map((metric) => {
                                const profile = qualityMeasurementProfiles[metric.id];
                                return <tr key={metric.id}>
                                  <td><strong>{qualityMetricLabels[metric.id] ?? metric.id}</strong><small>{metric.id}</small></td>
                                  <td>{metric.category}</td>
                                  <td>{profile?.method}</td>
                                  <td><strong>{qualityTargetLabel(metric)}</strong></td>
                                  <td>{stakeholderById.get(profile?.ownerId ?? "")?.title ?? profile?.ownerId}</td>
                                  <td>{metric.scope === "remote_control_enabled" ? "仅远程控制纳入批准范围时" : "全项目"}<small>{profile?.evidence}</small></td>
                                </tr>;
                              })}</tbody>
                            </table>
                          </div>
                          <p className="lab-v2-document-note">D19 保存批准的测量口径与阈值；测试用例和执行明细统一保存在 D32。</p>
                        </section>
                      )}
                      {selectedDocument.id === "D20" && (
                        <section className="lab-v2-document-data lab-v2-document-stack lab-v2-quality-report">
                          <div className="lab-v2-report-metrics">
                            <span><b>{qualityReportStatus}</b>当前质量结论</span>
                            <span><b>{qualityResultCounts.passed}</b>达标指标</span>
                            <span><b>{qualityReportMetricFailures.length + qualityReportIssueFailures.length}</b>需处理项</span>
                            <span><b>{qualityResidualRisks.length}</b>开放质量 / 安全风险</span>
                          </div>
                          <section>
                            <span>阶段质量趋势</span>
                            <div className="lab-v2-data-table-wrap lab-v2-fit-table-wrap">
                              <table className="lab-v2-quality-trend-table">
                                <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>报告周</th><th>已测量</th><th>达标</th><th>未达标</th><th>范围不适用</th><th>未关闭严重问题</th></tr></thead>
                                <tbody>{qualityTrendRows.map((row) => <tr key={row.week}><td>W{row.week}</td><td>{row.measured}</td><td>{row.passed}</td><td>{row.failed}</td><td>{row.notApplicable}</td><td>{row.seriousOpenIssues}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                          <div className="lab-v2-report-grid">
                            <section>
                              <span>当前未通过项</span>
                              {qualityReportMetricFailures.length || qualityReportIssueFailures.length ? <ol className="lab-v2-report-list">
                                {qualityReportMetricFailures.map((metric) => <li key={metric.id}><b>{metric.id} · {metric.title}</b><p>{formatQualityValue(metric.actual, metric.unit)} / 阈值 {qualityTargetLabel(metric)}</p><small>D18 · W{metric.measuredWeek ?? selectedWeek}</small></li>)}
                                {qualityReportIssueFailures.map((issue) => <li key={issue.id}><b>{issue.id} · {issue.title}</b><p>{issue.severity === "critical" ? "严重" : "高"}级问题，计划 W{issue.targetResolutionWeek} 完成处置。</p><small>D08 · {stakeholderById.get(issue.ownerStakeholderId)?.title ?? issue.ownerStakeholderId}</small></li>)}
                              </ol> : <p className="lab-v2-register-empty">当前没有未通过指标或未关闭严重质量问题。</p>}
                            </section>
                            <section>
                              <span>残余风险</span>
                              {qualityResidualRisks.length ? <ol className="lab-v2-report-list">
                                {qualityResidualRisks.map((risk) => <li key={risk.id}><b>{risk.id} · {risk.title}</b><p>{riskSeverity(risk.currentAssessment.probability, risk.currentAssessment.impact, risk.severityOverride)} · {risk.impactDimensions.map((dimension) => riskImpactDimensionLabels[dimension] ?? dimension).join("、")}</p><small>D26 · {riskLifecycleLabels[risk.lifecycle] ?? risk.lifecycle} · {risk.controlStatus ? riskControlStatusLabels[risk.controlStatus] ?? risk.controlStatus : "持续监控"}</small></li>)}
                              </ol> : <p className="lab-v2-register-empty">当前没有未关闭的质量或安全风险。</p>}
                            </section>
                          </div>
                          <section className="lab-v2-report-conclusion">
                            <span>发布建议</span>
                            <strong>{qualityReportStatus}</strong>
                            <p>{qualityReleaseRecommendation}</p>
                            <small>依据：D18 测量结果 / D19 批准阈值 / D08 问题状态 / D16 范围状态 / D26 风险状态 / D32 最近测试结论</small>
                          </section>
                          <p className="lab-v2-document-note">D20 只汇总趋势、例外、残余风险和发布建议，不复制 D18 的完整测量表或 D32 的测试执行明细。</p>
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
                      {selectedDocument.id === "D23" && (
                        <section className="lab-v2-document-data lab-v2-document-stack">
                          <section>
                            <span>资源分解结构 · {resourceBreakdownRows.length} 项</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-resource-breakdown-table">
                                <colgroup><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>RBS编号</th><th>层级</th><th>资源</th><th>管理边界</th></tr></thead>
                                <tbody>{resourceBreakdownRows.map((resource) => <tr key={resource.id}><td>{resource.id}</td><td>{resource.level}</td><td>{resource.resource}<small>{resource.resourceId}</small></td><td>{resource.controlBoundary}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D24" && (
                        <section className="lab-v2-document-data lab-v2-document-stack">
                          <div className="lab-v2-resource-metrics">
                            <span><b>{weekState.plannedTeamPersonDays}</b>本周计划人日</span>
                            <span><b>{resourceCalendarRows.reduce((sum, row) => sum + row.availablePersonDays, 0)}</b>本周可用人日</span>
                            <span><b>{resourceCalendarRows.filter((row) => row.balancePersonDays < 0).length}</b>容量缺口角色</span>
                            <span><b>{resourceCalendarRows.filter((row) => row.exception !== "无当前例外").length}</b>当前例外</span>
                          </div>
                          <section>
                            <span>逐周资源容量 · 当前 W{selectedWeek}</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-resource-calendar-table">
                                <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>角色</th><th>计划人日</th><th>可用人日</th><th>余量 / 缺口</th><th>状态</th><th>日历例外</th></tr></thead>
                                <tbody>{resourceCalendarRows.map((row) => <tr key={row.role.id}><td>{row.role.title}<small>{row.role.id}</small></td><td>{row.plannedPersonDays}</td><td>{row.availablePersonDays}</td><td>{row.balancePersonDays > 0 ? `+${row.balancePersonDays}` : row.balancePersonDays}</td><td>{row.status}</td><td>{row.exception}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D25" && (
                        <section className="lab-v2-document-data lab-v2-document-stack">
                          <div className="lab-v2-resource-metrics">
                            <span><b>{activityResourceRequirementRows.length}</b>活动</span>
                            <span><b>{mainline.workload.roles.length}</b>核心角色</span>
                            <span><b>{mainline.baselineWorkload.totalPlannedPersonDays}</b>计划人日</span>
                            <span><b>{nonHumanRequirementRows.length}</b>非人力类别</span>
                          </div>
                          <section>
                            <span>活动级人员需求</span>
                            <div className="lab-v2-data-table-wrap lab-v2-fit-table-wrap">
                              <table className="lab-v2-resource-requirement-table">
                                <colgroup><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>活动 / WBS</th><th>活动</th><th>计划窗口</th><th>角色投入</th><th>总人日</th></tr></thead>
                                <tbody>{activityResourceRequirementRows.map((activity) => <tr key={activity.id}><td>{activity.id}<small>{activity.parentId}</small></td><td>{activity.title}</td><td>W{activity.startWeek}–W{activity.endWeek}</td><td>{activity.roleRequirements.join("；")}</td><td>{activity.totalPersonDays}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                          <section>
                            <span>非人力资源需求窗口</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-nonhuman-requirement-table">
                                <colgroup><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>资源</th><th>类别</th><th>需求周</th><th>对应WBS</th></tr></thead>
                                <tbody>{nonHumanRequirementRows.map((resource) => <tr key={resource.id}><td>{resource.id}<small>{resource.title}</small></td><td>{resource.group}</td><td>W{resource.weeks.join(" / W")}</td><td>{resource.relatedWbsIds.join(" / ")}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D26" && (
                        <section className="lab-v2-document-data">
                          <span>风险登记册 · W{selectedWeek}</span>
                          <div className="lab-v2-data-table-wrap">
                            <table className="lab-v2-risk-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>编号</th><th>风险</th><th>等级</th><th>影响范围</th><th>发现</th><th>执行措施</th><th>负责人</th><th>关闭</th><th>处理后结果</th></tr></thead>
                              <tbody>{riskState.map((risk) => <tr key={risk.id}><td>{risk.id}</td><td>{risk.title}</td><td>{riskSeverity(risk.currentAssessment.probability, risk.currentAssessment.impact, risk.severityOverride)}</td><td>{risk.impactDimensions.map((dimension) => riskImpactDimensionLabels[dimension] ?? dimension).join("、")}</td><td>W{risk.discoveredWeek}</td><td>{risk.responseActions.join("；")}</td><td>{risk.owner}</td><td>{risk.lifecycle === "closed" ? `W${risk.closedWeek}` : "—"}</td><td>{risk.lifecycle === "closed" ? risk.postTreatmentResult : "持续监控中"}</td></tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {selectedDocument.id === "D27" && (
                        <section className="lab-v2-document-data lab-v2-document-stack lab-v2-risk-report">
                          <div className="lab-v2-report-metrics">
                            <span><b>{riskState.length}</b>已识别风险</span>
                            <span><b>{openRiskRows.length}</b>当前开放</span>
                            <span><b>{highOpenRiskCount}</b>高 / 极高</span>
                            <span><b>{riskState.length - openRiskRows.length}</b>已关闭</span>
                          </div>
                          <section>
                            <span>阶段风险趋势</span>
                            <div className="lab-v2-data-table-wrap lab-v2-fit-table-wrap">
                              <table className="lab-v2-risk-trend-table">
                                <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>报告周</th><th>累计识别</th><th>当前开放</th><th>高 / 极高</th><th>中</th><th>已关闭</th></tr></thead>
                                <tbody>{riskTrendRows.map((row) => <tr key={row.week}><td>W{row.week}</td><td>{row.identified}</td><td>{row.open}</td><td>{row.high}</td><td>{row.medium}</td><td>{row.closed}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </section>
                          <section>
                            <span>当前最高暴露项</span>
                            {openRiskRows.length ? <div className="lab-v2-data-table-wrap lab-v2-fit-table-wrap">
                              <table className="lab-v2-risk-focus-table">
                                <colgroup><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>风险</th><th>等级 / 分值</th><th>状态</th><th>主要影响</th><th>负责人 / 当前重点</th></tr></thead>
                                <tbody>{openRiskRows.slice(0, 3).map((risk) => <tr key={risk.id}><td>{risk.id}<small>{risk.title}</small></td><td><strong>{riskSeverity(risk.currentAssessment.probability, risk.currentAssessment.impact, risk.severityOverride)}</strong><small>{risk.currentAssessment.probability * risk.currentAssessment.impact}</small></td><td>{riskLifecycleLabels[risk.lifecycle] ?? risk.lifecycle}<small>{risk.controlStatus ? riskControlStatusLabels[risk.controlStatus] ?? risk.controlStatus : "持续监控"}</small></td><td>{risk.impactDimensions.map((dimension) => riskImpactDimensionLabels[dimension] ?? dimension).join("、")}</td><td>{risk.owner}<small>{risk.responseActions[0]}</small></td></tr>)}</tbody>
                              </table>
                            </div> : <p className="lab-v2-register-empty">当前没有开放风险。</p>}
                          </section>
                          <section className="lab-v2-report-conclusion">
                            <span>整体风险结论</span>
                            <strong>{criticalOpenRiskCount ? "需治理升级" : highOpenRiskCount ? "高风险受控跟踪" : openRiskRows.length ? "持续监控" : "可归档"}</strong>
                            <p>{riskReportConclusion}</p>
                            <small>当前进度预测 W{forecastCompletionWeek} · 依据 D26 风险状态、D08 问题状态与 D29 进度预测</small>
                          </section>
                          <p className="lab-v2-document-note">D27 只汇总风险趋势、最高暴露项和整体结论；风险原因、应对措施及逐项历史保留在 D26。</p>
                        </section>
                      )}
                      {selectedDocument.id === "D28" && (
                        <section className="lab-v2-document-data lab-v2-document-stack lab-v2-schedule-control-document">
                          <div className="lab-v2-schedule-control-metrics six">
                            <span><b>W{selectedWeek}</b>数据日期</span>
                            <span><b>{formatMoney(weekState.cumulativePlannedValueCny)}</b>累计 PV</span>
                            <span><b>{formatMoney(weekState.cumulativeEarnedValueCny)}</b>累计 EV</span>
                            <span><b>{formatMoney(weekState.cumulativeActualCostCny)}</b>累计 AC</span>
                            <span><b>{weekState.spi.toFixed(2)}</b>SPI</span>
                            <span><b>{weekState.cpi.toFixed(2)}</b>CPI</span>
                          </div>
                          <section>
                            <span>本数据日期需记录的活动状态 · 状态变化与当前关键活动</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-schedule-data-table">
                                <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>活动 / WBS</th><th>当前状态</th><th>实际开始</th><th>实际完成</th><th>计划窗口</th><th>状态证据</th></tr></thead>
                                <tbody>{scheduleDataRows.map((activity) => <tr key={activity.id} className={activity.network?.isCritical ? "critical" : ""}><td>{activity.id}<small>{activity.title}</small></td><td>{activityStatusLabels[activity.currentStatus]}</td><td>{selectedWeek >= activity.startWeek ? `W${activity.startWeek}` : "—"}</td><td>{activity.currentStatus === "completed" ? `W${activity.endWeek}` : "—"}</td><td>W{activity.startWeek}–W{activity.endWeek}</td><td>{activity.currentStatus === "completed" ? activity.acceptanceCriteria[0] : activity.currentStatus === "not_started" ? "数据日期未到计划开始周" : `W${selectedWeek} 主线周状态与 EVM 快照`}</td></tr>)}</tbody>
                              </table>
                            </div>
                            <p className="lab-v2-document-note">这里只列出本周开始、完成或仍在执行的零浮动活动，不复制 D02 的 35 项完整清单。个人分支当前周的 PV、EV、AC、SPI 和 CPI 使用回合快照。</p>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D29" && (
                        <section className="lab-v2-document-data lab-v2-document-stack lab-v2-schedule-control-document">
                          <div className="lab-v2-schedule-control-metrics six">
                            <span><b>W{selectedWeek}</b>预测日期</span>
                            <span><b>W{mainline.schedule.projectSchedulePlan.calendar.plannedFinishWeek}</b>批准基线</span>
                            <span><b>{previousScheduleStatusEvent ? `W${previousScheduleStatusEvent.forecastFinishWeek}` : "—"}</b>上次预测</span>
                            <span><b>W{forecastCompletionWeek}</b>当前预测</span>
                            <span><b>{forecastVarianceWeeks > 0 ? `+${forecastVarianceWeeks}` : forecastVarianceWeeks}</b>预测偏差（周）</span>
                            <span><b>{currentScheduleStatusEvent ? scheduleHealthLabels[currentScheduleStatusEvent.health] : "初始编制"}</b>主线健康</span>
                          </div>
                          <section>
                            <span>当前预测依据</span>
                            <div className="lab-v2-forecast-basis">
                              <article><b>结论依据</b><p>{forecastEvidence}</p></article>
                              <article><b>当前零浮动活动</b><p>{activeCriticalActivityIds.join(" / ") || "当前数据日期无执行中的零浮动活动"}</p></article>
                              <article><b>未关闭进度风险</b><p>{openScheduleRiskIds.join(" / ") || "无"}</p></article>
                            </div>
                          </section>
                          <section>
                            <span>里程碑预测偏差</span>
                            {forecastMilestoneRows.length ? <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-forecast-milestone-table">
                                <colgroup><col /><col /><col /><col /></colgroup>
                                <thead><tr><th>里程碑</th><th>基准周</th><th>预测周</th><th>最新依据</th></tr></thead>
                                <tbody>{forecastMilestoneRows.map((milestone) => <tr key={milestone.id}><td>{milestone.id}<small>{milestone.title}</small></td><td>W{milestone.baselineWeek}</td><td>W{milestone.currentEvent.forecastWeek}</td><td>{milestone.currentEvent.evidence}</td></tr>)}</tbody>
                              </table>
                            </div> : <p className="lab-v2-register-empty">当前里程碑预测与批准基线一致。</p>}
                            <p className="lab-v2-document-note">D29 只记录当前预测、偏差和依据，不重抄 D14 计划明细或 D26 风险条目；预测变化本身不构成基线变更。</p>
                          </section>
                        </section>
                      )}
                      {selectedDocument.id === "D30" && (
                        <section className="lab-v2-document-data">
                          <span>干系人登记册 · W{selectedWeek} · 已识别 {stakeholderState.length} 人</span>
                          <div className="lab-v2-data-table-wrap lab-v2-stakeholder-register-wrap">
                            <table className="lab-v2-stakeholder-register-table">
                              <colgroup><col /><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
                              <thead><tr><th>编号/识别</th><th>干系人与项目角色</th><th>类别</th><th>权力/利益</th><th>当前/目标参与</th><th>核心期望</th><th>信息需求</th><th>主要沟通安排</th><th>参与责任与最近更新</th></tr></thead>
                              <tbody>{stakeholderState.map((stakeholder) => <tr key={stakeholder.id}>
                                <td>{stakeholder.id}<small>W{stakeholder.identifiedWeek} · {stakeholder.identificationBasis}</small></td>
                                <td><strong>{stakeholder.title}</strong><small>{stakeholder.projectRole}</small><small>{stakeholder.organization}</small></td>
                                <td>{stakeholderGroupLabels[stakeholder.group]}</td>
                                <td>P{stakeholder.initialEngagement.power} / I{stakeholder.initialEngagement.interest}</td>
                                <td>{engagementStateLabels[stakeholder.current] ?? stakeholder.current}<small>目标：{engagementStateLabels[stakeholder.desired] ?? stakeholder.desired}</small></td>
                                <td>{stakeholder.expectations.join("；")}</td>
                                <td>{stakeholder.informationNeeds.join("；")}</td>
                                <td><strong>{stakeholder.primaryTouchpoint?.title ?? "未设置"}</strong><small>{communicationTouchpointSchedule(stakeholder.primaryTouchpoint)}</small></td>
                                <td>{stakeholderById.get(stakeholder.engagementOwnerStakeholderId)?.title ?? stakeholder.engagementOwnerStakeholderId}<small>W{stakeholder.lastUpdatedWeek} · {stakeholder.lastEvidence.join("；")}</small></td>
                              </tr>)}</tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      {selectedDocument.id === "D31" && (
                        <section className="lab-v2-team-charter">
                          <div className="lab-v2-team-charter-section">
                            <span>共同价值观</span>
                            <div className="lab-v2-team-charter-values">{teamCharter.values.map((value) => <article key={value.id}><b>{value.id}</b><strong>{value.title}</strong><p>{value.agreement}</p></article>)}</div>
                          </div>
                          <div className="lab-v2-team-charter-section">
                            <span>决策权限</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-team-charter-table">
                                <thead><tr><th>决策领域</th><th>责任人</th><th>咨询成员</th><th>决策规则</th></tr></thead>
                                <tbody>{teamCharter.decisionRights.map((decision) => <tr key={decision.area}><td>{decision.area}</td><td>{stakeholderById.get(decision.ownerStakeholderId)?.title ?? decision.ownerStakeholderId}</td><td>{stakeholderNames(decision.consultedStakeholderIds).join("、")}</td><td>{decision.rule}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </div>
                          <div className="lab-v2-team-charter-section">
                            <span>工作约定</span>
                            <div className="lab-v2-team-charter-rules">{teamCharter.workingAgreements.map((agreement) => <article key={agreement.id}><b>{agreement.id}</b><div><strong>{agreement.title}</strong><p>{agreement.agreement}</p></div></article>)}</div>
                          </div>
                          <div className="lab-v2-team-charter-section">
                            <span>沟通与响应</span>
                            <div className="lab-v2-data-table-wrap">
                              <table className="lab-v2-team-charter-table communication">
                                <thead><tr><th>沟通方式</th><th>节奏</th><th>响应与记录规则</th><th>记录文件</th></tr></thead>
                                <tbody>{teamCharter.communicationAgreements.map((agreement) => <tr key={agreement.id}><td><strong>{agreement.channel}</strong><small>{agreement.id}</small></td><td>{agreement.cadence}</td><td>{agreement.responseRule}</td><td>{agreement.recordDocumentId}</td></tr>)}</tbody>
                              </table>
                            </div>
                          </div>
                          <div className="lab-v2-team-charter-grid">
                            <section><span>质量与安全红线</span><ol>{teamCharter.qualityAndSafetyGuardrails.map((guardrail, index) => <li key={guardrail}><b>{String(index + 1).padStart(2, "0")}</b><p>{guardrail}</p></li>)}</ol></section>
                            <section><span>冲突解决与升级</span><ol>{teamCharter.conflictResolutionSteps.map((step) => <li key={step.step}><b>{step.step}</b><p><strong>{step.timebox} · {stakeholderById.get(step.ownerStakeholderId)?.title ?? step.ownerStakeholderId}</strong>{step.rule}</p></li>)}</ol></section>
                          </div>
                          <div className="lab-v2-team-charter-protocols">
                            <article><span>关键岗位交接</span><strong>{teamCharter.handoverProtocol.trigger}</strong><p>{teamCharter.handoverProtocol.ownerRule}</p><ul>{teamCharter.handoverProtocol.requiredContents.map((content) => <li key={content}>{content}</li>)}</ul><small>记录到 {teamCharter.handoverProtocol.recordDocumentId}</small></article>
                            <article><span>章程修订规则</span><strong>{teamCharter.amendmentRule.trigger}</strong><p>{teamCharter.amendmentRule.decisionRule}</p><small>如有修订，记录到 {teamCharter.amendmentRule.recordDocumentId}</small></article>
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
