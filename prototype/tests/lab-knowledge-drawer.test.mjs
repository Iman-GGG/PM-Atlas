import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("resolves official document and tool references without inventing stakeholder entries", () => {
  return Promise.all([
    readFile(new URL("../app/knowledge-entry-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/obsidian-knowledge.generated.ts", import.meta.url), "utf8"),
  ]).then(([resolver, knowledge]) => {
    assert.match(resolver, /\^D\\d\{2\}\$\/i[\s\S]*`document:\$\{value\.toUpperCase\(\)\}`/);
    assert.match(resolver, /\^T\\d\{3\}\$\/i[\s\S]*`tool:\$\{value\.slice\(1\)\}`/);
    assert.match(resolver, /return nodeById\.has\(value\) \? value : null/);
    assert.match(resolver, /tool\?\.content \?\? note\?\.content \?\? node\.description/);
    assert.match(knowledge, /"title": "项目范围说明书"[\s\S]*"sourcePath": "项目范围说明书\.md"/);
    assert.match(knowledge, /"title": "演示"[\s\S]*"sourcePath": "演示\.md"/);
  });
});

test("opens knowledge in an in-place drawer from action cards and AI review references", async () => {
  const [timeline, outcome, drawer, styles, api] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lab-scenario-outcome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/knowledge-entry-drawer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../worker/lab/case-api.ts", import.meta.url), "utf8"),
  ]);

  assert.match(timeline, /knowledgeReferenceExists\(card\.referenceId\)/);
  assert.match(timeline, /setSelectedKnowledgeReference\(card\.referenceId\)/);
  assert.match(timeline, /<KnowledgeEntryDrawer referenceId=\{selectedKnowledgeReference\}/);
  assert.match(outcome, /onOpenKnowledge\(id\)/);
  assert.match(outcome, /className="lab-v2-knowledge-code"/);
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /if \(event\.key === "Escape"\)/);
  assert.match(drawer, /分支、周次、材料和行动链不会重置/);
  assert.doesNotMatch(drawer, /location\.|window\.open|router\./);
  assert.match(styles, /\.lab-v2-knowledge-backdrop \{ position: fixed; z-index: 120/);
  assert.match(api, /knowledgeReferences/);
  assert.match(api, /只能从 knowledgeReferences 的 id 中原样选择/);
});
