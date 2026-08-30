export type ExceptionPriority = "P0" | "P1" | "P2" | "P3";
export type ProjectHealthStatus = "healthy" | "watch" | "at_risk" | "blocked";

export type ProjectControlException = {
  id: string;
  priority: ExceptionPriority;
  primaryAreaId: string;
  areaIds: string[];
  title: string;
  evidence: string;
  response: string;
  owner: string;
  documentIds: string[];
};

export const exceptionPriorityOrder: Record<ExceptionPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export const projectHealthLabels: Record<ProjectHealthStatus, string> = {
  healthy: "健康",
  watch: "关注",
  at_risk: "风险",
  blocked: "阻断",
};

export function sortProjectExceptions(exceptions: ProjectControlException[]): ProjectControlException[] {
  return [...exceptions].sort((left, right) => (
    exceptionPriorityOrder[left.priority] - exceptionPriorityOrder[right.priority]
    || left.primaryAreaId.localeCompare(right.primaryAreaId)
    || left.id.localeCompare(right.id)
  ));
}

export function projectHealthStatus(exceptions: ProjectControlException[]): ProjectHealthStatus {
  const highestPriority = sortProjectExceptions(exceptions)[0]?.priority;
  if (highestPriority === "P0") return "blocked";
  if (highestPriority === "P1") return "at_risk";
  if (highestPriority === "P2" || highestPriority === "P3") return "watch";
  return "healthy";
}

export function projectExceptionCounts(exceptions: ProjectControlException[]): Record<ExceptionPriority, number> {
  return {
    P0: exceptions.filter((item) => item.priority === "P0").length,
    P1: exceptions.filter((item) => item.priority === "P1").length,
    P2: exceptions.filter((item) => item.priority === "P2").length,
    P3: exceptions.filter((item) => item.priority === "P3").length,
  };
}
