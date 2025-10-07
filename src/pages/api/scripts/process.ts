// src/pages/api/scripts/process.ts
import type { NextApiRequest, NextApiResponse } from "next";
import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

function getDbPath(project: string) {
  const filePath = path.join(process.cwd(), "mock-data", `${project}.sqlite`);
  const db = new sqlite3.Database(filePath);
      //   CREATE TABLE IF NOT EXISTS processors (
      //   id INTEGER PRIMARY KEY AUTOINCREMENT,
      //   project TEXT,
      //   endpoint TEXT,
      //   method TEXT,
      //   type TEXT,
      //   code TEXT,
      //   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      // )
  db.run(`
CREATE TABLE IF NOT EXISTS processors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,
  endpoint TEXT,
  method TEXT,
  type TEXT, -- 'pre' | 'post' | 'expectation'
  code TEXT,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

    `);
  db.close();
  return filePath;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { project, endpoint, method, type, code, id } = req.body.project
    ? req.body
    : { ...req.query, ...req.body };

  if (!project) {
    return res.status(400).json({ error: "Missing project" });
  }

  const dbPath = getDbPath(project);
  const db = new sqlite3.Database(dbPath);

  if (req.method === "GET") {
    const { project: qProject, endpoint: qEndpoint, method: qMethod } = req.query;
    db.all(
      `SELECT * FROM processors WHERE project=? AND endpoint=? AND method=?`,
      [qProject, qEndpoint, qMethod],
      (err, rows) => {
        db.close();
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json(rows);
      }
    );
  } else if (req.method === "POST") {
    if (!endpoint || !method || !type || !code) {
      db.close();
      return res.status(400).json({ error: "Missing required fields" });
    }
    db.run(
      `INSERT INTO processors (project, endpoint, method, type, code, enabled) VALUES (?, ?, ?, ?, ?, 0)`,
      [project, endpoint, method, type, code],
      function (err) {
        db.close();
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID });
      }
    );
  } else if (req.method === "PUT") {
    if (!id || !code) {
      db.close();
      return res.status(400).json({ error: "Missing id or code for update" });
    }
    db.run(`UPDATE processors SET code=? WHERE id=?`, [code, id], function (err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ updated: this.changes });
    });
  } else if (req.method === "DELETE") {
    if (!id) {
      db.close();
      return res.status(400).json({ error: "Missing id for delete" });
    }
    db.run(`DELETE FROM processors WHERE id=?`, [id], function (err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ deleted: this.changes });
    });
  } else {
    db.close();
    res.status(405).json({ error: "Method not allowed" });
  }
}
