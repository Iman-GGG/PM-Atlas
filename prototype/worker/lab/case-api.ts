import { publicLabCaseBaseline } from "../../lib/lab/lab-case-public.generated";
import type {
  ManagementActionChain,
  RoundResult,
  RoundSubmissionRequest,
  ScenarioDefinition,
  StateEffect,
} from "../../lib/lab/contracts";
import { getPlatformIdentity } from "../auth/platform-identity";
import { privateLabCasePackage } from "../generated/lab-case-private.generated";
import { projectScenarioForClient } from "./project-case-for-client";
import {
  createBranchRecords,
  commitRoundRecords,
  findRoundSubmissionByIdempotency,
  findLabUser,
  findOwnedBranch,
  findStoredCaseVersion,
  readCurrentStateSnapshot,
  readRoundSubmission,
  readRoundDraft,
  readOwnedBranchContext,
  readScenarioActionChainSubmissions,
  recordMaterialView,
  saveRoundDraft,
  type BranchEvent,
  type LabD1,
} from "./repository";
import { projectStoredBranchState, settleRound } from "./settle-round";

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
    ...(opened ? { content: material } : {}),
  };
}

type RoundDraftBody = {
  expectedRoundNumber: number;
  actionChains: ManagementActionChain[];
};

function parseStoredJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseCardIdList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 32) return null;
  if (value.some((cardId) => typeof cardId !== "string" || !/^[A-Za-z0-9._:-]{1,64}$/.test(cardId))) return null;
  return value as string[];
}

function parseActionChainValue(value: unknown): ManagementActionChain | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const chain = value as Record<string, unknown>;
  if (typeof chain.id !== "string" || !/^[A-Za-z0-9._:-]{1,96}$/.test(chain.id)) return null;
  if (typeof chain.title !== "string" || chain.title.trim().length < 1 || chain.title.trim().length > 80) return null;
  const documentCardIds = parseCardIdList(chain.documentCardIds);
  const toolTechniqueCardIds = parseCardIdList(chain.toolTechniqueCardIds);
  const stakeholderCardIds = parseCardIdList(chain.stakeholderCardIds);
  if (!documentCardIds || !toolTechniqueCardIds || !stakeholderCardIds) return null;
  return {
    id: chain.id,
    title: chain.title.trim(),
    documentCardIds,
    toolTechniqueCardIds,
    stakeholderCardIds,
  };
}

function flattenActionChainCardIds(actionChains: ManagementActionChain[]): string[] {
  return [...new Set(actionChains.flatMap((chain) => [
    ...chain.documentCardIds,
    ...chain.toolTechniqueCardIds,
    ...chain.stakeholderCardIds,
  ]))];
}

function readStoredActionChains(
  storedValue: string,
  selectedCardIds: string[],
  scenario: ScenarioDefinition,
): ManagementActionChain[] {
  const parsed = parseStoredJson<unknown>(storedValue, []);
  if (Array.isArray(parsed)) {
    const actionChains = parsed.map(parseActionChainValue);
    if (parsed.length > 0 && actionChains.length === parsed.length && actionChains.every(Boolean)) {
      return actionChains as ManagementActionChain[];
    }
    if (parsed.length === 0 && selectedCardIds.length === 0) return [];
  }

  const selectedCards = scenario.cards.filter((card) => selectedCardIds.includes(card.id));
  const documentCardIds = selectedCards.filter((card) => card.column === "evidence_document").map((card) => card.id);
  const toolTechniqueCardIds = selectedCards.filter((card) => card.column === "tool_technique").map((card) => card.id);
  const stakeholderCardIds = selectedCards.filter((card) => card.column === "stakeholder").map((card) => card.id);
  if (!documentCardIds.length || !toolTechniqueCardIds.length || !stakeholderCardIds.length) return [];
  return [{
    id: `legacy-${scenario.id}`,
    title: "继续完善上一版行动",
    documentCardIds,
    toolTechniqueCardIds,
    stakeholderCardIds,
  }];
}

