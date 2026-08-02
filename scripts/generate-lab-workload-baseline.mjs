import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLabCase } from "./validate-lab-case.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const caseDirectory = path.join(projectRoot, "content", "lab-cases", "car-control", "v1");
const sourcePath = path.join(caseDirectory, "workload-plan.json");
const schedulePath = path.join(caseDirectory, "schedule-plan.json");
const stakeholderPath = path.join(caseDirectory, "stakeholder-plan.json");
const documentPath = path.join(caseDirectory, "document-plan.json");
const outputPath = path.join(caseDirectory, "baseline-workload.generated.json");

await validateLabCase(caseDirectory);

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const schedule = JSON.parse(await readFile(schedulePath, "utf8"));
const stakeholderPlan = JSON.parse(await readFile(stakeholderPath, "utf8"));
const documentPlan = JSON.parse(await readFile(documentPath, "utf8"));

class MinCostFlow {
  constructor(nodeCount) {
    this.graph = Array.from({ length: nodeCount }, () => []);
  }

  addEdge(from, to, capacity, cost, metadata = null) {
    const forward = { to, reverseIndex: this.graph[to].length, capacity, cost, flow: 0, metadata };
    const reverse = { to: from, reverseIndex: this.graph[from].length, capacity: 0, cost: -cost, flow: 0, metadata: null };
    this.graph[from].push(forward);
    this.graph[to].push(reverse);
  }

  solve(sourceNode, sinkNode, requiredFlow) {
    let totalFlow = 0;
    let totalCost = 0;

    while (totalFlow < requiredFlow) {
      const distances = Array(this.graph.length).fill(Number.POSITIVE_INFINITY);
      const inQueue = Array(this.graph.length).fill(false);
      const previousNode = Array(this.graph.length).fill(-1);
      const previousEdge = Array(this.graph.length).fill(-1);
      const queue = [sourceNode];
      distances[sourceNode] = 0;
      inQueue[sourceNode] = true;

      while (queue.length > 0) {
        const currentNode = queue.shift();
        inQueue[currentNode] = false;

        this.graph[currentNode].forEach((edge, edgeIndex) => {
          if (edge.capacity <= 0) return;
          const nextDistance = distances[currentNode] + edge.cost;
          if (nextDistance >= distances[edge.to]) return;
          distances[edge.to] = nextDistance;
          previousNode[edge.to] = currentNode;
          previousEdge[edge.to] = edgeIndex;
          if (!inQueue[edge.to]) {
            queue.push(edge.to);
            inQueue[edge.to] = true;
          }
        });
      }

      if (!Number.isFinite(distances[sinkNode])) {
        return { totalFlow, totalCost, complete: false };
      }

      let augmentingFlow = requiredFlow - totalFlow;
      for (let node = sinkNode; node !== sourceNode; node = previousNode[node]) {
        const edge = this.graph[previousNode[node]][previousEdge[node]];
        augmentingFlow = Math.min(augmentingFlow, edge.capacity);
      }

      for (let node = sinkNode; node !== sourceNode; node = previousNode[node]) {
        const fromNode = previousNode[node];
        const edge = this.graph[fromNode][previousEdge[node]];
        edge.capacity -= augmentingFlow;
        edge.flow += augmentingFlow;
        const reverse = this.graph[node][edge.reverseIndex];
        reverse.capacity += augmentingFlow;
        reverse.flow -= augmentingFlow;
      }

      totalFlow += augmentingFlow;
      totalCost += augmentingFlow * distances[sinkNode];
    }

    return { totalFlow, totalCost, complete: true };
  }
}

const roleById = new Map(source.roles.map((role) => [role.id, role]));
const workPackageById = new Map(source.workPackages.map((workPackage) => [workPackage.id, workPackage]));
const stakeholderById = new Map(stakeholderPlan.stakeholders.map((stakeholder) => [stakeholder.id, stakeholder]));
const documentById = new Map(documentPlan.documents.map((document) => [document.id, document]));
const totalRequiredPersonDays = source.weeklyTeamPersonDays.reduce((total, value) => total + value, 0);
const schedulingPolicy = schedule.resourceSchedulingPolicy;
const overtimeByRoleWeek = new Map(schedulingPolicy.approvedOvertime.map((entry) => [
  `${entry.roleId}:${entry.week}`,
  entry,
]));

