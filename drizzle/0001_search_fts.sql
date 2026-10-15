CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
  kind UNINDEXED,
  ref UNINDEXED,
  title,
  body,
  tags,
  tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_activities_ai AFTER INSERT ON activities BEGIN
  DELETE FROM search_fts WHERE kind = 'activity' AND ref = new.id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'activity', new.id, new.title, coalesce(new.description, ''),
    coalesce((SELECT group_concat(t.name, ' ') FROM activity_tags at JOIN tags t ON t.id = at.tag_id WHERE at.activity_id = new.id), '')
  WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_activities_au AFTER UPDATE ON activities BEGIN
  DELETE FROM search_fts WHERE kind = 'activity' AND ref = new.id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'activity', new.id, new.title, coalesce(new.description, ''),
    coalesce((SELECT group_concat(t.name, ' ') FROM activity_tags at JOIN tags t ON t.id = at.tag_id WHERE at.activity_id = new.id), '')
  WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_activities_ad AFTER DELETE ON activities BEGIN
  DELETE FROM search_fts WHERE kind = 'activity' AND ref = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_activity_tags_ai AFTER INSERT ON activity_tags BEGIN
  DELETE FROM search_fts WHERE kind = 'activity' AND ref = new.activity_id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'activity', a.id, a.title, coalesce(a.description, ''),
    coalesce((SELECT group_concat(t.name, ' ') FROM activity_tags at JOIN tags t ON t.id = at.tag_id WHERE at.activity_id = a.id), '')
  FROM activities a WHERE a.id = new.activity_id AND a.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_activity_tags_ad AFTER DELETE ON activity_tags BEGIN
  DELETE FROM search_fts WHERE kind = 'activity' AND ref = old.activity_id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'activity', a.id, a.title, coalesce(a.description, ''),
    coalesce((SELECT group_concat(t.name, ' ') FROM activity_tags at JOIN tags t ON t.id = at.tag_id WHERE at.activity_id = a.id), '')
  FROM activities a WHERE a.id = old.activity_id AND a.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_tasks_ai AFTER INSERT ON tasks BEGIN
  DELETE FROM search_fts WHERE kind = 'task' AND ref = new.id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'task', new.id, new.title, coalesce(new.description, ''),
    coalesce((SELECT group_concat(t.name, ' ') FROM task_tags tt JOIN tags t ON t.id = tt.tag_id WHERE tt.task_id = new.id), '');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_tasks_au AFTER UPDATE ON tasks BEGIN
  DELETE FROM search_fts WHERE kind = 'task' AND ref = new.id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'task', new.id, new.title, coalesce(new.description, ''),
    coalesce((SELECT group_concat(t.name, ' ') FROM task_tags tt JOIN tags t ON t.id = tt.tag_id WHERE tt.task_id = new.id), '');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_tasks_ad AFTER DELETE ON tasks BEGIN
  DELETE FROM search_fts WHERE kind = 'task' AND ref = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_task_tags_ai AFTER INSERT ON task_tags BEGIN
  DELETE FROM search_fts WHERE kind = 'task' AND ref = new.task_id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'task', t.id, t.title, coalesce(t.description, ''),
    coalesce((SELECT group_concat(g.name, ' ') FROM task_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.task_id = t.id), '')
  FROM tasks t WHERE t.id = new.task_id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_task_tags_ad AFTER DELETE ON task_tags BEGIN
  DELETE FROM search_fts WHERE kind = 'task' AND ref = old.task_id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'task', t.id, t.title, coalesce(t.description, ''),
    coalesce((SELECT group_concat(g.name, ' ') FROM task_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.task_id = t.id), '')
  FROM tasks t WHERE t.id = old.task_id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_goals_ai AFTER INSERT ON goals BEGIN
  DELETE FROM search_fts WHERE kind = 'goal' AND ref = new.id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'goal', new.id, new.title, coalesce(new.description, ''),
    coalesce((SELECT group_concat(t.name, ' ') FROM goal_tags gt JOIN tags t ON t.id = gt.tag_id WHERE gt.goal_id = new.id), '')
  WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_goals_au AFTER UPDATE ON goals BEGIN
  DELETE FROM search_fts WHERE kind = 'goal' AND ref = new.id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'goal', new.id, new.title, coalesce(new.description, ''),
    coalesce((SELECT group_concat(t.name, ' ') FROM goal_tags gt JOIN tags t ON t.id = gt.tag_id WHERE gt.goal_id = new.id), '')
  WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_goals_ad AFTER DELETE ON goals BEGIN
  DELETE FROM search_fts WHERE kind = 'goal' AND ref = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_goal_tags_ai AFTER INSERT ON goal_tags BEGIN
  DELETE FROM search_fts WHERE kind = 'goal' AND ref = new.goal_id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'goal', g.id, g.title, coalesce(g.description, ''),
    coalesce((SELECT group_concat(t.name, ' ') FROM goal_tags gt JOIN tags t ON t.id = gt.tag_id WHERE gt.goal_id = g.id), '')
  FROM goals g WHERE g.id = new.goal_id AND g.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_goal_tags_ad AFTER DELETE ON goal_tags BEGIN
  DELETE FROM search_fts WHERE kind = 'goal' AND ref = old.goal_id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'goal', g.id, g.title, coalesce(g.description, ''),
    coalesce((SELECT group_concat(t.name, ' ') FROM goal_tags gt JOIN tags t ON t.id = gt.tag_id WHERE gt.goal_id = g.id), '')
  FROM goals g WHERE g.id = old.goal_id AND g.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_journals_ai AFTER INSERT ON journals BEGIN
  DELETE FROM search_fts WHERE kind = 'journal' AND ref = new.id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'journal', new.id, new.date, new.content_plain,
    coalesce((SELECT group_concat(t.name, ' ') FROM journal_tags jt JOIN tags t ON t.id = jt.tag_id WHERE jt.journal_id = new.id), '')
  WHERE new.deleted_at IS NULL AND new.type = 'daily';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_journals_au AFTER UPDATE ON journals BEGIN
  DELETE FROM search_fts WHERE kind = 'journal' AND ref = new.id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'journal', new.id, new.date, new.content_plain,
    coalesce((SELECT group_concat(t.name, ' ') FROM journal_tags jt JOIN tags t ON t.id = jt.tag_id WHERE jt.journal_id = new.id), '')
  WHERE new.deleted_at IS NULL AND new.type = 'daily';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_journals_ad AFTER DELETE ON journals BEGIN
  DELETE FROM search_fts WHERE kind = 'journal' AND ref = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_journal_tags_ai AFTER INSERT ON journal_tags BEGIN
  DELETE FROM search_fts WHERE kind = 'journal' AND ref = new.journal_id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'journal', j.id, j.date, j.content_plain,
    coalesce((SELECT group_concat(t.name, ' ') FROM journal_tags jt JOIN tags t ON t.id = jt.tag_id WHERE jt.journal_id = j.id), '')
  FROM journals j WHERE j.id = new.journal_id AND j.deleted_at IS NULL AND j.type = 'daily';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_journal_tags_ad AFTER DELETE ON journal_tags BEGIN
  DELETE FROM search_fts WHERE kind = 'journal' AND ref = old.journal_id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'journal', j.id, j.date, j.content_plain,
    coalesce((SELECT group_concat(t.name, ' ') FROM journal_tags jt JOIN tags t ON t.id = jt.tag_id WHERE jt.journal_id = j.id), '')
  FROM journals j WHERE j.id = old.journal_id AND j.deleted_at IS NULL AND j.type = 'daily';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_habits_ai AFTER INSERT ON habits BEGIN
  DELETE FROM search_fts WHERE kind = 'habit' AND ref = new.id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'habit', new.id, new.name, coalesce(new.description, ''), '';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_habits_au AFTER UPDATE ON habits BEGIN
  DELETE FROM search_fts WHERE kind = 'habit' AND ref = new.id;
  INSERT INTO search_fts(kind, ref, title, body, tags)
  SELECT 'habit', new.id, new.name, coalesce(new.description, ''), ''
  WHERE new.archived = 0;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fts_habits_ad AFTER DELETE ON habits BEGIN
  DELETE FROM search_fts WHERE kind = 'habit' AND ref = old.id;
