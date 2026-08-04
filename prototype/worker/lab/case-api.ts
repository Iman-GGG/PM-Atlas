import { publicLabCaseBaseline } from "../../lib/lab/lab-case-public.generated";
import type { CardConnection, DecisionReasoning, DecisionReference, StateEffect } from "../../lib/lab/contracts";
import { getPlatformIdentity } from "../auth/platform-identity";
import { privateLabCasePackage } from "../generated/lab-case-private.generated";
import { projectScenarioForClient } from "./project-case-for-client";
import {
  createBranchRecords,
  findLabUser,
  findOwnedBranch,
  findStoredCaseVersion,
  readBranchEvents,
  readRoundDraft,
  recordMaterialView,
  saveRoundDraft,
  type BranchEvent,
  type LabD1,
} from "./repository";

export type LabApiEnv = {
  DB?: LabD1;
};

const sectionNames = [
  "workload",
  "schedule",
  "stakeholders",
  "documents",
  "requirements",
  "risks",
  "quality",
  "baselineWorkload",
] as const;
type SectionName = (typeof sectionNames)[number];
const sectionNameSet = new Set<string>(sectionNames);

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function errorResponse(status: number, code: string, message: string, headers?: HeadersInit): Response {
  return jsonResponse({ error: { code, message } }, { status, headers });
}

function withPublicCache(response: Response): Response {
  response.headers.set("cache-control", "public, max-age=300, s-maxage=86400, immutable");
  return response;
}

function withPrivateCache(response: Response): Response {
  response.headers.set("cache-control", "private, no-store");
  response.headers.set("vary", "oai-authenticated-user-id, oai-authenticated-user-email");
  return response;
}

function parseWeek(url: URL): number | null {
  const rawWeek = url.searchParams.get("week");
  if (rawWeek === null) return null;
  const week = Number(rawWeek);
  return Number.isInteger(week) && week >= 1 && week <= publicLabCaseBaseline.totalWeeks ? week : Number.NaN;
}

function parseSections(url: URL): SectionName[] | null {
  const raw = url.searchParams.get("sections");
  const requested = raw ? raw.split(",").map((value) => value.trim()).filter(Boolean) : ["baselineWorkload"];
  if (requested.length === 0 || requested.some((section) => !sectionNameSet.has(section))) return null;
  return [...new Set(requested)] as SectionName[];
}

function projectSection(section: SectionName, week: number | null): StateEffect {
  const source = publicLabCaseBaseline.plans[section] as StateEffect;
  if (week === null) return source;

  if (section === "baselineWorkload") {
    return { ...source, weeks: (source.weeks as StateEffect[]).filter((item) => item.week === week) };
  }
  if (section === "documents") {
    return {
      ...source,
      documents: (source.documents as StateEffect[]).filter((item) => Number(item.createdWeek) <= week),
      mainlineEvents: (source.mainlineEvents as StateEffect[]).filter((item) => Number(item.week) <= week),
      contentRevisions: (source.contentRevisions as StateEffect[]).filter((item) => Number(item.week) <= week),
      changeItems: (source.changeItems as StateEffect[]).filter((item) => Number(item.submittedWeek) <= week),
      issues: (source.issues as StateEffect[]).filter((item) => Number(item.discoveredWeek) <= week),
      testRounds: (source.testRounds as StateEffect[]).filter((item) => Number(item.executionWeek) <= week),
      relations: (source.relations as StateEffect[]).filter((item) => Number(item.effectiveWeek) <= week),
    };
  }
  if (section === "requirements") {
    return {
      ...source,
      requirements: (source.requirements as StateEffect[]).filter((item) => Number(item.discoveredWeek) <= week),
      mainlineEvents: (source.mainlineEvents as StateEffect[]).filter((item) => Number(item.week) <= week),
    };
  }
  if (section === "risks") {
    return {
      ...source,
      mainlineLifecycleEvents: (source.mainlineLifecycleEvents as StateEffect[]).filter((item) => Number(item.week) <= week),
    };
  }
  if (section === "stakeholders") {
    return {
      ...source,
      mainlineEngagementEvents: (source.mainlineEngagementEvents as StateEffect[]).filter((item) => Number(item.week) <= week),
    };
  }
  if (section === "quality") {
    return {
      ...source,
      mainlineSeries: (source.mainlineSeries as StateEffect[]).filter((item) => Number(item.week) <= week),
    };
  }
  return source;
}