const raciByWorkPackageId = new Map(stakeholderPlan.workPackageRaci.map((row) => [row.workPackageId, row]));
if (raciByWorkPackageId.size !== source.workPackages.length) {
  throw new Error(`RACI has ${raciByWorkPackageId.size} rows; expected ${source.workPackages.length}`);
}
for (const workPackage of source.workPackages) {
  const row = raciByWorkPackageId.get(workPackage.id);
  if (!row) throw new Error(`Missing RACI row for ${workPackage.id}`);
  if (row.A.length !== 1) throw new Error(`${workPackage.id} must have exactly one A`);
  if (row.R.length < 1) throw new Error(`${workPackage.id} must have at least one R`);
  const assignments = ["A", "R", "C", "I"].flatMap((code) => row[code].map((stakeholderId) => ({ code, stakeholderId })));
  for (const assignment of assignments) {
    if (!stakeholderById.has(assignment.stakeholderId)) {
      throw new Error(`Unknown stakeholder ${assignment.stakeholderId} in ${workPackage.id}`);
    }
  }
  const codesByStakeholder = new Map();
  for (const assignment of assignments) {
    const codes = codesByStakeholder.get(assignment.stakeholderId) ?? [];
    codes.push(assignment.code);
    codesByStakeholder.set(assignment.stakeholderId, codes);
  }
  for (const [stakeholderId, codes] of codesByStakeholder) {
    if (codes.length > 1 && !(codes.length === 2 && codes.includes("A") && codes.includes("R"))) {
      throw new Error(`${stakeholderId} has conflicting RACI assignments ${codes.join("/")} in ${workPackage.id}`);
    }
  }
}

const expectedGateWeeks = stakeholderPlan.raciPolicy.stageGateWeeks;
if (stakeholderPlan.stageGates.length !== expectedGateWeeks.length) {
  throw new Error(`Stage gates have ${stakeholderPlan.stageGates.length} rows; expected ${expectedGateWeeks.length}`);
}
for (const week of expectedGateWeeks) {
  if (!stakeholderPlan.stageGates.some((gate) => gate.week === week)) throw new Error(`Missing stage gate for week ${week}`);
}
for (const gate of stakeholderPlan.stageGates) {
  if (!stakeholderById.has(gate.decisionOwner)) throw new Error(`Unknown decision owner ${gate.decisionOwner} in ${gate.id}`);
  for (const field of ["presenters", "requiredSignoffs", "advisors", "informed"]) {
    for (const stakeholderId of gate[field]) {
      if (!stakeholderById.has(stakeholderId)) throw new Error(`Unknown stakeholder ${stakeholderId} in ${gate.id}/${field}`);
    }
  }
  if (gate.presenters.length < 1 || gate.requiredSignoffs.length < 1 || gate.evidenceTitles.length < 1) {
    throw new Error(`${gate.id} is missing presenters, signoffs, or evidence`);
  }
}

