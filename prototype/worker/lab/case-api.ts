import { publicLabCaseBaseline } from "../../lib/lab/lab-case-public.generated";
import type { StateEffect } from "../../lib/lab/contracts";
import { getPlatformIdentity } from "../auth/platform-identity";
import { privateLabCasePackage } from "../generated/lab-case-private.generated";
import { projectScenarioForClient } from "./project-case-for-client";
import {
  createBranchRecords,
  findLabUser,
  findOwnedBranch,
  findStoredCaseVersion,
  readBranchEvents,
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
      relations: (source.relations as StateEffect[]).filter((item) => Number(item.effectiveWeek) <= week),
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
  visibleMaterialIds: string[];
  cardsUnlocked: boolean;
} {
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
    if (typeof payload.materialId === "string") visibleMaterialIds.add(payload.materialId);
    if (Array.isArray(payload.materialIds)) {
      for (const materialId of payload.materialIds) {
        if (typeof materialId === "string") visibleMaterialIds.add(materialId);
      }
    }
    if (payload.cardsUnlocked === true || event.eventType === "scenario_cards_unlocked") cardsUnlocked = true;
  }

  return { visibleMaterialIds: [...visibleMaterialIds], cardsUnlocked };
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
    const visibility = parseEventVisibility(events, scenarioId);
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
