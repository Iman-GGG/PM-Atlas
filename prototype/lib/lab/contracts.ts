export type RiskLifecycleState =
  | "identified"
  | "assessed"
  | "response_approved"
  | "monitoring"
  | "triggered"
  | "closed";

export type RiskControlStatus =
  | "prepared"
  | "active_uncontrolled"
  | "active_partially_controlled"
  | "active_controlled"
  | "pending_execution";

export type RiskAssessment = {
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
};

export type CardColumn =
  | "evidence_document"
  | "tool_technique"
  | "execution_action"
  | "stakeholder";

export type VisibleCardColumn = Exclude<CardColumn, "execution_action">;

export type CardEvaluationRole = "useful_optional" | "harmful";
export type PathClassification =
  | "near_mainline_success"
  | "detour_success"
  | "delayed_success"
  | "scenario_failure";

export type ReviewLevel = "mature" | "developing" | "needs-practice";
export type StateEffect = Record<string, unknown>;

export type EventMaterial = {
  id: string;
  type?: string;
  channel?: string;
  subject?: string;
  facts?: string[];
  senderStakeholderId?: string;
  documentIds?: string[];
  widget?: string;
  metric?: string;
  displayLabel?: string;
  [key: string]: unknown;
};

export type EventMaterials = {
  primaryClues: EventMaterial[];
  corroboratingClues: EventMaterial[];
  dashboardAnomalies: EventMaterial[];
};

export type NecessaryManagementAction = {
  id: string;
  title: string;
  completedEffect: StateEffect;
  prerequisiteActionIds?: string[];
  prerequisiteActionIdsForForecastRecovery?: string[];
};

export type RequiredObservation = {
  source: "document" | "dashboard" | "event_material";
  id: string;
  title: string;
};

export type ScenarioCard = {
  id: string;
  column: CardColumn;
  referenceId: string;
  title: string;
  satisfiesActionIds?: string[];
  evaluationRole?: CardEvaluationRole;
  managementLoad?: number;
  consequenceId?: string;
};

/** @deprecated Immutable-case compatibility only; the current UI does not submit manual connections. */
export type CardConnection = {
  fromCardId: string;
  toCardId: string;
};

export type ManagementActionChain = {
  id: string;
  title: string;
  documentCardIds: string[];
  toolTechniqueCardIds: string[];
  stakeholderCardIds: string[];
};

export type MissingActionConsequence = {
  actionId: string;
  gapCategories: string[];
  effects: string[];
};

export type HarmfulConsequence = {
  cardId: string;
  id: string;
  effects: StateEffect;
};

export type TerminalRule = {
  classification: PathClassification;
  conditions?: string[];
  conditionsAny?: string[];
  closeWeek?: number;
  minimumCloseWeek?: number;
  maximumCloseWeek?: number;
  forecastCompletionWeek?: number;
  minimumForecastCompletionWeek?: number;
  maximumForecastCompletionWeek?: number;
  terminal?: boolean;
  failureReason?: string;
};

export type ScenarioDefinition = {
  id: string;
  week: number;
  title: string;
  initialImpact: StateEffect;
  eventMaterials: EventMaterials;
  necessaryManagementActions: NecessaryManagementAction[];
  idealDecision?: string;
  requiredObservations: RequiredObservation[];
  idealOutcome: StateEffect;
  missingActionConsequences: MissingActionConsequence[];
  incompleteOutcomePolicy: StateEffect;
  unresolvedIssueDegradation: StateEffect;
  harmfulConsequences: HarmfulConsequence[];
  harmfulEffectsStack: boolean;
  terminalRules: TerminalRule[];
  cards: ScenarioCard[];
  /** @deprecated Immutable-case compatibility only; current settlement derives actions from visible cards. */
  minimumCorrectCardIds?: string[];
  /** @deprecated Immutable-case compatibility only; current settlement has no global connection gate. */
  minimumCorrectConnections?: CardConnection[];
};

