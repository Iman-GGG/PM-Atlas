CREATE TABLE `lab_ai_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`scenario_id` text DEFAULT '__project__' NOT NULL,
	`review_kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`state_hash` text NOT NULL,
	`review_json` text,
	`model_ref` text NOT NULL,
	`prompt_version` text NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `lab_branches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lab_ai_reviews_kind_scope_ck" CHECK(("lab_ai_reviews"."review_kind" = 'project' AND "lab_ai_reviews"."scenario_id" = '__project__') OR ("lab_ai_reviews"."review_kind" = 'scenario' AND "lab_ai_reviews"."scenario_id" <> '__project__')),
	CONSTRAINT "lab_ai_reviews_status_ck" CHECK("lab_ai_reviews"."status" IN ('pending', 'completed', 'failed', 'budget_blocked')),
	CONSTRAINT "lab_ai_reviews_retry_ck" CHECK("lab_ai_reviews"."retry_count" BETWEEN 0 AND 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_ai_reviews_cache_uq` ON `lab_ai_reviews` (`branch_id`,`review_kind`,`scenario_id`,`state_hash`,`prompt_version`);--> statement-breakpoint
CREATE INDEX `lab_ai_reviews_branch_status_idx` ON `lab_ai_reviews` (`branch_id`,`status`);--> statement-breakpoint
CREATE TABLE `lab_branches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`case_id` text NOT NULL,
	`case_version` text NOT NULL,
	`parent_branch_id` text,
	`fork_week` integer NOT NULL,
	`fork_round_number` integer DEFAULT 0 NOT NULL,
	`current_week` integer NOT NULL,
	`current_round_number` integer DEFAULT 0 NOT NULL,
	`lock_version` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`outcome_classification` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `lab_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_branch_id`) REFERENCES `lab_branches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`case_id`,`case_version`) REFERENCES `lab_case_versions`(`case_id`,`case_version`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "lab_branches_week_ck" CHECK("lab_branches"."fork_week" >= 1 AND "lab_branches"."current_week" >= "lab_branches"."fork_week"),
	CONSTRAINT "lab_branches_round_ck" CHECK("lab_branches"."fork_round_number" >= 0 AND "lab_branches"."current_round_number" >= "lab_branches"."fork_round_number"),
	CONSTRAINT "lab_branches_lock_version_ck" CHECK("lab_branches"."lock_version" >= 0),
	CONSTRAINT "lab_branches_status_ck" CHECK("lab_branches"."status" IN ('active', 'completed', 'failed', 'archived')),
	CONSTRAINT "lab_branches_outcome_ck" CHECK("lab_branches"."outcome_classification" IS NULL OR "lab_branches"."outcome_classification" IN ('near_mainline_success', 'detour_success', 'delayed_success', 'scenario_failure'))
);
--> statement-breakpoint
CREATE INDEX `lab_branches_user_case_idx` ON `lab_branches` (`user_id`,`case_id`,`case_version`);--> statement-breakpoint
CREATE INDEX `lab_branches_parent_idx` ON `lab_branches` (`parent_branch_id`);--> statement-breakpoint
CREATE INDEX `lab_branches_status_idx` ON `lab_branches` (`status`);--> statement-breakpoint
CREATE TABLE `lab_case_versions` (
	`case_id` text NOT NULL,
	`case_version` text NOT NULL,
	`content_hash` text NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`case_id`, `case_version`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_case_versions_content_hash_uq` ON `lab_case_versions` (`content_hash`);--> statement-breakpoint
CREATE TABLE `lab_document_deltas` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`document_id` text NOT NULL,
	`week` integer NOT NULL,
	`patch_json` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `lab_branches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lab_document_deltas_round_week_ck" CHECK("lab_document_deltas"."round_number" >= 1 AND "lab_document_deltas"."week" >= 1)
);
--> statement-breakpoint
CREATE INDEX `lab_document_deltas_branch_document_week_idx` ON `lab_document_deltas` (`branch_id`,`document_id`,`week`);--> statement-breakpoint
CREATE INDEX `lab_document_deltas_branch_round_idx` ON `lab_document_deltas` (`branch_id`,`round_number`);--> statement-breakpoint
CREATE TABLE `lab_events` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`round_number` integer,
	`week` integer NOT NULL,
	`event_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`visibility` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `lab_branches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lab_events_round_week_ck" CHECK(("lab_events"."round_number" IS NULL OR "lab_events"."round_number" >= 0) AND "lab_events"."week" >= 1),
	CONSTRAINT "lab_events_visibility_ck" CHECK("lab_events"."visibility" IN ('user', 'review_only', 'internal'))
);
--> statement-breakpoint
CREATE INDEX `lab_events_branch_week_idx` ON `lab_events` (`branch_id`,`week`);--> statement-breakpoint
CREATE INDEX `lab_events_branch_type_idx` ON `lab_events` (`branch_id`,`event_type`);--> statement-breakpoint
CREATE TABLE `lab_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`case_id` text NOT NULL,
	`case_version` text NOT NULL,
	`highest_unlocked_week` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `lab_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`case_id`,`case_version`) REFERENCES `lab_case_versions`(`case_id`,`case_version`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "lab_progress_unlocked_week_ck" CHECK("lab_progress"."highest_unlocked_week" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_progress_user_case_version_uq` ON `lab_progress` (`user_id`,`case_id`,`case_version`);--> statement-breakpoint
CREATE INDEX `lab_progress_user_idx` ON `lab_progress` (`user_id`);--> statement-breakpoint
CREATE TABLE `lab_round_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`scenario_id` text NOT NULL,
	`selected_card_ids_json` text DEFAULT '[]' NOT NULL,
	`connections_json` text DEFAULT '[]' NOT NULL,
	`reasoning_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `lab_branches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lab_round_drafts_round_ck" CHECK("lab_round_drafts"."round_number" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_round_drafts_branch_round_uq` ON `lab_round_drafts` (`branch_id`,`round_number`);--> statement-breakpoint
CREATE INDEX `lab_round_drafts_branch_idx` ON `lab_round_drafts` (`branch_id`);--> statement-breakpoint
CREATE TABLE `lab_round_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`scenario_id` text NOT NULL,
	`submission_json` text NOT NULL,
	`reasoning_json` text NOT NULL,
	`rule_result_json` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `lab_branches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lab_round_submissions_round_ck" CHECK("lab_round_submissions"."round_number" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_round_submissions_branch_round_uq` ON `lab_round_submissions` (`branch_id`,`round_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `lab_round_submissions_branch_idempotency_uq` ON `lab_round_submissions` (`branch_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `lab_round_submissions_branch_idx` ON `lab_round_submissions` (`branch_id`);--> statement-breakpoint
CREATE TABLE `lab_state_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`week` integer NOT NULL,
	`scenario_id` text,
	`state_json` text NOT NULL,
	`state_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `lab_branches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lab_state_snapshots_round_week_ck" CHECK("lab_state_snapshots"."round_number" >= 0 AND "lab_state_snapshots"."week" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_state_snapshots_branch_round_uq` ON `lab_state_snapshots` (`branch_id`,`round_number`);--> statement-breakpoint
CREATE INDEX `lab_state_snapshots_branch_week_idx` ON `lab_state_snapshots` (`branch_id`,`week`);--> statement-breakpoint
CREATE INDEX `lab_state_snapshots_hash_idx` ON `lab_state_snapshots` (`state_hash`);--> statement-breakpoint
CREATE TABLE `lab_users` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_key` text NOT NULL,
	`display_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_users_identity_key_uq` ON `lab_users` (`identity_key`);