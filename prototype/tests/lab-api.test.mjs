import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("lab-api-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

function createEnv({ identityKey = "oai-user:user-123", contentHash = "", currentWeek = 9 } = {}) {
  const branch = {
    id: "branch-1",
    caseId: "car-control",
    caseVersion: "v1",
    contentHash,
    currentWeek,
    currentRoundNumber: 1,
    status: "active",
  };
  const events = [
    {
      eventType: "scenario_material_viewed",
      payloadJson: JSON.stringify({ scenarioId: "scenario-1", materialId: "S1-M01" }),
    },
    {
      eventType: "scenario_cards_unlocked",
      payloadJson: JSON.stringify({ scenarioId: "scenario-1", cardsUnlocked: true }),
    },
  ];

  return {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DB: {
      prepare(query) {
        let bindings = [];
        return {
          bind(...values) {
            bindings = values;
            return this;
          },
          async first() {
            if (!query.includes("FROM lab_branches")) return null;
            return bindings[0] === branch.id && bindings[1] === identityKey ? branch : null;
          },
          async all() {
            if (!query.includes("FROM lab_events")) return { results: [] };
            return { results: bindings[0] === branch.id ? events : [] };
          },
        };
      },
    },
  };
}

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

async function request(path, options = {}, env = createEnv()) {
  return worker.fetch(new Request(`http://localhost${path}`, options), env, executionContext);
}

test("serves a public case manifest without private scenario content", async () => {
  const response = await request("/api/lab/cases/car-control/v1");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /^public,/);
  const body = await response.json();
  assert.equal(body.totalWeeks, 32);
  assert.equal(body.takeoverPoints.length, 3);
  assert.equal(body.takeoverPoints[0].label, "从这里接手");
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /minimumCorrectCardIds|necessaryManagementActions|试点车主反馈/);
});

test("filters public mainline data by section and week", async () => {
  const response = await request("/api/lab/cases/car-control/v1/mainline?week=9&sections=baselineWorkload,documents");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.sections.baselineWorkload.weeks.map((item) => item.week), [9]);
  assert.ok(body.sections.documents.documents.every((document) => document.createdWeek <= 9));
  assert.ok(body.sections.documents.mainlineEvents.every((event) => event.week <= 9));
});

test("reports platform session state without exposing the identity key", async () => {
  const response = await request("/api/lab/session", {
    headers: {
      "oai-authenticated-user-id": "user-123",
      "oai-authenticated-user-email": "IMAN@example.com",
      "oai-authenticated-user-full-name": encodeURIComponent("Iman 测试"),
      "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    authenticated: true,
    displayName: "Iman 测试",
    email: "iman@example.com",
    identitySource: "platform_user_id",
  });
  assert.equal(JSON.stringify(body).includes("oai-user:user-123"), false);
});

test("uses an email hash fallback when the stable platform id is absent", async () => {
  const response = await request("/api/lab/session", {
    headers: { "oai-authenticated-user-email": "Iman@example.com" },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.identitySource, "email_hash_fallback");
  assert.equal(JSON.stringify(body).includes("sha256"), false);
});

test("rejects protected scenario reads without platform identity", async () => {
  const response = await request("/api/lab/branches/branch-1/scenarios/scenario-1/projection");
  assert.equal(response.status, 401);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("validates branch ownership and strips scenario scoring fields", async () => {
  const manifestResponse = await request("/api/lab/cases/car-control/v1");
  const manifest = await manifestResponse.json();
  const env = createEnv({ contentHash: manifest.contentHash });
  const response = await request("/api/lab/branches/branch-1/scenarios/scenario-1/projection", {
    headers: {
      "oai-authenticated-user-id": "user-123",
      "oai-authenticated-user-email": "iman@example.com",
    },
  }, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.scenario.eventMaterials.primaryClues.map((item) => item.id), ["S1-M01"]);
  assert.ok(body.scenario.cards.length > 0);
  const serializedCards = JSON.stringify(body.scenario.cards);
  assert.doesNotMatch(serializedCards, /satisfiesActionIds|evaluationRole|consequenceId|managementLoad/);
});

test("does not reveal whether another user's branch exists", async () => {
  const manifestResponse = await request("/api/lab/cases/car-control/v1");
  const manifest = await manifestResponse.json();
  const env = createEnv({ identityKey: "oai-user:owner", contentHash: manifest.contentHash });
  const response = await request("/api/lab/branches/branch-1/scenarios/scenario-1/projection", {
    headers: {
      "oai-authenticated-user-id": "intruder",
      "oai-authenticated-user-email": "intruder@example.com",
    },
  }, env);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "BRANCH_NOT_FOUND");
});
