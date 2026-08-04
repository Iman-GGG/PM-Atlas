import type {
  CardConnection,
  PathClassification,
  RoundResult,
  ScenarioDefinition,
  StateEffect,
} from "../../lib/lab/contracts";

type InternalScenarioState = {
  id: string;
  status: "open" | "closed" | "failed";
  completedActionIds: string[];
  satisfiedConnectionKeys: string[];
  appliedHarmfulCardIds: string[];
  appliedOptionalCardIds: string[];
  appliedThresholdWeeks: number[];
  consecutiveUncontrolledDevelopmentRounds: number;
};

export type InternalBranchState = {
  caseId: string;
  caseVersion: string;
  contentHash: string;
  mode: "learning";
  week: number;
  baseline: StateEffect;
  scenario: InternalScenarioState;
  performance: {
    spi: number;
    cpi: number;
    cumulativePlannedValueCny: number;
    cumulativeEarnedValueCny: number;
    cumulativeActualCostCny: number;
    budgetAtCompletionCny: number;
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
  governance: {
    ccbOpenItems: number;
    scopeControlViolation: boolean;
  };
  riskTransitions: StateEffect[];
  stakeholderTransitions: StateEffect[];
  documentRevisions: string[];
  outcomeClassification?: PathClassification;
};

type SettleRoundInput = {
  branchId: string;
  roundNumber: number;
  scenario: ScenarioDefinition;
  previousState: Record<string, unknown>;
  selectedCardIds: string[];
  connections: CardConnection[];
  nextBaseline: StateEffect;
  budgetAtCompletionCny: number;
};

export type SettledRound = {
  internalState: InternalBranchState;
  result: RoundResult;
};

const additiveFields = [
  "incrementalActualCostCny",
  "incrementalWorkPersonDays",
  "overtimePersonDays",
  "blockedPersonDays",
  "coordinationAndWaitingPersonDays",
] as const;

function connectionKey(connection: CardConnection): string {
  return `${connection.fromCardId}>${connection.toCardId}`;
}

function numericValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sumNamedField(value: unknown, fieldName: string): number {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + sumNamedField(item, fieldName), 0);
  if (!value || typeof value !== "object") return 0;
  return Object.entries(value as Record<string, unknown>).reduce((sum, [key, item]) => (
    sum + (key === fieldName ? numericValue(item) : sumNamedField(item, fieldName))
  ), 0);
}

function findNamedNumbers(value: unknown, fieldName: string): number[] {
  if (Array.isArray(value)) return value.flatMap((item) => findNamedNumbers(item, fieldName));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => (
    key === fieldName && typeof item === "number" ? [item] : findNamedNumbers(item, fieldName)
  ));
}

function findNamedStrings(value: unknown, fieldName: string): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => findNamedStrings(item, fieldName));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    if (key === fieldName && Array.isArray(item)) return item.filter((entry): entry is string => typeof entry === "string");
    return findNamedStrings(item, fieldName);
  });
}

function findNamedObjects(value: unknown, fieldName: string): StateEffect[] {
  if (Array.isArray(value)) return value.flatMap((item) => findNamedObjects(item, fieldName));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    if (key === fieldName && Array.isArray(item)) {
      return item.filter((entry): entry is StateEffect => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
    }
    return findNamedObjects(item, fieldName);
  });
}

