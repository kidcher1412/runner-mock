// src/pages/api/db/tables.ts
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";

type TableInfo = {
  name: string;
  columns?: string[];
};
type ColumnInfo = {
  name: string;
  type: string;
};

// API chính
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { project, sql, table } = req.query as { project?: string; sql?: string; table?: string };

  if (!project) return res.status(400).json({ error: "project is required" });

  const dbPath = path.join(process.cwd(), "mock-data", `${project}.sqlite`);
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: `Database file not found for project ${project}` });

  const db = new sqlite3.Database(dbPath);

  // Nếu có query sql => chạy sql
  // PUT hoặc POST để chạy SQL
  let sqlQuery: string | undefined;
if (req.method === "PUT") {
  // Body JSON: req.body đã parse nếu bạn dùng middleware JSON
  sqlQuery = (req.body as { sql?: string }).sql;
} else {
  // GET query param
  sqlQuery = req.query.sql as string | undefined;
}

console.log("SQL:", sqlQuery);

if (sqlQuery) {
  db.all(sqlQuery, [], (err, rows) => {
    db.close();
    if (err) {
      console.error(err);
      return res.status(400).json({ error: "Failed to execute SQL", details: err.message });
    }
    res.status(200).json(rows);
  });
  return;
}

  // Trả thông tin cột (name + type)
  // if (table) {
  //   db.all(`PRAGMA table_info(${table})`, [], (err, cols) => {
  //     db.close();
  //     if (err) return res.status(500).json({ error: `Failed to get columns for table ${table}` });
  //     const columns: ColumnInfo[] = Array.isArray(cols)
  //       ? cols.map(c => ({ name: (c as any).name, type: (c as any).type }))
  //       : [];
  //     res.status(200).json(columns);
  //   });
  //   return;
  // }

  if (table) {
    console.log(`SELECT * FROM ${table}`)
    db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json(rows); // rows đã là array rồi
    });
    return;
  }

  // Nếu không có sql và table => trả danh sách bảng
  db.all(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`,
    [],
    (err, rows) => {
      db.close();
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to read tables" });
      }
      const tables = Array.isArray(rows) ? rows.map(r => (r as { name: string }).name) : [];
      res.status(200).json(tables);
    }
  );
}
