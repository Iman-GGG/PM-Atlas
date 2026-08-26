import { publicLabCaseBaseline } from "../../lib/lab/lab-case-public.generated.ts";
import type { LabCaseRuntimePackage } from "../../lib/lab/contracts";
import { frozenLabCaseRuntimePackages } from "../generated/lab-case-history.generated.ts";
import { privateLabCasePackage } from "../generated/lab-case-private.generated.ts";

function currentRuntimePackage(): LabCaseRuntimePackage {
  return {
    ...publicLabCaseBaseline,
    scenarios: privateLabCasePackage.sourceFiles.scenarioPlan.scenarios,
  };
}

export const currentLabCaseRuntimePackage = currentRuntimePackage();

export const labCaseRuntimePackages: readonly LabCaseRuntimePackage[] = [
  ...frozenLabCaseRuntimePackages,
  currentLabCaseRuntimePackage,
];

export function findLabCaseRuntimePackage(
  caseId: string,
  caseVersion: string,
  contentHash?: string,
): LabCaseRuntimePackage | null {
  return labCaseRuntimePackages.find((runtime) => (
    runtime.caseId === caseId
    && runtime.caseVersion === caseVersion
    && (contentHash === undefined || runtime.contentHash === contentHash)
  )) ?? null;
}

export function isCurrentLabCase(caseId: string, caseVersion: string): boolean {
  return caseId === currentLabCaseRuntimePackage.caseId
    && caseVersion === currentLabCaseRuntimePackage.caseVersion;
}