function parseEventVisibility(events: BranchEvent[], scenarioId: string): {
  availableMaterialIds: string[];
  visibleMaterialIds: string[];
  cardsUnlocked: boolean;
} {
  const availableMaterialIds = new Set<string>();
  const visibleMaterialIds = new Set<string>();
  let cardsUnlocked = false;

  for (const event of events) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (payload.scenarioId !== scenarioId) continue;
    if (Array.isArray(payload.availableMaterialIds)) {
      for (const materialId of payload.availableMaterialIds) {
        if (typeof materialId === "string") availableMaterialIds.add(materialId);
      }
    }
    if (typeof payload.materialId === "string") visibleMaterialIds.add(payload.materialId);
    if (Array.isArray(payload.materialIds)) {
      for (const materialId of payload.materialIds) {
        if (typeof materialId === "string") visibleMaterialIds.add(materialId);
      }
    }
    if (payload.cardsUnlocked === true || event.eventType === "scenario_cards_unlocked") cardsUnlocked = true;
  }

  return {
    availableMaterialIds: [...availableMaterialIds],
    visibleMaterialIds: [...visibleMaterialIds],
    cardsUnlocked,
  };
}

function findScenarioMaterial(scenarioId: string, materialId: string) {
  const scenario = privateLabCasePackage.sourceFiles.scenarioPlan.scenarios.find(({ id }) => id === scenarioId);
  if (!scenario) return null;
  for (const [group, materials] of Object.entries(scenario.eventMaterials)) {
    const material = materials.find((item) => item.id === materialId);
    if (material) return { scenario, group, material };
  }
  return null;
}

function findScenario(scenarioId: string) {
  return privateLabCasePackage.sourceFiles.scenarioPlan.scenarios.find(({ id }) => id === scenarioId) ?? null;
}

function materialSummary(group: string, material: Record<string, unknown>, opened: boolean) {
  return {
    id: material.id,
    group,
    type: material.type ?? (group === "dashboardAnomalies" ? "dashboard_anomaly" : "project_material"),
    channel: material.channel ?? null,
    title: material.subject ?? material.displayLabel ?? "项目状态出现新信号",
    opened,
  };
}

const cardColumnOrder = ["evidence_document", "tool_technique", "execution_action", "stakeholder"] as const;
const referenceTypes = new Set<DecisionReference["type"]>(["event_material", "project_document", "action_card"]);

type RoundDraftBody = {
  expectedRoundNumber: number;
  selectedCardIds: string[];
  connections: CardConnection[];
  reasoning: DecisionReasoning;
};

function emptyReasoning(): DecisionReasoning {
  return { observedSignals: "", riskOrRootCause: "", actionRationale: "", references: [] };
}

function parseStoredJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function parseRoundDraftBody(request: Request): Promise<RoundDraftBody | null> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return null;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 64_000) return null;
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    if (!Number.isInteger(body.expectedRoundNumber) || Number(body.expectedRoundNumber) < 1) return null;
    if (!Array.isArray(body.selectedCardIds) || body.selectedCardIds.length > 64) return null;
    if (!Array.isArray(body.connections) || body.connections.length > 128) return null;
    if (!body.reasoning || typeof body.reasoning !== "object" || Array.isArray(body.reasoning)) return null;
    const reasoning = body.reasoning as Record<string, unknown>;
    const reasoningFields = [reasoning.observedSignals, reasoning.riskOrRootCause, reasoning.actionRationale];
    if (reasoningFields.some((value) => typeof value !== "string" || value.length > 500)) return null;
    if (!Array.isArray(reasoning.references) || reasoning.references.length > 100) return null;
    const selectedCardIds = body.selectedCardIds;
    if (selectedCardIds.some((cardId) => typeof cardId !== "string" || !/^[A-Za-z0-9._:-]{1,64}$/.test(cardId))) return null;
    const connections = body.connections;
    if (connections.some((connection) => (
      !connection
      || typeof connection !== "object"
      || typeof connection.fromCardId !== "string"
      || typeof connection.toCardId !== "string"
    ))) return null;
    const references = reasoning.references;
    if (references.some((reference) => (
      !reference
      || typeof reference !== "object"
      || !referenceTypes.has(reference.type as DecisionReference["type"])
      || typeof reference.id !== "string"
      || !/^[A-Za-z0-9._:-]{1,64}$/.test(reference.id)
    ))) return null;
    return {
      expectedRoundNumber: Number(body.expectedRoundNumber),
      selectedCardIds: selectedCardIds as string[],
      connections: connections as CardConnection[],
      reasoning: {
        observedSignals: reasoning.observedSignals as string,
        riskOrRootCause: reasoning.riskOrRootCause as string,
        actionRationale: reasoning.actionRationale as string,
        references: references as DecisionReference[],
      },
    };
  } catch {
    return null;
  }
}

