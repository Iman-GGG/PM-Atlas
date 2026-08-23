import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => text(name).notNull().default(sql`CURRENT_TIMESTAMP`);

export const labUsers = sqliteTable(
  "lab_users",
  {
    id: text("id").primaryKey(),
    identityKey: text("identity_key").notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [uniqueIndex("lab_users_identity_key_uq").on(table.identityKey)],
);

export const labUserActivityDays = sqliteTable(
  "lab_user_activity_days",
  {
    userId: text("user_id")
      .notNull()
      .references(() => labUsers.id, { onDelete: "cascade" }),
    activityDate: text("activity_date").notNull(),
    visitCount: integer("visit_count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at"),
    lastSeenAt: timestamp("last_seen_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.activityDate], name: "lab_user_activity_days_pk" }),
    index("lab_user_activity_days_date_idx").on(table.activityDate),
    check("lab_user_activity_days_visit_count_ck", sql`${table.visitCount} >= 1`),
  ],
);

export const labCaseVersions = sqliteTable(
  "lab_case_versions",
  {
    caseId: text("case_id").notNull(),
    caseVersion: text("case_version").notNull(),
    contentHash: text("content_hash").notNull(),
    publishedAt: timestamp("published_at"),
  },
  (table) => [
    primaryKey({ columns: [table.caseId, table.caseVersion], name: "lab_case_versions_pk" }),
    uniqueIndex("lab_case_versions_content_hash_uq").on(table.contentHash),
  ],
);

export const labProgress = sqliteTable(
  "lab_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => labUsers.id, { onDelete: "cascade" }),
    caseId: text("case_id").notNull(),
    caseVersion: text("case_version").notNull(),
    highestUnlockedWeek: integer("highest_unlocked_week").notNull().default(1),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    foreignKey({
      columns: [table.caseId, table.caseVersion],
      foreignColumns: [labCaseVersions.caseId, labCaseVersions.caseVersion],
      name: "lab_progress_case_version_fk",
    }).onDelete("restrict"),
    uniqueIndex("lab_progress_user_case_version_uq").on(table.userId, table.caseId, table.caseVersion),
    index("lab_progress_user_idx").on(table.userId),
    check("lab_progress_unlocked_week_ck", sql`${table.highestUnlockedWeek} >= 1`),
  ],
);

export const labBranches = sqliteTable(
  "lab_branches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => labUsers.id, { onDelete: "cascade" }),
    caseId: text("case_id").notNull(),
    caseVersion: text("case_version").notNull(),
    parentBranchId: text("parent_branch_id").references((): AnySQLiteColumn => labBranches.id, {
      onDelete: "set null",
    }),
    forkWeek: integer("fork_week").notNull(),
    forkRoundNumber: integer("fork_round_number").notNull().default(0),
    currentWeek: integer("current_week").notNull(),
    currentRoundNumber: integer("current_round_number").notNull().default(0),
    lockVersion: integer("lock_version").notNull().default(0),
    status: text("status", { enum: ["active", "completed", "failed", "archived"] })
      .notNull()
      .default("active"),
    outcomeClassification: text("outcome_classification", {
      enum: ["near_mainline_success", "detour_success", "delayed_success", "scenario_failure"],
    }),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    foreignKey({
      columns: [table.caseId, table.caseVersion],
      foreignColumns: [labCaseVersions.caseId, labCaseVersions.caseVersion],
      name: "lab_branches_case_version_fk",
    }).onDelete("restrict"),
    index("lab_branches_user_case_idx").on(table.userId, table.caseId, table.caseVersion),
    index("lab_branches_parent_idx").on(table.parentBranchId),
    index("lab_branches_status_idx").on(table.status),
    check("lab_branches_week_ck", sql`${table.forkWeek} >= 1 AND ${table.currentWeek} >= ${table.forkWeek}`),
    check("lab_branches_round_ck", sql`${table.forkRoundNumber} >= 0 AND ${table.currentRoundNumber} >= ${table.forkRoundNumber}`),
    check("lab_branches_lock_version_ck", sql`${table.lockVersion} >= 0`),
    check("lab_branches_status_ck", sql`${table.status} IN ('active', 'completed', 'failed', 'archived')`),
    check("lab_branches_outcome_ck", sql`${table.outcomeClassification} IS NULL OR ${table.outcomeClassification} IN ('near_mainline_success', 'detour_success', 'delayed_success', 'scenario_failure')`),
  ],
);

