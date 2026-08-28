import type { LabCaseRuntimePackage, StateEffect } from "../../lib/lab/contracts";
import type {
  OwnedBranch,
  StoredBranchPathRound,
  StoredDocumentDelta,
} from "./repository";

type PathMetricSnapshot = {
  week: number;
  spi: number;
  cpi: number;
  forecastCompletionWeek: number;
  status: string;
};

export type BranchPathDocumentChange = {
  documentId: string;
  operationCount: number;
};

export type BranchPathRound = {
  roundNumber: number;
  week: number;
  commitHash: string;
  submittedAt: string | null;
  scenarioStatus: string;
  pathClassification: string | null;
  mainline: PathMetricSnapshot;
  branch: PathMetricSnapshot;
  documents: BranchPathDocumentChange[];
  completedActions: number;
  harmfulEffects: number;
};

export type BranchPathComparison = {
  caseVersion: string;
  contentHash: string;
  forkWeek: number;
  currentWeek: number;
  currentRoundNumber: number;
  branchStatus: string;
  outcomeClassification: string | null;
  mainline: PathMetricSnapshot;
  branch: PathMetricSnapshot | null;
  rounds: BranchPathRound[];
  summary: {
    submittedRoundCount: number;
    revisedDocumentCount: number;
    operationCount: number;
  };
};

function asRecord(value: unknown): StateEffect {
  return value && typeof value === "object" && !Array.isArray(value) ? value as StateEffect : {};
}

