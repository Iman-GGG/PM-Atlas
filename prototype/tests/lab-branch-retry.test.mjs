import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("adds one backward-compatible branch-name column without duplicating retry state", async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_gorgeous_johnny_blaze.sql", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /branchName: text\("branch_name"\)/);
  assert.match(schema, /parentBranchId: text\("parent_branch_id"\)/);
  assert.equal(migration.trim(), "ALTER TABLE `lab_branches` ADD `branch_name` text;");
  assert.doesNotMatch(schema, /attempt_number|retry_sequence/);
});

test("groups attempts by scenario and exposes naming plus new-v6 retry actions", async () => {
  const [pageSource, outcomeSource, cssSource] = await Promise.all([
    readFile(new URL("../app/lab-timeline-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lab-scenario-outcome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(pageSource, /grouped\.get\(summary\.scenarioId\)/);
  assert.match(pageSource, /attemptNumber: index \+ 1/);
  assert.match(pageSource, /method: "PATCH"/);
  assert.match(pageSource, /retryFromBranchId/);
  assert.match(pageSource, /branch\.branchName \?\?/);
  assert.match(outcomeSource, /从 W\$\{comparison\.forkWeek\} 重新尝试 · 新建 V6 分支/);
  assert.match(cssSource, /\.lab-v2-branch-history-group/);
  assert.doesNotMatch(cssSource, /\.lab-v2-branch-history-list > button/);
});
