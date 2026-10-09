import { sql } from "drizzle-orm";
import {
  ACTIVITY_STATUSES,
  ATTACHMENT_ENTITY_TYPES,
  ATTACHMENT_KINDS,
  ATTACHMENT_STATUSES,
  GOAL_STATUSES,
  HABIT_FREQUENCIES,
  JOURNAL_STATUSES,
  JOURNAL_TYPES,
  PRIORITIES,
  PROGRESS_MODES,
  TASK_STATUSES,
} from "../config/enums";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

const softDelete = {
  deletedAt: text("deleted_at"),
};

const enumCheck = (column: string, values: readonly string[]) =>
  sql.raw(`${column} IN (${values.map((value) => `'${value}'`).join(", ")})`);

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (table) => [
  check("ck_categories_name_len", sql`length(${table.name}) BETWEEN 1 AND 40`),
]);

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "restrict" }),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("not_started"),
  progressMode: text("progress_mode").notNull().default("auto"),
  manualProgress: integer("manual_progress"),
  startDate: text("start_date"),
  deadline: text("deadline"),
  ...timestamps,
  ...softDelete,
}, (table) => [
  check("ck_goals_title_len", sql`length(${table.title}) BETWEEN 1 AND 200`),
  check("ck_goals_priority", enumCheck("priority", PRIORITIES)),
  check("ck_goals_status", enumCheck("status", GOAL_STATUSES)),
  check("ck_goals_progress_mode", enumCheck("progress_mode", PROGRESS_MODES)),
  check(
    "ck_goals_manual_progress",
    sql`manual_progress IS NULL OR manual_progress BETWEEN 0 AND 100`,
  ),
  check(
    "ck_goals_deadline_order",
    sql`deadline IS NULL OR start_date IS NULL OR deadline >= start_date`,
  ),
  index("idx_goal_status").on(table.status).where(sql`deleted_at IS NULL`),
  index("idx_goal_deadline")
    .on(table.deadline)
    .where(sql`deleted_at IS NULL AND deadline IS NOT NULL`),
]);

export const milestones = sqliteTable("milestones", {
  id: text("id").primaryKey(),
  goalId: text("goal_id")
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  dueDate: text("due_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  check("ck_milestones_title_len", sql`length(${table.title}) BETWEEN 1 AND 200`),
  index("idx_ms_goal").on(table.goalId, table.sortOrder),
]);

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "restrict" }),
  goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
  sourceActivityId: text("source_activity_id").references((): AnySQLiteColumn => activities.id, {
    onDelete: "set null",
  }),
  date: text("date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  startEpoch: integer("start_epoch"),
  durationMinutes: integer("duration_minutes"),
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("planned"),
  priority: text("priority").notNull().default("medium"),
  location: text("location"),
  mood: integer("mood"),
  energyLevel: integer("energy_level"),
  ...timestamps,
  ...softDelete,
}, (table) => [
  check("ck_activities_title_len", sql`length(${table.title}) BETWEEN 1 AND 200`),
  check("ck_activities_status", enumCheck("status", ACTIVITY_STATUSES)),
  check("ck_activities_priority", enumCheck("priority", PRIORITIES)),
  check("ck_activities_mood", sql`mood IS NULL OR mood BETWEEN 1 AND 5`),
  check("ck_activities_energy", sql`energy_level IS NULL OR energy_level BETWEEN 1 AND 5`),
  check(
    "ck_activities_time_order",
    sql`start_time IS NULL OR end_time IS NULL OR end_time > start_time`,
  ),
  index("idx_act_date_alive").on(table.date).where(sql`deleted_at IS NULL`),
  index("idx_act_cat_date").on(table.categoryId, table.date),
  index("idx_act_status_date").on(table.status, table.date).where(sql`deleted_at IS NULL`),
  index("idx_act_goal").on(table.goalId).where(sql`goal_id IS NOT NULL`),
  index("idx_act_epoch").on(table.startEpoch).where(sql`start_epoch IS NOT NULL`),
]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  dueDate: text("due_date"),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "restrict" }),
  goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
  activityId: text("activity_id").references(() => activities.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: text("completed_at"),
  ...timestamps,
}, (table) => [
  check("ck_tasks_title_len", sql`length(${table.title}) BETWEEN 1 AND 200`),
  check("ck_tasks_status", enumCheck("status", TASK_STATUSES)),
  check("ck_tasks_priority", enumCheck("priority", PRIORITIES)),
  index("idx_task_status_due").on(table.status, table.dueDate),
  index("idx_task_goal").on(table.goalId).where(sql`goal_id IS NOT NULL`),
  index("idx_task_due_alive")
    .on(table.dueDate)
    .where(sql`status IN ('todo', 'in_progress')`),
]);

