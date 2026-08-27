import type { LabCaseRuntimePackage, StateEffect } from "../../lib/lab/contracts";
import type { JsonPatchOperation, JsonPatchValue } from "./document-diff";

type StoredDocumentPatch = {
  roundNumber: number;
  week: number;
  reason: string;
  operations: JsonPatchOperation[];
};

export type DocumentFieldSide = {
  exists: boolean;
  resolved: boolean;
  value: JsonPatchValue | null;
};

export type DocumentFieldComparison = {
  path: string;
  changeType: "added" | "modified" | "removed";
  roundNumber: number;
  week: number;
  reason: string;
  mainline: DocumentFieldSide;
  branch: DocumentFieldSide;
};

type PointerResult = { exists: boolean; value: unknown };

function asRecord(value: unknown): StateEffect {
  return value && typeof value === "object" && !Array.isArray(value) ? value as StateEffect : {};
}

function asRecords(value: unknown): StateEffect[] {
  return Array.isArray(value) ? value.filter((item): item is StateEffect => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function pointerSegments(path: string): string[] {
  if (!path.startsWith("/")) return [];
  const segments = path.slice(1).split("/").map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  return segments.some((segment) => segment === "__proto__" || segment === "prototype" || segment === "constructor") ? [] : segments;
}

function readPointer(root: StateEffect, path: string): PointerResult {
  let current: unknown = root;
  for (const segment of pointerSegments(path)) {
    if (!current || typeof current !== "object" || Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { exists: false, value: undefined };
    }
    current = (current as StateEffect)[segment];
  }
  return { exists: true, value: current };
}

function writePointer(root: StateEffect, path: string, value: JsonPatchValue): void {
  const segments = pointerSegments(path);
  if (!segments.length) return;
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (!next || typeof next !== "object" || Array.isArray(next)) current[segment] = {};
    current = current[segment] as StateEffect;
  }
  current[segments.at(-1)!] = value;
}

function removePointer(root: StateEffect, path: string): void {
  const segments = pointerSegments(path);
  if (!segments.length) return;
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (!next || typeof next !== "object" || Array.isArray(next)) return;
    current = next as StateEffect;
  }
  delete current[segments.at(-1)!];
}

function scalar(value: unknown): JsonPatchValue | undefined {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null ? value : undefined;
}

function latestByWeek(items: StateEffect[], week: number, key = "week"): StateEffect | null {
  return items.filter((item) => Number(item[key]) <= week).sort((left, right) => Number(left[key]) - Number(right[key])).at(-1) ?? null;
}

function itemById(items: StateEffect[], id: string): StateEffect | null {
  return items.find((item) => item.id === id) ?? null;
}

function setScalar(snapshot: StateEffect, path: string, value: unknown): void {
  const next = scalar(value);
  if (next !== undefined) writePointer(snapshot, path, next);
}

function currentWeekState(runtime: LabCaseRuntimePackage, week: number): StateEffect {
  const weeks = asRecords(runtime.plans.baselineWorkload.weeks);
  return weeks.find((item) => Number(item.week) === week) ?? latestByWeek(weeks, week) ?? {};
}

function currentScheduleStatus(runtime: LabCaseRuntimePackage, week: number): StateEffect {
  const plan = asRecord(runtime.plans.schedule.projectSchedulePlan);
  return latestByWeek(asRecords(plan.statusEvents), week) ?? {};
}

function currentScopeStatus(documents: StateEffect, itemId: string, week: number): StateEffect | null {
  const scope = asRecord(documents.projectScopeStatement);
  const item = itemById(asRecords(scope.productScopeItems), itemId);
  return item ? latestByWeek(asRecords(item.statusEvents), week) : null;
}

function riskSnapshot(runtime: LabCaseRuntimePackage, week: number): Map<string, { lifecycle: string; controlStatus: string | null }> {
  const risks = asRecord(runtime.plans.risks);
  const current = new Map<string, { lifecycle: string; controlStatus: string | null }>(asRecords(risks.initialRisks)
    .filter((risk) => Number(risk.discoveredWeek) <= week)
    .map((risk) => [String(risk.id), { lifecycle: "identified", controlStatus: null }] as const));
  for (const event of asRecords(risks.mainlineLifecycleEvents).filter((item) => Number(item.week) <= week)) {
    for (const riskId of Array.isArray(event.riskIds) ? event.riskIds : []) {
      if (typeof riskId !== "string" || !current.has(riskId)) continue;
      const previous = current.get(riskId)!;
      current.set(riskId, {
        lifecycle: typeof event.toLifecycleState === "string" ? event.toLifecycleState : previous.lifecycle,
        controlStatus: event.controlStatus === null ? null : typeof event.controlStatus === "string" ? event.controlStatus : previous.controlStatus,
      });
    }
  }
  return current;
}