export type ScenarioPlan = {
  schemaVersion: number;
  caseId: string;
  caseVersion: string;
  eventDiscoveryPolicy: StateEffect;
  /** @deprecated Immutable-case compatibility only; the current submission has no separate reasoning fields. */
  decisionReasoningPolicy: StateEffect & { enabled: false; fields: [] };
  aiReviewPolicy: StateEffect;
  engineSettlementPolicy: StateEffect;
  branchComparisonPolicy: StateEffect;
  scenarios: ScenarioDefinition[];
};

export type LabCasePackageIdentity = {
  schemaVersion: number;
  caseId: string;
  caseVersion: string;
  contentHash: string;
};

export type PrivateLabCasePackage = LabCasePackageIdentity & {
  sourceFiles: {
    workloadPlan: StateEffect;
    schedulePlan: StateEffect;
    stakeholderPlan: StateEffect;
    documentPlan: StateEffect;
    requirementPlan: StateEffect;
    riskPlan: StateEffect;
    qualityPlan: StateEffect;
    iterationPlan: StateEffect;
    scenarioPlan: ScenarioPlan;
    baselineWorkload: StateEffect;
  };
};

export type PublicTakeoverPoint = {
  scenarioId: string;
  week: number;
  label: "从这里接手";
};

export type PublicLabCaseBaseline = LabCasePackageIdentity & {
  totalWeeks: number;
  plans: {
    workload: StateEffect;
    schedule: StateEffect;
    stakeholders: StateEffect;
    documents: StateEffect;
    requirements: StateEffect;
    risks: StateEffect;
    quality: StateEffect;
    /** Added in car-control:v6; frozen v1-v5 packages intentionally omit it. */
    iterations?: StateEffect;
    baselineWorkload: StateEffect;
  };
  learningPolicies: {
    eventDiscovery: StateEffect;
  };
  takeoverPoints: PublicTakeoverPoint[];
};

/** Immutable public baseline plus private scenario rules for one exact case hash. */
export type LabCaseRuntimePackage = PublicLabCaseBaseline & {
  scenarios: ScenarioDefinition[];
};

export type PublicScenarioCard = Pick<ScenarioCard, "id" | "referenceId" | "title"> & {
  column: VisibleCardColumn;
};

export type VisibleScenarioProjection = {
  id: string;
  week: number;
  title: string;
  eventMaterials: EventMaterials;
  cards: PublicScenarioCard[];
};

export type RoundSubmissionRequest = {
  scenarioId: string;
  expectedRoundNumber: number;
  idempotencyKey: string;
  actionChains: ManagementActionChain[];
};

export type RuleGapSupportCard = Pick<ScenarioCard, "id" | "referenceId" | "title"> & {
  column: VisibleCardColumn;
};

export type RuleGap = {
  categories: string[];
  objectiveEffects: string[];
  relatedActionIds: string[];
  actionTitle?: string;
  recognizedCards?: RuleGapSupportCard[];
  missingCards?: RuleGapSupportCard[];
  cardsSplitAcrossChains?: boolean;
  missingPrerequisites?: Array<{ actionId: string; title: string }>;
  diagnosis?: "missing_cards" | "split_across_chains" | "prerequisite_incomplete";
};

export type RoundResult = {
  rulesetVersion: 2;
  branchId: string;
  roundNumber: number;
  advancedToWeek: number;
  scenarioState: "open" | "closed" | "failed";
  pathClassification?: PathClassification;
  stateSnapshot: Record<string, unknown>;
  stateDiff: StateEffect;
  documentDiffs: StateEffect[];
  newVisibleMaterialIds: string[];
  gaps: RuleGap[];
};

export type ReviewFinding = {
  claim: string;
  evidenceRefs: string[];
  impact: string;
};

export type AiReview = {
  summary: string;
  strengths: ReviewFinding[];
  improvements: ReviewFinding[];
  mainlineDifferences: ReviewFinding[];
  capabilityProfile: {
    signalRecognition: ReviewLevel;
    riskAndRootCauseDiagnosis: ReviewLevel;
    actionCompletenessAndMinimality: ReviewLevel;
    timingAndTradeoff: ReviewLevel;
    communicationAndGovernance: ReviewLevel;
  };
  recommendedKnowledgeIds: string[];
  retrySuggestion: string;
};
