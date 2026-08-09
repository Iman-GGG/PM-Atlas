import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("lab-api-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

function createEnv({
  identityKey = "oai-user:user-123",
  contentHash = "",
  currentWeek = 9,
  includeExistingBranch = true,
} = {}) {
  const branch = {
    id: "branch-1",
    caseId: "car-control",
    caseVersion: "v4",
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

  const state = {
    branches: new Map(includeExistingBranch ? [[branch.id, { ...branch, identityKey }]] : []),
    caseVersions: new Map(contentHash ? [["car-control:v4", contentHash]] : []),
    users: new Map(),
    events: includeExistingBranch ? [...events] : [],
    snapshots: [],
    progress: [],
    drafts: new Map(),
  };

  function prepare(query) {
    let bindings = [];
    return {
      query,
      get bindings() {
        return bindings;
      },
      bind(...values) {
        bindings = values;
        return this;
      },
      async first() {
        if (query.includes("FROM lab_case_versions")) {
          const storedHash = state.caseVersions.get(`${bindings[0]}:${bindings[1]}`);
          return storedHash ? { contentHash: storedHash } : null;
        }
        if (query.includes("FROM lab_users")) {
          const user = state.users.get(bindings[0]);
          return user ? { id: user.id } : null;
        }
        if (query.includes("FROM lab_branches")) {
          const storedBranch = state.branches.get(bindings[0]);
          return storedBranch?.identityKey === bindings[1] ? storedBranch : null;
        }
        if (query.includes("FROM lab_round_drafts")) {
          return state.drafts.get(`${bindings[0]}:${bindings[1]}`) ?? null;
        }
        return null;
      },
      async all() {
        if (!query.includes("FROM lab_events")) return { results: [] };
        return {
          results: state.events
            .filter((event) => event.branchId === undefined || event.branchId === bindings[0])
            .map(({ eventType, payloadJson }) => ({ eventType, payloadJson })),
        };
      },
      async run() {
        applyStatement(this);
        return { results: [] };
      },
    };
  }

  function applyStatement(statement) {
    const { query, bindings } = statement;
    if (query.includes("INSERT INTO lab_case_versions")) {
      if (!state.caseVersions.has(`${bindings[0]}:${bindings[1]}`)) {
        state.caseVersions.set(`${bindings[0]}:${bindings[1]}`, bindings[2]);
      }
    } else if (query.includes("INSERT INTO lab_users")) {
      state.users.set(bindings[1], { id: bindings[0], displayName: bindings[2] });
    } else if (query.includes("INSERT INTO lab_progress")) {
      state.progress.push({ id: bindings[0], userId: bindings[1], highestUnlockedWeek: bindings[4] });
    } else if (query.includes("INSERT OR IGNORE INTO lab_branches")) {
      if (!state.branches.has(bindings[0])) {
        const caseHash = state.caseVersions.get(`${bindings[2]}:${bindings[3]}`);
        state.branches.set(bindings[0], {
          id: bindings[0],
          identityKey,
          caseId: bindings[2],
          caseVersion: bindings[3],
          contentHash: caseHash,
          currentWeek: bindings[5],
          currentRoundNumber: 0,
          status: "active",
        });
      }
    } else if (query.includes("INSERT OR IGNORE INTO lab_state_snapshots")) {
      state.snapshots.push({
        id: bindings[0],
        branchId: bindings[1],
        week: bindings[2],
        scenarioId: bindings[3],
        stateJson: bindings[4],
        stateHash: bindings[5],
      });
    } else if (query.includes("INSERT OR IGNORE INTO lab_events")) {
      if (state.events.some((event) => event.id === bindings[0])) return;
      const isScenarioStarted = query.includes("'scenario_started'");
      const isMaterialViewed = query.includes("'scenario_material_viewed'");
      state.events.push({
        id: bindings[0],
        branchId: bindings[1],
        week: bindings[isScenarioStarted ? 2 : 3],
        eventType: isScenarioStarted
          ? "scenario_started"
          : isMaterialViewed
            ? "scenario_material_viewed"
            : "scenario_cards_unlocked",
        payloadJson: bindings[isScenarioStarted ? 3 : 4],
      });
    } else if (query.includes("INSERT INTO lab_round_drafts")) {
      state.drafts.set(`${bindings[1]}:${bindings[2]}`, {
        id: bindings[0],
        branchId: bindings[1],
        roundNumber: bindings[2],
        scenarioId: bindings[3],
        selectedCardIdsJson: bindings[4],
        connectionsJson: bindings[5],
        reasoningJson: bindings[6],
        updatedAt: "2026-08-04 12:00:00",
      });
    }
  }

  return {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    __state: state,
    DB: {
      prepare,
      async batch(statements) {
        statements.forEach(applyStatement);
        return statements.map(() => ({ results: [] }));
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
  const response = await request("/api/lab/cases/car-control/v4");
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
  const response = await request("/api/lab/cases/car-control/v4/mainline?week=9&sections=baselineWorkload,documents");
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

test("creates an idempotent branch from a configured takeover point", async () => {
  const env = createEnv({ includeExistingBranch: false });
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-id": "user-123",
      "oai-authenticated-user-email": "iman@example.com",
    },
    body: JSON.stringify({ scenarioId: "scenario-1", idempotencyKey: "takeover-test-001" }),
  };
  const response = await request("/api/lab/cases/car-control/v4/branches", options, env);
  assert.equal(response.status, 201);
  assert.match(response.headers.get("location") ?? "", /^\/api\/lab\/branches\/branch-/);
  const body = await response.json();
  assert.equal(body.branch.currentWeek, 9);
  assert.equal(body.scenario.id, "scenario-1");
  assert.equal(body.scenario.availableMaterialCount, 5);
  assert.equal(body.scenario.cardsUnlocked, false);
  assert.equal(body.initialState.scenario.initialImpact.forecastCompletionWeek, 32);
  assert.equal(env.__state.branches.size, 1);
  assert.equal(env.__state.snapshots.length, 1);
  assert.equal(env.__state.events.length, 1);
  assert.equal(env.__state.progress[0].highestUnlockedWeek, 9);

  const replay = await request("/api/lab/cases/car-control/v4/branches", options, env);
  assert.equal(replay.status, 200);
  const replayBody = await replay.json();
  assert.equal(replayBody.branch.id, body.branch.id);
  assert.equal(replayBody.idempotentReplay, true);
  assert.equal(env.__state.branches.size, 1);
  assert.equal(env.__state.snapshots.length, 1);

  const projection = await request(response.headers.get("location"), {
    headers: {
      "oai-authenticated-user-id": "user-123",
      "oai-authenticated-user-email": "iman@example.com",
    },
  }, env);
  assert.equal(projection.status, 200);
  const projectionBody = await projection.json();
  assert.equal(projectionBody.scenario.title, "试点车主反馈引发的需求变更");
  assert.deepEqual(projectionBody.scenario.cards, []);
  assert.deepEqual(projectionBody.scenario.eventMaterials.primaryClues, []);

  const materialsResponse = await request(
    `/api/lab/branches/${body.branch.id}/scenarios/scenario-1/materials`,
    {
      headers: {
        "oai-authenticated-user-id": "user-123",
        "oai-authenticated-user-email": "iman@example.com",
      },
    },
    env,
  );
  assert.equal(materialsResponse.status, 200);
  const materialsBody = await materialsResponse.json();
  assert.equal(materialsBody.totalCount, 5);
  assert.equal(materialsBody.openedCount, 0);
  assert.equal(materialsBody.materials[0].title, "家庭成员临时用车时无法查看车辆状态");
  assert.equal(JSON.stringify(materialsBody).includes("希望允许家庭成员共享车辆"), false);

  const openedResponse = await request(
    `/api/lab/branches/${body.branch.id}/scenarios/scenario-1/materials/S1-M01/view`,
    {
      method: "POST",
      headers: {
        "oai-authenticated-user-id": "user-123",
        "oai-authenticated-user-email": "iman@example.com",
      },
    },
    env,
  );
  assert.equal(openedResponse.status, 200);
  const openedBody = await openedResponse.json();
  assert.deepEqual(openedBody.material.facts, ["配偶临时用车时无法查看车辆状态", "希望允许家庭成员共享车辆"]);
  assert.equal(openedBody.cardsUnlocked, false);
});

test("creates a v4 branch when an immutable v3 case record already exists", async () => {
  const env = createEnv({ includeExistingBranch: false });
  env.__state.caseVersions.set("car-control:v3", "legacy-v3-content-hash");

  const response = await request("/api/lab/cases/car-control/v4/branches", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-id": "user-123",
      "oai-authenticated-user-email": "iman@example.com",
    },
    body: JSON.stringify({ scenarioId: "scenario-1", idempotencyKey: "takeover-version-004" }),
  }, env);

  assert.equal(response.status, 201);
  assert.equal((await response.json()).branch.caseVersion, "v4");
  assert.equal(env.__state.caseVersions.get("car-control:v3"), "legacy-v3-content-hash");
});

test("requires login and a valid takeover request when creating a branch", async () => {
  const anonymous = await request("/api/lab/cases/car-control/v4/branches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId: "scenario-1", idempotencyKey: "takeover-test-002" }),
  }, createEnv({ includeExistingBranch: false }));
  assert.equal(anonymous.status, 401);

  const invalid = await request("/api/lab/cases/car-control/v4/branches", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-id": "user-123",
      "oai-authenticated-user-email": "iman@example.com",
    },
    body: JSON.stringify({ scenarioId: "scenario-1", idempotencyKey: "short" }),
  }, createEnv({ includeExistingBranch: false }));
  assert.equal(invalid.status, 400);
});