function asRecords(value: unknown): StateEffect[] {
  return Array.isArray(value)
    ? value.filter((item): item is StateEffect => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function parseRecord(value: string | null): StateEffect {
  if (!value) return {};
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
}

function parseOperationCount(value: string): number {
  try {
    const operations = JSON.parse(value);
    return Array.isArray(operations) ? operations.length : 0;
  } catch {
    return 0;
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function latestAtOrBefore(records: StateEffect[], week: number): StateEffect {
  return records
    .filter((record) => finiteNumber(record.week, 0) <= week)
    .sort((left, right) => finiteNumber(left.week, 0) - finiteNumber(right.week, 0))
    .at(-1) ?? {};
}

function projectPathState(state: StateEffect, fallbackWeek: number): StateEffect {
  const scenario = asRecord(state.scenario);
  const performance = asRecord(state.performance);
  if (Object.keys(performance).length > 0) {
    return {
      week: finiteNumber(state.week, fallbackWeek),
      scenario: { status: typeof scenario.status === "string" ? scenario.status : "open" },
      performance,
      outcomeClassification: state.outcomeClassification ?? null,
    };
  }
  const baseline = asRecord(state.baseline);
  const initialImpact = asRecord(scenario.initialImpact);
  return {
    week: finiteNumber(state.week, fallbackWeek),
    scenario: { status: typeof scenario.status === "string" ? scenario.status : "open" },
    performance: {
      spi: finiteNumber(baseline.spi, 1),
      cpi: finiteNumber(baseline.cpi, 1),
      forecastCompletionWeek: finiteNumber(initialImpact.forecastCompletionWeek, 32),
    },
    outcomeClassification: typeof state.outcomeClassification === "string" ? state.outcomeClassification : null,
  };
}

function mainlineMetricSnapshot(runtime: LabCaseRuntimePackage, requestedWeek: number): PathMetricSnapshot {
  const week = Math.min(Math.max(1, requestedWeek), runtime.totalWeeks);
  const baseline = latestAtOrBefore(asRecords(runtime.plans.baselineWorkload.weeks), week);
  const schedule = asRecord(runtime.plans.schedule);
  const schedulePlan = asRecord(schedule.projectSchedulePlan);
  const scheduleStatus = latestAtOrBefore(asRecords(schedulePlan.statusEvents), week);
  return {
    week,
    spi: finiteNumber(baseline.spi, 1),
    cpi: finiteNumber(baseline.cpi, 1),
    forecastCompletionWeek: finiteNumber(scheduleStatus.forecastFinishWeek, runtime.totalWeeks),
    status: typeof scheduleStatus.health === "string" ? scheduleStatus.health : "mainline",
  };
}

function branchMetricSnapshot(round: StoredBranchPathRound): PathMetricSnapshot & {
  scenarioStatus: string;
  pathClassification: string | null;
  completedActions: number;
  harmfulEffects: number;
} {
  const projected = projectPathState(parseRecord(round.stateJson), round.week);
  const performance = asRecord(projected.performance);
  const scenario = asRecord(projected.scenario);
  const ruleResult = parseRecord(round.ruleResultJson);
  const stateDiff = asRecord(ruleResult.stateDiff);
  const projectedOutcome = projected.outcomeClassification;
  const ruleOutcome = ruleResult.pathClassification;
  return {
    week: round.week,
    spi: finiteNumber(performance.spi, 1),
    cpi: finiteNumber(performance.cpi, 1),
    forecastCompletionWeek: finiteNumber(performance.forecastCompletionWeek, 32),
    status: typeof scenario.status === "string" ? scenario.status : "open",
    scenarioStatus: typeof scenario.status === "string" ? scenario.status : "open",
    pathClassification: typeof ruleOutcome === "string"
      ? ruleOutcome
      : typeof projectedOutcome === "string"
        ? projectedOutcome
        : null,
    completedActions: finiteNumber(stateDiff.managementActionsCompletedThisRound, 0),
    harmfulEffects: finiteNumber(stateDiff.harmfulEffectsApplied, 0),
  };
}

export function buildBranchPathComparison(
  runtime: LabCaseRuntimePackage,
  branch: OwnedBranch,
  storedRounds: StoredBranchPathRound[],
  documentDeltas: StoredDocumentDelta[],
): BranchPathComparison {
  const documentsByRound = new Map<number, Map<string, number>>();
  let operationCount = 0;
  for (const delta of documentDeltas) {
    const count = parseOperationCount(delta.patchJson);
    operationCount += count;
    const documents = documentsByRound.get(delta.roundNumber) ?? new Map<string, number>();
    documents.set(delta.documentId, (documents.get(delta.documentId) ?? 0) + count);
    documentsByRound.set(delta.roundNumber, documents);
  }

  const rounds = [...storedRounds]
    .sort((left, right) => left.roundNumber - right.roundNumber)
    .map((round): BranchPathRound => {
      const branchMetric = branchMetricSnapshot(round);
      const documents = [...(documentsByRound.get(round.roundNumber) ?? new Map<string, number>())]
        .map(([documentId, count]) => ({ documentId, operationCount: count }))
        .sort((left, right) => left.documentId.localeCompare(right.documentId, "en"));
      return {
        roundNumber: round.roundNumber,
        week: branchMetric.week,
        commitHash: round.stateHash.slice(0, 8),
        submittedAt: round.submittedAt,
        scenarioStatus: branchMetric.scenarioStatus,
        pathClassification: branchMetric.pathClassification,
        mainline: mainlineMetricSnapshot(runtime, branchMetric.week),
        branch: {
          week: branchMetric.week,
          spi: branchMetric.spi,
          cpi: branchMetric.cpi,
          forecastCompletionWeek: branchMetric.forecastCompletionWeek,
          status: branchMetric.status,
        },
        documents,
        completedActions: branchMetric.completedActions,
        harmfulEffects: branchMetric.harmfulEffects,
      };
    });

  const latestRound = rounds.at(-1);
  const fallbackForkWeek = Math.max(1, branch.currentWeek - branch.currentRoundNumber);
  const forkWeek = rounds[0]?.week ?? fallbackForkWeek;
  const outcomeClassification = branch.status === "active"
    ? null
    : branch.outcomeClassification ?? latestRound?.pathClassification ?? null;
  return {
    caseVersion: branch.caseVersion,
    contentHash: branch.contentHash,
    forkWeek,
    currentWeek: branch.currentWeek,
    currentRoundNumber: branch.currentRoundNumber,
    branchStatus: branch.status,
    outcomeClassification,
    mainline: latestRound?.mainline ?? mainlineMetricSnapshot(runtime, branch.currentWeek),
    branch: latestRound?.branch ?? null,
    rounds,
    summary: {
      submittedRoundCount: rounds.filter((round) => round.roundNumber > 0).length,
      revisedDocumentCount: new Set(documentDeltas.map((delta) => delta.documentId)).size,
      operationCount,
    },
  };
}