function caseMatches(caseId: string, caseVersion: string): boolean {
  return caseId === publicLabCaseBaseline.caseId && caseVersion === publicLabCaseBaseline.caseVersion;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [
    key,
    stableValue((value as Record<string, unknown>)[key]),
  ]));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function stableId(prefix: string, value: string): Promise<string> {
  return `${prefix}-${(await sha256(value)).slice(0, 32)}`;
}

async function parseCreateBranchBody(request: Request): Promise<{
  scenarioId: string;
  idempotencyKey: string;
} | null> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return null;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) return null;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.scenarioId !== "string" || typeof body.idempotencyKey !== "string") return null;
    if (!/^scenario-[a-z0-9-]{1,48}$/.test(body.scenarioId)) return null;
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(body.idempotencyKey)) return null;
    return { scenarioId: body.scenarioId, idempotencyKey: body.idempotencyKey };
  } catch {
    return null;
  }
}

async function createBranch(request: Request, env: LabApiEnv, caseId: string, caseVersion: string): Promise<Response> {
  if (!caseMatches(caseId, caseVersion)) return errorResponse(404, "CASE_NOT_FOUND", "Case version not found.");
  const identity = await getPlatformIdentity(request);
  if (!identity) {
    return withPrivateCache(errorResponse(401, "AUTHENTICATION_REQUIRED", "Sign in with ChatGPT to take over a project."));
  }
  if (!env.DB) return withPrivateCache(errorResponse(503, "DATABASE_UNAVAILABLE", "Project progress storage is unavailable."));
  const body = await parseCreateBranchBody(request);
  if (!body) {
    return withPrivateCache(errorResponse(
      400,
      "INVALID_BRANCH_REQUEST",
      "A valid scenarioId and 8-128 character idempotencyKey are required.",
    ));
  }

  const scenario = privateLabCasePackage.sourceFiles.scenarioPlan.scenarios.find(({ id }) => id === body.scenarioId);
  const takeoverPoint = publicLabCaseBaseline.takeoverPoints.find(({ scenarioId }) => scenarioId === body.scenarioId);
  if (!scenario || !takeoverPoint || scenario.week !== takeoverPoint.week) {
    return withPrivateCache(errorResponse(404, "TAKEOVER_POINT_NOT_FOUND", "Takeover point not found."));
  }

  const storedCaseVersion = await findStoredCaseVersion(env.DB, caseId, caseVersion);
  if (storedCaseVersion && storedCaseVersion.contentHash !== publicLabCaseBaseline.contentHash) {
    return withPrivateCache(errorResponse(409, "CASE_VERSION_MISMATCH", "The stored case version differs from this deployment."));
  }

  const branchScope = `${identity.identityKey}\u0000${caseId}\u0000${caseVersion}\u0000${body.scenarioId}\u0000${body.idempotencyKey}`;
  const branchId = await stableId("branch", branchScope);
  const existingBranch = await findOwnedBranch(env.DB, branchId, identity.identityKey);
  if (existingBranch) {
    const response = jsonResponse({
      branch: existingBranch,
      scenario: { id: scenario.id, week: scenario.week, title: scenario.title },
      idempotentReplay: true,
    }, { status: 200, headers: { location: `/api/lab/branches/${branchId}/scenarios/${scenario.id}/projection` } });
    return withPrivateCache(response);
  }

  const storedUser = await findLabUser(env.DB, identity.identityKey);
  const userId = storedUser?.id ?? await stableId("user", identity.identityKey);
  const baselineWeek = (publicLabCaseBaseline.plans.baselineWorkload.weeks as StateEffect[])
    .find((item) => item.week === scenario.week);
  if (!baselineWeek) return withPrivateCache(errorResponse(500, "BASELINE_STATE_MISSING", "The takeover baseline is unavailable."));

  const initialState = {
    caseId,
    caseVersion,
    contentHash: publicLabCaseBaseline.contentHash,
    mode: "learning",
    week: scenario.week,
    baseline: baselineWeek,
    scenario: {
      id: scenario.id,
      status: "open",
      initialImpact: scenario.initialImpact,
    },
  };
  const stateJson = JSON.stringify(stableValue(initialState));
  const stateHash = await sha256(stateJson);
  const materialIds = Object.values(scenario.eventMaterials).flat().map((material) => material.id);
  const eventPayload = {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    availableMaterialIds: materialIds,
    entrySignals: publicLabCaseBaseline.learningPolicies.eventDiscovery.entrySignals,
    cardsUnlocked: false,
  };

  await createBranchRecords(env.DB, {
    caseId,
    caseVersion,
    contentHash: publicLabCaseBaseline.contentHash,
    userId,
    identityKey: identity.identityKey,
    displayName: identity.displayName,
    progressId: await stableId("progress", `${identity.identityKey}\u0000${caseId}\u0000${caseVersion}`),
    branchId,
    scenarioId: scenario.id,
    forkWeek: scenario.week,
    snapshotId: `${branchId}:snapshot:0`,
    stateJson,
    stateHash,
    eventId: `${branchId}:scenario-started`,
    eventPayloadJson: JSON.stringify(eventPayload),
  });

  const branch = await findOwnedBranch(env.DB, branchId, identity.identityKey);
  if (!branch) return withPrivateCache(errorResponse(500, "BRANCH_CREATE_FAILED", "The project branch could not be created."));
  const response = jsonResponse({
    branch,
    scenario: {
      id: scenario.id,
      week: scenario.week,
      title: scenario.title,
      entrySignals: eventPayload.entrySignals,
      availableMaterialCount: materialIds.length,
      cardsUnlocked: false,
    },
    initialState,
    stateHash,
    idempotentReplay: false,
  }, { status: 201, headers: { location: `/api/lab/branches/${branchId}/scenarios/${scenario.id}/projection` } });
  return withPrivateCache(response);
}