function parseRoundDraftValue(body: Record<string, unknown>): RoundDraftBody | null {
  try {
    if (!Number.isInteger(body.expectedRoundNumber) || Number(body.expectedRoundNumber) < 1) return null;
    if (!Array.isArray(body.actionChains) || body.actionChains.length > 16) return null;
    const actionChains = body.actionChains.map(parseActionChainValue);
    if (actionChains.some((chain) => !chain)) return null;
    return {
      expectedRoundNumber: Number(body.expectedRoundNumber),
      actionChains: actionChains as ManagementActionChain[],
    };
  } catch {
    return null;
  }
}

async function parseJsonRequest(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return null;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 64_000) return null;
    const body = JSON.parse(rawBody);
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function parseRoundDraftBody(request: Request): Promise<RoundDraftBody | null> {
  const body = await parseJsonRequest(request);
  return body ? parseRoundDraftValue(body) : null;
}

async function parseRoundSubmissionBody(request: Request): Promise<RoundSubmissionRequest | null> {
  const body = await parseJsonRequest(request);
  if (!body || typeof body.scenarioId !== "string" || typeof body.idempotencyKey !== "string") return null;
  if (!/^scenario-[a-z0-9-]{1,48}$/.test(body.scenarioId)) return null;
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(body.idempotencyKey)) return null;
  const draft = parseRoundDraftValue(body);
  return draft ? { ...draft, scenarioId: body.scenarioId, idempotencyKey: body.idempotencyKey } : null;
}

type RoundValidationIssue = { status: number; code: string; message: string };

