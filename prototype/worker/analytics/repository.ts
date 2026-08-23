import type { PlatformIdentity } from "../auth/platform-identity";
import type { LabD1 } from "../lab/repository";

export type AnalyticsEventType = "ai_review_requested";

export type AnalyticsSummary = {
  generatedAt: string;
  rangeDays: number;
  rangeStartDate: string;
  timezone: "Asia/Shanghai";
  identifiedUsers: number;
  authenticatedVisitors: number;
  authenticatedVisitorsInRange: number;
  todayActiveUsers: number;
  branchCreators: number;
  aiReviewRequests: number;
  aiReviewRequestsInRange: number;
  dailyActivity: Array<{ date: string; activeUsers: number; visits: number }>;
  materialViews: Array<{
    scenarioId: string;
    scenarioTitle?: string;
    materialId: string;
    materialTitle?: string;
    views: number;
    uniqueUsers: number;
  }>;
};

function chinaDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeys(days: number): string[] {
  return Array.from({ length: days }, (_, index) => (
    chinaDateKey(new Date(Date.now() - (days - index - 1) * 86_400_000))
  ));
}

async function stableUserId(identityKey: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identityKey));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `user-${hex.slice(0, 32)}`;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function userUpsert(db: LabD1, identity: PlatformIdentity, userId: string) {
  return db.prepare(`
    INSERT INTO lab_users (id, identity_key, display_name)
    VALUES (?, ?, ?)
    ON CONFLICT(identity_key) DO UPDATE SET
      display_name = excluded.display_name,
      updated_at = CURRENT_TIMESTAMP
  `).bind(userId, identity.identityKey, identity.displayName);
}

export async function recordAuthenticatedVisit(
  db: LabD1,
  identity: PlatformIdentity,
  now = new Date(),
): Promise<void> {
  const userId = await stableUserId(identity.identityKey);
  const activityDate = chinaDateKey(now);
  await db.batch([
    userUpsert(db, identity, userId),
    db.prepare(`
      INSERT INTO lab_user_activity_days (
        user_id, activity_date, visit_count, first_seen_at, last_seen_at
      ) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, activity_date) DO UPDATE SET
        visit_count = visit_count + 1,
        last_seen_at = CURRENT_TIMESTAMP
    `).bind(userId, activityDate),
  ]);
}

export async function recordAnalyticsEvent(
  db: LabD1,
  identity: PlatformIdentity,
  event: {
    type: AnalyticsEventType;
    branchId?: string | null;
    scenarioId?: string | null;
    metadata?: Record<string, unknown>;
  },
  now = new Date(),
): Promise<void> {
  const userId = await stableUserId(identity.identityKey);
  await db.batch([
    userUpsert(db, identity, userId),
    db.prepare(`
      INSERT INTO lab_analytics_events (
        id, user_id, event_type, event_date, branch_id, scenario_id, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `analytics-${crypto.randomUUID()}`,
      userId,
      event.type,
      chinaDateKey(now),
      event.branchId ?? null,
      event.scenarioId ?? null,
      JSON.stringify(event.metadata ?? {}),
    ),
  ]);
}

export async function readAnalyticsSummary(db: LabD1, rangeDays: number): Promise<AnalyticsSummary> {
  const keys = dateKeys(rangeDays);
  const rangeStartDate = keys[0];
  const today = keys.at(-1) ?? chinaDateKey();
  const [
    identifiedUsers,
    authenticatedVisitors,
    authenticatedVisitorsInRange,
    todayActiveUsers,
    branchCreators,
    aiReviewRequests,
    aiReviewRequestsInRange,
    dailyRows,
    materialRows,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM lab_users").first<{ count: number }>(),
    db.prepare("SELECT COUNT(DISTINCT user_id) AS count FROM lab_user_activity_days").first<{ count: number }>(),
    db.prepare("SELECT COUNT(DISTINCT user_id) AS count FROM lab_user_activity_days WHERE activity_date >= ?").bind(rangeStartDate).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM lab_user_activity_days WHERE activity_date = ?").bind(today).first<{ count: number }>(),
    db.prepare("SELECT COUNT(DISTINCT user_id) AS count FROM lab_branches").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM lab_analytics_events WHERE event_type = 'ai_review_requested'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM lab_analytics_events WHERE event_type = 'ai_review_requested' AND event_date >= ?").bind(rangeStartDate).first<{ count: number }>(),
    db.prepare(`
      SELECT activity_date AS date, COUNT(*) AS activeUsers, SUM(visit_count) AS visits
      FROM lab_user_activity_days
      WHERE activity_date >= ?
      GROUP BY activity_date
      ORDER BY activity_date ASC
    `).bind(rangeStartDate).all<{ date: string; activeUsers: number; visits: number }>(),
    db.prepare(`
      SELECT
        json_extract(e.payload_json, '$.scenarioId') AS scenarioId,
        json_extract(e.payload_json, '$.materialId') AS materialId,
        COUNT(*) AS views,
        COUNT(DISTINCT b.user_id) AS uniqueUsers
      FROM lab_events e
      INNER JOIN lab_branches b ON b.id = e.branch_id
      WHERE e.event_type = 'scenario_material_viewed'
      GROUP BY scenarioId, materialId
      ORDER BY scenarioId ASC, materialId ASC
    `).all<{ scenarioId: string; materialId: string; views: number; uniqueUsers: number }>(),
  ]);

  const activityByDate = new Map((dailyRows.results ?? []).map((row) => [row.date, row]));
  return {
    generatedAt: new Date().toISOString(),
    rangeDays,
    rangeStartDate,
    timezone: "Asia/Shanghai",
    identifiedUsers: numberValue(identifiedUsers?.count),
    authenticatedVisitors: numberValue(authenticatedVisitors?.count),
    authenticatedVisitorsInRange: numberValue(authenticatedVisitorsInRange?.count),
    todayActiveUsers: numberValue(todayActiveUsers?.count),
    branchCreators: numberValue(branchCreators?.count),
    aiReviewRequests: numberValue(aiReviewRequests?.count),
    aiReviewRequestsInRange: numberValue(aiReviewRequestsInRange?.count),
    dailyActivity: keys.map((date) => {
      const row = activityByDate.get(date);
      return {
        date,
        activeUsers: numberValue(row?.activeUsers),
        visits: numberValue(row?.visits),
      };
    }),
    materialViews: (materialRows.results ?? []).map((row) => ({
      scenarioId: String(row.scenarioId ?? ""),
      materialId: String(row.materialId ?? ""),
      views: numberValue(row.views),
      uniqueUsers: numberValue(row.uniqueUsers),
    })),
  };
}