async function readOwnedScenarioContext(
  request: Request,
  env: LabApiEnv,
  branchId: string,
  scenarioId: string,
): Promise<{
  branch: Awaited<ReturnType<typeof findOwnedBranch>> & {};
  events: BranchEvent[];
  visibility: ReturnType<typeof parseEventVisibility>;
} | Response> {
  const identity = await getPlatformIdentity(request);
  if (!identity) {
    return withPrivateCache(errorResponse(401, "AUTHENTICATION_REQUIRED", "Sign in with ChatGPT to read a project branch."));
  }
  if (!env.DB) return withPrivateCache(errorResponse(503, "DATABASE_UNAVAILABLE", "Project progress storage is unavailable."));
  const branch = await findOwnedBranch(env.DB, branchId, identity.identityKey);
  if (!branch) return withPrivateCache(errorResponse(404, "BRANCH_NOT_FOUND", "Project branch not found."));
  if (!caseMatches(branch.caseId, branch.caseVersion) || branch.contentHash !== publicLabCaseBaseline.contentHash) {
    return withPrivateCache(errorResponse(409, "CASE_VERSION_MISMATCH", "The branch case package is not available in this deployment."));
  }
  const events = await readBranchEvents(env.DB, branch.id, branch.currentWeek);
  return { branch, events, visibility: parseEventVisibility(events, scenarioId) };
}

async function listScenarioMaterials(
  request: Request,
  env: LabApiEnv,
  branchId: string,
  scenarioId: string,
): Promise<Response> {
  const context = await readOwnedScenarioContext(request, env, branchId, scenarioId);
  if (context instanceof Response) return context;
  const opened = new Set(context.visibility.visibleMaterialIds);
  const materials = context.visibility.availableMaterialIds.flatMap((materialId) => {
    const found = findScenarioMaterial(scenarioId, materialId);
    return found ? [materialSummary(found.group, found.material, opened.has(materialId))] : [];
  });
  if (materials.length === 0) {
    return withPrivateCache(errorResponse(404, "SCENARIO_MATERIALS_NOT_FOUND", "Scenario materials are not available for this branch."));
  }
  return withPrivateCache(jsonResponse({
    branchId,
    scenarioId,
    currentWeek: context.branch.currentWeek,
    openedCount: materials.filter((material) => material.opened).length,
    totalCount: materials.length,
    cardsUnlocked: context.visibility.cardsUnlocked,
    materials,
  }));
}

