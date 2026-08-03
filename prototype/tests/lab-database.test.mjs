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
    new Request("http://localhost/api/lab/cases/car-control/v1/branches", requestInit),
    env,
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.equal(firstBody.branch.currentWeek, 17);
  assert.equal(firstBody.initialState.scenario.id, "scenario-2");

  const replay = await worker.fetch(
    new Request("http://localhost/api/lab/cases/car-control/v1/branches", requestInit),
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
  ]) {
    const count = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
    assert.equal(count, 1, `${table} should contain exactly one idempotent record`);
  }
  database.close();
});