function qualityGateResult(runtime: LabCaseRuntimePackage, metricId: string, week: number): JsonPatchValue | undefined {
  const quality = asRecord(runtime.plans.quality);
  const definition = itemById([...asRecords(quality.hardGates), ...asRecords(quality.performanceMetrics)], metricId);
  const series = asRecords(quality.mainlineSeries).find((item) => item.metricId === metricId);
  const anchor = series ? latestByWeek(asRecords(series.anchors), week) : null;
  if (!definition || !anchor) return undefined;
  const value = anchor.value;
  const target = definition.target;
  if (definition.operator === "equals") return value === target ? "passed" : "failed_blocked";
  if (typeof value !== "number" || typeof target !== "number") return "failed_blocked";
  if (definition.operator === "greater_than_or_equal") return value >= target ? "passed" : "failed_blocked";
  return value <= target ? "passed" : "failed_blocked";
}

/**
 * Builds the semantic mainline shape used by branch patches. These paths are
 * intentionally stable across frozen case packages and are not raw source JSON paths.
 */
export function buildMainlineDocumentSnapshot(documentId: string, runtime: LabCaseRuntimePackage, week: number): StateEffect {
  const snapshot: StateEffect = {};
  const documents = asRecord(runtime.plans.documents);
  const weekState = currentWeekState(runtime, week);
  const scheduleStatus = currentScheduleStatus(runtime, week);
  const forecastCompletionWeek = Number(scheduleStatus.forecastFinishWeek || 32);

  switch (documentId) {
    case "D03": {
      const log = asRecord(documents.assumptionLog);
      for (const assumption of asRecords(log.items)) {
        const event = latestByWeek(asRecords(assumption.statusEvents), week);
        if (typeof assumption.id === "string") setScalar(snapshot, `/assumptions/${assumption.id}/status`, event?.status);
      }
      break;
    }
    case "D05": {
      const openItems = asRecords(documents.changeItems).filter((item) => Number(item.submittedWeek) <= week && Number(item.closedWeek) > week).length;
      setScalar(snapshot, "/changeControl/openItems", openItems);
      setScalar(snapshot, "/changeControl/scopeControlViolation", false);
      break;
    }
    case "D10": {
      const register = asRecord(documents.milestoneList);
      for (const milestone of asRecords(register.items)) {
        if (typeof milestone.id !== "string") continue;
        const event = latestByWeek(asRecords(milestone.statusEvents), week);
        setScalar(snapshot, `/milestones/${milestone.id}/status`, event?.status);
        setScalar(snapshot, `/milestones/${milestone.id}/currentForecastWeek`, event?.forecastWeek);
      }
      break;
    }
    case "D13":
      setScalar(snapshot, "/communication/overdueItems", 0);
      break;
    case "D14": {
      const plan = asRecord(runtime.plans.schedule.projectSchedulePlan);
      const calendar = asRecord(plan.calendar);
      const health = String(scheduleStatus.health ?? "on_track");
      const activityForecast = health === "at_risk" ? "at_risk" : health === "recovery_approved" ? "recovery_plan_active" : "on_plan";
      setScalar(snapshot, "/scheduleStatus/dataDateWeek", week);
      setScalar(snapshot, "/scheduleStatus/spi", weekState.spi);
      setScalar(snapshot, "/scheduleStatus/cpi", weekState.cpi);
      setScalar(snapshot, "/scheduleStatus/forecastCompletionWeek", forecastCompletionWeek);
      setScalar(snapshot, "/scheduleStatus/forecastVarianceWeeks", forecastCompletionWeek - Number(calendar.plannedFinishWeek || 32));
      setScalar(snapshot, "/scheduleBaseline/finishWeek", calendar.plannedFinishWeek ?? 32);
      setScalar(snapshot, "/scheduleBaseline/changeStatus", "unchanged");
      setScalar(snapshot, "/activities/WBS-8.2/forecastStatus", activityForecast);
      setScalar(snapshot, "/activities/WBS-9.2/forecastStatus", activityForecast);
      if (week >= 18) setScalar(snapshot, "/recoveryPlan/strategy", "staged_interface_mock_parallel_backup_handoff");
      break;
    }
    case "D16": {
      const scope = asRecord(documents.projectScopeStatement);
      const baseline = latestByWeek(asRecords(scope.baselineEvents), week);
      setScalar(snapshot, "/scopeBaseline/version", baseline?.version);
      for (const itemId of ["PSC-02", "PSC-03"]) setScalar(snapshot, `/productScope/${itemId}/status`, currentScopeStatus(documents, itemId, week)?.status);
      const exclusion = itemById(asRecords(scope.exclusions), "EX-05");
      if (exclusion && Number(exclusion.effectiveWeek) <= week) setScalar(snapshot, "/scopeExclusions/EX-05/status", "active");
      setScalar(snapshot, "/scopeApproval/status", baseline?.approvedChangeId ? "ccb_approved" : "baseline_approved");
      break;
    }
    case "D17": {
      const assignmentStatus = week === 17 ? "temporarily_unavailable" : week >= 18 && week < 20 ? "backup_active" : week >= 20 ? "restored" : "assigned";
      const handoverStatus = week === 17 ? "pending_start" : week >= 18 && week < 20 ? "structured_handover_in_progress" : week >= 20 ? "structured_handover_complete" : "not_required";
      setScalar(snapshot, "/assignments/vehicle_integration/status", assignmentStatus);
      setScalar(snapshot, "/assignments/vehicle_integration/handoverStatus", handoverStatus);
      break;
    }
    case "D20": {
      const remoteScope = currentScopeStatus(documents, "PSC-03", week)?.status;
      const readOnlyScope = currentScopeStatus(documents, "PSC-02", week)?.status;
      const openSecurityIssue = asRecords(documents.issues).some((issue) => (
        issue.category === "security"
        && (issue.severity === "high" || issue.severity === "critical")
        && Number(issue.discoveredWeek) <= week
        && Number(issue.resolvedWeek) > week
      ));
      setScalar(snapshot, "/qualityGates/remote_control/result", openSecurityIssue ? "failed_blocked" : qualityGateResult(runtime, "remote_control_audit_revocation_expiry_complete", week));
      setScalar(snapshot, "/qualityGates/read_only_vehicle_status/result", week >= 24 ? "passed" : "pending_evidence");
      setScalar(snapshot, "/releaseScope/remote_control/status", remoteScope);
      setScalar(snapshot, "/releaseScope/read_only_vehicle_status/status", readOnlyScope);
      const recommendation = remoteScope === "deferred_from_v1_0"
        ? "release_read_only_on_schedule_disable_remote_control"
        : openSecurityIssue ? "block_affected_capability_pending_fix" : "continue_stage_validation";
      setScalar(snapshot, "/releaseRecommendation", recommendation);
      if (remoteScope === "deferred_from_v1_0") setScalar(snapshot, "/residualRisk/remoteControl", "deferred_until_security_gate_passes");
      break;
    }
    case "D21":
      setScalar(snapshot, "/requirements/traceabilityCoveragePercent", 100);
      break;
    case "D22":
      setScalar(snapshot, "/traceability/coveragePercent", 100);
      setScalar(snapshot, "/traceability/unauthorizedScopeWorkPersonDays", 0);
      break;
    case "D24":
      setScalar(snapshot, "/availability/vehicle_integration/W17-W18/status", week >= 17 && week <= 18 ? "unavailable" : "available");
      setScalar(snapshot, "/capacity/backend/W18/approvedOvertimePersonDays", week === 18 ? 1 : 0);
      setScalar(snapshot, "/capacity/forecastCompletionWeek", forecastCompletionWeek);
      break;
    case "D26":
      setScalar(snapshot, "/risk/forecastCompletionWeek", forecastCompletionWeek);
      setScalar(snapshot, "/risk/scenarioStatus", "mainline");
      break;
    case "D27": {
      const currentRisks = riskSnapshot(runtime, week);
      for (const [riskId, state] of currentRisks) {
        setScalar(snapshot, `/riskSummary/current/${riskId}/lifecycleState`, state.lifecycle);
        if (state.controlStatus) setScalar(snapshot, `/riskSummary/current/${riskId}/controlStatus`, state.controlStatus);
      }
      setScalar(snapshot, "/riskSummary/forecastCompletionWeek", forecastCompletionWeek);
      setScalar(snapshot, "/riskSummary/managementConclusion", [...currentRisks.values()].every((risk) => risk.lifecycle === "closed") ? "all_identified_risks_closed" : "continue_monitoring");
      break;
    }
    case "D28":
      setScalar(snapshot, "/progress/dataDateWeek", week);
      setScalar(snapshot, "/progress/spi", weekState.spi);
      setScalar(snapshot, "/progress/cpi", weekState.cpi);
      setScalar(snapshot, "/progress/cumulativePlannedValueCny", weekState.cumulativePlannedValueCny);
      setScalar(snapshot, "/progress/cumulativeEarnedValueCny", weekState.cumulativeEarnedValueCny);
      setScalar(snapshot, "/progress/cumulativeActualCostCny", weekState.cumulativeActualCostCny);
      break;
    case "D29": {
      const plan = asRecord(runtime.plans.schedule.projectSchedulePlan);
      const calendar = asRecord(plan.calendar);
      setScalar(snapshot, "/forecast/dataDateWeek", week);
      setScalar(snapshot, "/forecast/completionWeek", forecastCompletionWeek);
      setScalar(snapshot, "/forecast/varianceWeeks", forecastCompletionWeek - Number(calendar.plannedFinishWeek || 32));
      setScalar(snapshot, "/forecast/spi", weekState.spi);
      setScalar(snapshot, "/forecast/cpi", weekState.cpi);
      setScalar(snapshot, "/forecast/basis", scheduleStatus.health ?? "deterministic_mainline_snapshot");
      break;
    }
    case "D30": {
      const stakeholders = asRecord(runtime.plans.stakeholders);
      const currentById = new Map(asRecords(stakeholders.stakeholders)
        .filter((item) => Number(item.identifiedWeek) <= week)
        .map((item) => [String(item.id), String(asRecord(item.initialEngagement).current ?? "neutral")]));
      for (const event of asRecords(stakeholders.mainlineEngagementEvents).filter((item) => Number(item.week) <= week)) {
        if (typeof event.stakeholderId === "string" && typeof event.current === "string") currentById.set(event.stakeholderId, event.current);
      }
      for (const [stakeholderId, current] of currentById) setScalar(snapshot, `/stakeholders/${stakeholderId}/currentEngagement`, current);
      setScalar(snapshot, "/engagement/overdueCommunicationItems", 0);
      break;
    }
  }
  return snapshot;
}

