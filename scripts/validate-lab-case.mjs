import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const defaultCaseDirectory = path.join(projectRoot, "content", "lab-cases", "car-control", "v4");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uniqueMap(items, label) {
  const result = new Map();
  for (const item of items) {
    assert(item?.id, `${label} contains an item without an id`);
    assert(!result.has(item.id), `Duplicate ${label} id ${item.id}`);
    result.set(item.id, item);
  }
  return result;
}

async function readJson(caseDirectory, filename) {
  return JSON.parse(await readFile(path.join(caseDirectory, filename), "utf8"));
}

function visit(value, visitor, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, visitor, [...pathParts, index]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child, [...pathParts, key]);
    visit(child, visitor, [...pathParts, key]);
  }
}

export async function validateLabCase(caseDirectory = defaultCaseDirectory) {
  const [workload, schedule, stakeholders, documents, requirements, risks, scenarios] = await Promise.all([
    readJson(caseDirectory, "workload-plan.json"),
    readJson(caseDirectory, "schedule-plan.json"),
    readJson(caseDirectory, "stakeholder-plan.json"),
    readJson(caseDirectory, "document-plan.json"),
    readJson(caseDirectory, "requirement-plan.json"),
    readJson(caseDirectory, "risk-plan.json"),
    readJson(caseDirectory, "scenario-plan.json"),
  ]);

  for (const plan of [workload, schedule, stakeholders, documents, requirements, risks, scenarios]) {
    assert(plan.caseId === workload.caseId, `Case id mismatch in ${plan.caseId ?? "unknown plan"}`);
    assert(plan.caseVersion === workload.caseVersion, `Case version mismatch in ${plan.caseVersion ?? "unknown plan"}`);
  }

  const documentById = uniqueMap(documents.documents, "document");
  const stakeholderById = uniqueMap(stakeholders.stakeholders, "stakeholder");
  const activityById = uniqueMap(schedule.activities, "activity");
  const workPackageById = uniqueMap(workload.workPackages, "work package");
  const deliverableById = new Map([...workPackageById, ...activityById]);
  const requirementById = uniqueMap(requirements.requirements, "requirement");
  const riskById = uniqueMap(risks.initialRisks, "risk");
  const scenarioById = uniqueMap(scenarios.scenarios, "scenario");
  const changeById = uniqueMap(documents.changeItems, "change item");
  const issueById = uniqueMap(documents.issues, "issue");
  const testRoundById = uniqueMap(documents.testRounds, "test round");
  const lifecycleStates = new Set(risks.lifecycle.states);
  const controlStates = new Set(risks.controlStatusModel.states);
  const allowedColumns = ["evidence_document", "tool_technique", "execution_action", "stakeholder"];
  const visibleColumns = ["evidence_document", "tool_technique", "stakeholder"];

  assert(documentById.size === 32, `Expected 32 documents; found ${documentById.size}`);
  assert(requirementById.size === 30, `Expected 30 requirements; found ${requirementById.size}`);
  assert([...requirementById.values()].filter((item) => item.traceabilityStatus === "baselined").length === 24, "Expected 24 baselined requirements");
  assert([...requirementById.values()].filter((item) => item.traceabilityStatus === "candidate_unplanned").length === 6, "Expected 6 candidate requirements");
  assert(scenarioById.size === 3, `Expected 3 scenarios; found ${scenarioById.size}`);
  assert(changeById.size === 8, `Expected 8 change items; found ${changeById.size}`);
  assert(issueById.size === 8, `Expected 8 issues; found ${issueById.size}`);
  assert(testRoundById.size === 6, `Expected 6 test rounds; found ${testRoundById.size}`);
  assert(scenarios.eventDiscoveryPolicy.requiredMaterialComposition.primaryClues === 3, "Primary clue policy must require 3 items");
  assert(scenarios.eventDiscoveryPolicy.requiredMaterialComposition.corroboratingClues === 1, "Corroborating clue policy must require 1 item");
  assert(scenarios.eventDiscoveryPolicy.requiredMaterialComposition.dashboardAnomalies === 1, "Dashboard anomaly policy must require 1 item");
  assert(scenarios.decisionReasoningPolicy.enabled === false, "Decision reasoning must be disabled");
  assert(scenarios.decisionReasoningPolicy.fields.length === 0, "Disabled decision reasoning must not contain fields");
  assert(scenarios.decisionReasoningPolicy.submissionRequirement === "at_least_one_complete_action_chain", "Submission must require one complete action chain");
  assert(scenarios.aiReviewPolicy.capabilityDimensions.length === 5, "AI review must contain 5 capability dimensions");

  for (const requirement of requirementById.values()) {
    assert(["P0", "P1", "P2", "P3"].includes(requirement.priority), `${requirement.id} has invalid priority`);
    assert(Number.isInteger(requirement.discoveredWeek) && requirement.discoveredWeek >= 1 && requirement.discoveredWeek <= workload.totalWeeks, `${requirement.id} has invalid discovery week`);
    assert(stakeholderById.has(requirement.sourceStakeholderId), `${requirement.id} references unknown source stakeholder ${requirement.sourceStakeholderId}`);
    assert(requirement.acceptanceCriteria?.length >= 1, `${requirement.id} has no acceptance criteria`);
    if (requirement.traceabilityStatus === "baselined") {
      assert(requirement.baselinedWeek >= requirement.discoveredWeek, `${requirement.id} is baselined before discovery`);
      assert(deliverableById.has(requirement.primaryWbsId), `${requirement.id} references unknown primary WBS ${requirement.primaryWbsId}`);
      for (const wbsId of requirement.supportingWbsIds ?? []) assert(deliverableById.has(wbsId), `${requirement.id} references unknown supporting WBS ${wbsId}`);
      assert(requirement.implementationCompletedWeek >= requirement.baselinedWeek, `${requirement.id} completes before baseline`);
      assert(requirement.verifiedWeek >= requirement.implementationCompletedWeek, `${requirement.id} verifies before implementation`);
    } else {
      assert(!requirement.baselinedWeek, `${requirement.id} candidate must not have a baseline week`);
      assert(deliverableById.has(requirement.proposedPrimaryWbsId), `${requirement.id} references unknown proposed primary WBS ${requirement.proposedPrimaryWbsId}`);
      for (const wbsId of requirement.proposedSupportingWbsIds ?? []) assert(deliverableById.has(wbsId), `${requirement.id} references unknown proposed supporting WBS ${wbsId}`);
    }
  }

  for (const event of requirements.mainlineEvents) {
    assert(Number.isInteger(event.week) && event.week >= 1 && event.week <= workload.totalWeeks, `${event.id} has invalid week`);
    for (const requirementId of event.requirementIds) assert(requirementById.has(requirementId), `${event.id} references unknown requirement ${requirementId}`);
    for (const documentId of event.documentRevisionIds) assert(documentById.has(documentId), `${event.id} references unknown document ${documentId}`);
  }

  for (const stakeholderId of documents.changeControlBoard.memberStakeholderIds) {
    assert(stakeholderById.has(stakeholderId), `CCB references unknown stakeholder ${stakeholderId}`);
  }
  assert(stakeholderById.has(documents.changeControlBoard.chairStakeholderId), "CCB chair is unknown");
  assert(stakeholderById.has(documents.changeControlBoard.secretaryStakeholderId), "CCB secretary is unknown");
  assert(documents.changeControlBoard.quorum >= 3, "CCB quorum must be at least 3");

  for (const change of changeById.values()) {
    assert(change.submittedWeek <= change.reviewWeek, `${change.id} is reviewed before submission`);
    assert(change.reviewWeek <= change.decisionWeek, `${change.id} is decided before review`);
    assert(change.decisionWeek <= change.implementationCompletedWeek, `${change.id} completes before decision`);
    assert(change.implementationCompletedWeek <= change.closedWeek, `${change.id} closes before implementation`);
    assert(change.closedWeek <= workload.totalWeeks, `${change.id} closes after the project`);
    assert(stakeholderById.has(change.requesterStakeholderId), `${change.id} has unknown requester ${change.requesterStakeholderId}`);
    assert(stakeholderById.has(change.ownerStakeholderId), `${change.id} has unknown owner ${change.ownerStakeholderId}`);
    for (const wbsId of change.affectedWbsIds) assert(deliverableById.has(wbsId), `${change.id} references unknown WBS ${wbsId}`);
    for (const requirementId of change.affectedRequirementIds) assert(requirementById.has(requirementId), `${change.id} references unknown requirement ${requirementId}`);
  }

  for (const issue of issueById.values()) {
    assert(issue.discoveredWeek <= issue.targetResolutionWeek, `${issue.id} target precedes discovery`);
    assert(issue.targetResolutionWeek <= issue.resolvedWeek, `${issue.id} resolves before target week`);
    assert(issue.resolvedWeek <= workload.totalWeeks, `${issue.id} resolves after the project`);
    assert(stakeholderById.has(issue.ownerStakeholderId), `${issue.id} has unknown owner ${issue.ownerStakeholderId}`);
    for (const requirementId of issue.linkedRequirementIds) assert(requirementById.has(requirementId), `${issue.id} references unknown requirement ${requirementId}`);
    for (const riskId of issue.linkedRiskIds) assert(riskById.has(riskId), `${issue.id} references unknown risk ${riskId}`);
    for (const changeId of issue.linkedChangeIds) assert(changeById.has(changeId), `${issue.id} references unknown change ${changeId}`);
  }

  for (const testRound of testRoundById.values()) {
    assert(testRound.executionWeek >= 12 && testRound.executionWeek <= workload.totalWeeks, `${testRound.id} has invalid execution week`);
    assert([testRound.passed, testRound.failed, testRound.blocked, testRound.criticalDefects].every((value) => Number.isInteger(value) && value >= 0), `${testRound.id} has invalid result counts`);
    for (const requirementId of testRound.coveredRequirementIds) assert(requirementById.has(requirementId), `${testRound.id} references unknown requirement ${requirementId}`);
  }

  for (const revision of documents.contentRevisions) {
    assert(revision.week >= 1 && revision.week <= workload.totalWeeks, `${revision.id} has invalid week`);
    const referencedDocumentIds = Object.values(revision).filter(Array.isArray).flat();
    for (const documentId of referencedDocumentIds) assert(documentById.has(documentId), `${revision.id} references unknown document ${documentId}`);
  }

  for (const event of risks.mainlineLifecycleEvents) {
    assert(lifecycleStates.has(event.toLifecycleState), `Invalid lifecycle state ${event.toLifecycleState}`);
    if (event.controlStatus) assert(controlStates.has(event.controlStatus), `Invalid control status ${event.controlStatus}`);
    for (const riskId of event.riskIds) assert(riskById.has(riskId), `Unknown risk ${riskId} in mainline event`);
  }
  for (const risk of riskById.values()) {
    assert(Number.isInteger(risk.discoveredWeek) && risk.discoveredWeek >= 1 && risk.discoveredWeek <= workload.totalWeeks, `${risk.id} has invalid discovery week`);
    assert(risk.assessmentWeek === risk.discoveredWeek, `${risk.id} must be assessed in its discovery week`);
    assert(risk.responseCompletedWeek >= risk.assessmentWeek, `${risk.id} response completes before assessment`);
    assert(risk.closedWeek >= risk.responseCompletedWeek, `${risk.id} closes before response completion`);
    assert(stakeholderById.has(risk.ownerStakeholderId), `${risk.id} references unknown owner stakeholder ${risk.ownerStakeholderId}`);
    assert(risk.responseActions?.length >= 1, `${risk.id} has no response actions`);
    for (const wbsId of risk.linkedWbsIds ?? []) assert(deliverableById.has(wbsId), `${risk.id} references unknown WBS ${wbsId}`);
    for (const requirementId of risk.linkedRequirementIds ?? []) assert(requirementById.has(requirementId), `${risk.id} references unknown requirement ${requirementId}`);
    for (const reopening of risk.reopenHistory ?? []) {
      assert(scenarioById.has(reopening.scenarioId), `${risk.id} reopening references unknown scenario ${reopening.scenarioId}`);
      assert(reopening.week > reopening.fromClosedWeek, `${risk.id} reopening must occur after closure`);
    }
  }
  for (const override of risks.scenarioOverrides) {
    assert(scenarioById.has(override.scenarioId), `Unknown scenario ${override.scenarioId} in risk override`);
    assert(lifecycleStates.has(override.toLifecycleState), `Invalid lifecycle state ${override.toLifecycleState}`);
    if (override.controlStatus) assert(controlStates.has(override.controlStatus), `Invalid control status ${override.controlStatus}`);
    for (const riskId of override.riskIds) assert(riskById.has(riskId), `Unknown risk ${riskId} in scenario override`);
  }

  for (const scenario of scenarios.scenarios) {
    const prefix = scenario.id;
    assert(Number.isInteger(scenario.week) && scenario.week >= 1 && scenario.week <= workload.totalWeeks, `${prefix} has invalid week`);
    assert(scenario.initialImpact, `${prefix} is missing initialImpact`);
    assert(scenario.unresolvedIssueDegradation, `${prefix} is missing unresolvedIssueDegradation`);
    assert(scenario.necessaryManagementActions.length >= 5 && scenario.necessaryManagementActions.length <= 7, `${prefix} must contain 5-7 necessary actions`);

    const actionById = uniqueMap(scenario.necessaryManagementActions, `${prefix} action`);
    uniqueMap(scenario.cards, `${prefix} card`);
    const visibleCards = scenario.cards.filter((card) => card.column !== "execution_action");
    assert([...actionById.values()].every((action) => action.completedEffect), `${prefix} has an action without completedEffect`);
    assert(visibleCards.length >= 14 && visibleCards.length <= 18, `${prefix} must expose 14-18 three-pool cards`);
    assert(visibleColumns.every((column) => visibleCards.some((card) => card.column === column)), `${prefix} must cover all three visible card pools`);

    for (const card of scenario.cards) {
      assert(allowedColumns.includes(card.column), `${prefix}/${card.id} has invalid column ${card.column}`);
      if (card.column === "evidence_document") assert(documentById.has(card.referenceId), `${prefix}/${card.id} references unknown document ${card.referenceId}`);
      if (card.column === "stakeholder") assert(stakeholderById.has(card.referenceId), `${prefix}/${card.id} references unknown stakeholder ${card.referenceId}`);
      for (const actionId of card.satisfiesActionIds ?? []) assert(actionById.has(actionId), `${prefix}/${card.id} references unknown action ${actionId}`);
    }

    for (const actionId of actionById.keys()) {
      const covered = visibleCards.some((card) => card.satisfiesActionIds?.includes(actionId));
      assert(covered, `${prefix}/${actionId} is not covered by a visible three-pool card`);
    }

    const missingActionIds = new Set(scenario.missingActionConsequences.map((item) => item.actionId));
    assert(missingActionIds.size === actionById.size, `${prefix} missing-action rules do not match action count`);
    for (const actionId of actionById.keys()) assert(missingActionIds.has(actionId), `${prefix}/${actionId} has no missing-action consequence`);

    const harmfulCardIds = new Set(scenario.cards.filter((card) => card.evaluationRole === "harmful").map((card) => card.id));
    const harmfulEffectCardIds = new Set(scenario.harmfulConsequences.map((item) => item.cardId));
    assert(harmfulCardIds.size === harmfulEffectCardIds.size, `${prefix} harmful cards and effects differ`);
    for (const cardId of harmfulCardIds) assert(harmfulEffectCardIds.has(cardId), `${prefix}/${cardId} has no harmful consequence`);

    const terminalClasses = new Set(scenario.terminalRules.map((rule) => rule.classification));
    for (const classification of ["near_mainline_success", "detour_success", "delayed_success", "scenario_failure"]) {
      assert(terminalClasses.has(classification), `${prefix} is missing terminal class ${classification}`);
    }

    const materials = scenario.eventMaterials;
    assert(materials.primaryClues.length === 3, `${prefix} must contain 3 primary clues`);
    assert(materials.corroboratingClues.length === 1, `${prefix} must contain 1 corroborating clue`);
    assert(materials.dashboardAnomalies.length === 1, `${prefix} must contain 1 dashboard anomaly`);
    uniqueMap([...materials.primaryClues, ...materials.corroboratingClues, ...materials.dashboardAnomalies], `${prefix} material`);

    for (const observation of scenario.requiredObservations) {
      if (observation.source === "document") assert(documentById.has(observation.id), `${prefix} observes unknown document ${observation.id}`);
    }

    const workTotal = scenario.necessaryManagementActions.reduce((total, action) => total + (action.completedEffect.incrementalWorkPersonDays ?? 0), 0);
    const costTotal = scenario.necessaryManagementActions.reduce((total, action) => total + (action.completedEffect.incrementalActualCostCny ?? 0), 0);
    if (scenario.idealOutcome.incrementalWorkPersonDays !== undefined) {
      assert(workTotal === scenario.idealOutcome.incrementalWorkPersonDays, `${prefix} action work ${workTotal} differs from ideal ${scenario.idealOutcome.incrementalWorkPersonDays}`);
    }
    if (scenario.idealOutcome.incrementalActualCostCny !== undefined) {
      assert(costTotal === scenario.idealOutcome.incrementalActualCostCny, `${prefix} action cost ${costTotal} differs from ideal ${scenario.idealOutcome.incrementalActualCostCny}`);
    }

    visit(scenario, (key, value, valuePath) => {
      const location = `${prefix}.${valuePath.join(".")}`;
      if (key === "riskId") assert(riskById.has(value), `${location} references unknown risk ${value}`);
      if (key === "documentRevisions" || key === "documentIds") {
        for (const documentId of value) assert(documentById.has(documentId), `${location} references unknown document ${documentId}`);
      }
      if (["stakeholderId", "senderStakeholderId", "escalatedToStakeholderId"].includes(key)) {
        assert(stakeholderById.has(value), `${location} references unknown stakeholder ${value}`);
      }
      if (key === "activityId") assert(activityById.has(value), `${location} references unknown activity ${value}`);
      if (key.endsWith("ActivityIds")) {
        for (const activityId of value) assert(activityById.has(activityId), `${location} references unknown activity ${activityId}`);
      }
      if (key.toLowerCase().includes("lifecyclestate") && value !== null) assert(lifecycleStates.has(value), `${location} has invalid lifecycle state ${value}`);
      if (key.toLowerCase().includes("controlstatus") && value !== null) assert(controlStates.has(value), `${location} has invalid control status ${value}`);
      if (key === "assessment" || key === "residual") {
        assert(value.probability >= 1 && value.probability <= 5, `${location} has invalid probability`);
        assert(value.impact >= 1 && value.impact <= 5, `${location} has invalid impact`);
      }
    });
  }

  return {
    caseId: workload.caseId,
    caseVersion: workload.caseVersion,
    documents: documentById.size,
    stakeholders: stakeholderById.size,
    activities: activityById.size,
    requirements: requirementById.size,
    risks: riskById.size,
    scenarios: scenarioById.size,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const caseDirectory = process.argv[2] ? path.resolve(process.argv[2]) : defaultCaseDirectory;
  const result = await validateLabCase(caseDirectory);
  console.log(`Validated ${result.caseId}:${result.caseVersion} — ${result.documents} documents, ${result.stakeholders} stakeholders, ${result.activities} activities, ${result.risks} risks, ${result.scenarios} scenarios.`);
}
