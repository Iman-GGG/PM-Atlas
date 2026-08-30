import type { ProjectControlException, ProjectHealthStatus } from "../lib/lab/project-control";

export type TakeoverPoint = {
  scenarioId: string;
  week: number;
  label: string;
};

export type CaseManifest = {
  caseId: string;
  caseVersion: string;
  totalWeeks: number;
  takeoverPoints: TakeoverPoint[];
};

export type LabSession = { authenticated: boolean };

export type BaselineWeek = {
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

export type IterationTask = {
  id: string;
  title: string;
  scheduleActivityId: string;
  requirementIds: string[];
  storyPoints: number;
  completedWorkday: number;
};

export type IterationSprint = {
  id: string;
  startWeek: number;
  endWeek: number;
  goal: string;
  tasks: IterationTask[];
};

export type IterationPlan = {
  policy: {
    firstSprintWeek: number;
    lastSprintWeek: number;
    sprintLengthWeeks: number;
    workdaysPerWeek: number;
    estimationUnit: "story_point";
    remainingWorkRule: string;
    weeklyDataDateRule: string;
  };
  sprints: IterationSprint[];
};

export type WorkPackage = {
  id: string;
  title: string;
  startWeek: number;
  endWeek: number;
};

export type CostRole = {
  id: string;
  title: string;
  plannedPersonDays: number;
  standardDayRateCny: number;
};

export type PlannedNonLaborCost = {
  id: string;
  title: string;
  entries: Array<{ week: number; amountCny: number }>;
};

export type ScheduleActivity = {
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

export type ActivityListPolicy = {
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

export type SchedulePlanStatusEvent = {
  week: number;
  health: "planning" | "on_track" | "at_risk" | "recovery_approved" | "recovered" | "completed";
  forecastFinishWeek: number;
  actualFinishWeek: number | null;
  forecastVarianceWeeks: number;
  evidence: string;
};

export type ProjectSchedulePlan = {
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

export type Stakeholder = {
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

export type CommunicationTouchpoint = {
  id: string;
  title: string;
  cadence: "weekly" | "biweekly" | "specified_weeks" | "activity_driven";
  startWeek?: number;
  endWeek?: number;
  weeks?: number[];
};

export type StageGate = {
  id: string;
  week: number;
  title: string;
  decisionOwner: string;
  presenters: string[];
  requiredSignoffs: string[];
  evidenceTitles: string[];
};

export type StakeholderEvent = {
  week: number;
  stakeholderId: string;
  current: string;
  desired?: string;
  evidence: string[];
};

export type RaciRow = {
  workPackageId: string;
  A: string[];
  R: string[];
  C: string[];
  I: string[];
};

export type ProjectDocument = {
  id: string;
  title: string;
  coverage: string;
  createdWeek: number;
};

export type DocumentEvent = {
  id: string;
  week: number;
  reason: string;
  [key: string]: unknown;
};

export type DocumentRelation = {
  id: string;
  fromDocumentId: string;
  toDocumentId: string;
  type: string;
  reason: string;
  effectiveWeek: number;
};

export type ChangeControlBoard = {
  memberStakeholderIds: string[];
  quorum: number;
  chairStakeholderId: string;
  secretaryStakeholderId: string;
  decisionRules: string[];
};

export type TeamCharter = {
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

export type AssumptionStatusEvent = {
  week: number;
  status: "open" | "validated" | "invalidated" | "retired";
  evidence: string;
};

export type AssumptionItem = {
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

export type AssumptionLog = {
  documentId: "D03";
  statusModel: AssumptionStatusEvent["status"][];
  items: AssumptionItem[];
};

export type LessonLearnedItem = {
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

export type LessonsLearnedRegister = {
  documentId: "D09";
  statusModel: LessonLearnedItem["status"][];
  items: LessonLearnedItem[];
};

export type MilestoneStatusEvent = {
  week: number;
  status: "planned" | "at_risk" | "achieved_with_conditions" | "achieved";
  forecastWeek: number;
  actualWeek: number | null;
  evidence: string;
};

export type MilestoneItem = {
  id: string;
  title: string;
  baselineWeek: number;
  ownerStakeholderId: string;
  acceptanceCriteria: string;
  relatedWbsIds: string[];
  evidenceDocumentIds: string[];
  statusEvents: MilestoneStatusEvent[];
};

export type MilestoneList = {
  documentId: "D10";
  statusModel: MilestoneStatusEvent["status"][];
  items: MilestoneItem[];
};

export type ScopeStatusEvent = {
  week: number;
  status: "draft_included" | "baselined_included" | "deferred_from_v1_0";
  evidence: string;
};

export type ProjectScopeStatement = {
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

export type ChangeItem = {
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

export type IssueItem = {
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

export type TestRound = {
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

export type RiskItem = {
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

export type RequirementItem = {
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

export type RiskEvent = {
  week: number;
  riskIds: string[];
  toLifecycleState: string;
  controlStatus?: string;
};

export type QualitySeries = {
  metricId: string;
  interpolation: "linear" | "step";
  anchors: Array<{ week: number; value: number | boolean }>;
};

export type QualityMetricDefinition = {
  id: string;
  operator: "equals" | "greater_than_or_equal" | "less_than_or_equal";
  target: number | boolean;
  unit?: "people" | "ratio" | "seconds" | "score_out_of_5";
  scope?: "remote_control_enabled";
};

export type QualityPlan = {
  preMeasurementState: "not_measured";
  scopeExclusionState: "not_applicable_by_approved_scope_change";
  hardGates: QualityMetricDefinition[];
  performanceMetrics: QualityMetricDefinition[];
  mainlineSeries: QualitySeries[];
  successRule: "all_applicable_hard_gates_pass";
};

export type NetworkActivity = {
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

export type MainlineData = {
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
  iterations?: IterationPlan;
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

export type MainlineResponse = {
  week: number | null;
  sections: MainlineData;
};

export type BranchContext = {
  id: string;
  caseVersion: string;
  parentBranchId: string | null;
  branchName: string | null;
  currentWeek: number;
  currentRoundNumber: number;
  status: string;
};

export type BranchSummary = BranchContext & {
  forkWeek: number;
  scenarioId: string;
  outcomeClassification: string | null;
  createdAt: string;
};

export type MaterialSummary = {
  id: string;
  group: string;
  type: string;
  channel: string | null;
  title: string;
  opened: boolean;
  content?: OpenedMaterial;
};

export type MaterialList = {
  openedCount: number;
  totalCount: number;
  cardsUnlocked: boolean;
  materials: MaterialSummary[];
};

export type PublicCard = {
  id: string;
  column: "evidence_document" | "tool_technique" | "stakeholder";
  referenceId: string;
  title: string;
};

export type ManagementActionChain = {
  id: string;
  title: string;
  documentCardIds: string[];
  toolTechniqueCardIds: string[];
  stakeholderCardIds: string[];
};

export type ActionChainPools = Record<PublicCard["column"], string[]>;

export type RoundDraft = {
  branchId: string;
  scenarioId: string;
  roundNumber: number;
  actionChains: ManagementActionChain[];
  updatedAt: string | null;
};

export type BranchState = {
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

export type RoundGap = {
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

export type RoundResult = {
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

export type DocumentPatch = { roundNumber: number; week: number; reason: string; operations: Array<{ op: "add" | "replace" | "remove"; path: string; value?: string | number | boolean | null }> };
export type DocumentFieldSide = { exists: boolean; resolved: boolean; value: string | number | boolean | null };
export type DocumentFieldComparison = {
  path: string;
  changeType: "added" | "modified" | "removed";
  roundNumber: number;
  week: number;
  reason: string;
  mainline: DocumentFieldSide;
  branch: DocumentFieldSide;
};
export type DocumentDiffResponse = {
  mainlineWeek: number;
  branchWeek: number;
  patches: DocumentPatch[];
  fields: DocumentFieldComparison[];
  summary: { added: number; modified: number; removed: number };
};
export type BranchPathMetric = {
  week: number;
  spi: number;
  cpi: number;
  forecastCompletionWeek: number;
  status: string;
};
export type BranchPathRound = {
  roundNumber: number;
  week: number;
  commitHash: string;
  submittedAt: string | null;
  scenarioStatus: string;
  pathClassification: string | null;
  mainline: BranchPathMetric;
  branch: BranchPathMetric;
  documents: Array<{ documentId: string; operationCount: number }>;
  completedActions: number;
  harmfulEffects: number;
};
export type BranchComparison = {
  caseVersion: string;
  contentHash: string;
  forkWeek: number;
  currentWeek: number;
  currentRoundNumber: number;
  branchStatus: string;
  outcomeClassification: string | null;
  mainline: BranchPathMetric;
  branch: BranchPathMetric | null;
  rounds: BranchPathRound[];
  summary: { submittedRoundCount: number; revisedDocumentCount: number; operationCount: number };
};

export type OpenedMaterial = {
  id: string;
  subject?: string;
  displayLabel?: string;
  channel?: string;
  facts?: string[];
  documentIds?: string[];
  [key: string]: unknown;
};

export type BranchCreation = {
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

export type ManagementArea = {
  id: string;
  index: string;
  title: string;
  shortTitle: string;
  documentIds: string[];
};

export type ManagementAreaSummary = {
  area: ManagementArea;
  status: ProjectHealthStatus;
  exceptions: ProjectControlException[];
  facts: string[];
  createdDocumentIds: string[];
};
