import assert from "node:assert/strict";
import test from "node:test";

import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";

const { documentPlan, stakeholderPlan } = privateLabCasePackage.sourceFiles;

test("defines D31 as a complete W1 team charter agreed by the staffed core team", () => {
  const document = documentPlan.documents.find((item) => item.id === "D31");
  const charter = documentPlan.teamCharter;
  assert.equal(document.createdWeek, 1);
  assert.equal(document.coverage, "supporting_key_versions");
  assert.equal(charter.documentId, "D31");
  assert.equal(charter.version, "1.0");
  assert.equal(charter.effectiveWeek, 1);

  const staffedCoreTeamIds = stakeholderPlan.stakeholders
    .filter((stakeholder) => stakeholder.resourceRoleId)
    .map((stakeholder) => stakeholder.id);
  assert.deepEqual(new Set(charter.agreedByStakeholderIds), new Set(staffedCoreTeamIds));
  assert.equal(charter.values.length, 5);
  assert.equal(charter.decisionRights.length, 5);
  assert.equal(charter.workingAgreements.length, 6);
  assert.equal(charter.communicationAgreements.length, 4);
  assert.equal(charter.qualityAndSafetyGuardrails.length, 4);
  assert.equal(charter.conflictResolutionSteps.length, 3);
  assert.match(charter.handoverProtocol.trigger, /关键岗位/);
});

test("keeps D31 content unchanged after W1 and treats W32 as archival only", () => {
  const hasContentRevision = documentPlan.contentRevisions.some((revision) => (
    Object.values(revision).some((value) => Array.isArray(value) && value.includes("D31"))
  ));
  assert.equal(hasContentRevision, false);

  const mainlineActions = documentPlan.mainlineEvents.flatMap((event) => (
    Object.entries(event)
      .filter(([, value]) => Array.isArray(value) && value.includes("D31"))
      .map(([key]) => ({ week: event.week, key }))
  ));
  assert.deepEqual(mainlineActions, [{ week: 32, key: "archivedDocumentIds" }]);

  for (const scenario of privateLabCasePackage.sourceFiles.scenarioPlan.scenarios) {
    assert.equal(JSON.stringify(scenario).includes('"D31"'), false);
  }
});