test("validates branch ownership and strips scenario scoring fields", async () => {
  const manifestResponse = await request("/api/lab/cases/car-control/v4");
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
  assert.doesNotMatch(serializedCards, /execution_action/);
});

test("does not reveal whether another user's branch exists", async () => {
  const manifestResponse = await request("/api/lab/cases/car-control/v4");
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

test("reads and autosaves an owned action-chain draft", async () => {
  const manifestResponse = await request("/api/lab/cases/car-control/v4");
  const manifest = await manifestResponse.json();
  const env = createEnv({ contentHash: manifest.contentHash });
  const path = "/api/lab/branches/branch-1/scenarios/scenario-1/draft";
  const headers = {
    "content-type": "application/json",
    "oai-authenticated-user-id": "user-123",
    "oai-authenticated-user-email": "iman@example.com",
  };

  const emptyResponse = await request(path, { headers }, env);
  assert.equal(emptyResponse.status, 200);
  const emptyDraft = await emptyResponse.json();
  assert.equal(emptyDraft.roundNumber, 2);
  assert.deepEqual(emptyDraft.actionChains, []);

  const actionChains = [{
    id: "chain-scope-review",
    title: "确认需求范围并形成评审方案",
    documentCardIds: ["S1-C02"],
    toolTechniqueCardIds: ["S1-C05"],
    stakeholderCardIds: ["S1-C10"],
  }];
  const savedResponse = await request(path, {
    method: "PUT",
    headers,
    body: JSON.stringify({ expectedRoundNumber: 2, actionChains }),
  }, env);
  assert.equal(savedResponse.status, 200);
  assert.equal(env.__state.drafts.size, 1);

  const restoredResponse = await request(path, { headers }, env);
  assert.equal(restoredResponse.status, 200);
  const restoredDraft = await restoredResponse.json();
  assert.deepEqual(restoredDraft.actionChains, actionChains);
  assert.equal("reasoning" in restoredDraft, false);

  const invalidResponse = await request(path, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      expectedRoundNumber: 2,
      actionChains: [{ ...actionChains[0], stakeholderCardIds: ["S1-C05"] }],
    }),
  }, env);
  assert.equal(invalidResponse.status, 400);
  assert.equal((await invalidResponse.json()).error.code, "INVALID_ACTION_CHAIN");
});
