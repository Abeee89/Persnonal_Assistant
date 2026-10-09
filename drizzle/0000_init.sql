CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category_id` text,
	`goal_id` text,
	`source_activity_id` text,
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`start_epoch` integer,
	`duration_minutes` integer,
	`all_day` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`location` text,
	`mood` integer,
	`energy_level` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ck_activities_title_len" CHECK(length("activities"."title") BETWEEN 1 AND 200),
	CONSTRAINT "ck_activities_status" CHECK(status IN ('planned', 'in_progress', 'done', 'cancelled')),
	CONSTRAINT "ck_activities_priority" CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
	CONSTRAINT "ck_activities_mood" CHECK(mood IS NULL OR mood BETWEEN 1 AND 5),
	CONSTRAINT "ck_activities_energy" CHECK(energy_level IS NULL OR energy_level BETWEEN 1 AND 5),
	CONSTRAINT "ck_activities_time_order" CHECK(start_time IS NULL OR end_time IS NULL OR end_time > start_time)
);
--> statement-breakpoint
CREATE INDEX `idx_act_date_alive` ON `activities` (`date`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_act_cat_date` ON `activities` (`category_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_act_status_date` ON `activities` (`status`,`date`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_act_goal` ON `activities` (`goal_id`) WHERE goal_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_act_epoch` ON `activities` (`start_epoch`) WHERE start_epoch IS NOT NULL;--> statement-breakpoint
CREATE TABLE `activity_tags` (
	`activity_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`activity_id`, `tag_id`),
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tag_act` ON `activity_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_path` text NOT NULL,
	`kind` text NOT NULL,
	`thumb_path` text,
	`checksum` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "ck_attachments_entity_type" CHECK(entity_type IN ('activity', 'journal', 'task', 'goal')),
	CONSTRAINT "ck_attachments_kind" CHECK(kind IN ('image', 'pdf', 'other')),
	CONSTRAINT "ck_attachments_status" CHECK(status IN ('pending', 'ready', 'orphan')),
	CONSTRAINT "ck_attachments_size" CHECK(size_bytes > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_storage_path_unique` ON `attachments` (`storage_path`);--> statement-breakpoint
CREATE INDEX `idx_att_entity` ON `attachments` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_att_status` ON `attachments` (`status`) WHERE status != 'ready';--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "ck_categories_name_len" CHECK(length("categories"."name") BETWEEN 1 AND 40)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `goal_tags` (
	`goal_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`goal_id`, `tag_id`),
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tag_goal` ON `goal_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category_id` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`progress_mode` text DEFAULT 'auto' NOT NULL,
	`manual_progress` integer,
	`start_date` text,
	`deadline` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_goals_title_len" CHECK(length("goals"."title") BETWEEN 1 AND 200),
	CONSTRAINT "ck_goals_priority" CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
	CONSTRAINT "ck_goals_status" CHECK(status IN ('not_started', 'in_progress', 'completed', 'archived')),
	CONSTRAINT "ck_goals_progress_mode" CHECK(progress_mode IN ('auto', 'manual')),
	CONSTRAINT "ck_goals_manual_progress" CHECK(manual_progress IS NULL OR manual_progress BETWEEN 0 AND 100),
	CONSTRAINT "ck_goals_deadline_order" CHECK(deadline IS NULL OR start_date IS NULL OR deadline >= start_date)
);
--> statement-breakpoint
CREATE INDEX `idx_goal_status` ON `goals` (`status`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_goal_deadline` ON `goals` (`deadline`) WHERE deleted_at IS NULL AND deadline IS NOT NULL;--> statement-breakpoint
CREATE TABLE `habit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_habitlog` ON `habit_logs` (`habit_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_habitlog_date` ON `habit_logs` (`date`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`frequency` text DEFAULT 'daily' NOT NULL,
	`interval_count` integer DEFAULT 1 NOT NULL,
	`target_per_period` integer,
	`color` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "ck_habits_name_len" CHECK(length("habits"."name") BETWEEN 1 AND 80),
	CONSTRAINT "ck_habits_frequency" CHECK(frequency IN ('daily', 'weekly', 'monthly')),
	CONSTRAINT "ck_habits_interval" CHECK(interval_count >= 1),
	CONSTRAINT "ck_habits_target" CHECK(target_per_period IS NULL OR target_per_period >= 1)
);
--> statement-breakpoint
CREATE TABLE `journal_tags` (
	`journal_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`journal_id`, `tag_id`),
	FOREIGN KEY (`journal_id`) REFERENCES `journals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tag_journal` ON `journal_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `journals` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`type` text DEFAULT 'daily' NOT NULL,
	`mood` integer,
	`energy_level` integer,
	`content_json` text DEFAULT '{}' NOT NULL,
	`content_plain` text DEFAULT '' NOT NULL,
	`what_happened` text,
	`accomplished` text,
	`went_well` text,
	`did_not_go_well` text,
	`learned` text,
	`improve_tomorrow` text,
	`gratitude` text,
	`notes` text,
	`private` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "ck_journals_type" CHECK(type IN ('daily', 'weekly', 'monthly')),
	CONSTRAINT "ck_journals_status" CHECK(status IN ('draft', 'final')),
	CONSTRAINT "ck_journals_mood" CHECK(mood IS NULL OR mood BETWEEN 1 AND 5),
	CONSTRAINT "ck_journals_energy" CHECK(energy_level IS NULL OR energy_level BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_journal_daily` ON `journals` (`date`) WHERE type = 'daily' AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX `idx_journal_date` ON `journals` (`date`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`due_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_milestones_title_len" CHECK(length("milestones"."title") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE INDEX `idx_ms_goal` ON `milestones` (`goal_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `preferences` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `task_tags` (
	`task_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `tag_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tag_task` ON `task_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` text,
	`category_id` text,
	`goal_id` text,
	`activity_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_tasks_title_len" CHECK(length("tasks"."title") BETWEEN 1 AND 200),
	CONSTRAINT "ck_tasks_status" CHECK(status IN ('todo', 'in_progress', 'done', 'cancelled')),
	CONSTRAINT "ck_tasks_priority" CHECK(priority IN ('low', 'medium', 'high', 'urgent'))
);
--> statement-breakpoint
CREATE INDEX `idx_task_status_due` ON `tasks` (`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `idx_task_goal` ON `tasks` (`goal_id`) WHERE goal_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_task_due_alive` ON `tasks` (`due_date`) WHERE status IN ('todo', 'in_progress');