if (documentPlan.documents.length !== 32 || documentById.size !== 32) {
  throw new Error(`Document plan must contain 32 unique documents; found ${documentPlan.documents.length}/${documentById.size}`);
}
const dynamicDocumentCount = documentPlan.documents.filter((document) => document.coverage === "dynamic_full_history").length;
const supportingDocumentCount = documentPlan.documents.filter((document) => document.coverage === "supporting_key_versions").length;
if (dynamicDocumentCount !== 18 || supportingDocumentCount !== 14) {
  throw new Error(`Document coverage must be 18 dynamic and 14 supporting; found ${dynamicDocumentCount}/${supportingDocumentCount}`);
}
for (const document of documentPlan.documents) {
  if (!Number.isInteger(document.createdWeek) || document.createdWeek < 1 || document.createdWeek > source.totalWeeks) {
    throw new Error(`Invalid created week for ${document.id}`);
  }
}
for (const event of documentPlan.mainlineEvents) {
  if (!Number.isInteger(event.week) || event.week < 1 || event.week > source.totalWeeks) throw new Error(`Invalid week for ${event.id}`);
  if (!stakeholderById.has(event.authorStakeholderId)) throw new Error(`Unknown author ${event.authorStakeholderId} in ${event.id}`);
  for (const approverId of event.approverStakeholderIds) {
    if (!stakeholderById.has(approverId)) throw new Error(`Unknown approver ${approverId} in ${event.id}`);
  }
  for (const [field, value] of Object.entries(event)) {
    if (!field.endsWith("DocumentIds")) continue;
    for (const documentId of value) {
      if (!documentById.has(documentId)) throw new Error(`Unknown document ${documentId} in ${event.id}/${field}`);
    }
  }
}
const closeoutEvent = documentPlan.mainlineEvents.find((event) => event.id === "docs-w32-closeout");
if (!closeoutEvent || new Set(closeoutEvent.archivedDocumentIds).size !== 32) {
  throw new Error("W32 closeout must archive all 32 documents");
}
const relationIds = new Set();
const relatedDocumentIds = new Set();
for (const relation of documentPlan.relations) {
  if (relationIds.has(relation.id)) throw new Error(`Duplicate document relation ${relation.id}`);
  relationIds.add(relation.id);
  if (!documentById.has(relation.fromDocumentId) || !documentById.has(relation.toDocumentId)) {
    throw new Error(`Unknown document in relation ${relation.id}`);
  }
  if (!documentPlan.relationPolicy.types.includes(relation.type)) throw new Error(`Unknown relation type in ${relation.id}`);
  if (!Number.isInteger(relation.effectiveWeek) || relation.effectiveWeek < 1 || relation.effectiveWeek > source.totalWeeks) {
    throw new Error(`Invalid effective week in ${relation.id}`);
  }
  relatedDocumentIds.add(relation.fromDocumentId);
  relatedDocumentIds.add(relation.toDocumentId);
}
if (relatedDocumentIds.size !== 32) throw new Error(`Document relation graph covers ${relatedDocumentIds.size}/32 documents`);
const plannedLaborCostCny = source.roles.reduce(
  (total, role) => total + role.plannedPersonDays * role.standardDayRateCny,
  0,
);
const plannedNonLaborCostCny = source.plannedNonLaborCosts.reduce(
  (total, category) => total + category.entries.reduce((entryTotal, entry) => entryTotal + entry.amountCny, 0),
  0,
);

if (plannedLaborCostCny + plannedNonLaborCostCny !== source.budgetAtCompletionCny) {
  throw new Error(
    `Planned cost ${plannedLaborCostCny + plannedNonLaborCostCny} does not match BAC ${source.budgetAtCompletionCny}`,
  );
}

function interpolatePerformance(week, metric) {
  const anchors = source.mainlinePerformanceAnchors;
  const rightIndex = anchors.findIndex((anchor) => anchor.week >= week);
  if (rightIndex < 0) throw new Error(`No performance anchor covers week ${week}`);
  const right = anchors[rightIndex];
  if (right.week === week || rightIndex === 0) return right[metric];
  const left = anchors[rightIndex - 1];
  const ratio = (week - left.week) / (right.week - left.week);
  return left[metric] + (right[metric] - left[metric]) * ratio;
}

const activityById = new Map(schedule.activities.map((activity) => [activity.id, activity]));
if (activityById.size !== schedule.activities.length) throw new Error("Duplicate activity id");

for (const activity of schedule.activities) {
  for (const dependency of activity.predecessors) {
    const predecessor = activityById.get(dependency.activityId);
    if (!predecessor) throw new Error(`Unknown predecessor ${dependency.activityId} for ${activity.id}`);
    if (!schedule.dependencyPolicy.supportedTypes.includes(dependency.type)) {
      throw new Error(`Unsupported dependency type ${dependency.type} for ${activity.id}`);
    }
    if (!Number.isInteger(dependency.lagWeeks) || dependency.lagWeeks < 0) {
      throw new Error(`Invalid lag for ${activity.id}/${dependency.activityId}`);
    }
    const earliestStart = dependency.type === "FS"
      ? predecessor.endWeek + 1 + dependency.lagWeeks
      : predecessor.startWeek + dependency.lagWeeks;
    if (activity.startWeek < earliestStart) {
      throw new Error(`${activity.id} starts in week ${activity.startWeek} before ${dependency.type} dependency ${dependency.activityId} permits week ${earliestStart}`);
    }
  }
}