export const labRoundDrafts = sqliteTable(
  "lab_round_drafts",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id")
      .notNull()
      .references(() => labBranches.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    scenarioId: text("scenario_id").notNull(),
    selectedCardIdsJson: text("selected_card_ids_json").notNull().default("[]"),
    connectionsJson: text("connections_json").notNull().default("[]"),
    reasoningJson: text("reasoning_json").notNull().default("{}"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("lab_round_drafts_branch_round_uq").on(table.branchId, table.roundNumber),
    index("lab_round_drafts_branch_idx").on(table.branchId),
    check("lab_round_drafts_round_ck", sql`${table.roundNumber} >= 1`),
  ],
);

export const labRoundSubmissions = sqliteTable(
  "lab_round_submissions",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id")
      .notNull()
      .references(() => labBranches.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    scenarioId: text("scenario_id").notNull(),
    submissionJson: text("submission_json").notNull(),
    reasoningJson: text("reasoning_json").notNull(),
    ruleResultJson: text("rule_result_json").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    submittedAt: timestamp("submitted_at"),
  },
  (table) => [
    uniqueIndex("lab_round_submissions_branch_round_uq").on(table.branchId, table.roundNumber),
    uniqueIndex("lab_round_submissions_branch_idempotency_uq").on(table.branchId, table.idempotencyKey),
    index("lab_round_submissions_branch_idx").on(table.branchId),
    check("lab_round_submissions_round_ck", sql`${table.roundNumber} >= 1`),
  ],
);

export const labStateSnapshots = sqliteTable(
  "lab_state_snapshots",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id")
      .notNull()
      .references(() => labBranches.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    week: integer("week").notNull(),
    scenarioId: text("scenario_id"),
    stateJson: text("state_json").notNull(),
    stateHash: text("state_hash").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    uniqueIndex("lab_state_snapshots_branch_round_uq").on(table.branchId, table.roundNumber),
    index("lab_state_snapshots_branch_week_idx").on(table.branchId, table.week),
    index("lab_state_snapshots_hash_idx").on(table.stateHash),
    check("lab_state_snapshots_round_week_ck", sql`${table.roundNumber} >= 0 AND ${table.week} >= 1`),
  ],
);

export const labEvents = sqliteTable(
  "lab_events",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id")
      .notNull()
      .references(() => labBranches.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number"),
    week: integer("week").notNull(),
    eventType: text("event_type").notNull(),
    payloadJson: text("payload_json").notNull(),
    visibility: text("visibility", { enum: ["user", "review_only", "internal"] })
      .notNull()
      .default("user"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("lab_events_branch_week_idx").on(table.branchId, table.week),
    index("lab_events_branch_type_idx").on(table.branchId, table.eventType),
    check("lab_events_round_week_ck", sql`(${table.roundNumber} IS NULL OR ${table.roundNumber} >= 0) AND ${table.week} >= 1`),
    check("lab_events_visibility_ck", sql`${table.visibility} IN ('user', 'review_only', 'internal')`),
  ],
);

export const labDocumentDeltas = sqliteTable(
  "lab_document_deltas",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id")
      .notNull()
      .references(() => labBranches.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    documentId: text("document_id").notNull(),
    week: integer("week").notNull(),
    patchJson: text("patch_json").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("lab_document_deltas_branch_document_week_idx").on(table.branchId, table.documentId, table.week),
    index("lab_document_deltas_branch_round_idx").on(table.branchId, table.roundNumber),
    check("lab_document_deltas_round_week_ck", sql`${table.roundNumber} >= 1 AND ${table.week} >= 1`),
  ],
);

export const labAiReviews = sqliteTable(
  "lab_ai_reviews",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id")
      .notNull()
      .references(() => labBranches.id, { onDelete: "cascade" }),
    scenarioId: text("scenario_id").notNull().default("__project__"),
    reviewKind: text("review_kind", { enum: ["scenario", "project"] }).notNull(),
    status: text("status", { enum: ["pending", "completed", "failed", "budget_blocked"] })
      .notNull()
      .default("pending"),
    stateHash: text("state_hash").notNull(),
    reviewJson: text("review_json"),
    modelRef: text("model_ref").notNull(),
    promptVersion: text("prompt_version").notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (table) => [
    uniqueIndex("lab_ai_reviews_cache_uq").on(
      table.branchId,
      table.reviewKind,
      table.scenarioId,
      table.stateHash,
      table.promptVersion,
    ),
    index("lab_ai_reviews_branch_status_idx").on(table.branchId, table.status),
    check("lab_ai_reviews_kind_scope_ck", sql`(${table.reviewKind} = 'project' AND ${table.scenarioId} = '__project__') OR (${table.reviewKind} = 'scenario' AND ${table.scenarioId} <> '__project__')`),
    check("lab_ai_reviews_status_ck", sql`${table.status} IN ('pending', 'completed', 'failed', 'budget_blocked')`),
    check("lab_ai_reviews_retry_ck", sql`${table.retryCount} BETWEEN 0 AND 1`),
  ],
);

export const labAnalyticsEvents = sqliteTable(
  "lab_analytics_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => labUsers.id, { onDelete: "cascade" }),
    eventType: text("event_type", { enum: ["ai_review_requested"] }).notNull(),
    eventDate: text("event_date").notNull(),
    branchId: text("branch_id"),
    scenarioId: text("scenario_id"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: timestamp("created_at"),
  },
  (table) => [
    index("lab_analytics_events_type_date_idx").on(table.eventType, table.eventDate),
    index("lab_analytics_events_user_date_idx").on(table.userId, table.eventDate),
    check("lab_analytics_events_type_ck", sql`${table.eventType} IN ('ai_review_requested')`),
  ],
);