function normalizeState(
  previousState: Record<string, unknown>,
  scenario: ScenarioDefinition,
  budgetAtCompletionCny: number,
): InternalBranchState {
  const previousScenario = previousState.scenario && typeof previousState.scenario === "object"
    ? previousState.scenario as Record<string, unknown>
    : {};
  const previousPerformance = previousState.performance && typeof previousState.performance === "object"
    ? previousState.performance as Record<string, unknown>
    : {};
  const previousTotals = previousState.totals && typeof previousState.totals === "object"
    ? previousState.totals as Record<string, unknown>
    : {};
  const previousGovernance = previousState.governance && typeof previousState.governance === "object"
    ? previousState.governance as Record<string, unknown>
    : {};
  const baseline = previousState.baseline && typeof previousState.baseline === "object"
    ? previousState.baseline as StateEffect
    : {};
  const initialTraceabilityDelta = scenario.initialImpact.requirements && typeof scenario.initialImpact.requirements === "object"
    ? numericValue((scenario.initialImpact.requirements as StateEffect).traceabilityCoverageDeltaPercentagePoints)
    : 0;
  return {
    caseId: String(previousState.caseId ?? ""),
    caseVersion: String(previousState.caseVersion ?? ""),
    contentHash: String(previousState.contentHash ?? ""),
    mode: "learning",
    week: numericValue(previousState.week) || scenario.week,
    baseline,
    scenario: {
      id: scenario.id,
      status: previousScenario.status === "closed" || previousScenario.status === "failed" ? previousScenario.status : "open",
      completedActionIds: Array.isArray(previousScenario.completedActionIds) ? previousScenario.completedActionIds.filter((id): id is string => typeof id === "string") : [],
      satisfiedConnectionKeys: Array.isArray(previousScenario.satisfiedConnectionKeys) ? previousScenario.satisfiedConnectionKeys.filter((id): id is string => typeof id === "string") : [],
      appliedHarmfulCardIds: Array.isArray(previousScenario.appliedHarmfulCardIds) ? previousScenario.appliedHarmfulCardIds.filter((id): id is string => typeof id === "string") : [],
      appliedOptionalCardIds: Array.isArray(previousScenario.appliedOptionalCardIds) ? previousScenario.appliedOptionalCardIds.filter((id): id is string => typeof id === "string") : [],
      appliedThresholdWeeks: Array.isArray(previousScenario.appliedThresholdWeeks) ? previousScenario.appliedThresholdWeeks.filter((week): week is number => typeof week === "number") : [],
      consecutiveUncontrolledDevelopmentRounds: numericValue(previousScenario.consecutiveUncontrolledDevelopmentRounds),
    },
    performance: {
      spi: numericValue(previousPerformance.spi) || numericValue(baseline.spi) || 1,
      cpi: numericValue(previousPerformance.cpi) || numericValue(baseline.cpi) || 1,
      cumulativePlannedValueCny: numericValue(previousPerformance.cumulativePlannedValueCny) || numericValue(baseline.cumulativePlannedValueCny),
      cumulativeEarnedValueCny: numericValue(previousPerformance.cumulativeEarnedValueCny) || numericValue(baseline.cumulativeEarnedValueCny),
      cumulativeActualCostCny: numericValue(previousPerformance.cumulativeActualCostCny) || numericValue(baseline.cumulativeActualCostCny),
      budgetAtCompletionCny,
      forecastCompletionWeek: numericValue(previousPerformance.forecastCompletionWeek)
        || numericValue(scenario.initialImpact.forecastCompletionWeek)
        || 32,
    },
    totals: {
      incrementalActualCostCny: numericValue(previousTotals.incrementalActualCostCny),
      incrementalWorkPersonDays: numericValue(previousTotals.incrementalWorkPersonDays),
      overtimePersonDays: numericValue(previousTotals.overtimePersonDays),
      blockedPersonDays: numericValue(previousTotals.blockedPersonDays),
      coordinationAndWaitingPersonDays: numericValue(previousTotals.coordinationAndWaitingPersonDays),
      unauthorizedScopeWorkPersonDays: numericValue(previousTotals.unauthorizedScopeWorkPersonDays),
      overdueCommunicationItems: numericValue(previousTotals.overdueCommunicationItems),
      requirementsTraceabilityCoveragePercent: numericValue(previousTotals.requirementsTraceabilityCoveragePercent)
        || Math.max(0, 100 + initialTraceabilityDelta),
    },
    governance: {
      ccbOpenItems: numericValue(previousGovernance.ccbOpenItems),
      scopeControlViolation: previousGovernance.scopeControlViolation === true,
    },
    riskTransitions: Array.isArray(previousState.riskTransitions) ? previousState.riskTransitions as StateEffect[] : [],
    stakeholderTransitions: Array.isArray(previousState.stakeholderTransitions) ? previousState.stakeholderTransitions as StateEffect[] : [],
    documentRevisions: Array.isArray(previousState.documentRevisions) ? previousState.documentRevisions.filter((id): id is string => typeof id === "string") : [],
    outcomeClassification: typeof previousState.outcomeClassification === "string"
      ? previousState.outcomeClassification as PathClassification
      : undefined,
  };
}