async function openScenarioMaterial(
  request: Request,
  env: LabApiEnv,
  branchId: string,
  scenarioId: string,
  materialId: string,
): Promise<Response> {
  const context = await readOwnedScenarioContext(request, env, branchId, scenarioId);
  if (context instanceof Response) return context;
  if (!context.visibility.availableMaterialIds.includes(materialId)) {
    return withPrivateCache(errorResponse(404, "MATERIAL_NOT_AVAILABLE", "This material is not available for the branch."));
  }
  const found = findScenarioMaterial(scenarioId, materialId);
  if (!found || context.branch.currentWeek < found.scenario.week) {
    return withPrivateCache(errorResponse(403, "MATERIAL_LOCKED", "This material is not available at the branch's current week."));
  }
  const openedMaterialIds = new Set(context.visibility.visibleMaterialIds);
  openedMaterialIds.add(materialId);
  const unlockCards = context.visibility.availableMaterialIds.every((id) => openedMaterialIds.has(id));
  await recordMaterialView(env.DB!, {
    branchId,
    roundNumber: context.branch.currentRoundNumber,
    week: context.branch.currentWeek,
    scenarioId,
    materialId,
    unlockCards,
  });
  const projection = projectScenarioForClient({
    scenarioId,
    currentWeek: context.branch.currentWeek,
    visibleMaterialIds: [...openedMaterialIds],
    cardsUnlocked: context.visibility.cardsUnlocked || unlockCards,
  });
  return withPrivateCache(jsonResponse({
    branchId,
    scenarioId,
    material: found.material,
    openedCount: openedMaterialIds.size,
    totalCount: context.visibility.availableMaterialIds.length,
    cardsUnlocked: context.visibility.cardsUnlocked || unlockCards,
    cards: projection?.cards ?? [],
  }));
}

async function readScenarioDraft(
  request: Request,
  env: LabApiEnv,
  branchId: string,
  scenarioId: string,
): Promise<Response> {
  const context = await readOwnedScenarioContext(request, env, branchId, scenarioId);
  if (context instanceof Response) return context;
  const scenario = findScenario(scenarioId);
  if (!scenario || context.branch.currentWeek < scenario.week) {
    return withPrivateCache(errorResponse(403, "SCENARIO_LOCKED", "This scenario is not available at the branch's current week."));
  }
  const roundNumber = context.branch.currentRoundNumber + 1;
  const storedDraft = await readRoundDraft(env.DB!, branchId, roundNumber);
  if (storedDraft && storedDraft.scenarioId !== scenarioId) {
    return withPrivateCache(errorResponse(409, "DRAFT_SCENARIO_MISMATCH", "The current round already has a draft for another scenario."));
  }
  return withPrivateCache(jsonResponse({
    branchId,
    scenarioId,
    roundNumber,
    selectedCardIds: storedDraft ? parseStoredJson<string[]>(storedDraft.selectedCardIdsJson, []) : [],
    connections: storedDraft ? parseStoredJson<CardConnection[]>(storedDraft.connectionsJson, []) : [],
    reasoning: storedDraft ? parseStoredJson<DecisionReasoning>(storedDraft.reasoningJson, emptyReasoning()) : emptyReasoning(),
    updatedAt: storedDraft?.updatedAt ?? null,
  }));
}

