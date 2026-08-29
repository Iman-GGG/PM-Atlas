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
  caseVersion = "v5",
  documentDeltas = [],
  snapshots = [],
  roundSubmissions = [],
  currentRoundNumber = 1,
  branchStatus = "active",
  outcomeClassification = null,
} = {}) {
  const branch = {
    id: "branch-1",
    caseId: "car-control",
    caseVersion,
    contentHash,
    parentBranchId: null,
    branchName: null,
    currentWeek,
    currentRoundNumber,
    status: branchStatus,
    forkWeek: 9,
    scenarioId: "scenario-1",
    outcomeClassification,
    createdAt: "2026-08-04 12:00:00",
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
    caseVersions: new Map(contentHash ? [[`car-control:${caseVersion}`, contentHash]] : []),
    users: new Map(),
    events: includeExistingBranch ? [...events] : [],
    snapshots: [...snapshots],
    roundSubmissions: [...roundSubmissions],
    progress: [],
    drafts: new Map(),
    documentDeltas: [...documentDeltas],
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
        if (query.includes("FROM lab_state_snapshots")) {
          return state.snapshots.find((snapshot) => snapshot.branchId === bindings[0] && snapshot.roundNumber === bindings[1]) ?? null;
        }
        return null;
      },
      async all() {
        if (query.includes("FROM lab_state_snapshots snapshots")) {
          return {
            results: state.snapshots
              .filter((snapshot) => snapshot.branchId === bindings[0])
              .sort((left, right) => left.roundNumber - right.roundNumber)
              .map((snapshot) => {
                const submission = state.roundSubmissions.find((item) => item.branchId === snapshot.branchId && item.roundNumber === snapshot.roundNumber);
                return { ...snapshot, ruleResultJson: submission?.ruleResultJson ?? null, submittedAt: submission?.submittedAt ?? null };
              }),
          };
        }
        if (query.includes("FROM lab_document_deltas")) {
          return {
            results: state.documentDeltas.filter((delta) => (
              delta.branchId === bindings[0]
              && (bindings.length < 2 || delta.documentId === bindings[1])
            )),
          };
        }
        if (query.includes("LEFT JOIN lab_events")) {
          const storedBranch = state.branches.get(bindings[0]);
          if (!storedBranch || storedBranch.identityKey !== bindings[1]) return { results: [] };
          const matchingEvents = state.events.filter((event) => event.branchId === undefined || event.branchId === storedBranch.id);
          return {
            results: matchingEvents.length > 0
              ? matchingEvents.map(({ eventType, payloadJson }) => ({ ...storedBranch, eventType, payloadJson }))
              : [{ ...storedBranch, eventType: null, payloadJson: null }],
          };
        }
        if (query.includes("FROM lab_branches b") && query.includes("INNER JOIN lab_state_snapshots initial")) {
          return { results: [...state.branches.values()].filter((item) => (
            item.identityKey === bindings[0]
            && item.caseId === bindings[1]
            && (bindings.length < 3 || item.caseVersion === bindings[2])
          )) };
        }
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
          parentBranchId: bindings[4],
          branchName: bindings[5],
          forkWeek: bindings[6],
          currentWeek: bindings[7],
          currentRoundNumber: 0,
          lockVersion: 0,
          status: "active",
        });
      }
    } else if (query.includes("UPDATE lab_branches") && query.includes("SET branch_name")) {
      const storedBranch = state.branches.get(bindings[1]);
      if (storedBranch?.identityKey === bindings[2]) state.branches.set(bindings[1], { ...storedBranch, branchName: bindings[0] });
    } else if (query.includes("INSERT OR IGNORE INTO lab_state_snapshots")) {
      state.snapshots.push({
        id: bindings[0],
        branchId: bindings[1],
        roundNumber: 0,
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
  const response = await request("/api/lab/cases/car-control/v5");
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
  const response = await request("/api/lab/cases/car-control/v5/mainline?week=9&sections=baselineWorkload,documents");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.sections.baselineWorkload.weeks.map((item) => item.week), [9]);
  assert.ok(body.sections.documents.documents.every((document) => document.createdWeek <= 9));
  assert.ok(body.sections.documents.mainlineEvents.every((event) => event.week <= 9));

  const stakeholderResponse = await request("/api/lab/cases/car-control/v5/mainline?week=1&sections=stakeholders");
  assert.equal(stakeholderResponse.status, 200);
  const stakeholderBody = await stakeholderResponse.json();
  assert.equal(stakeholderBody.sections.stakeholders.stakeholders.length, 13);
  assert.equal(stakeholderBody.sections.stakeholders.stakeholders.some((stakeholder) => stakeholder.id === "vehicle_vendor_pm"), false);
  assert.equal(stakeholderBody.sections.stakeholders.stakeholders.some((stakeholder) => stakeholder.id === "security_vendor"), false);
  assert.ok(stakeholderBody.sections.stakeholders.mainlineEngagementEvents.every((event) => event.week <= 1));
});

