import type { InternalBranchState } from "./settle-round";

export type JsonPatchOperation = {
  op: "add" | "replace";
  path: string;
  value: string | number | boolean;
};

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
    case "D05": return [...common,
      { op: "add", path: "/changeControl/openItems", value: state.governance.ccbOpenItems },
      { op: "add", path: "/changeControl/scopeControlViolation", value: state.governance.scopeControlViolation },
    ];
    case "D13": return [...common,
      { op: "add", path: "/communication/overdueItems", value: state.totals.overdueCommunicationItems },
    ];
    case "D21": return [...common,
      { op: "add", path: "/requirements/traceabilityCoveragePercent", value: state.totals.requirementsTraceabilityCoveragePercent },
    ];
    case "D22": return [...common,
      { op: "add", path: "/traceability/coveragePercent", value: state.totals.requirementsTraceabilityCoveragePercent },
      { op: "add", path: "/traceability/unauthorizedScopeWorkPersonDays", value: state.totals.unauthorizedScopeWorkPersonDays },
    ];
    case "D26": return [...common,
      { op: "add", path: "/risk/forecastCompletionWeek", value: state.performance.forecastCompletionWeek },
      { op: "add", path: "/risk/scenarioStatus", value: state.scenario.status },
    ];
    default: return common;
  }
}
