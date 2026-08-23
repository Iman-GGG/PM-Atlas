import { getPlatformIdentity } from "../auth/platform-identity";
import { privateLabCasePackage } from "../generated/lab-case-private.generated";
import type { LabD1 } from "../lab/repository";
import { readAnalyticsSummary } from "./repository";

export type AnalyticsApiEnv = {
  DB?: LabD1;
  ANALYTICS_ADMIN_EMAILS?: string;
};

export function isAnalyticsAdmin(email: string, configuredEmails?: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (configuredEmails ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "private, no-store");
  headers.set("vary", "oai-authenticated-user-id, oai-authenticated-user-email");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function materialLabels(scenarioId: string, materialId: string): { scenarioTitle?: string; materialTitle?: string } {
  const scenario = privateLabCasePackage.sourceFiles.scenarioPlan.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) return {};
  const materials = [
    ...scenario.eventMaterials.primaryClues,
    ...scenario.eventMaterials.corroboratingClues,
    ...scenario.eventMaterials.dashboardAnomalies,
  ];
  const material = materials.find((item) => item.id === materialId);
  return {
    scenarioTitle: scenario.title,
    materialTitle: material?.subject ?? material?.displayLabel,
  };
}

export async function handleAnalyticsApi(request: Request, env: AnalyticsApiEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/analytics/")) return null;
  if (url.pathname !== "/api/analytics/summary") {
    return jsonResponse({ error: { code: "ANALYTICS_ROUTE_NOT_FOUND", message: "Analytics route not found." } }, { status: 404 });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Only GET and HEAD are supported." } }, { status: 405, headers: { allow: "GET, HEAD" } });
  }
  const identity = await getPlatformIdentity(request);
  if (!identity) {
    return jsonResponse({ error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in with ChatGPT to view analytics." } }, { status: 401 });
  }
  if (!isAnalyticsAdmin(identity.email, env.ANALYTICS_ADMIN_EMAILS)) {
    return jsonResponse({ error: { code: "ANALYTICS_ACCESS_DENIED", message: "This account cannot view site analytics." } }, { status: 403 });
  }
  if (!env.DB) {
    return jsonResponse({ error: { code: "DATABASE_UNAVAILABLE", message: "Analytics storage is unavailable." } }, { status: 503 });
  }
  const rawDays = Number(url.searchParams.get("days") ?? 30);
  const rangeDays = [7, 30, 90].includes(rawDays) ? rawDays : 30;
  const summary = await readAnalyticsSummary(env.DB, rangeDays);
  const response = jsonResponse({
    ...summary,
    materialViews: summary.materialViews.map((item) => ({
      ...item,
      ...materialLabels(item.scenarioId, item.materialId),
    })),
  });
  if (request.method === "HEAD") return new Response(null, { status: response.status, headers: response.headers });
  return response;
}