test("serves a frozen historical manifest and mainline from the matching package", async () => {
  const frozenHash = "c85e10f6076226cc22b98b0f616f149593ba6508587822d902caf291bdddf353";
  const manifestResponse = await request("/api/lab/cases/car-control/v4");
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.caseVersion, "v4");
  assert.equal(manifest.contentHash, frozenHash);

  const mainlineResponse = await request("/api/lab/cases/car-control/v4/mainline?week=9&sections=baselineWorkload,documents");
  assert.equal(mainlineResponse.status, 200);
  const mainline = await mainlineResponse.json();
  assert.equal(mainline.caseVersion, "v4");
  assert.equal(mainline.contentHash, frozenHash);
  assert.deepEqual(mainline.sections.baselineWorkload.weeks.map((item) => item.week), [9]);
  assert.ok(mainline.sections.documents.documents.every((document) => document.createdWeek <= 9));
});

test("lists the signed-in user's scenario branches for switching", async () => {
  const currentManifest = await (await request("/api/lab/cases/car-control/v5")).json();
  const env = createEnv({ contentHash: currentManifest.contentHash });
  const response = await request("/api/lab/cases/car-control/branches", {
    headers: { "oai-authenticated-user-id": "user-123", "oai-authenticated-user-email": "iman@example.com" },
  }, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.branches.length, 1);
  assert.equal(body.branches[0].scenarioId, "scenario-1");
  assert.equal(body.branches[0].forkWeek, 9);
});

test("merges signed-in branch history across frozen v1-v4 and current v5", async () => {
  const currentManifest = await (await request("/api/lab/cases/car-control/v5")).json();
  const env = createEnv({ contentHash: currentManifest.contentHash });
  const historicalHashes = {
    v1: "60e75a09b7043b00d18401ab272fe98536348adef8769ab38130a9a99af0466d",
    v2: "f2b85b61f1a727785c5e1043be4f2eba77bdc6059920ace1996d1cba50d0eccd",
    v3: "e2ef46b6e929a4303d1d43f8478c0169d3371991ef8756a61af4d3de28d70847",
    v4: "c85e10f6076226cc22b98b0f616f149593ba6508587822d902caf291bdddf353",
  };
  for (const [version, contentHash] of Object.entries(historicalHashes)) {
    env.__state.branches.set(`branch-${version}`, {
      ...env.__state.branches.get("branch-1"),
      id: `branch-${version}`,
      caseVersion: version,
      contentHash,
    });
  }

  const response = await request("/api/lab/cases/car-control/branches", {
    headers: { "oai-authenticated-user-id": "user-123", "oai-authenticated-user-email": "iman@example.com" },
  }, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual([...new Set(body.branches.map((branch) => branch.caseVersion))].sort(), ["v1", "v2", "v3", "v4", "v5"]);
});

test("loads a historical v4 branch only through its exact frozen content hash", async () => {
  const frozenHash = "c85e10f6076226cc22b98b0f616f149593ba6508587822d902caf291bdddf353";
  const headers = { "oai-authenticated-user-id": "user-123", "oai-authenticated-user-email": "iman@example.com" };
  const supported = createEnv({ caseVersion: "v4", contentHash: frozenHash });
  const response = await request("/api/lab/branches/branch-1/scenarios/scenario-1/projection", { headers }, supported);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.caseVersion, "v4");
  assert.equal(body.contentHash, frozenHash);
  assert.equal(body.scenario.title, "试点车主反馈引发的需求变更");

  const mismatched = createEnv({ caseVersion: "v4", contentHash: "mutated-v4-hash" });
  const rejected = await request("/api/lab/branches/branch-1/scenarios/scenario-1/projection", { headers }, mismatched);
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).error.code, "CASE_VERSION_MISMATCH");
});

