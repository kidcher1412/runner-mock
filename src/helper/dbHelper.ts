import { open } from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";

import { resolveToAbsolute } from "@/lib/utils";

export function createDbHelper(project: string) {
  const rel = `./mock-data/${project}.sqlite`;
  const dbFile = resolveToAbsolute(rel);
  return {
    async query(sql: string, params: any[] = []) {
      const db = await open({ filename: dbFile, driver: sqlite3.Database });
      const rows = await db.all(sql, params);
      await db.close();
      return rows;
    },
    async exec(sql: string, params: any[] = []) {
      const db = await open({ filename: dbFile, driver: sqlite3.Database });
      const result = await db.run(sql, params);
      await db.close();
      return result;
    },
  };
}
