import type { InternalBranchState } from "./settle-round";

export type JsonPatchValue = string | number | boolean | null;

export type JsonPatchOperation =
  | { op: "add" | "replace"; path: string; value: JsonPatchValue }
  | { op: "remove"; path: string };

function jsonPointerSegment(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Branch documents are a projection of the immutable mainline document plus
 * these explicitly recorded business-field deltas.  Keeping the deltas small
 * makes them auditable and prevents private scenario rules from leaking.
 */
export function buildDocumentPatch(documentId: string, state: InternalBranchState): JsonPatchOperation[] {
  const common: JsonPatchOperation[] = [
    { op: "add", path: "/branchMeta/lastSettlementWeek", value: state.week },
    { op: "add", path: "/branchMeta/scenarioStatus", value: state.scenario.status },
  ];
  switch (documentId) {
    case "D03": {
      const scenarioOperations: Record<string, JsonPatchOperation[]> = {
        "scenario-1": [
          { op: "replace", path: "/assumptions/ASM-001/status", value: "invalidated" },
          { op: "add", path: "/assumptions/ASM-001/branchEvidence", value: "家庭共享需求证明单一车主不足以覆盖主要用车场景" },
        ],
        "scenario-2": [
          { op: "replace", path: "/assumptions/ASM-002/status", value: "invalidated" },
          { op: "replace", path: "/assumptions/ASM-003/status", value: "invalidated" },
          { op: "add", path: "/assumptions/ASM-003/branchEvidence", value: "供应商延期与核心工程师抽调已核实" },
        ],
        "scenario-3": [
          { op: "replace", path: "/assumptions/ASM-004/status", value: "invalidated" },
          { op: "replace", path: "/assumptions/ASM-008/status", value: state.scenario.status === "closed" ? "validated" : "open" },
          { op: "add", path: "/assumptions/ASM-004/branchEvidence", value: "授权链重放漏洞使远程控制安全门失效" },
        ],
      };
      return [...common, ...(scenarioOperations[state.scenario.id] ?? [])];
    }
    case "D05": return [...common,
      { op: "add", path: "/changeControl/openItems", value: state.governance.ccbOpenItems },
      { op: "add", path: "/changeControl/scopeControlViolation", value: state.governance.scopeControlViolation },
    ];
    case "D09": {
      const scenarioLessons: Record<string, { id: string; title: string; recommendation: string }> = {
        "scenario-1": {
          id: "BR-LES-S1",
          title: "高价值反馈仍需经过范围分类和变更控制",
          recommendation: "先澄清场景并完成综合影响评估，再决定进入当前基线或后续版本。",
        },
        "scenario-2": {
          id: "BR-LES-S2",
          title: "供应分批承诺与关键岗位备份需要联合设计",
          recommendation: "把Mock、最小接口、完整接口和结构化交接写入同一份恢复计划。",
        },
        "scenario-3": {
          id: "BR-LES-S3",
          title: "能力隔离是安全缺陷下保持可交付性的前提",
          recommendation: "高风险能力应具备独立功能开关、权限边界、回归范围和回滚路径。",
        },
      };
      const lesson = scenarioLessons[state.scenario.id];
      return lesson ? [...common,
        { op: "add", path: `/lessons/${lesson.id}/title`, value: lesson.title },
        { op: "add", path: `/lessons/${lesson.id}/recommendation`, value: lesson.recommendation },
        { op: "add", path: `/lessons/${lesson.id}/status`, value: state.scenario.status === "closed" ? "shared" : "captured" },
        { op: "add", path: `/lessons/${lesson.id}/outcomeClassification`, value: state.outcomeClassification ?? "ongoing" },
      ] : common;
    }
    case "D10": {
      const milestoneOperations: Record<string, JsonPatchOperation[]> = {
        "scenario-2": [
          { op: "replace", path: "/milestones/MS-04/status", value: state.scenario.status === "closed" ? "achieved_with_conditions" : "at_risk" },
          { op: "replace", path: "/milestones/MS-06/currentForecastWeek", value: state.performance.forecastCompletionWeek },
          { op: "add", path: "/milestones/MS-06/forecastBasis", value: "supplier_and_resource_recovery_plan" },
        ],
        "scenario-3": [
          { op: "replace", path: "/milestones/MS-05/status", value: state.scenario.status === "closed" ? "achieved_with_conditions" : "at_risk" },
          { op: "add", path: "/milestones/MS-05/releaseScope", value: "read_only_vehicle_status_only" },
          { op: "replace", path: "/milestones/MS-06/currentForecastWeek", value: state.performance.forecastCompletionWeek },
        ],
      };
      return [...common, ...(milestoneOperations[state.scenario.id] ?? [])];
    }
    case "D13": return [...common,
      { op: "add", path: "/communication/overdueItems", value: state.totals.overdueCommunicationItems },
    ];
    case "D14": return [...common,
      { op: "replace", path: "/scheduleStatus/dataDateWeek", value: state.week },
      { op: "replace", path: "/scheduleStatus/spi", value: state.performance.spi },
      { op: "replace", path: "/scheduleStatus/cpi", value: state.performance.cpi },
      { op: "replace", path: "/scheduleStatus/forecastCompletionWeek", value: state.performance.forecastCompletionWeek },
      { op: "replace", path: "/scheduleStatus/forecastVarianceWeeks", value: state.performance.forecastCompletionWeek - 32 },
      { op: "replace", path: "/scheduleBaseline/finishWeek", value: 32 },
      { op: "add", path: "/scheduleBaseline/changeStatus", value: "unchanged" },
      { op: "replace", path: "/activities/WBS-8.2/forecastStatus", value: state.scenario.status === "closed" ? "recovery_plan_active" : "at_risk" },
      { op: "replace", path: "/activities/WBS-9.2/forecastStatus", value: state.scenario.status === "closed" ? "recovery_plan_active" : "at_risk" },
      { op: "add", path: "/recoveryPlan/strategy", value: "staged_interface_mock_parallel_backup_handoff" },
    ];
    case "D16": return [...common,
      { op: "replace", path: "/scopeBaseline/version", value: state.scenario.id === "scenario-3" ? "1.1-branch" : "1.0" },
      { op: "replace", path: "/productScope/PSC-03/status", value: state.scenario.id === "scenario-3" ? "deferred_from_v1_0" : "baselined_included" },
      { op: "replace", path: "/productScope/PSC-02/status", value: "baselined_included" },
      { op: "add", path: "/scopeExclusions/EX-05/status", value: state.scenario.id === "scenario-3" ? "active" : "not_applicable" },
      { op: "add", path: "/scopeApproval/status", value: state.scenario.status === "closed" ? "ccb_approved" : "pending_scope_decision" },
    ];
    case "D17": return state.scenario.id === "scenario-2" ? [...common,
      { op: "replace", path: "/assignments/vehicle_integration/status", value: state.scenario.status === "closed" ? "restored" : "backup_active" },
      { op: "replace", path: "/assignments/vehicle_integration/handoverStatus", value: state.scenario.status === "closed" ? "structured_handover_complete" : "structured_handover_in_progress" },
      { op: "add", path: "/assignments/tech_lead/temporaryCoverage", value: "vehicle_interface_coordination" },
      { op: "add", path: "/assignments/pm/approvedChangeId", value: "CR-004" },
    ] : common;
    case "D20": return state.scenario.id === "scenario-3" ? [...common,
      { op: "replace", path: "/qualityGates/remote_control/result", value: "failed_blocked" },
      { op: "replace", path: "/qualityGates/read_only_vehicle_status/result", value: "passed" },
      { op: "replace", path: "/releaseScope/remote_control/status", value: "deferred_from_v1_0" },
      { op: "replace", path: "/releaseScope/read_only_vehicle_status/status", value: "approved_for_release" },
      { op: "add", path: "/releaseRecommendation", value: "release_read_only_on_schedule_disable_remote_control" },
      { op: "add", path: "/residualRisk/remoteControl", value: "deferred_until_security_gate_passes" },
    ] : common;
    case "D21": return [...common,
      { op: "add", path: "/requirements/traceabilityCoveragePercent", value: state.totals.requirementsTraceabilityCoveragePercent },
    ];
    case "D22": return [...common,
      { op: "add", path: "/traceability/coveragePercent", value: state.totals.requirementsTraceabilityCoveragePercent },
      { op: "add", path: "/traceability/unauthorizedScopeWorkPersonDays", value: state.totals.unauthorizedScopeWorkPersonDays },
    ];
    case "D24": return state.scenario.id === "scenario-2" ? [...common,
      { op: "replace", path: "/availability/vehicle_integration/W17-W18/status", value: "unavailable" },
      { op: "add", path: "/availability/vehicle_integration/recoveryStatus", value: state.scenario.status === "closed" ? "restored" : "backup_active" },
      { op: "add", path: "/capacity/backend/W18/approvedOvertimePersonDays", value: 1 },
      { op: "add", path: "/capacity/forecastCompletionWeek", value: state.performance.forecastCompletionWeek },
    ] : common;
    case "D26": return [...common,
      { op: "add", path: "/risk/forecastCompletionWeek", value: state.performance.forecastCompletionWeek },
      { op: "add", path: "/risk/scenarioStatus", value: state.scenario.status },
    ];
    case "D27": {
      const latestTransitions = new Map<string, (typeof state.riskTransitions)[number]>();
      for (const transition of state.riskTransitions) {
        if (typeof transition.riskId === "string") latestTransitions.set(transition.riskId, transition);
      }
      const riskOperations = [...latestTransitions].flatMap(([riskId, transition]): JsonPatchOperation[] => {
        const path = `/riskSummary/current/${jsonPointerSegment(riskId)}`;
        const lifecycle = typeof transition.toLifecycleState === "string"
          ? transition.toLifecycleState
          : typeof transition.lifecycleState === "string" ? transition.lifecycleState : null;
        const operations: JsonPatchOperation[] = [];
        if (lifecycle) operations.push({ op: "replace", path: `${path}/lifecycleState`, value: lifecycle });
        if (typeof transition.controlStatus === "string") operations.push({ op: "replace", path: `${path}/controlStatus`, value: transition.controlStatus });
        if (transition.controlStatus === null) operations.push({ op: "remove", path: `${path}/controlStatus` });
        return operations;
      });
      const managementConclusionByScenario: Record<string, string> = {
        "scenario-1": "controlled_scope_change_no_current_baseline_impact",
        "scenario-2": "controlled_one_week_delay_quality_first",
        "scenario-3": "safe_minimum_scope_delivered_on_schedule",
      };
      return [...common,
        { op: "add", path: "/riskSummary/forecastCompletionWeek", value: state.performance.forecastCompletionWeek },
        { op: "add", path: "/riskSummary/managementConclusion", value: managementConclusionByScenario[state.scenario.id] ?? "continue_monitoring" },
        ...riskOperations,
      ];
    }
    case "D28": return [...common,
      { op: "replace", path: "/progress/dataDateWeek", value: state.week },
      { op: "replace", path: "/progress/spi", value: state.performance.spi },
      { op: "replace", path: "/progress/cpi", value: state.performance.cpi },
      { op: "replace", path: "/progress/cumulativePlannedValueCny", value: state.performance.cumulativePlannedValueCny },
      { op: "replace", path: "/progress/cumulativeEarnedValueCny", value: state.performance.cumulativeEarnedValueCny },
      { op: "replace", path: "/progress/cumulativeActualCostCny", value: state.performance.cumulativeActualCostCny },
    ];
    case "D29": {
      const forecastBasisByScenario: Record<string, string> = {
        "scenario-1": "scope_clarification_impact_analysis_change_control",
        "scenario-2": "staged_interface_mock_parallel_backup_handoff",
        "scenario-3": "read_only_scope_security_isolation",
      };
      return [...common,
        { op: "replace", path: "/forecast/dataDateWeek", value: state.week },
        { op: "replace", path: "/forecast/completionWeek", value: state.performance.forecastCompletionWeek },
        { op: "replace", path: "/forecast/varianceWeeks", value: state.performance.forecastCompletionWeek - 32 },
        { op: "replace", path: "/forecast/spi", value: state.performance.spi },
        { op: "replace", path: "/forecast/cpi", value: state.performance.cpi },
        { op: "add", path: "/forecast/basis", value: forecastBasisByScenario[state.scenario.id] ?? "deterministic_round_snapshot" },
      ];
    }
    case "D30": {
      const currentEngagementByStakeholder = new Map<string, string>();
      for (const transition of state.stakeholderTransitions) {
        if (typeof transition.stakeholderId === "string" && typeof transition.state === "string") {
          currentEngagementByStakeholder.set(transition.stakeholderId, transition.state);
        }
      }
      return [
        ...common,
        { op: "add", path: "/engagement/overdueCommunicationItems", value: state.totals.overdueCommunicationItems },
        ...[...currentEngagementByStakeholder].map(([stakeholderId, engagementState]): JsonPatchOperation => ({
          op: "replace",
          path: `/stakeholders/${jsonPointerSegment(stakeholderId)}/currentEngagement`,
          value: engagementState,
        })),
      ];
    }
    default: return common;
  }
}