const dependencyVisitState = new Map();
const topologicalActivityIds = [];
function visitActivity(activityId, stack = []) {
  const state = dependencyVisitState.get(activityId);
  if (state === "visited") return;
  if (state === "visiting") throw new Error(`Dependency cycle: ${[...stack, activityId].join(" -> ")}`);
  dependencyVisitState.set(activityId, "visiting");
  const activity = activityById.get(activityId);
  for (const dependency of activity.predecessors) visitActivity(dependency.activityId, [...stack, activityId]);
  dependencyVisitState.set(activityId, "visited");
  topologicalActivityIds.push(activityId);
}
for (const activity of schedule.activities) visitActivity(activity.id);

const criticalPathActivities = topologicalActivityIds
  .map((activityId) => activityById.get(activityId))
  .filter((activity) => activity.type === "discrete");
const criticalPathActivityIds = new Set(criticalPathActivities.map((activity) => activity.id));
const networkByActivityId = new Map();

for (const activity of criticalPathActivities) {
  const duration = activity.durationWeeks.mostLikely;
  let earliestStart = 1;
  for (const dependency of activity.predecessors.filter((item) => criticalPathActivityIds.has(item.activityId))) {
    const predecessor = networkByActivityId.get(dependency.activityId);
    const candidate = dependency.type === "FS"
      ? predecessor.earliestFinish + 1 + dependency.lagWeeks
      : predecessor.earliestStart + dependency.lagWeeks;
    earliestStart = Math.max(earliestStart, candidate);
  }
  networkByActivityId.set(activity.id, {
    activityId: activity.id,
    duration,
    earliestStart,
    earliestFinish: earliestStart + duration - 1,
    expectedDuration: Number(((activity.durationWeeks.optimistic + 4 * duration + activity.durationWeeks.pessimistic) / 6).toFixed(2)),
    durationVariance: Number((((activity.durationWeeks.pessimistic - activity.durationWeeks.optimistic) / 6) ** 2).toFixed(4)),
  });
}

const successorsByActivityId = new Map(criticalPathActivities.map((activity) => [activity.id, []]));
for (const activity of criticalPathActivities) {
  for (const dependency of activity.predecessors.filter((item) => criticalPathActivityIds.has(item.activityId))) {
    successorsByActivityId.get(dependency.activityId).push({ ...dependency, successorActivityId: activity.id });
  }
}

for (const activity of [...criticalPathActivities].reverse()) {
  const network = networkByActivityId.get(activity.id);
  const successors = successorsByActivityId.get(activity.id);
  let latestStart = source.totalWeeks - network.duration + 1;
  if (successors.length > 0) {
    latestStart = Math.min(...successors.map((successor) => {
      const successorNetwork = networkByActivityId.get(successor.successorActivityId);
      return successor.type === "FS"
        ? successorNetwork.latestStart - successor.lagWeeks - network.duration
        : successorNetwork.latestStart - successor.lagWeeks;
    }));
  }
  network.latestStart = latestStart;
  network.latestFinish = latestStart + network.duration - 1;
  network.totalFloat = latestStart - network.earliestStart;
  network.freeFloat = successors.length === 0
    ? source.totalWeeks - network.earliestFinish
    : Math.min(...successors.map((successor) => {
      const successorNetwork = networkByActivityId.get(successor.successorActivityId);
      return successor.type === "FS"
        ? successorNetwork.earliestStart - network.earliestFinish - 1 - successor.lagWeeks
        : successorNetwork.earliestStart - network.earliestStart - successor.lagWeeks;
    }));
  network.isCritical = network.totalFloat === 0;
}

const calculatedProjectFinishWeek = Math.max(...[...networkByActivityId.values()].map((activity) => activity.earliestFinish));
if (calculatedProjectFinishWeek > source.totalWeeks) {
  throw new Error(`Critical-path network finishes in week ${calculatedProjectFinishWeek}, after deadline week ${source.totalWeeks}`);
}

const roleActivityPairs = [];
for (const activity of schedule.activities) {
  if (!workPackageById.has(activity.parentId)) throw new Error(`Unknown parent work package ${activity.parentId}`);
  for (const [roleId, personDays] of Object.entries(activity.plannedPersonDaysByRole)) {
    if (!roleById.has(roleId)) throw new Error(`Unknown role ${roleId}`);
    if (personDays > 0) roleActivityPairs.push({ roleId, activityId: activity.id, workPackageId: activity.parentId, personDays });
  }
}