END;
--> statement-breakpoint
INSERT INTO search_fts(kind, ref, title, body, tags)
SELECT 'activity', a.id, a.title, coalesce(a.description, ''),
  coalesce((SELECT group_concat(t.name, ' ') FROM activity_tags at JOIN tags t ON t.id = at.tag_id WHERE at.activity_id = a.id), '')
FROM activities a WHERE a.deleted_at IS NULL;
--> statement-breakpoint
INSERT INTO search_fts(kind, ref, title, body, tags)
SELECT 'task', t.id, t.title, coalesce(t.description, ''),
  coalesce((SELECT group_concat(g.name, ' ') FROM task_tags tt JOIN tags g ON g.id = tt.tag_id WHERE tt.task_id = t.id), '')
FROM tasks t;
--> statement-breakpoint
INSERT INTO search_fts(kind, ref, title, body, tags)
SELECT 'goal', g.id, g.title, coalesce(g.description, ''),
  coalesce((SELECT group_concat(t.name, ' ') FROM goal_tags gt JOIN tags t ON t.id = gt.tag_id WHERE gt.goal_id = g.id), '')
FROM goals g WHERE g.deleted_at IS NULL;
--> statement-breakpoint
INSERT INTO search_fts(kind, ref, title, body, tags)
SELECT 'journal', j.id, j.date, j.content_plain,
  coalesce((SELECT group_concat(t.name, ' ') FROM journal_tags jt JOIN tags t ON t.id = jt.tag_id WHERE jt.journal_id = j.id), '')
FROM journals j WHERE j.deleted_at IS NULL AND j.type = 'daily';
--> statement-breakpoint
INSERT INTO search_fts(kind, ref, title, body, tags)
SELECT 'habit', h.id, h.name, coalesce(h.description, ''), ''
FROM habits h WHERE h.archived = 0;