async function saveScenarioDraft(
  request: Request,
  env: LabApiEnv,
  branchId: string,
  scenarioId: string,
): Promise<Response> {
  const context = await readOwnedScenarioContext(request, env, branchId, scenarioId);
  if (context instanceof Response) return context;
  const scenario = findScenario(scenarioId);
  if (!scenario || context.branch.currentWeek < scenario.week) {
    return withPrivateCache(errorResponse(403, "SCENARIO_LOCKED", "This scenario is not available at the branch's current week."));
  }
  if (!context.visibility.cardsUnlocked) {
    return withPrivateCache(errorResponse(409, "ACTION_CARDS_LOCKED", "Open every event material before editing the action chain."));
  }
  const body = await parseRoundDraftBody(request);
  if (!body) {
    return withPrivateCache(errorResponse(400, "INVALID_DRAFT", "The action-chain draft is not valid."));
  }
  const roundNumber = context.branch.currentRoundNumber + 1;
  if (body.expectedRoundNumber !== roundNumber) {
    return withPrivateCache(errorResponse(409, "ROUND_CONFLICT", "The branch has advanced. Reload the latest round before saving."));
  }

  const cardById = new Map(scenario.cards.map((card) => [card.id, card]));
  if (new Set(body.selectedCardIds).size !== body.selectedCardIds.length || body.selectedCardIds.some((id) => !cardById.has(id))) {
    return withPrivateCache(errorResponse(400, "INVALID_CARD_SELECTION", "The selected action cards are not valid for this scenario."));
  }
  const selectedCardIds = new Set(body.selectedCardIds);
  const connectionKeys = new Set<string>();
  for (const connection of body.connections) {
    const fromCard = cardById.get(connection.fromCardId);
    const toCard = cardById.get(connection.toCardId);
    const key = `${connection.fromCardId}\u0000${connection.toCardId}`;
    if (
      !fromCard
      || !toCard
      || !selectedCardIds.has(fromCard.id)
      || !selectedCardIds.has(toCard.id)
      || cardColumnOrder.indexOf(toCard.column) !== cardColumnOrder.indexOf(fromCard.column) + 1
      || connectionKeys.has(key)
    ) {
      return withPrivateCache(errorResponse(400, "INVALID_CARD_CONNECTION", "Connections must link selected cards in adjacent columns."));
    }
    connectionKeys.add(key);
  }

  const availableDocuments = new Set((publicLabCaseBaseline.plans.documents.documents as StateEffect[])
    .filter((document) => Number(document.createdWeek) <= context.branch.currentWeek)
    .map((document) => String(document.id)));
  const visibleMaterialIds = new Set(context.visibility.visibleMaterialIds);
  const referenceKeys = new Set<string>();
  for (const reference of body.reasoning.references) {
    const key = `${reference.type}\u0000${reference.id}`;
    const isValid = reference.type === "event_material"
      ? visibleMaterialIds.has(reference.id)
      : reference.type === "project_document"
        ? availableDocuments.has(reference.id)
        : selectedCardIds.has(reference.id) && cardById.has(reference.id);
    if (!isValid || referenceKeys.has(key)) {
      return withPrivateCache(errorResponse(400, "INVALID_DECISION_REFERENCE", "Decision references must point to visible materials, available documents, or selected cards."));
    }
    referenceKeys.add(key);
  }

  const draftId = await stableId("draft", `${branchId}\u0000${roundNumber}`);
  await saveRoundDraft(env.DB!, {
    id: draftId,
    branchId,
    roundNumber,
    scenarioId,
    selectedCardIdsJson: JSON.stringify(body.selectedCardIds),
    connectionsJson: JSON.stringify(body.connections),
    reasoningJson: JSON.stringify(body.reasoning),
  });
  return withPrivateCache(jsonResponse({
    branchId,
    scenarioId,
    roundNumber,
    selectedCardIds: body.selectedCardIds,
    connections: body.connections,
    reasoning: body.reasoning,
    updatedAt: new Date().toISOString(),
  }));
}