const pairTotal = roleActivityPairs.reduce((total, pair) => total + pair.personDays, 0);
if (pairTotal !== totalRequiredPersonDays) {
  throw new Error(`Activity total ${pairTotal} does not match weekly total ${totalRequiredPersonDays}`);
}

for (const [roleId, workPackages] of Object.entries(source.roleWorkPackagePersonDays)) {
  for (const [workPackageId, expected] of Object.entries(workPackages)) {
    const actual = roleActivityPairs
      .filter((pair) => pair.roleId === roleId && pair.workPackageId === workPackageId)
      .reduce((total, pair) => total + pair.personDays, 0);
    if (actual !== expected) {
      throw new Error(`${roleId}/${workPackageId} activity total ${actual} does not match matrix ${expected}`);
    }
  }
}

const sourceNode = 0;
let nextNode = 1;
const pairNodes = new Map();
const roleWeekNodes = new Map();
const weekNodes = new Map();

for (const pair of roleActivityPairs) {
  pairNodes.set(`${pair.roleId}:${pair.activityId}`, nextNode++);
}
for (const role of source.roles) {
  for (let week = 1; week <= source.totalWeeks; week += 1) {
    roleWeekNodes.set(`${role.id}:${week}`, nextNode++);
  }
}
for (let week = 1; week <= source.totalWeeks; week += 1) {
  weekNodes.set(week, nextNode++);
}
const sinkNode = nextNode++;
const network = new MinCostFlow(nextNode);

for (const pair of roleActivityPairs) {
  const pairKey = `${pair.roleId}:${pair.activityId}`;
  const pairNode = pairNodes.get(pairKey);
  const activity = activityById.get(pair.activityId);
  network.addEdge(sourceNode, pairNode, pair.personDays, 0);

  const bufferWeeks = schedulingPolicy.defaultBufferWeeks;
  const allowedWeeks = activity.type === "recurring"
    ? [...new Set(activity.occurrenceWeeks.flatMap((week) =>
      Array.from({ length: bufferWeeks * 2 + 1 }, (_, index) => week - bufferWeeks + index)))]
      .filter((week) => week >= 1 && week <= source.totalWeeks)
    : Array.from(
      { length: Math.min(source.totalWeeks, activity.endWeek + bufferWeeks) - Math.max(1, activity.startWeek - bufferWeeks) + 1 },
      (_, index) => Math.max(1, activity.startWeek - bufferWeeks) + index,
    );
  for (const week of allowedWeeks) {
    const roleWeekNode = roleWeekNodes.get(`${pair.roleId}:${week}`);
    const distanceFromWindow = activity.type === "recurring"
      ? Math.min(...activity.occurrenceWeeks.map((occurrenceWeek) => Math.abs(week - occurrenceWeek)))
      : week < activity.startWeek
        ? activity.startWeek - week
        : week > activity.endWeek
          ? week - activity.endWeek
          : 0;
    const allocationTiming = activity.type === "recurring"
      ? distanceFromWindow === 0 ? "occurrence" : "stage_support"
      : week < activity.startWeek
        ? "preparation"
        : week > activity.endWeek
          ? "closeout"
          : "core";
    network.addEdge(pairNode, roleWeekNode, pair.personDays, distanceFromWindow * schedulingPolicy.outsideWindowCostPerWeek, {
      type: "allocation",
      roleId: pair.roleId,
      activityId: pair.activityId,
      workPackageId: pair.workPackageId,
      week,
      distanceFromWindow,
      allocationTiming,
    });
  }
}

const utilizationCosts = [0, 0, 0, 2, 7];
for (const role of source.roles) {
  for (let week = 1; week <= source.totalWeeks; week += 1) {
    const roleWeekNode = roleWeekNodes.get(`${role.id}:${week}`);
    const weekNode = weekNodes.get(week);
    const overtime = overtimeByRoleWeek.get(`${role.id}:${week}`)?.extraPersonDays ?? 0;
    const capacityCosts = [...utilizationCosts, ...Array.from({ length: overtime }, (_, index) => 20 + index * 5)];
    for (const cost of capacityCosts) {
      network.addEdge(roleWeekNode, weekNode, 1, cost);
    }
  }
}

