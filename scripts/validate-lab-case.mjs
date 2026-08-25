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
  const [workload, schedule, baselineWorkload, stakeholders, documents, requirements, risks, scenarios] = await Promise.all([
    readJson(caseDirectory, "workload-plan.json"),
    readJson(caseDirectory, "schedule-plan.json"),
    readJson(caseDirectory, "baseline-workload.generated.json"),
    readJson(caseDirectory, "stakeholder-plan.json"),
    readJson(caseDirectory, "document-plan.json"),
    readJson(caseDirectory, "requirement-plan.json"),
    readJson(caseDirectory, "risk-plan.json"),
    readJson(caseDirectory, "scenario-plan.json"),
  ]);

  for (const plan of [workload, schedule, baselineWorkload, stakeholders, documents, requirements, risks, scenarios]) {
    assert(plan.caseId === workload.caseId, `Case id mismatch in ${plan.caseId ?? "unknown plan"}`);
    assert(plan.caseVersion === workload.caseVersion, `Case version mismatch in ${plan.caseVersion ?? "unknown plan"}`);
  }

  const documentById = uniqueMap(documents.documents, "document");
  const stakeholderById = uniqueMap(stakeholders.stakeholders, "stakeholder");
  const communicationTouchpointById = uniqueMap(stakeholders.communicationTouchpoints, "communication touchpoint");
  const roleById = uniqueMap(workload.roles, "role");
  const activityById = uniqueMap(schedule.activities, "activity");
  const workPackageById = uniqueMap(workload.workPackages, "work package");
  const deliverableById = new Map([...workPackageById, ...activityById]);
  const requirementById = uniqueMap(requirements.requirements, "requirement");
  const riskById = uniqueMap(risks.initialRisks, "risk");
  const scenarioById = uniqueMap(scenarios.scenarios, "scenario");
  const changeById = uniqueMap(documents.changeItems, "change item");
  const issueById = uniqueMap(documents.issues, "issue");
  const testRoundById = uniqueMap(documents.testRounds, "test round");
  const assumptionById = uniqueMap(documents.assumptionLog.items, "assumption");
  const lessonById = uniqueMap(documents.lessonsLearnedRegister.items, "lesson learned");
  const milestoneById = uniqueMap(documents.milestoneList.items, "milestone");
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
  assert(assumptionById.size === 10, `Expected 10 assumptions; found ${assumptionById.size}`);
  assert(lessonById.size === 9, `Expected 9 lessons learned; found ${lessonById.size}`);
  assert(milestoneById.size === 6, `Expected 6 milestones; found ${milestoneById.size}`);
  assert(scenarios.eventDiscoveryPolicy.requiredMaterialComposition.primaryClues === 3, "Primary clue policy must require 3 items");
  assert(scenarios.eventDiscoveryPolicy.requiredMaterialComposition.corroboratingClues === 1, "Corroborating clue policy must require 1 item");
  assert(scenarios.eventDiscoveryPolicy.requiredMaterialComposition.dashboardAnomalies === 1, "Dashboard anomaly policy must require 1 item");
  assert(scenarios.decisionReasoningPolicy.enabled === false, "Decision reasoning must be disabled");
  assert(scenarios.decisionReasoningPolicy.fields.length === 0, "Disabled decision reasoning must not contain fields");
  assert(scenarios.decisionReasoningPolicy.submissionRequirement === "at_least_one_complete_action_chain", "Submission must require one complete action chain");
  assert(scenarios.aiReviewPolicy.capabilityDimensions.length === 5, "AI review must contain 5 capability dimensions");

  const stakeholderGroups = new Set(["governance", "core_team", "business", "external"]);
  const engagementStates = new Set(stakeholders.engagementPolicy.states);
  for (const stakeholder of stakeholderById.values()) {
    assert(Number.isInteger(stakeholder.identifiedWeek) && stakeholder.identifiedWeek >= 1 && stakeholder.identifiedWeek <= workload.totalWeeks, `${stakeholder.id} has invalid identification week`);
    assert(typeof stakeholder.projectRole === "string" && stakeholder.projectRole.length > 0, `${stakeholder.id} has no project role`);
    assert(typeof stakeholder.organization === "string" && stakeholder.organization.length > 0, `${stakeholder.id} has no organization`);
    assert(stakeholderGroups.has(stakeholder.group), `${stakeholder.id} has invalid stakeholder group ${stakeholder.group}`);
    assert(Number.isInteger(stakeholder.initialEngagement?.power) && stakeholder.initialEngagement.power >= 1 && stakeholder.initialEngagement.power <= 5, `${stakeholder.id} has invalid power`);
    assert(Number.isInteger(stakeholder.initialEngagement?.interest) && stakeholder.initialEngagement.interest >= 1 && stakeholder.initialEngagement.interest <= 5, `${stakeholder.id} has invalid interest`);
    assert(engagementStates.has(stakeholder.initialEngagement?.current), `${stakeholder.id} has invalid initial current engagement`);
    assert(engagementStates.has(stakeholder.initialEngagement?.desired), `${stakeholder.id} has invalid initial desired engagement`);
    assert(Array.isArray(stakeholder.expectations) && stakeholder.expectations.length >= 1, `${stakeholder.id} has no expectations`);
    assert(Array.isArray(stakeholder.informationNeeds) && stakeholder.informationNeeds.length >= 1, `${stakeholder.id} has no information needs`);
    assert(communicationTouchpointById.has(stakeholder.primaryCommunicationTouchpointId), `${stakeholder.id} references unknown primary communication touchpoint ${stakeholder.primaryCommunicationTouchpointId}`);
    assert(stakeholderById.has(stakeholder.engagementOwnerStakeholderId), `${stakeholder.id} references unknown engagement owner ${stakeholder.engagementOwnerStakeholderId}`);
    assert(typeof stakeholder.identificationBasis === "string" && stakeholder.identificationBasis.length > 0, `${stakeholder.id} has no identification basis`);
  }
  for (const touchpoint of communicationTouchpointById.values()) {
    assert(["weekly", "biweekly", "specified_weeks", "activity_driven"].includes(touchpoint.cadence), `${touchpoint.id} has invalid cadence ${touchpoint.cadence}`);
    for (const stakeholderId of touchpoint.participants ?? []) assert(stakeholderById.has(stakeholderId), `${touchpoint.id} references unknown participant ${stakeholderId}`);
  }
  const stakeholderEventKeys = new Set();
  for (const event of stakeholders.mainlineEngagementEvents) {
    const stakeholder = stakeholderById.get(event.stakeholderId);
    assert(stakeholder, `Stakeholder engagement event references unknown stakeholder ${event.stakeholderId}`);
    assert(Number.isInteger(event.week) && event.week >= stakeholder.identifiedWeek && event.week <= workload.totalWeeks, `${event.stakeholderId} has invalid engagement event week ${event.week}`);
    assert(engagementStates.has(event.current), `${event.stakeholderId} has invalid current engagement ${event.current}`);
    if (event.desired) assert(engagementStates.has(event.desired), `${event.stakeholderId} has invalid desired engagement ${event.desired}`);
    assert(Array.isArray(event.evidence) && event.evidence.length >= 1, `${event.stakeholderId} engagement event has no evidence`);
    const eventKey = `${event.stakeholderId}:${event.week}`;
    assert(!stakeholderEventKeys.has(eventKey), `Duplicate stakeholder engagement event ${eventKey}`);
    stakeholderEventKeys.add(eventKey);
  }

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

  const teamCharter = documents.teamCharter;
  assert(teamCharter.documentId === "D31", "Team charter must belong to D31");
  assert(teamCharter.version === "1.0" && teamCharter.effectiveWeek === 1, "Team charter must be effective as v1.0 in W1");
  assert(typeof teamCharter.purpose === "string" && teamCharter.purpose.length > 0, "Team charter has no purpose");
  assert(typeof teamCharter.mission === "string" && teamCharter.mission.length > 0, "Team charter has no mission");
  assert(stakeholderById.has(teamCharter.facilitatorStakeholderId), "Team charter facilitator is unknown");
  const expectedCoreTeamIds = stakeholders.stakeholders.filter((stakeholder) => stakeholder.resourceRoleId).map((stakeholder) => stakeholder.id).sort();
  assert(new Set(teamCharter.agreedByStakeholderIds).size === teamCharter.agreedByStakeholderIds.length, "Team charter contains duplicate agreeing members");
  assert(JSON.stringify([...teamCharter.agreedByStakeholderIds].sort()) === JSON.stringify(expectedCoreTeamIds), "Team charter must be agreed by all eight staffed core-team roles");
  uniqueMap(teamCharter.values, "team charter value");
  uniqueMap(teamCharter.workingAgreements, "team charter working agreement");
  uniqueMap(teamCharter.communicationAgreements, "team charter communication agreement");
  assert(teamCharter.values.length >= 4, "Team charter must define at least four values");
  assert(teamCharter.workingAgreements.length >= 5, "Team charter must define at least five working agreements");
  assert(teamCharter.qualityAndSafetyGuardrails.length >= 3, "Team charter must define quality and safety guardrails");
  const decisionAreas = new Set();
  for (const decision of teamCharter.decisionRights) {
    assert(!decisionAreas.has(decision.area), `Duplicate team charter decision area ${decision.area}`);
    decisionAreas.add(decision.area);
    assert(stakeholderById.has(decision.ownerStakeholderId), `Team charter decision area ${decision.area} has unknown owner`);
    for (const stakeholderId of decision.consultedStakeholderIds) assert(stakeholderById.has(stakeholderId), `Team charter decision area ${decision.area} has unknown consulted stakeholder ${stakeholderId}`);
    assert(typeof decision.rule === "string" && decision.rule.length > 0, `Team charter decision area ${decision.area} has no rule`);
  }
  for (const agreement of teamCharter.communicationAgreements) {
    assert(documentById.has(agreement.recordDocumentId), `${agreement.id} references unknown record document ${agreement.recordDocumentId}`);
  }
  teamCharter.conflictResolutionSteps.forEach((step, index) => {
    assert(step.step === index + 1, `Team charter conflict step ${step.step} is out of sequence`);
    assert(stakeholderById.has(step.ownerStakeholderId), `Team charter conflict step ${step.step} has unknown owner`);
  });
  assert(documentById.has(teamCharter.handoverProtocol.recordDocumentId), "Team charter handover protocol references an unknown document");
  assert(teamCharter.handoverProtocol.requiredContents.length >= 4, "Team charter handover protocol is incomplete");
  assert(documentById.has(teamCharter.amendmentRule.recordDocumentId), "Team charter amendment rule references an unknown document");
  assert(!documents.contentRevisions.some((revision) => Object.values(revision).some((value) => Array.isArray(value) && value.includes("D31"))), "D31 must not have planned content revisions after W1");
  const teamCharterMainlineActions = documents.mainlineEvents.flatMap((event) => Object.entries(event).filter(([, value]) => Array.isArray(value) && value.includes("D31")).map(([key]) => key));
  assert(teamCharterMainlineActions.length === 1 && teamCharterMainlineActions[0] === "archivedDocumentIds", "D31 may only be archived after W1; it must not receive a new content version");

  const activityList = schedule.activityList;
  assert(activityList.documentId === "D02", "Activity list policy must belong to D02");
  assert(activityList.createdWeek === documentById.get("D02").createdWeek && activityList.approvedWeek === 8, "D02 creation or approval week is inconsistent");
  assert(JSON.stringify(activityList.statusModel) === JSON.stringify(["not_started", "in_progress", "waiting_next_occurrence", "completed"]), "D02 has an invalid status model");
  for (const documentId of activityList.sourceDocumentIds) assert(documentById.has(documentId), `D02 references unknown source document ${documentId}`);
  const activityTypes = new Set(activityList.typeDefinitions.map((item) => item.type));
  assert(activityTypes.size === activityList.typeDefinitions.length && activityTypes.size === 3, "D02 activity type definitions are incomplete or duplicated");
  for (const activity of activityById.values()) {
    assert(workPackageById.has(activity.parentId), `${activity.id} references unknown parent WBS ${activity.parentId}`);
    assert(activityTypes.has(activity.type), `${activity.id} has unsupported activity type ${activity.type}`);
    assert(Number.isInteger(activity.startWeek) && Number.isInteger(activity.endWeek) && activity.startWeek >= 1 && activity.endWeek >= activity.startWeek && activity.endWeek <= workload.totalWeeks, `${activity.id} has invalid planned weeks`);
    assert(Array.isArray(activity.acceptanceCriteria) && activity.acceptanceCriteria.length >= 1, `${activity.id} has no completion acceptance criteria`);
    assert(Object.keys(activity.plannedPersonDaysByRole).length >= 1, `${activity.id} has no planned role effort`);
    for (const [roleId, personDays] of Object.entries(activity.plannedPersonDaysByRole)) {
      assert(roleById.has(roleId), `${activity.id} references unknown role ${roleId}`);
      assert(Number.isFinite(personDays) && personDays >= 0, `${activity.id} has invalid planned effort for ${roleId}`);
    }
    if (activity.type === "discrete") {
      assert(activity.durationWeeks && activity.durationWeeks.optimistic <= activity.durationWeeks.mostLikely && activity.durationWeeks.mostLikely <= activity.durationWeeks.pessimistic, `${activity.id} has invalid three-point duration estimates`);
    }
    if (activity.type === "recurring") {
      assert(activity.occurrenceWeeks?.length >= 2, `${activity.id} recurring occurrences are incomplete`);
      assert(activity.occurrenceWeeks.every((week) => week >= activity.startWeek && week <= activity.endWeek), `${activity.id} has an occurrence outside its planned window`);
    }
    for (const predecessor of activity.predecessors ?? []) {
      assert(activityById.has(predecessor.activityId), `${activity.id} references unknown predecessor ${predecessor.activityId}`);
      assert(schedule.dependencyPolicy.supportedTypes.includes(predecessor.type), `${activity.id} has unsupported dependency type ${predecessor.type}`);
      assert(Number.isInteger(predecessor.lagWeeks) && predecessor.lagWeeks >= 0, `${activity.id} has invalid lag for ${predecessor.activityId}`);
    }
  }
  const documentHasVersionAction = (event, documentId) => Object.entries(event).some(([key, value]) => (
    Array.isArray(value)
    && value.includes(documentId)
    && !key.toLowerCase().includes("archived")
    && !key.toLowerCase().includes("unchanged")
  ));
  assert(JSON.stringify(documents.mainlineEvents.filter((event) => documentHasVersionAction(event, "D02")).map((event) => event.week)) === JSON.stringify([8]), "D02 may only receive its W8 approval version after creation");
  assert(!documents.contentRevisions.some((revision) => documentHasVersionAction(revision, "D02")), "D02 must not receive content revisions when only dates, dependencies or resources change");

  const projectSchedulePlan = schedule.projectSchedulePlan;
  assert(projectSchedulePlan.documentId === "D14", "Project schedule plan must belong to D14");
  assert(documentById.get("D14").createdWeek === 6 && documentById.get("D14").coverage === "dynamic_full_history", "D14 metadata is inconsistent");
  assert(projectSchedulePlan.createdWeek === 6 && projectSchedulePlan.baselineWeek === 8, "D14 creation or baseline week is inconsistent");
  for (const documentId of projectSchedulePlan.sourceDocumentIds) assert(documentById.has(documentId), `D14 references unknown source document ${documentId}`);
  assert(projectSchedulePlan.calendar.plannedStartWeek === 1 && projectSchedulePlan.calendar.plannedFinishWeek === 32 && projectSchedulePlan.calendar.deadlineWeek === 32, "D14 calendar must preserve the W1-W32 approved window");
  assert(projectSchedulePlan.calendar.workDaysPerWeek === workload.personDaysPerPersonWeek, "D14 calendar workdays must match the workload plan");
  assert(projectSchedulePlan.baseline.activityCount === activityById.size, "D14 baseline activity count differs from D02");
  assert(projectSchedulePlan.baseline.milestoneCount === milestoneById.size, "D14 baseline milestone count differs from D10");
  assert(projectSchedulePlan.baseline.criticalActivityCount === baselineWorkload.scheduleNetwork.criticalActivityIds.length, "D14 critical activity count differs from the generated network");
  assert(projectSchedulePlan.baseline.totalPlannedPersonDays === baselineWorkload.totalPlannedPersonDays, "D14 planned person-days differ from the generated workload baseline");
  assert(baselineWorkload.scheduleNetwork.calculatedProjectFinishWeek === projectSchedulePlan.calendar.plannedFinishWeek, "D14 finish week differs from the generated CPM result");
  for (const activityId of baselineWorkload.scheduleNetwork.criticalActivityIds) assert(activityById.has(activityId), `D14 critical path references unknown activity ${activityId}`);
  const scheduleVersionWeeks = projectSchedulePlan.versionEvents.map((event) => event.week);
  const scheduleVersionNumbers = projectSchedulePlan.versionEvents.map((event) => event.version);
  assert(JSON.stringify(scheduleVersionWeeks) === JSON.stringify([6, 8, 12, 20, 28, 32]), "D14 version weeks must be W6, W8, W12, W20, W28 and W32");
  assert(JSON.stringify(scheduleVersionNumbers) === JSON.stringify(["0.1", "1.0", "1.1", "1.2", "1.3", "1.4"]), "D14 version numbers are inconsistent");
  assert(projectSchedulePlan.versionEvents.filter((event) => event.baselineChanged).length === 1 && projectSchedulePlan.versionEvents.find((event) => event.baselineChanged)?.week === 8, "D14 may establish its baseline only in W8; rolling forecasts must not rebaseline it");
  for (const event of projectSchedulePlan.versionEvents) {
    assert(typeof event.decision === "string" && event.decision.length > 0, `D14 version ${event.version} has no decision basis`);
    for (const changeId of event.approvedChangeIds) assert(changeById.has(changeId), `D14 version ${event.version} references unknown change ${changeId}`);
  }
  const scheduleHealthStates = new Set(["planning", "on_track", "at_risk", "recovery_approved", "recovered", "completed"]);
  assert(JSON.stringify(projectSchedulePlan.statusEvents.map((event) => event.week)) === JSON.stringify([6, 8, 12, 17, 18, 20, 24, 28, 32]), "D14 forecast status event weeks are inconsistent");
  for (const event of projectSchedulePlan.statusEvents) {
    assert(scheduleHealthStates.has(event.health), `D14 has invalid schedule health ${event.health}`);
    assert(event.forecastFinishWeek - projectSchedulePlan.calendar.plannedFinishWeek === event.forecastVarianceWeeks, `D14 W${event.week} forecast variance is inconsistent`);
    assert(event.actualFinishWeek === null || event.actualFinishWeek === projectSchedulePlan.calendar.plannedFinishWeek, `D14 W${event.week} has an unsupported actual finish week`);
    assert(typeof event.evidence === "string" && event.evidence.length > 0, `D14 W${event.week} status has no evidence`);
  }
  const scheduleStatusByWeek = new Map(projectSchedulePlan.statusEvents.map((event) => [event.week, event]));
  assert(scheduleStatusByWeek.get(17).forecastFinishWeek === 35, "D14 must show the unmitigated W35 forecast at the W17 supply/resource event");
  assert(scheduleStatusByWeek.get(18).forecastFinishWeek === 33 && scheduleStatusByWeek.get(20).forecastFinishWeek === 33, "D14 must retain the W33 recovery forecast through W20");
  assert(scheduleStatusByWeek.get(24).forecastFinishWeek === 32 && scheduleStatusByWeek.get(32).actualFinishWeek === 32, "D14 must recover and finish on the W32 baseline");
  uniqueMap(projectSchedulePlan.controlRules, "schedule control rule");
  assert(projectSchedulePlan.controlRules.length === 5, "D14 must define five schedule control rules");
  assert(projectSchedulePlan.resourceSchedulingNotes.length >= 4, "D14 resource scheduling notes are incomplete");
  assert(JSON.stringify(documents.mainlineEvents.filter((event) => documentHasVersionAction(event, "D14")).map((event) => event.week)) === JSON.stringify([8, 12, 20, 28, 32]), "D14 mainline version events must align with its approved lifecycle");
  assert(!documents.contentRevisions.some((revision) => documentHasVersionAction(revision, "D14")), "D14 lifecycle versions must be controlled through the defined mainline events");
  const scenarioTwo = scenarioById.get("scenario-2");
  assert(scenarioTwo.idealOutcome.documentRevisions.includes("D14"), "Scenario 2 must revise D14 after the recovery plan is agreed");
  assert(!scenarioById.get("scenario-1").idealOutcome.documentRevisions.includes("D14") && !scenarioById.get("scenario-3").idealOutcome.documentRevisions.includes("D14"), "Only the schedule-disruption scenario should revise D14");

  const scopeStatement = documents.projectScopeStatement;
  assert(scopeStatement.documentId === "D16", "Project scope statement must belong to D16");
  assert(documentById.get("D16").createdWeek === 3 && documentById.get("D16").coverage === "dynamic_full_history", "D16 metadata is inconsistent");
  assert(JSON.stringify(scopeStatement.baselineEvents.map((event) => event.week)) === JSON.stringify([3, 8, 28]), "D16 baseline event weeks must be W3, W8 and W28");
  assert(JSON.stringify(scopeStatement.baselineEvents.map((event) => event.version)) === JSON.stringify(["0.1", "1.0", "1.1"]), "D16 baseline versions are inconsistent");
  for (const event of scopeStatement.baselineEvents) {
    if (event.approvedChangeId) assert(changeById.has(event.approvedChangeId), `D16 baseline event W${event.week} references unknown change ${event.approvedChangeId}`);
  }
  const scopeStatuses = new Set(scopeStatement.statusModel);
  const productScopeItemById = uniqueMap(scopeStatement.productScopeItems, "product scope item");
  assert(productScopeItemById.size === 6, "D16 must define six product scope groups");
  for (const item of productScopeItemById.values()) {
    let priorWeek = 0;
    for (const event of item.statusEvents) {
      assert(event.week >= priorWeek && event.week >= 3 && event.week <= workload.totalWeeks, `${item.id} scope status events are invalid or out of order`);
      assert(scopeStatuses.has(event.status), `${item.id} has invalid scope status ${event.status}`);
      assert(typeof event.evidence === "string" && event.evidence.length > 0, `${item.id} status event W${event.week} has no evidence`);
      priorWeek = event.week;
    }
    assert(item.statusEvents[0]?.week === 3, `${item.id} must be present in the W3 draft`);
    for (const requirementId of item.relatedRequirementIds) assert(requirementById.has(requirementId), `${item.id} references unknown requirement ${requirementId}`);
    for (const wbsId of item.relatedWbsIds) assert(deliverableById.has(wbsId), `${item.id} references unknown WBS ${wbsId}`);
  }
  const scopeDeliverableById = uniqueMap(scopeStatement.deliverables, "scope deliverable");
  assert(scopeDeliverableById.size === 8, "D16 must define eight major deliverables");
  for (const deliverable of scopeDeliverableById.values()) {
    assert(deliverable.definedWeek === 3 && deliverable.targetWeek >= deliverable.definedWeek && deliverable.targetWeek <= workload.totalWeeks, `${deliverable.id} has invalid definition or target week`);
    for (const wbsId of deliverable.relatedWbsIds) assert(deliverableById.has(wbsId), `${deliverable.id} references unknown WBS ${wbsId}`);
    for (const documentId of deliverable.evidenceDocumentIds) assert(documentById.has(documentId), `${deliverable.id} references unknown evidence document ${documentId}`);
  }
  uniqueMap(scopeStatement.exclusions, "scope exclusion");
  for (const exclusion of scopeStatement.exclusions) assert(exclusion.effectiveWeek >= 3 && exclusion.effectiveWeek <= workload.totalWeeks, `${exclusion.id} has invalid effective week`);
  uniqueMap(scopeStatement.constraints, "scope constraint");
  for (const assumptionId of scopeStatement.assumptionIds) assert(assumptionById.has(assumptionId), `D16 references unknown assumption ${assumptionId}`);
  const scopeAcceptanceById = uniqueMap(scopeStatement.acceptanceCriteria, "scope acceptance criterion");
  assert(scopeAcceptanceById.size === 7, "D16 must define seven acceptance criteria");
  for (const criterion of scopeAcceptanceById.values()) for (const documentId of criterion.evidenceDocumentIds) assert(documentById.has(documentId), `${criterion.id} references unknown evidence document ${documentId}`);
  assert(JSON.stringify(documents.mainlineEvents.filter((event) => documentHasVersionAction(event, "D16")).map((event) => event.week)) === JSON.stringify([8, 28]), "D16 must be baselined in W8 and rebaselined in W28 only");
  assert(!documents.contentRevisions.some((revision) => documentHasVersionAction(revision, "D16")), "D16 changes must be controlled through mainline baseline events");
  const scenarioOne = scenarioById.get("scenario-1");
  const scenarioThree = scenarioById.get("scenario-3");
  assert(scenarioOne.idealOutcome.unchangedBaselines.includes("D16") && !scenarioOne.idealOutcome.documentRevisions.includes("D16"), "Scenario 1 must preserve the D16 baseline");
  assert(scenarioThree.idealOutcome.documentRevisions.includes("D16"), "Scenario 3 must revise D16 after phased-release approval");

  assert(documents.assumptionLog.documentId === "D03", "Assumption log must belong to D03");
  const assumptionStatuses = new Set(documents.assumptionLog.statusModel);
  const assumptionCategories = new Set(["scope", "supplier", "resource", "security", "quality", "technical", "stakeholder", "operations", "compliance"]);
  for (const assumption of assumptionById.values()) {
    assert(assumptionCategories.has(assumption.category), `${assumption.id} has invalid category ${assumption.category}`);
    assert(Number.isInteger(assumption.identifiedWeek) && assumption.identifiedWeek >= 1 && assumption.identifiedWeek <= workload.totalWeeks, `${assumption.id} has invalid identification week`);
    assert(Number.isInteger(assumption.targetValidationWeek) && assumption.targetValidationWeek >= assumption.identifiedWeek && assumption.targetValidationWeek <= workload.totalWeeks, `${assumption.id} has invalid target validation week`);
    assert(stakeholderById.has(assumption.ownerStakeholderId), `${assumption.id} references unknown owner ${assumption.ownerStakeholderId}`);
    assert(typeof assumption.statement === "string" && assumption.statement.length > 0, `${assumption.id} has no statement`);
    assert(typeof assumption.validationMethod === "string" && assumption.validationMethod.length > 0, `${assumption.id} has no validation method`);
    assert(typeof assumption.impactIfFalse === "string" && assumption.impactIfFalse.length > 0, `${assumption.id} has no false-impact description`);
    let priorWeek = 0;
    for (const event of assumption.statusEvents) {
      assert(Number.isInteger(event.week) && event.week >= assumption.identifiedWeek && event.week <= workload.totalWeeks, `${assumption.id} has invalid status-event week ${event.week}`);
      assert(event.week >= priorWeek, `${assumption.id} status events are out of order`);
      assert(assumptionStatuses.has(event.status), `${assumption.id} has invalid status ${event.status}`);
      assert(typeof event.evidence === "string" && event.evidence.length > 0, `${assumption.id} status event W${event.week} has no evidence`);
      priorWeek = event.week;
    }
    assert(assumption.statusEvents[0]?.week === assumption.identifiedWeek, `${assumption.id} must have an initial status event in its identification week`);
    for (const riskId of assumption.linkedRiskIds) assert(riskById.has(riskId), `${assumption.id} references unknown risk ${riskId}`);
    for (const requirementId of assumption.linkedRequirementIds) assert(requirementById.has(requirementId), `${assumption.id} references unknown requirement ${requirementId}`);
    for (const wbsId of assumption.linkedWbsIds) assert(deliverableById.has(wbsId), `${assumption.id} references unknown WBS ${wbsId}`);
    for (const documentId of assumption.linkedDocumentIds) assert(documentById.has(documentId), `${assumption.id} references unknown document ${documentId}`);
  }

  assert(documents.lessonsLearnedRegister.documentId === "D09", "Lessons learned register must belong to D09");
  assert(documentById.get("D09").coverage === "dynamic_full_history", "D09 must retain full dynamic history");
  const lessonStatuses = new Set(documents.lessonsLearnedRegister.statusModel);
  for (const lesson of lessonById.values()) {
    assert(Number.isInteger(lesson.observedWeek) && lesson.observedWeek >= 1 && lesson.observedWeek <= workload.totalWeeks, `${lesson.id} has invalid observation week`);
    assert(Number.isInteger(lesson.capturedWeek) && lesson.capturedWeek >= lesson.observedWeek && lesson.capturedWeek <= workload.totalWeeks, `${lesson.id} has invalid capture week`);
    assert(Number.isInteger(lesson.adoptedWeek) && lesson.adoptedWeek >= lesson.capturedWeek && lesson.adoptedWeek <= workload.totalWeeks, `${lesson.id} has invalid adoption week`);
    assert(lessonStatuses.has(lesson.status), `${lesson.id} has invalid status ${lesson.status}`);
    assert(stakeholderById.has(lesson.ownerStakeholderId), `${lesson.id} references unknown owner ${lesson.ownerStakeholderId}`);
    for (const issueId of lesson.linkedIssueIds) assert(issueById.has(issueId), `${lesson.id} references unknown issue ${issueId}`);
    for (const riskId of lesson.linkedRiskIds) assert(riskById.has(riskId), `${lesson.id} references unknown risk ${riskId}`);
    for (const changeId of lesson.linkedChangeIds) assert(changeById.has(changeId), `${lesson.id} references unknown change ${changeId}`);
    for (const documentId of lesson.evidenceDocumentIds) assert(documentById.has(documentId), `${lesson.id} references unknown evidence document ${documentId}`);
    for (const field of ["title", "context", "observation", "impact", "recommendation", "applicablePhase"]) {
      assert(typeof lesson[field] === "string" && lesson[field].length > 0, `${lesson.id} has no ${field}`);
    }
  }

  assert(documents.milestoneList.documentId === "D10", "Milestone list must belong to D10");
  const milestoneStatuses = new Set(documents.milestoneList.statusModel);
  let priorBaselineWeek = 0;
  for (const milestone of milestoneById.values()) {
    assert(Number.isInteger(milestone.baselineWeek) && milestone.baselineWeek > priorBaselineWeek && milestone.baselineWeek <= workload.totalWeeks, `${milestone.id} has an invalid or unordered baseline week`);
    priorBaselineWeek = milestone.baselineWeek;
    assert(stakeholderById.has(milestone.ownerStakeholderId), `${milestone.id} references unknown owner ${milestone.ownerStakeholderId}`);
    assert(typeof milestone.acceptanceCriteria === "string" && milestone.acceptanceCriteria.length > 0, `${milestone.id} has no acceptance criteria`);
    for (const wbsId of milestone.relatedWbsIds) assert(deliverableById.has(wbsId), `${milestone.id} references unknown WBS ${wbsId}`);
    for (const documentId of milestone.evidenceDocumentIds) assert(documentById.has(documentId), `${milestone.id} references unknown evidence document ${documentId}`);
    let priorEventWeek = 0;
    for (const event of milestone.statusEvents) {
      assert(Number.isInteger(event.week) && event.week >= 1 && event.week <= workload.totalWeeks, `${milestone.id} has invalid event week ${event.week}`);
      assert(event.week >= priorEventWeek, `${milestone.id} status events are out of order`);
      assert(milestoneStatuses.has(event.status), `${milestone.id} has invalid status ${event.status}`);
      assert(Number.isInteger(event.forecastWeek) && event.forecastWeek >= event.week && event.forecastWeek <= 40, `${milestone.id} has invalid forecast week at W${event.week}`);
      assert(event.actualWeek === null || (Number.isInteger(event.actualWeek) && event.actualWeek >= 1 && event.actualWeek <= workload.totalWeeks), `${milestone.id} has invalid actual week at W${event.week}`);
      assert(typeof event.evidence === "string" && event.evidence.length > 0, `${milestone.id} event W${event.week} has no evidence`);
      priorEventWeek = event.week;
    }
    assert(milestone.statusEvents[0]?.week === 1, `${milestone.id} must be planned or achieved in W1`);
  }

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