function validateRoundContent(
  scenario: ScenarioDefinition,
  body: RoundDraftBody,
  requireCompleteInput: boolean,
): RoundValidationIssue | null {
  const cardById = new Map(scenario.cards.map((card) => [card.id, card]));
  const chainIds = new Set<string>();
  for (const chain of body.actionChains) {
    const pools = [
      { cardIds: chain.documentCardIds, column: "evidence_document" },
      { cardIds: chain.toolTechniqueCardIds, column: "tool_technique" },
      { cardIds: chain.stakeholderCardIds, column: "stakeholder" },
    ] as const;
    if (chainIds.has(chain.id)) {
      return { status: 400, code: "DUPLICATE_ACTION_CHAIN", message: "Each action chain must have a unique id." };
    }
    chainIds.add(chain.id);
    for (const pool of pools) {
      if (
        pool.cardIds.length === 0
        || new Set(pool.cardIds).size !== pool.cardIds.length
        || pool.cardIds.some((id) => cardById.get(id)?.column !== pool.column)
      ) {
        return { status: 400, code: "INVALID_ACTION_CHAIN", message: "Each action chain needs valid project files, tools and techniques, and stakeholders." };
      }
    }
  }
  if (requireCompleteInput) {
    if (body.actionChains.length === 0) {
      return { status: 400, code: "INCOMPLETE_ACTION_CHAIN", message: "At least one complete action chain is required." };
    }
  }
  return null;
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
  const ownedContext = await readOwnedBranchContext(env.DB, branchId, identity.identityKey);
  if (!ownedContext) return withPrivateCache(errorResponse(404, "BRANCH_NOT_FOUND", "Project branch not found."));
  const { branch, events } = ownedContext;
  if (!caseMatches(branch.caseId, branch.caseVersion) || branch.contentHash !== publicLabCaseBaseline.contentHash) {
    return withPrivateCache(errorResponse(409, "CASE_VERSION_MISMATCH", "The branch case package is not available in this deployment."));
  }
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
  const alreadyOpened = openedMaterialIds.has(materialId);
  openedMaterialIds.add(materialId);
  const unlockCards = context.visibility.availableMaterialIds.every((id) => openedMaterialIds.has(id));
  if (!alreadyOpened) {
    await recordMaterialView(env.DB!, {
      branchId,
      roundNumber: context.branch.currentRoundNumber,
      week: context.branch.currentWeek,
      scenarioId,
      materialId,
      unlockCards,
    });
  }
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
  const selectedCardIds = storedDraft ? parseStoredJson<string[]>(storedDraft.selectedCardIdsJson, []) : [];
  return withPrivateCache(jsonResponse({
    branchId,
    scenarioId,
    roundNumber,
    actionChains: storedDraft ? readStoredActionChains(storedDraft.connectionsJson, selectedCardIds, scenario) : [],
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

  const validationIssue = validateRoundContent(scenario, body, false);
  if (validationIssue) {
    return withPrivateCache(errorResponse(validationIssue.status, validationIssue.code, validationIssue.message));
  }

  const draftId = await stableId("draft", `${branchId}\u0000${roundNumber}`);
  await saveRoundDraft(env.DB!, {
    id: draftId,
    branchId,
    roundNumber,
    scenarioId,
    selectedCardIdsJson: JSON.stringify(flattenActionChainCardIds(body.actionChains)),
    connectionsJson: JSON.stringify(body.actionChains),
    reasoningJson: "{}",
  });
  return withPrivateCache(jsonResponse({
    branchId,
    scenarioId,
    roundNumber,
    actionChains: body.actionChains,
    updatedAt: new Date().toISOString(),
  }));
}

async function submitRound(request: Request, env: LabApiEnv, branchId: string): Promise<Response> {
  const body = await parseRoundSubmissionBody(request);
  if (!body) {
    return withPrivateCache(errorResponse(400, "INVALID_ROUND_SUBMISSION", "A valid scenario, action chain, and idempotency key are required."));
  }
  const context = await readOwnedScenarioContext(request, env, branchId, body.scenarioId);
  if (context instanceof Response) return context;
  const scenario = findScenario(body.scenarioId);
  if (!scenario || context.branch.currentWeek < scenario.week) {
    return withPrivateCache(errorResponse(403, "SCENARIO_LOCKED", "This scenario is not available at the branch's current week."));
  }

  const replay = await findRoundSubmissionByIdempotency(env.DB!, branchId, body.idempotencyKey);
  if (replay) {
    if (replay.scenarioId !== body.scenarioId) {
      return withPrivateCache(errorResponse(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was already used for another scenario."));
    }
    return withPrivateCache(jsonResponse({
      ...parseStoredJson<RoundResult>(replay.ruleResultJson, {} as RoundResult),
      idempotentReplay: true,
    }));
  }
  if (context.branch.status !== "active") {
    return withPrivateCache(errorResponse(409, "BRANCH_NOT_ACTIVE", "This project branch no longer accepts new rounds."));
  }
  const nextRoundNumber = context.branch.currentRoundNumber + 1;
  if (body.expectedRoundNumber !== nextRoundNumber) {
    return withPrivateCache(errorResponse(409, "ROUND_CONFLICT", "The branch has advanced. Reload the latest round before submitting."));
  }
  if (!context.visibility.cardsUnlocked) {
    return withPrivateCache(errorResponse(409, "ACTION_CARDS_LOCKED", "Open every event material before submitting the action chain."));
  }
  const validationIssue = validateRoundContent(scenario, body, true);
  if (validationIssue) {
    return withPrivateCache(errorResponse(validationIssue.status, validationIssue.code, validationIssue.message));
  }

  const [snapshot, historicalSubmissions] = await Promise.all([
    readCurrentStateSnapshot(env.DB!, branchId, context.branch.currentRoundNumber),
    readScenarioActionChainSubmissions(env.DB!, branchId, body.scenarioId),
  ]);
  if (!snapshot || snapshot.scenarioId !== body.scenarioId) {
    return withPrivateCache(errorResponse(409, "BRANCH_STATE_MISSING", "The current branch state is unavailable for this scenario."));
  }
  const previousState = parseStoredJson<Record<string, unknown>>(snapshot.stateJson, {});
  const baselineWeeks = publicLabCaseBaseline.plans.baselineWorkload.weeks as StateEffect[];
  const nextWeek = context.branch.currentWeek + 1;
  const nextBaseline = baselineWeeks.find((week) => Number(week.week) === Math.min(nextWeek, publicLabCaseBaseline.totalWeeks));
  if (!nextBaseline) {
    return withPrivateCache(errorResponse(500, "BASELINE_STATE_MISSING", "The next weekly baseline is unavailable."));
  }
  const budgetAtCompletionCny = Number(publicLabCaseBaseline.plans.workload.budgetAtCompletionCny);
  const historicalActionChains = historicalSubmissions.flatMap((submission) => {
    const stored = parseStoredJson<{ actionChains?: unknown[] }>(submission.submissionJson, {});
    return (stored.actionChains ?? []).flatMap((value) => {
      const chain = parseActionChainValue(value);
      return chain ? [chain] : [];
    });
  });
  const settled = settleRound({
    branchId,
    roundNumber: nextRoundNumber,
    scenario,
    previousState,
    actionChains: body.actionChains,
    historicalActionChains,
    nextBaseline,
    budgetAtCompletionCny,
  });
  const stateJson = JSON.stringify(stableValue(settled.internalState));
  const stateHash = await sha256(stateJson);
  const publicResult = { ...settled.result, caseVersion: context.branch.caseVersion, stateHash };
  const ruleResultJson = JSON.stringify(publicResult);
  const branchStatus = settled.result.scenarioState === "open"
    ? "active"
    : settled.result.scenarioState === "closed" ? "completed" : "failed";
  const recordScope = `${branchId}\u0000${nextRoundNumber}`;

  try {
    await commitRoundRecords(env.DB!, {
      branchId,
      expectedCurrentRoundNumber: context.branch.currentRoundNumber,
      expectedLockVersion: context.branch.lockVersion,
      nextRoundNumber,
      nextWeek: settled.result.advancedToWeek,
      branchStatus,
      outcomeClassification: settled.result.pathClassification ?? null,
      submissionId: await stableId("submission", `${recordScope}\u0000${body.idempotencyKey}`),
      scenarioId: body.scenarioId,
      submissionJson: JSON.stringify({
        actionChains: body.actionChains,
      }),
      reasoningJson: "{}",
      ruleResultJson,
      idempotencyKey: body.idempotencyKey,
      snapshotId: `${branchId}:snapshot:${nextRoundNumber}`,
      stateJson,
      stateHash,
      eventId: `${branchId}:round-settled:${nextRoundNumber}`,
      eventPayloadJson: JSON.stringify({
        scenarioId: body.scenarioId,
        scenarioState: settled.result.scenarioState,
        pathClassification: settled.result.pathClassification ?? null,
        stateDiff: settled.result.stateDiff,
        gaps: settled.result.gaps,
      }),
      documentDeltas: settled.result.documentDiffs.map((documentDiff) => {
        const documentId = String(documentDiff.documentId);
        return {
          id: `${branchId}:document-delta:${nextRoundNumber}:${documentId}`,
          documentId,
          patchJson: JSON.stringify([{ op: "add", path: "/branchRevisions/-", value: { week: settled.result.advancedToWeek, roundNumber: nextRoundNumber } }]),
          reason: "round_settlement",
        };
      }),
    });
  } catch {
    const concurrentReplay = await findRoundSubmissionByIdempotency(env.DB!, branchId, body.idempotencyKey);
    if (concurrentReplay) {
      return withPrivateCache(jsonResponse({
        ...parseStoredJson<RoundResult>(concurrentReplay.ruleResultJson, {} as RoundResult),
        idempotentReplay: true,
      }));
    }
    return withPrivateCache(errorResponse(409, "ROUND_CONFLICT", "Another round was committed first. Reload the branch and try again."));
  }

  return withPrivateCache(jsonResponse({ ...publicResult, idempotentReplay: false }, { status: 201 }));
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
  if (parts.length === 5 && parts[2] === "branches" && parts[4] === "rounds") {
    if (request.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Only POST is supported.", { allow: "POST" });
    }
    return submitRound(request, env, parts[3]);
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
    const [snapshot, latestSubmission] = await Promise.all([
      readCurrentStateSnapshot(env.DB!, branch.id, branch.currentRoundNumber),
      branch.currentRoundNumber > 0 ? readRoundSubmission(env.DB!, branch.id, branch.currentRoundNumber) : Promise.resolve(null),
    ]);
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
      state: snapshot ? projectStoredBranchState(parseStoredJson<Record<string, unknown>>(snapshot.stateJson, {})) : null,
      stateHash: snapshot?.stateHash ?? null,
      lastRoundResult: latestSubmission ? parseStoredJson<RoundResult>(latestSubmission.ruleResultJson, {} as RoundResult) : null,
    }));
  } else {
    return errorResponse(404, "LAB_ROUTE_NOT_FOUND", "Lab API route not found.");
  }

  if (request.method === "HEAD") return new Response(null, { status: response.status, headers: response.headers });
  return response;
}