source.weeklyTeamPersonDays.forEach((personDays, index) => {
  network.addEdge(weekNodes.get(index + 1), sinkNode, personDays, 0);
});

const solution = network.solve(sourceNode, sinkNode, totalRequiredPersonDays);
if (!solution.complete) {
  const pairByNode = new Map([...pairNodes.entries()].map(([key, node]) => [node, key]));
  const unresolvedPairs = network.graph[sourceNode]
    .filter((edge) => edge.capacity > 0)
    .map((edge) => ({ pair: pairByNode.get(edge.to), remainingPersonDays: edge.capacity }));
  const unresolvedWeeks = [...weekNodes.entries()]
    .map(([week, node]) => {
      const sinkEdge = network.graph[node].find((edge) => edge.to === sinkNode);
      return { week, remainingPersonDays: sinkEdge?.capacity ?? 0 };
    })
    .filter((item) => item.remainingPersonDays > 0);
  throw new Error(`Unable to allocate all person-days: ${JSON.stringify({
    allocated: solution.totalFlow,
    required: totalRequiredPersonDays,
    unresolvedPairs,
    unresolvedWeeks,
  }, null, 2)}`);
}

const allocations = [];
for (const edges of network.graph) {
  for (const edge of edges) {
    if (edge.metadata?.type === "allocation" && edge.flow > 0) {
      allocations.push({ ...edge.metadata, personDays: edge.flow });
    }
  }
}

let cumulativePlannedValueCny = 0;
const weeks = Array.from({ length: source.totalWeeks }, (_, index) => {
  const week = index + 1;
  const weekAllocations = allocations.filter((allocation) => allocation.week === week);
  const rolePersonDays = Object.fromEntries(source.roles.map((role) => [
    role.id,
    weekAllocations
      .filter((allocation) => allocation.roleId === role.id)
      .reduce((total, allocation) => total + allocation.personDays, 0),
  ]));
  const workPackagePersonDays = Object.fromEntries(source.workPackages.map((workPackage) => [
    workPackage.id,
    weekAllocations
      .filter((allocation) => allocation.workPackageId === workPackage.id)
      .reduce((total, allocation) => total + allocation.personDays, 0),
  ]));
  const overtimePersonDays = Object.fromEntries(source.roles.map((role) => [
    role.id,
    Math.max(0, rolePersonDays[role.id] - source.personDaysPerPersonWeek),
  ]));
  const weekPlannedLaborCostCny = source.roles.reduce(
    (total, role) => total + rolePersonDays[role.id] * role.standardDayRateCny,
    0,
  );
  const nonLaborCosts = source.plannedNonLaborCosts.flatMap((category) =>
    category.entries
      .filter((entry) => entry.week === week)
      .map((entry) => ({ categoryId: category.id, title: category.title, amountCny: entry.amountCny })),
  );
  const weekPlannedNonLaborCostCny = nonLaborCosts.reduce((total, entry) => total + entry.amountCny, 0);
  const weekPlannedValueCny = weekPlannedLaborCostCny + weekPlannedNonLaborCostCny;
  cumulativePlannedValueCny += weekPlannedValueCny;
  const spi = interpolatePerformance(week, "spi");
  const cpi = interpolatePerformance(week, "cpi");
  const cumulativeEarnedValueCny = Math.round(cumulativePlannedValueCny * spi);
  const cumulativeActualCostCny = Math.round(cumulativeEarnedValueCny / cpi);

  return {
    week,
    sprint: week >= 9 && week <= 28 ? `S${Math.floor((week - 9) / 2) + 1}` : null,
    plannedTeamPersonDays: source.weeklyTeamPersonDays[index],
    plannedLaborCostCny: weekPlannedLaborCostCny,
    plannedNonLaborCostCny: weekPlannedNonLaborCostCny,
    plannedValueCny: weekPlannedValueCny,
    cumulativePlannedValueCny,
    spi: Number(spi.toFixed(4)),
    cpi: Number(cpi.toFixed(4)),
    cumulativeEarnedValueCny,
    cumulativeActualCostCny,
    nonLaborCosts,
    rolePersonDays,
    workPackagePersonDays,
    overtimePersonDays,
    allocations: weekAllocations.sort((left, right) =>
      left.roleId.localeCompare(right.roleId) || left.workPackageId.localeCompare(right.workPackageId)),
  };
});