export const journals = sqliteTable("journals", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  type: text("type").notNull().default("daily"),
  mood: integer("mood"),
  energyLevel: integer("energy_level"),
  contentJson: text("content_json").notNull().default("{}"),
  contentPlain: text("content_plain").notNull().default(""),
  whatHappened: text("what_happened"),
  accomplished: text("accomplished"),
  wentWell: text("went_well"),
  didNotGoWell: text("did_not_go_well"),
  learned: text("learned"),
  improveTomorrow: text("improve_tomorrow"),
  gratitude: text("gratitude"),
  notes: text("notes"),
  private: integer("private", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("draft"),
  ...timestamps,
  ...softDelete,
}, (table) => [
  check("ck_journals_type", enumCheck("type", JOURNAL_TYPES)),
  check("ck_journals_status", enumCheck("status", JOURNAL_STATUSES)),
  check("ck_journals_mood", sql`mood IS NULL OR mood BETWEEN 1 AND 5`),
  check("ck_journals_energy", sql`energy_level IS NULL OR energy_level BETWEEN 1 AND 5`),
  uniqueIndex("uq_journal_daily")
    .on(table.date)
    .where(sql`type = 'daily' AND deleted_at IS NULL`),
  index("idx_journal_date").on(table.date),
]);

export const habits = sqliteTable("habits", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  frequency: text("frequency").notNull().default("daily"),
  intervalCount: integer("interval_count").notNull().default(1),
  targetPerPeriod: integer("target_per_period"),
  color: text("color"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (table) => [
  check("ck_habits_name_len", sql`length(${table.name}) BETWEEN 1 AND 80`),
  check("ck_habits_frequency", enumCheck("frequency", HABIT_FREQUENCIES)),
  check("ck_habits_interval", sql`interval_count >= 1`),
  check("ck_habits_target", sql`target_per_period IS NULL OR target_per_period >= 1`),
]);

export const habitLogs = sqliteTable("habit_logs", {
  id: text("id").primaryKey(),
  habitId: text("habit_id")
    .notNull()
    .references(() => habits.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("uq_habitlog").on(table.habitId, table.date),
  index("idx_habitlog_date").on(table.date),
]);

export const activityTags = sqliteTable(
  "activity_tags",
  {
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.activityId, table.tagId] }),
    index("idx_tag_act").on(table.tagId),
  ],
);

export const journalTags = sqliteTable(
  "journal_tags",
  {
    journalId: text("journal_id")
      .notNull()
      .references(() => journals.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.journalId, table.tagId] }),
    index("idx_tag_journal").on(table.tagId),
  ],
);

export const taskTags = sqliteTable(
  "task_tags",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.tagId] }),
    index("idx_tag_task").on(table.tagId),
  ],
);

export const goalTags = sqliteTable(
  "goal_tags",
  {
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.goalId, table.tagId] }),
    index("idx_tag_goal").on(table.tagId),
  ],
);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull().unique(),
  kind: text("kind").notNull(),
  thumbPath: text("thumb_path"),
  checksum: text("checksum").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  check("ck_attachments_entity_type", enumCheck("entity_type", ATTACHMENT_ENTITY_TYPES)),
  check("ck_attachments_kind", enumCheck("kind", ATTACHMENT_KINDS)),
  check("ck_attachments_status", enumCheck("status", ATTACHMENT_STATUSES)),
  check("ck_attachments_size", sql`size_bytes > 0`),
  index("idx_att_entity").on(table.entityType, table.entityId),
  index("idx_att_status").on(table.status).where(sql`status != 'ready'`),
]);

export const preferences = sqliteTable("preferences", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const schema = {
  categories,
  tags,
  goals,
  milestones,
  activities,
  tasks,
  journals,
  habits,
  habitLogs,
  activityTags,
  journalTags,
  taskTags,
  goalTags,
  attachments,
  preferences,
  meta,
};
