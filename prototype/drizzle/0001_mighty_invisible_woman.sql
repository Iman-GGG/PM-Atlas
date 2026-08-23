CREATE TABLE `lab_analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`branch_id` text,
	`scenario_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `lab_users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lab_analytics_events_type_ck" CHECK("lab_analytics_events"."event_type" IN ('ai_review_requested'))
);
--> statement-breakpoint
CREATE INDEX `lab_analytics_events_type_date_idx` ON `lab_analytics_events` (`event_type`,`event_date`);--> statement-breakpoint
CREATE INDEX `lab_analytics_events_user_date_idx` ON `lab_analytics_events` (`user_id`,`event_date`);--> statement-breakpoint
CREATE TABLE `lab_user_activity_days` (
	`user_id` text NOT NULL,
	`activity_date` text NOT NULL,
	`visit_count` integer DEFAULT 1 NOT NULL,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `activity_date`),
	FOREIGN KEY (`user_id`) REFERENCES `lab_users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "lab_user_activity_days_visit_count_ck" CHECK("lab_user_activity_days"."visit_count" >= 1)
);
--> statement-breakpoint
CREATE INDEX `lab_user_activity_days_date_idx` ON `lab_user_activity_days` (`activity_date`);
--> statement-breakpoint
INSERT OR IGNORE INTO `lab_analytics_events` (
	`id`, `user_id`, `event_type`, `event_date`, `branch_id`, `scenario_id`, `metadata_json`, `created_at`
)
SELECT
	'analytics-legacy-ai-' || reviews.`id`,
	branches.`user_id`,
	'ai_review_requested',
	substr(datetime(reviews.`created_at`, '+8 hours'), 1, 10),
	reviews.`branch_id`,
	reviews.`scenario_id`,
	'{"source":"historical_review"}',
	reviews.`created_at`
FROM `lab_ai_reviews` reviews
INNER JOIN `lab_branches` branches ON branches.`id` = reviews.`branch_id`;
--> statement-breakpoint
PRAGMA optimize;