function addEffectTotals(state: InternalBranchState, effect: StateEffect): void {
  for (const field of additiveFields) state.totals[field] += sumNamedField(effect, field);
  state.totals.unauthorizedScopeWorkPersonDays += sumNamedField(effect, "unauthorizedScopeWorkPersonDays");
  state.totals.overdueCommunicationItems += sumNamedField(effect, "overdueCommunicationActions")
    + sumNamedField(effect, "newOverdueCommunicationItems");
  if (findNamedNumbers(effect, "scopeControlViolation").length || effect.scopeControlViolation === true) {
    state.governance.scopeControlViolation = true;
  }
}

function publicState(state: InternalBranchState): Record<string, unknown> {
  return {
    week: state.week,
    scenario: { id: state.scenario.id, status: state.scenario.status },
    performance: state.performance,
    totals: state.totals,
    governance: state.governance,
    riskTransitions: state.riskTransitions,
    stakeholderTransitions: state.stakeholderTransitions,
    documentRevisions: state.documentRevisions,
    outcomeClassification: state.outcomeClassification ?? null,
  };
}

export function projectStoredBranchState(state: Record<string, unknown>): Record<string, unknown> {
  const baseline = state.baseline && typeof state.baseline === "object" ? state.baseline as StateEffect : {};
  const scenario = state.scenario && typeof state.scenario === "object" ? state.scenario as StateEffect : {};
  const initialImpact = scenario.initialImpact && typeof scenario.initialImpact === "object" ? scenario.initialImpact as StateEffect : {};
  const initialRequirements = initialImpact.requirements && typeof initialImpact.requirements === "object" ? initialImpact.requirements as StateEffect : {};
  const initialTraceabilityCoverage = Math.max(0, 100 + numericValue(initialRequirements.traceabilityCoverageDeltaPercentagePoints));
  if (state.performance && state.totals && state.governance) return publicState(state as unknown as InternalBranchState);
  return {
    week: numericValue(state.week),
    scenario: { id: scenario.id ?? null, status: scenario.status ?? "open" },
    performance: {
      spi: numericValue(baseline.spi) || 1,
      cpi: numericValue(baseline.cpi) || 1,
      cumulativePlannedValueCny: numericValue(baseline.cumulativePlannedValueCny),
      cumulativeEarnedValueCny: numericValue(baseline.cumulativeEarnedValueCny),
      cumulativeActualCostCny: numericValue(baseline.cumulativeActualCostCny),
      forecastCompletionWeek: numericValue(initialImpact.forecastCompletionWeek) || 32,
    },
    totals: {
      incrementalActualCostCny: 0,
      incrementalWorkPersonDays: 0,
      overtimePersonDays: 0,
      blockedPersonDays: 0,
      coordinationAndWaitingPersonDays: 0,
      unauthorizedScopeWorkPersonDays: 0,
      overdueCommunicationItems: 0,
      requirementsTraceabilityCoveragePercent: initialTraceabilityCoverage,
    },
    governance: { ccbOpenItems: 0, scopeControlViolation: false },
    riskTransitions: [],
    stakeholderTransitions: [],
    documentRevisions: [],
    outcomeClassification: null,
  };
}