test("returns same-week mainline and branch values for each changed document field", async () => {
  const manifest = await (await request("/api/lab/cases/car-control/v5")).json();
  const env = createEnv({
    contentHash: manifest.contentHash,
    currentWeek: 26,
    documentDeltas: [{
      branchId: "branch-1",
      documentId: "D16",
      roundNumber: 1,
      week: 26,
      reason: "round_settlement",
      patchJson: JSON.stringify([
        { op: "add", path: "/branchMeta/lastSettlementWeek", value: 26 },
        { op: "replace", path: "/scopeBaseline/version", value: "1.1-branch" },
        { op: "replace", path: "/productScope/PSC-03/status", value: "deferred_from_v1_0" },
        { op: "replace", path: "/productScope/PSC-02/status", value: "baselined_included" },
        { op: "add", path: "/scopeExclusions/EX-05/status", value: "active" },
      ]),
    }],
  });
  const response = await request("/api/lab/branches/branch-1/documents/D16", {
    headers: { "oai-authenticated-user-id": "user-123", "oai-authenticated-user-email": "iman@example.com" },
  }, env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const body = await response.json();
  const byPath = new Map(body.fields.map((field) => [field.path, field]));
  assert.equal(byPath.get("/scopeBaseline/version").mainline.value, "1.0");
  assert.equal(byPath.get("/scopeBaseline/version").branch.value, "1.1-branch");
  assert.equal(byPath.get("/scopeExclusions/EX-05/status").changeType, "added");
  assert.equal(byPath.has("/productScope/PSC-02/status"), false);
  assert.deepEqual(body.summary, { added: 1, modified: 2, removed: 0 });

  const afterW32 = createEnv({
    contentHash: manifest.contentHash,
    currentWeek: 33,
    documentDeltas: [{
      branchId: "branch-1",
      documentId: "D28",
      roundNumber: 2,
      week: 33,
      reason: "round_settlement",
      patchJson: JSON.stringify([{ op: "replace", path: "/progress/dataDateWeek", value: 33 }]),
    }],
  });
  const afterResponse = await request("/api/lab/branches/branch-1/documents/D28", {
    headers: { "oai-authenticated-user-id": "user-123", "oai-authenticated-user-email": "iman@example.com" },
  }, afterW32);
  const afterBody = await afterResponse.json();
  assert.deepEqual([afterBody.mainlineWeek, afterBody.branchWeek], [32, 33]);
  assert.equal(afterBody.fields[0].mainline.value, 32);
  assert.equal(afterBody.fields[0].branch.value, 33);
});

test("returns a deterministic multi-round Git-style branch path without private rule data", async () => {
  const manifest = await (await request("/api/lab/cases/car-control/v5")).json();
  const pathState = (week, spi, cpi, forecastCompletionWeek, status, outcome = null) => JSON.stringify({
    week,
    scenario: { id: "scenario-1", status },
    performance: { spi, cpi, forecastCompletionWeek },
    totals: {},
    governance: {},
    riskTransitions: [],
    stakeholderTransitions: [],
    documentRevisions: [],
    outcomeClassification: outcome,
  });
  const env = createEnv({
    contentHash: manifest.contentHash,
    currentWeek: 11,
    currentRoundNumber: 2,
    branchStatus: "completed",
    outcomeClassification: "detour_success",
    snapshots: [
      { branchId: "branch-1", roundNumber: 0, week: 9, scenarioId: "scenario-1", stateJson: pathState(9, 0.94, 0.98, 34, "open"), stateHash: "fork0000abcdef" },
      { branchId: "branch-1", roundNumber: 1, week: 10, scenarioId: "scenario-1", stateJson: pathState(10, 0.95, 0.97, 34, "open"), stateHash: "commit01abcdef" },
      { branchId: "branch-1", roundNumber: 2, week: 11, scenarioId: "scenario-1", stateJson: pathState(11, 0.98, 0.99, 33, "closed", "detour_success"), stateHash: "commit02abcdef" },
    ],
    roundSubmissions: [
      { branchId: "branch-1", roundNumber: 1, submittedAt: "2026-08-28 10:00:00", ruleResultJson: JSON.stringify({ stateDiff: { managementActionsCompletedThisRound: 1 } }) },
      { branchId: "branch-1", roundNumber: 2, submittedAt: "2026-08-28 10:05:00", ruleResultJson: JSON.stringify({ pathClassification: "detour_success", stateDiff: { managementActionsCompletedThisRound: 2 } }) },
    ],
    documentDeltas: [
      { branchId: "branch-1", documentId: "D05", roundNumber: 1, week: 10, reason: "round_settlement", patchJson: JSON.stringify([{ op: "replace", path: "/changeControl/openItems", value: 1 }]) },
      { branchId: "branch-1", documentId: "D14", roundNumber: 2, week: 11, reason: "round_settlement", patchJson: JSON.stringify([{ op: "replace", path: "/scheduleStatus/spi", value: 0.98 }, { op: "replace", path: "/scheduleStatus/cpi", value: 0.99 }]) },
    ],
  });
  const response = await request("/api/lab/branches/branch-1/comparison", {
    headers: { "oai-authenticated-user-id": "user-123", "oai-authenticated-user-email": "iman@example.com" },
  }, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.forkWeek, 9);
  assert.equal(body.outcomeClassification, "detour_success");
  assert.deepEqual(body.rounds.map((round) => round.roundNumber), [0, 1, 2]);
  assert.deepEqual(body.rounds.map((round) => round.mainline.week), [9, 10, 11]);
  assert.deepEqual(body.rounds[2].documents, [{ documentId: "D14", operationCount: 2 }]);
  assert.deepEqual(body.summary, { submittedRoundCount: 2, revisedDocumentCount: 2, operationCount: 3 });
  assert.equal(body.rounds[2].commitHash, "commit02");
  assert.doesNotMatch(JSON.stringify(body), /stateJson|ruleResultJson|minimumCorrectCardIds|necessaryManagementActions/);
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

test("requires platform identity and explicit confirmation before deleting lab data", async () => {
  const anonymous = await request("/api/lab/me/data", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE_LAB_DATA" }),
  });
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.headers.get("cache-control") ?? "", /no-store/);

  const invalidConfirmation = await request("/api/lab/me/data", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-id": "user-123",
      "oai-authenticated-user-email": "iman@example.com",
    },
    body: JSON.stringify({ confirmation: "删除" }),
  });
  assert.equal(invalidConfirmation.status, 400);
  assert.equal((await invalidConfirmation.json()).error.code, "DELETION_CONFIRMATION_REQUIRED");
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
  const response = await request("/api/lab/cases/car-control/v5/branches", options, env);
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

  const replay = await request("/api/lab/cases/car-control/v5/branches", options, env);
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

  const refreshedMaterialsResponse = await request(
    `/api/lab/branches/${body.branch.id}/scenarios/scenario-1/materials`,
    {
      headers: {
        "oai-authenticated-user-id": "user-123",
        "oai-authenticated-user-email": "iman@example.com",
      },
    },
    env,
  );
  const refreshedMaterials = await refreshedMaterialsResponse.json();
  assert.deepEqual(refreshedMaterials.materials[0].content.facts, openedBody.material.facts);
  assert.equal("content" in refreshedMaterials.materials[1], false);
});

