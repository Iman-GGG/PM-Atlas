import assert from "node:assert/strict";
import test from "node:test";

import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";

const stakeholderPlan = privateLabCasePackage.sourceFiles.stakeholderPlan;
const documentPlan = privateLabCasePackage.sourceFiles.documentPlan;

test("builds D30 as a time-sliced stakeholder register with complete business fields", () => {
  const registerDocument = documentPlan.documents.find((document) => document.id === "D30");
  assert.equal(registerDocument.createdWeek, 1);
  assert.equal(registerDocument.coverage, "dynamic_full_history");

  const stakeholdersAt = (week) => stakeholderPlan.stakeholders.filter((stakeholder) => stakeholder.identifiedWeek <= week);
  assert.equal(stakeholdersAt(1).length, 13);
  assert.equal(stakeholdersAt(4).length, 14);
  assert.equal(stakeholdersAt(8).length, 15);

  for (const stakeholder of stakeholderPlan.stakeholders) {
    assert.ok(stakeholder.projectRole);
    assert.ok(stakeholder.organization);
    assert.ok(stakeholder.expectations.length >= 1);
    assert.ok(stakeholder.informationNeeds.length >= 1);
    assert.ok(stakeholder.primaryCommunicationTouchpointId);
    assert.ok(stakeholder.engagementOwnerStakeholderId);
    assert.ok(stakeholder.identificationBasis);
  }
});

test("records D30 updates at the weeks where stakeholder information changes", () => {
  const contentRevisionWeeks = documentPlan.contentRevisions
    .filter((revision) => Object.values(revision).some((value) => Array.isArray(value) && value.includes("D30")))
    .map((revision) => revision.week);
  assert.deepEqual(contentRevisionWeeks, [4, 10, 12, 17, 25]);

  const mainlineRevisionWeeks = documentPlan.mainlineEvents
    .filter((event) => Object.values(event).some((value) => Array.isArray(value) && value.includes("D30")))
    .map((event) => event.week);
  assert.deepEqual(mainlineRevisionWeeks, [8, 28, 32]);

  const engagementEventWeeks = new Set(stakeholderPlan.mainlineEngagementEvents.map((event) => event.week));
  assert.deepEqual([...engagementEventWeeks], [4, 8, 10, 12, 17, 25]);
});