export function settleRound(input: SettleRoundInput): SettledRound {
  const state = normalizeState(input.previousState, input.scenario, input.budgetAtCompletionCny);
  const selectedCardIds = new Set(input.selectedCardIds);
  const connectedCardIds = new Set(input.connections.flatMap((connection) => [connection.fromCardId, connection.toCardId]));
  const currentConnectionKeys = new Set(input.connections.map(connectionKey));
  const satisfiedConnectionKeys = new Set([...state.scenario.satisfiedConnectionKeys, ...currentConnectionKeys]);
  const completedActionIds = new Set(state.scenario.completedActionIds);
  const newlyCompletedEffects: StateEffect[] = [];

  for (const action of input.scenario.necessaryManagementActions) {
    if (completedActionIds.has(action.id)) continue;
    const actionCards = input.scenario.cards.filter((card) => card.satisfiesActionIds?.includes(action.id));
    const cardsComplete = actionCards.length > 0 && actionCards.every((card) => selectedCardIds.has(card.id) && connectedCardIds.has(card.id));
    const prerequisitesComplete = (action.prerequisiteActionIds ?? []).every((actionId) => completedActionIds.has(actionId));
    if (cardsComplete && prerequisitesComplete) {
      completedActionIds.add(action.id);
      newlyCompletedEffects.push(action.completedEffect);
    }
  }

  const appliedHarmfulCardIds = new Set(state.scenario.appliedHarmfulCardIds);
  const appliedOptionalCardIds = new Set(state.scenario.appliedOptionalCardIds);
  let optionalManagementLoad = 0;
  for (const card of input.scenario.cards) {
    if (
      card.evaluationRole !== "useful_optional"
      || !selectedCardIds.has(card.id)
      || !connectedCardIds.has(card.id)
      || appliedOptionalCardIds.has(card.id)
    ) continue;
    appliedOptionalCardIds.add(card.id);
    optionalManagementLoad += card.managementLoad ?? 0;
  }
  const newlyAppliedHarmfulEffects = input.scenario.harmfulConsequences.flatMap((consequence) => {
    if (!selectedCardIds.has(consequence.cardId) || !connectedCardIds.has(consequence.cardId) || appliedHarmfulCardIds.has(consequence.cardId)) return [];
    appliedHarmfulCardIds.add(consequence.cardId);
    return [consequence.effects];
  });
  const requiredConnectionKeys = new Set(input.scenario.minimumCorrectConnections.map(connectionKey));
  const allConnectionsComplete = [...requiredConnectionKeys].every((key) => satisfiedConnectionKeys.has(key));
  const allActionsComplete = input.scenario.necessaryManagementActions.every((action) => completedActionIds.has(action.id));
  const allManagementComplete = allActionsComplete && allConnectionsComplete;
  const nextWeek = state.week + 1;

  for (const effect of newlyCompletedEffects) addEffectTotals(state, effect);
  for (const effect of newlyAppliedHarmfulEffects) addEffectTotals(state, effect);
  state.totals.incrementalWorkPersonDays += optionalManagementLoad;

  for (const effect of newlyCompletedEffects) {
    const recoveryWeeks = [
      ...findNamedNumbers(effect, "forecastCompletionWeek"),
      ...findNamedNumbers(effect, "forecastCompletionWeekWhenPrerequisitesComplete"),
    ];
    if (recoveryWeeks.length) state.performance.forecastCompletionWeek = Math.min(state.performance.forecastCompletionWeek, ...recoveryWeeks);
  }
  for (const effect of newlyAppliedHarmfulEffects) {
    const harmfulForecasts = findNamedNumbers(effect, "forecastCompletionWeek");
    if (harmfulForecasts.length) state.performance.forecastCompletionWeek = Math.max(state.performance.forecastCompletionWeek, ...harmfulForecasts);
    const delayWeeks = sumNamedField(effect, "forecastCompletionDelayWeeks");
    if (delayWeeks) state.performance.forecastCompletionWeek = Math.max(state.performance.forecastCompletionWeek, 32 + delayWeeks);
  }

  const selectedUncontrolledDevelopment = selectedCardIds.has("S1-C21") && connectedCardIds.has("S1-C21");
  state.scenario.consecutiveUncontrolledDevelopmentRounds = selectedUncontrolledDevelopment
    ? state.scenario.consecutiveUncontrolledDevelopmentRounds + 1
    : 0;

  const appliedThresholdWeeks = new Set(state.scenario.appliedThresholdWeeks);
  let thresholdTerminalCondition: string | null = null;
  if (!allManagementComplete) {
    const degradation = input.scenario.unresolvedIssueDegradation;
    const perOpenRound = degradation.perOpenRound as StateEffect;
    addEffectTotals(state, perOpenRound);
    state.totals.incrementalWorkPersonDays += sumNamedField(perOpenRound, "managementWorkPersonDays");
    const traceabilityDelta = sumNamedField(perOpenRound, "traceabilityCoverageDeltaPercentagePoints");
    const traceabilityFloor = numericValue((degradation.floors as StateEffect | undefined)?.requirementsTraceabilityCoveragePercent);
    state.totals.requirementsTraceabilityCoveragePercent = Math.max(
      traceabilityFloor,
      state.totals.requirementsTraceabilityCoveragePercent + traceabilityDelta,
    );
    for (const threshold of degradation.weekThresholds as Array<{ week: number; effects: StateEffect }>) {
      if (threshold.week !== nextWeek || appliedThresholdWeeks.has(threshold.week)) continue;
      appliedThresholdWeeks.add(threshold.week);
      addEffectTotals(state, threshold.effects);
      const forecastWeeks = findNamedNumbers(threshold.effects, "forecastCompletionWeek");
      if (forecastWeeks.length) state.performance.forecastCompletionWeek = Math.max(state.performance.forecastCompletionWeek, ...forecastWeeks);
      const terminalConditions = findNamedStrings({ terminalCondition: [threshold.effects.terminalCondition] }, "terminalCondition");
      thresholdTerminalCondition = typeof threshold.effects.terminalCondition === "string"
        ? threshold.effects.terminalCondition
        : terminalConditions[0] ?? null;
    }
  }

  const nextEarnedValue = numericValue(input.nextBaseline.cumulativeEarnedValueCny);
  const nextPlannedValue = numericValue(input.nextBaseline.cumulativePlannedValueCny);
  const mainlineActualCost = numericValue(input.nextBaseline.cumulativeActualCostCny);
  let spi = numericValue(input.nextBaseline.spi) || 1;
  const submittedSpiValues = [...newlyAppliedHarmfulEffects, ...newlyCompletedEffects]
    .flatMap((effect) => findNamedNumbers(effect, "spi"));
  if (submittedSpiValues.length) spi = Math.min(spi, ...submittedSpiValues);
  const cumulativeActualCostCny = mainlineActualCost + state.totals.incrementalActualCostCny;
  state.performance = {
    spi,
    cpi: cumulativeActualCostCny > 0 ? nextEarnedValue / cumulativeActualCostCny : 1,
    cumulativePlannedValueCny: nextPlannedValue,
    cumulativeEarnedValueCny: nextEarnedValue,
    cumulativeActualCostCny,
    budgetAtCompletionCny: input.budgetAtCompletionCny,
    forecastCompletionWeek: state.performance.forecastCompletionWeek,
  };

  const estimatedFinalCost = input.budgetAtCompletionCny + state.totals.incrementalActualCostCny;
  const failure = Boolean(
    thresholdTerminalCondition
    || state.totals.unauthorizedScopeWorkPersonDays >= 36
    || state.scenario.consecutiveUncontrolledDevelopmentRounds >= 3
    || state.performance.forecastCompletionWeek > 38
    || estimatedFinalCost >= 2_860_000
  );
  let pathClassification: PathClassification | undefined;
  if (failure) {
    pathClassification = "scenario_failure";
    state.scenario.status = "failed";
  } else if (allManagementComplete) {
    const harmfulOccurred = appliedHarmfulCardIds.size > 0;
    const nearRule = input.scenario.terminalRules.find((rule) => rule.classification === "near_mainline_success");
    const detourRule = input.scenario.terminalRules.find((rule) => rule.classification === "detour_success");
    if (!harmfulOccurred && nearRule?.closeWeek === nextWeek) pathClassification = "near_mainline_success";
    else if (
      !harmfulOccurred
      && nextWeek >= (detourRule?.minimumCloseWeek ?? Number.MAX_SAFE_INTEGER)
      && nextWeek <= (detourRule?.maximumCloseWeek ?? Number.MIN_SAFE_INTEGER)
    ) pathClassification = "detour_success";
    else pathClassification = "delayed_success";
    state.scenario.status = "closed";
    const terminalRule = input.scenario.terminalRules.find((rule) => rule.classification === pathClassification);
    if (terminalRule?.forecastCompletionWeek) state.performance.forecastCompletionWeek = terminalRule.forecastCompletionWeek;
  }

  const idealOutcomeApplied = pathClassification === "near_mainline_success";
  if (idealOutcomeApplied) {
    state.totals.requirementsTraceabilityCoveragePercent = 100;
    state.governance.ccbOpenItems = numericValue(input.scenario.idealOutcome.ccbOpenItems);
    state.riskTransitions = findNamedObjects(input.scenario.idealOutcome, "riskTransitions");
    state.stakeholderTransitions = findNamedObjects(input.scenario.idealOutcome, "stakeholderTransitions");
  } else {
    state.riskTransitions = [...state.riskTransitions, ...newlyCompletedEffects.flatMap((effect) => findNamedObjects(effect, "riskTransitions"))];
    state.stakeholderTransitions = [...state.stakeholderTransitions, ...newlyCompletedEffects.flatMap((effect) => findNamedObjects(effect, "stakeholderTransitions"))];
  }

  const previousDocumentRevisions = new Set(state.documentRevisions);
  const revisedDocuments = new Set(state.documentRevisions);
  for (const effect of newlyCompletedEffects) findNamedStrings(effect, "documentRevisions").forEach((id) => revisedDocuments.add(id));
  if (state.scenario.status === "closed") findNamedStrings(input.scenario.idealOutcome, "documentRevisions").forEach((id) => revisedDocuments.add(id));
  state.week = nextWeek;
  state.baseline = input.nextBaseline;
  state.scenario.completedActionIds = [...completedActionIds];
  state.scenario.satisfiedConnectionKeys = [...satisfiedConnectionKeys];
  state.scenario.appliedHarmfulCardIds = [...appliedHarmfulCardIds];
  state.scenario.appliedOptionalCardIds = [...appliedOptionalCardIds];
  state.scenario.appliedThresholdWeeks = [...appliedThresholdWeeks];
  state.documentRevisions = [...revisedDocuments];
  state.outcomeClassification = pathClassification;

  const missingConsequences = input.scenario.missingActionConsequences.filter((consequence) => !completedActionIds.has(consequence.actionId));
  const gaps = missingConsequences.map((consequence) => ({
    categories: consequence.gapCategories,
    objectiveEffects: consequence.effects,
    relatedActionIds: [],
  }));
  if (allActionsComplete && !allConnectionsComplete) {
    gaps.push({
      categories: ["connection"],
      objectiveEffects: ["selected_management_actions_not_connected_into_a_complete_chain"],
      relatedActionIds: [],
    });
  }

  const documentDiffs = [...revisedDocuments]
    .filter((documentId) => !previousDocumentRevisions.has(documentId))
    .map((documentId) => ({ documentId, operation: "update", reason: "round_settlement" }));
  const additionalActualCostCny = newlyCompletedEffects.reduce((sum, effect) => sum + sumNamedField(effect, "incrementalActualCostCny"), 0)
    + newlyAppliedHarmfulEffects.reduce((sum, effect) => sum + sumNamedField(effect, "incrementalActualCostCny"), 0)
    + (!allManagementComplete ? sumNamedField(input.scenario.unresolvedIssueDegradation.perOpenRound, "incrementalActualCostCny") : 0);

  const result: RoundResult = {
    branchId: input.branchId,
    roundNumber: input.roundNumber,
    advancedToWeek: nextWeek,
    scenarioState: state.scenario.status,
    pathClassification,
    stateSnapshot: publicState(state),
    stateDiff: {
      managementActionsCompletedThisRound: newlyCompletedEffects.length,
      additionalActualCostCny,
      incrementalWorkPersonDays: optionalManagementLoad
        + newlyCompletedEffects.reduce((sum, effect) => sum + sumNamedField(effect, "incrementalWorkPersonDays"), 0)
        + newlyAppliedHarmfulEffects.reduce((sum, effect) => sum + sumNamedField(effect, "incrementalWorkPersonDays"), 0)
        + (!allManagementComplete ? sumNamedField(input.scenario.unresolvedIssueDegradation.perOpenRound, "managementWorkPersonDays") : 0),
      harmfulEffectsApplied: newlyAppliedHarmfulEffects.length,
      forecastCompletionWeek: state.performance.forecastCompletionWeek,
      spi: state.performance.spi,
      cpi: state.performance.cpi,
      requirementsTraceabilityCoveragePercent: state.totals.requirementsTraceabilityCoveragePercent,
    },
    documentDiffs,
    newVisibleMaterialIds: [],
    gaps: state.scenario.status === "open" ? gaps : [],
  };
  return { internalState: state, result };
}