test("creates a v5 branch when an immutable v4 case record already exists", async () => {
  const env = createEnv({ includeExistingBranch: false });
  env.__state.caseVersions.set("car-control:v4", "c85e10f6076226cc22b98b0f616f149593ba6508587822d902caf291bdddf353");

  const response = await request("/api/lab/cases/car-control/v5/branches", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-id": "user-123",
      "oai-authenticated-user-email": "iman@example.com",
    },
    body: JSON.stringify({ scenarioId: "scenario-1", idempotencyKey: "takeover-version-005" }),
  }, env);

  assert.equal(response.status, 201);
  assert.equal((await response.json()).branch.caseVersion, "v5");
  assert.equal(env.__state.caseVersions.get("car-control:v4"), "c85e10f6076226cc22b98b0f616f149593ba6508587822d902caf291bdddf353");
});

test("creates a new v5 retry branch without mutating the settled source", async () => {
  const env = createEnv({
    caseVersion: "v4",
    contentHash: "c85e10f6076226cc22b98b0f616f149593ba6508587822d902caf291bdddf353",
    currentWeek: 11,
    currentRoundNumber: 2,
    branchStatus: "completed",
    outcomeClassification: "detour_success",
    snapshots: [{
      branchId: "branch-1",
      roundNumber: 2,
      week: 11,
      scenarioId: "scenario-1",
      stateJson: "{}",
      stateHash: "settled-source-hash",
    }],
  });
  const headers = {
    "content-type": "application/json",
    "oai-authenticated-user-id": "user-123",
    "oai-authenticated-user-email": "iman@example.com",
  };
  const response = await request("/api/lab/cases/car-control/v5/branches", {
    method: "POST",
    headers,
    body: JSON.stringify({
      scenarioId: "scenario-1",
      idempotencyKey: "retry-scenario-001",
      retryFromBranchId: "branch-1",
      branchName: "减少重复动作",
    }),
  }, env);
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.notEqual(body.branch.id, "branch-1");
  assert.equal(body.branch.caseVersion, "v5");
  assert.equal(body.branch.parentBranchId, "branch-1");
  assert.equal(body.branch.branchName, "减少重复动作");
  assert.equal(body.branch.currentWeek, 9);
  assert.equal(env.__state.branches.get("branch-1").status, "completed");
  assert.equal(env.__state.branches.get("branch-1").caseVersion, "v4");
  assert.equal(env.__state.snapshots.some((snapshot) => snapshot.branchId === "branch-1" && snapshot.stateHash === "settled-source-hash"), true);

  const secondResponse = await request("/api/lab/cases/car-control/v5/branches", {
    method: "POST",
    headers,
    body: JSON.stringify({
      scenarioId: "scenario-1",
      idempotencyKey: "retry-scenario-002",
      retryFromBranchId: body.branch.id,
    }),
  }, env);
  assert.equal(secondResponse.status, 409, "an active retry must not be used as another retry source");
  assert.equal((await secondResponse.json()).error.code, "RETRY_SOURCE_ACTIVE");
});