export async function handleLabApi(request: Request, env: LabApiEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/lab/")) return null;

  let parts: string[];
  try {
    parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return errorResponse(400, "INVALID_PATH", "The request path is not valid UTF-8.");
  }
  if (parts.length === 6 && parts[2] === "cases" && parts[5] === "branches") {
    if (request.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Only POST is supported.", { allow: "POST" });
    }
    return createBranch(request, env, parts[3], parts[4]);
  }
  if (parts.length === 7 && parts[2] === "branches" && parts[4] === "scenarios" && parts[6] === "materials") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Only GET and HEAD are supported.", { allow: "GET, HEAD" });
    }
    const response = await listScenarioMaterials(request, env, parts[3], parts[5]);
    if (request.method === "HEAD") return new Response(null, { status: response.status, headers: response.headers });
    return response;
  }
  if (
    parts.length === 9
    && parts[2] === "branches"
    && parts[4] === "scenarios"
    && parts[6] === "materials"
    && parts[8] === "view"
  ) {
    if (request.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Only POST is supported.", { allow: "POST" });
    }
    return openScenarioMaterial(request, env, parts[3], parts[5], parts[7]);
  }
  if (parts.length === 7 && parts[2] === "branches" && parts[4] === "scenarios" && parts[6] === "draft") {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "PUT") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Only GET, HEAD, and PUT are supported.", { allow: "GET, HEAD, PUT" });
    }
    const response = request.method === "PUT"
      ? await saveScenarioDraft(request, env, parts[3], parts[5])
      : await readScenarioDraft(request, env, parts[3], parts[5]);
    if (request.method === "HEAD") return new Response(null, { status: response.status, headers: response.headers });
    return response;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Only GET and HEAD are supported.", { allow: "GET, HEAD" });
  }
  let response: Response;

  if (parts.length === 3 && parts[2] === "session") {
    const identity = await getPlatformIdentity(request);
    response = withPrivateCache(jsonResponse(identity ? {
      authenticated: true,
      displayName: identity.displayName,
      email: identity.email,
      identitySource: identity.source,
    } : { authenticated: false }));
  } else if (parts.length === 5 && parts[2] === "cases") {
    const [, , , caseId, caseVersion] = parts;
    if (!caseMatches(caseId, caseVersion)) return errorResponse(404, "CASE_NOT_FOUND", "Case version not found.");
    response = withPublicCache(jsonResponse({
      schemaVersion: publicLabCaseBaseline.schemaVersion,
      caseId,
      caseVersion,
      contentHash: publicLabCaseBaseline.contentHash,
      totalWeeks: publicLabCaseBaseline.totalWeeks,
      learningPolicies: publicLabCaseBaseline.learningPolicies,
      takeoverPoints: publicLabCaseBaseline.takeoverPoints,
      availableSections: sectionNames,
    }));
  } else if (parts.length === 6 && parts[2] === "cases" && parts[5] === "mainline") {
    const [, , , caseId, caseVersion] = parts;
    if (!caseMatches(caseId, caseVersion)) return errorResponse(404, "CASE_NOT_FOUND", "Case version not found.");
    const week = parseWeek(url);
    if (Number.isNaN(week)) return errorResponse(400, "INVALID_WEEK", `week must be between 1 and ${publicLabCaseBaseline.totalWeeks}.`);
    const sections = parseSections(url);
    if (!sections) return errorResponse(400, "INVALID_SECTIONS", `sections must use: ${sectionNames.join(", ")}.`);
    response = withPublicCache(jsonResponse({
      caseId,
      caseVersion,
      contentHash: publicLabCaseBaseline.contentHash,
      week,
      sections: Object.fromEntries(sections.map((section) => [section, projectSection(section, week)])),
    }));
  } else if (parts.length === 7 && parts[2] === "branches" && parts[4] === "scenarios") {
    const branchId = parts[3];
    const scenarioId = parts[5];
    if (parts[6] !== "projection") return errorResponse(404, "LAB_ROUTE_NOT_FOUND", "Lab API route not found.");
    const context = await readOwnedScenarioContext(request, env, branchId, scenarioId);
    if (context instanceof Response) return context;
    const { branch, visibility } = context;
    const projection = projectScenarioForClient({
      scenarioId,
      currentWeek: branch.currentWeek,
      ...visibility,
    });
    if (!projection) return withPrivateCache(errorResponse(403, "SCENARIO_LOCKED", "This scenario is not available at the branch's current week."));
    response = withPrivateCache(jsonResponse({
      branch: {
        id: branch.id,
        currentWeek: branch.currentWeek,
        currentRoundNumber: branch.currentRoundNumber,
        status: branch.status,
      },
      caseId: branch.caseId,
      caseVersion: branch.caseVersion,
      contentHash: branch.contentHash,
      scenario: projection,
    }));
  } else {
    return errorResponse(404, "LAB_ROUTE_NOT_FOUND", "Lab API route not found.");
  }

  if (request.method === "HEAD") return new Response(null, { status: response.status, headers: response.headers });
  return response;
}