for (const week of weeks) {
  const roleTotal = Object.values(week.rolePersonDays).reduce((total, value) => total + value, 0);
  if (roleTotal !== week.plannedTeamPersonDays) {
    throw new Error(`Week ${week.week} role total ${roleTotal} does not match ${week.plannedTeamPersonDays}`);
  }
  for (const [roleId, personDays] of Object.entries(week.rolePersonDays)) {
    const approvedOvertime = overtimeByRoleWeek.get(`${roleId}:${week.week}`)?.extraPersonDays ?? 0;
    if (personDays > source.personDaysPerPersonWeek + approvedOvertime) {
      throw new Error(`Role ${roleId} is overloaded in week ${week.week}: ${personDays}`);
    }
  }
}

for (let index = 1; index < weeks.length; index += 1) {
  const previous = weeks[index - 1];
  const current = weeks[index];
  if (current.cumulativeEarnedValueCny < previous.cumulativeEarnedValueCny) {
    throw new Error(`Cumulative EV decreases in week ${current.week}`);
  }
  if (current.cumulativeActualCostCny < previous.cumulativeActualCostCny) {
    throw new Error(`Cumulative AC decreases in week ${current.week}`);
  }
}

const finalWeek = weeks.at(-1);
if (finalWeek.cumulativeEarnedValueCny !== source.budgetAtCompletionCny) {
  throw new Error(`Final EV ${finalWeek.cumulativeEarnedValueCny} does not match BAC ${source.budgetAtCompletionCny}`);
}

for (const role of source.roles) {
  const actual = weeks.reduce((total, week) => total + week.rolePersonDays[role.id], 0);
  if (actual !== role.plannedPersonDays) {
    throw new Error(`Role ${role.id} total ${actual} does not match ${role.plannedPersonDays}`);
  }
}

for (const pair of roleActivityPairs) {
  const actual = allocations
    .filter((allocation) => allocation.roleId === pair.roleId && allocation.activityId === pair.activityId)
    .reduce((total, allocation) => total + allocation.personDays, 0);
  if (actual !== pair.personDays) {
    throw new Error(`${pair.roleId}/${pair.activityId} total ${actual} does not match ${pair.personDays}`);
  }
}

const bufferedAllocations = allocations.filter((allocation) => allocation.distanceFromWindow > 0);
const bufferedPersonDaysByDistance = Object.fromEntries(
  Array.from({ length: schedulingPolicy.defaultBufferWeeks }, (_, index) => index + 1).map((distance) => [
    distance,
    bufferedAllocations
      .filter((allocation) => allocation.distanceFromWindow === distance)
      .reduce((total, allocation) => total + allocation.personDays, 0),
  ]),
);
const actualOvertime = weeks.flatMap((week) => Object.entries(week.overtimePersonDays)
  .filter(([, personDays]) => personDays > 0)
  .map(([roleId, personDays]) => ({ week: week.week, roleId, personDays })));

const output = {
  schemaVersion: 1,
  generatedFrom: [path.relative(projectRoot, sourcePath), path.relative(projectRoot, schedulePath), path.relative(projectRoot, stakeholderPath), path.relative(projectRoot, documentPath)],
  caseId: source.caseId,
  caseVersion: source.caseVersion,
  totalPlannedPersonDays: totalRequiredPersonDays,
  totalActivities: schedule.activities.length,
  budgetAtCompletionCny: source.budgetAtCompletionCny,
  plannedLaborCostCny,
  plannedNonLaborCostCny,
  resourceSchedulingSummary: {
    bufferedPersonDays: bufferedAllocations.reduce((total, allocation) => total + allocation.personDays, 0),
    bufferedPersonDaysByDistance,
    overtime: actualOvertime,
  },
  scheduleNetwork: {
    deadlineWeek: source.totalWeeks,
    calculatedProjectFinishWeek,
    criticalActivityIds: [...networkByActivityId.values()].filter((activity) => activity.isCritical).map((activity) => activity.activityId),
    activities: [...networkByActivityId.values()],
  },
  weeks,
};

await mkdir(caseDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Generated ${path.relative(projectRoot, outputPath)} with ${allocations.length} allocations.`);