test("renames only an owned branch and allows clearing the custom name", async () => {
  const env = createEnv();
  const headers = {
    "content-type": "application/json",
    "oai-authenticated-user-id": "user-123",
    "oai-authenticated-user-email": "iman@example.com",
  };
  const renamed = await request("/api/lab/branches/branch-1", {
    method: "PATCH",
    headers,
    body: JSON.stringify({ branchName: "第二次：先处理根因" }),
  }, env);
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).branch.branchName, "第二次：先处理根因");

  const cleared = await request("/api/lab/branches/branch-1", {
    method: "PATCH",
    headers,
    body: JSON.stringify({ branchName: "   " }),
  }, env);
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).branch.branchName, null);

  const tooLong = await request("/api/lab/branches/branch-1", {
    method: "PATCH",
    headers,
    body: JSON.stringify({ branchName: "分".repeat(41) }),
  }, env);
  assert.equal(tooLong.status, 400);

  const intruder = await request("/api/lab/branches/branch-1", {
    method: "PATCH",
    headers: { ...headers, "oai-authenticated-user-id": "intruder", "oai-authenticated-user-email": "intruder@example.com" },
    body: JSON.stringify({ branchName: "越权命名" }),
  }, env);
  assert.equal(intruder.status, 404);
});

test("requires login and a valid takeover request when creating a branch", async () => {
  const anonymous = await request("/api/lab/cases/car-control/v5/branches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId: "scenario-1", idempotencyKey: "takeover-test-002" }),
  }, createEnv({ includeExistingBranch: false }));
  assert.equal(anonymous.status, 401);

  const invalid = await request("/api/lab/cases/car-control/v5/branches", {
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
  const manifestResponse = await request("/api/lab/cases/car-control/v5");
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
  const manifestResponse = await request("/api/lab/cases/car-control/v5");
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
  const manifestResponse = await request("/api/lab/cases/car-control/v5");
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
