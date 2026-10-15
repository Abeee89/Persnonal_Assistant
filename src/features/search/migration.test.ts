import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "@/db/client";
import { MIGRATIONS_FOLDER } from "@/db/migrate";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { search } from "./service";

const NOW = "2026-10-14T08:00:00.000Z";

describe("0001_search_fts migration", () => {
  it("indexes rows that already existed before the migration ran", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pa-mig-"));
    const handle = openDatabase({ file: path.join(dir, "t.db") });
    try {
      const sqlOnlyInit = path.join(dir, "init-only");
      fs.mkdirSync(path.join(sqlOnlyInit, "meta"), { recursive: true });
      fs.copyFileSync(path.join(MIGRATIONS_FOLDER, "0000_init.sql"), path.join(sqlOnlyInit, "0000_init.sql"));
      fs.copyFileSync(path.join(MIGRATIONS_FOLDER, "meta", "0000_snapshot.json"), path.join(sqlOnlyInit, "meta", "0000_snapshot.json"));
      const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8")) as {
        entries: unknown[];
      };
      fs.writeFileSync(
        path.join(sqlOnlyInit, "meta", "_journal.json"),
        JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
      );
      migrate(handle.db, { migrationsFolder: sqlOnlyInit });

      handle.sqlite
        .prepare("INSERT INTO activities (id, title, description, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run("old1", "Pre-existing run", "from before search", "2026-09-01", NOW, NOW);

      migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });

      expect(search(handle.db, "pre-existing").map((h) => h.ref)).toEqual(["old1"]);
      expect(search(handle.db, "before search").map((h) => h.ref)).toEqual(["old1"]);
    } finally {
      handle.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
