import assert from "node:assert/strict";
import test from "node:test";

import { authoritativeToolCategories, authoritativeTools } from "../app/obsidian-knowledge.generated.ts";
import { obsidianProjectDocuments } from "../app/project-document-data.ts";
import { privateLabCasePackage } from "../worker/generated/lab-case-private.generated.ts";

test("keeps every visible lab card aligned with an authoritative source", () => {
  const orderedTools = authoritativeToolCategories.flatMap((category) => (
    authoritativeTools.filter((tool) => tool.categoryId === category.id)
  ));
  const managementToolIdByTitle = new Map(
    orderedTools.map((tool, index) => [tool.title, `tool:${String(index + 1).padStart(3, "0")}`]),
  );
  const documentTitleById = new Map(obsidianProjectDocuments.map((document) => [document.id, document.title]));
  const stakeholderTitleById = new Map(
    privateLabCasePackage.sourceFiles.stakeholderPlan.stakeholders.map((stakeholder) => [stakeholder.id, stakeholder.title]),
  );
  let toolCardCount = 0;

  for (const scenario of privateLabCasePackage.sourceFiles.scenarioPlan.scenarios) {
    for (const card of scenario.cards) {
      if (card.column === "evidence_document") {
        assert.equal(card.title, documentTitleById.get(card.referenceId), `${scenario.id}/${card.id} must use the knowledge-base document title`);
      }
      if (card.column === "tool_technique") {
        toolCardCount += 1;
        assert.equal(card.referenceId, managementToolIdByTitle.get(card.title), `${scenario.id}/${card.id} must use an authoritative tool title and T number`);
      }
      if (card.column === "stakeholder") {
        assert.equal(card.title, stakeholderTitleById.get(card.referenceId), `${scenario.id}/${card.id} must use the case stakeholder-register title`);
      }
    }
  }

  assert.equal(toolCardCount, 11);
});
