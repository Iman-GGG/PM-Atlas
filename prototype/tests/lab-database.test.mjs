import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("lab-database-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

function createD1Adapter(database) {
  return {
    prepare(query) {
      const statement = database.prepare(query);
      let bindings = [];
      return {
        bind(...values) {
          bindings = values;
          return this;
        },
        async first() {
          return statement.get(...bindings) ?? null;
        },
        async all() {
          return { results: statement.all(...bindings) };
        },
        async run() {
          statement.run(...bindings);
          return { results: [] };
        },
      };
    },
    async batch(statements) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

test("persists an idempotent takeover branch against the real migration", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  const migrationDirectory = new URL("../drizzle/", import.meta.url);
  const migrationFiles = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
  for (const migrationFile of migrationFiles) {
    const migration = await readFile(new URL(migrationFile, migrationDirectory), "utf8");
    database.exec(migration.replaceAll("--> statement-breakpoint", ""));
  }
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DB: createD1Adapter(database),
    ANALYTICS_ADMIN_EMAILS: "database@example.com",
  };
  const authHeaders = {
    "oai-authenticated-user-id": "database-user",
    "oai-authenticated-user-email": "database@example.com",
  };
  const session = await worker.fetch(
    new Request("http://localhost/api/lab/session", { headers: authHeaders }),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(session.status, 200);
  assert.equal((await session.json()).analyticsAdmin, true);
  const requestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-id": "database-user",
      "oai-authenticated-user-email": "database@example.com",
    },
    body: JSON.stringify({ scenarioId: "scenario-2", idempotencyKey: "database-takeover-001" }),
  };

  const first = await worker.fetch(
    new Request("http://localhost/api/lab/cases/car-control/v5/branches", requestInit),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.equal(firstBody.branch.currentWeek, 17);
  assert.equal(firstBody.initialState.scenario.id, "scenario-2");

  const materialsPath = `/api/lab/branches/${firstBody.branch.id}/scenarios/scenario-2/materials`;
  const materials = await worker.fetch(
    new Request(`http://localhost${materialsPath}`, { headers: authHeaders }),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(materials.status, 200);
  const materialsBody = await materials.json();
  assert.equal(materialsBody.totalCount, 5);
  assert.equal(materialsBody.openedCount, 0);
  assert.equal(JSON.stringify(materialsBody).includes("完整接口预计延期3周"), false);

  let finalMaterialBody;
  for (const materialId of ["S2-M01", "S2-M02", "S2-M03", "S2-M04", "S2-M05"]) {
    const opened = await worker.fetch(
      new Request(`http://localhost${materialsPath}/${materialId}/view`, {
        method: "POST",
        headers: authHeaders,
      }),
      env,
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(opened.status, 200);
    finalMaterialBody = await opened.json();
  }
  assert.equal(finalMaterialBody.cardsUnlocked, true);
  assert.ok(finalMaterialBody.cards.length >= 12);
  assert.doesNotMatch(JSON.stringify(finalMaterialBody.cards), /satisfiesActionIds|evaluationRole|consequenceId/);
  assert.doesNotMatch(JSON.stringify(finalMaterialBody.cards), /execution_action/);

  const reopened = await worker.fetch(
    new Request(`http://localhost${materialsPath}/S2-M05/view`, {
      method: "POST",
      headers: authHeaders,
    }),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(reopened.status, 200);

  const draftPath = `/api/lab/branches/${firstBody.branch.id}/scenarios/scenario-2/draft`;
  const draft = {
    expectedRoundNumber: 1,
    actionChains: [{
      id: "chain-supplier-delay",
      title: "评估供应商延期并制定恢复计划",
      documentCardIds: ["S2-C02"],
      toolTechniqueCardIds: ["S2-C05"],
      stakeholderCardIds: ["S2-C10"],
    }],
  };
  const savedDraft = await worker.fetch(
    new Request(`http://localhost${draftPath}`, {
      method: "PUT",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify(draft),
    }),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(savedDraft.status, 200);
  const restoredDraft = await worker.fetch(
    new Request(`http://localhost${draftPath}`, { headers: authHeaders }),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(restoredDraft.status, 200);
  assert.deepEqual((await restoredDraft.json()).actionChains, draft.actionChains);

  const roundPath = `/api/lab/branches/${firstBody.branch.id}/rounds`;
  const submitted = await worker.fetch(
    new Request(`http://localhost${roundPath}`, {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        ...draft,
        scenarioId: "scenario-2",
        idempotencyKey: "database-round-001",
      }),
    }),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(submitted.status, 201);
  const submittedBody = await submitted.json();
  assert.equal(submittedBody.roundNumber, 1);
  assert.equal(submittedBody.advancedToWeek, 18);
  assert.equal(submittedBody.scenarioState, "open");
  assert.ok(submittedBody.gaps.length > 0);
  assert.equal(JSON.stringify(submittedBody).includes("minimumCorrectCardIds"), false);

  const roundReplay = await worker.fetch(
    new Request(`http://localhost${roundPath}`, {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        ...draft,
        scenarioId: "scenario-2",
        idempotencyKey: "database-round-001",
      }),
    }),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(roundReplay.status, 200);
  assert.equal((await roundReplay.json()).idempotentReplay, true);

  const replay = await worker.fetch(
    new Request("http://localhost/api/lab/cases/car-control/v5/branches", requestInit),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).idempotentReplay, true);

  const userId = database.prepare("SELECT id FROM lab_users WHERE identity_key = ?").get("oai-user:database-user").id;
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const eventDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  database.prepare(`
    INSERT INTO lab_analytics_events (id, user_id, event_type, event_date, branch_id, scenario_id, metadata_json)
    VALUES (?, ?, 'ai_review_requested', ?, ?, 'scenario-2', '{}')
  `).run("analytics-test-ai-request", userId, eventDate, firstBody.branch.id);

  const analytics = await worker.fetch(
    new Request("http://localhost/api/analytics/summary?days=30", { headers: authHeaders }),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(analytics.status, 200);
  const analyticsBody = await analytics.json();
  assert.equal(analyticsBody.identifiedUsers, 1);
  assert.equal(analyticsBody.authenticatedVisitors, 1);
  assert.equal(analyticsBody.authenticatedVisitorsInRange, 1);
  assert.equal(analyticsBody.todayActiveUsers, 1);
  assert.equal(analyticsBody.branchCreators, 1);
  assert.equal(analyticsBody.aiReviewRequests, 1);
  assert.equal(analyticsBody.materialViews.length, 5);
  const lastMaterial = analyticsBody.materialViews.find((item) => item.materialId === "S2-M05");
  assert.equal(lastMaterial.views, 1, "reopening a material must not inflate its first-open count");
  assert.equal(lastMaterial.scenarioTitle, "供应商接口延期与核心工程师临时抽调");

  const forbiddenAnalytics = await worker.fetch(
    new Request("http://localhost/api/analytics/summary", {
      headers: { "oai-authenticated-user-email": "viewer@example.com" },
    }),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(forbiddenAnalytics.status, 403);
  const anonymousAnalytics = await worker.fetch(
    new Request("http://localhost/api/analytics/summary"),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(anonymousAnalytics.status, 401);

  for (const table of [
    "lab_users",
    "lab_case_versions",
    "lab_progress",
    "lab_branches",
    "lab_state_snapshots",
    "lab_events",
    "lab_round_drafts",
    "lab_round_submissions",
    "lab_user_activity_days",
    "lab_analytics_events",
  ]) {
    const count = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
    const expected = table === "lab_events"
      ? 8
      : table === "lab_state_snapshots" ? 2 : table === "lab_round_drafts" ? 0 : 1;
    assert.equal(count, expected, `${table} should contain the expected idempotent records`);
  }
  database.close();
});

test("backfills one analytics request for each historical AI review", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  const baseMigration = await readFile(new URL("../drizzle/0000_lab_mvp.sql", import.meta.url), "utf8");
  database.exec(baseMigration.replaceAll("--> statement-breakpoint", ""));

  database.prepare("INSERT INTO lab_users (id, identity_key, display_name) VALUES (?, ?, ?)")
    .run("legacy-user", "oai-user:legacy", "Legacy User");
  database.prepare("INSERT INTO lab_case_versions (case_id, case_version, content_hash) VALUES (?, ?, ?)")
    .run("car-control", "v4", "legacy-content-hash");
  database.prepare(`
    INSERT INTO lab_branches (id, user_id, case_id, case_version, fork_week, current_week, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run("legacy-branch", "legacy-user", "car-control", "v4", 9, 10, "completed");
  database.prepare(`
    INSERT INTO lab_ai_reviews (
      id, branch_id, scenario_id, review_kind, status, state_hash,
      review_json, model_ref, prompt_version, created_at, updated_at
    ) VALUES (?, ?, ?, 'scenario', 'completed', ?, '{}', 'deepseek-chat', 'v1', ?, ?)
  `).run("legacy-review", "legacy-branch", "scenario-1", "legacy-state-hash", "2026-08-04 16:30:00", "2026-08-04 16:30:00");

  const analyticsMigration = await readFile(new URL("../drizzle/0001_mighty_invisible_woman.sql", import.meta.url), "utf8");
  database.exec(analyticsMigration.replaceAll("--> statement-breakpoint", ""));
  const event = database.prepare(`
    SELECT user_id AS userId, event_type AS eventType, event_date AS eventDate,
      branch_id AS branchId, scenario_id AS scenarioId, metadata_json AS metadataJson
    FROM lab_analytics_events
  `).get();
  assert.deepEqual({ ...event }, {
    userId: "legacy-user",
    eventType: "ai_review_requested",
    eventDate: "2026-08-05",
    branchId: "legacy-branch",
    scenarioId: "scenario-1",
    metadataJson: '{"source":"historical_review"}',
  });
  database.close();
});
