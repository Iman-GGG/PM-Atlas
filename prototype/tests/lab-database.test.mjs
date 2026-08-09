import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  const migration = await readFile(new URL("../drizzle/0000_lab_mvp.sql", import.meta.url), "utf8");
  database.exec(migration.replaceAll("--> statement-breakpoint", ""));
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DB: createD1Adapter(database),
  };
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
    new Request("http://localhost/api/lab/cases/car-control/v3/branches", requestInit),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.equal(firstBody.branch.currentWeek, 17);
  assert.equal(firstBody.initialState.scenario.id, "scenario-2");

  const authHeaders = {
    "oai-authenticated-user-id": "database-user",
    "oai-authenticated-user-email": "database@example.com",
  };
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
    reasoning: {
      observedSignals: "供应商接口交付与工程师可用性同时发生偏差。",
      riskOrRootCause: "外部依赖和关键资源冲突可能共同影响关键路径。",
      actionRationale: "通过联合排障、分阶段交付和责任人协作维持并行开发节奏。",
      references: [
        { type: "event_material", id: "S2-M01" },
        { type: "project_document", id: "D14" },
      ],
    },
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
    new Request("http://localhost/api/lab/cases/car-control/v3/branches", requestInit),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).idempotentReplay, true);

  for (const table of [
    "lab_users",
    "lab_case_versions",
    "lab_progress",
    "lab_branches",
    "lab_state_snapshots",
    "lab_events",
    "lab_round_drafts",
    "lab_round_submissions",
  ]) {
    const count = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
    const expected = table === "lab_events"
      ? 8
      : table === "lab_state_snapshots" ? 2 : table === "lab_round_drafts" ? 0 : 1;
    assert.equal(count, expected, `${table} should contain the expected idempotent records`);
  }
  database.close();
});