function side(result: PointerResult, resolved = true): DocumentFieldSide {
  return {
    exists: result.exists,
    resolved,
    value: scalar(result.value) ?? null,
  };
}

export function compareDocumentPatches(
  documentId: string,
  runtime: LabCaseRuntimePackage,
  week: number,
  patches: StoredDocumentPatch[],
): DocumentFieldComparison[] {
  const mainline = buildMainlineDocumentSnapshot(documentId, runtime, week);
  const branch = structuredClone(mainline);
  const latestByPath = new Map<string, { operation: JsonPatchOperation; patch: StoredDocumentPatch }>();

  for (const patch of patches.sort((left, right) => left.roundNumber - right.roundNumber)) {
    for (const operation of patch.operations) {
      if (!operation || typeof operation !== "object" || typeof operation.path !== "string" || !["add", "replace", "remove"].includes(operation.op)) continue;
      if (!operation.path.startsWith("/") || !pointerSegments(operation.path).length || operation.path.startsWith("/branchMeta/")) continue;
      if (operation.op === "remove") removePointer(branch, operation.path);
      else {
        const value = scalar(operation.value);
        if (value === undefined) continue;
        writePointer(branch, operation.path, value);
      }
      latestByPath.set(operation.path, { operation, patch });
    }
  }

  return [...latestByPath].flatMap(([path, latest]) => {
    const mainlineField = readPointer(mainline, path);
    const branchField = readPointer(branch, path);
    const mainlineResolved = mainlineField.exists || latest.operation.op === "add";
    if (mainlineResolved && mainlineField.exists === branchField.exists && mainlineField.value === branchField.value) return [];
    const changeType = !branchField.exists ? "removed" : !mainlineField.exists && latest.operation.op === "add" ? "added" : "modified";
    return [{
      path,
      changeType,
      roundNumber: latest.patch.roundNumber,
      week: latest.patch.week,
      reason: latest.patch.reason,
      mainline: side(mainlineField, mainlineResolved),
      branch: side(branchField),
    } satisfies DocumentFieldComparison];
  }).sort((left, right) => left.path.localeCompare(right.path));
}
