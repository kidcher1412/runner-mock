import { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";


function getDbOnProject(project: string) {
  const filePath = path.join(process.cwd(), "mock-data", `${project}.sqlite`);
  const db = new sqlite3.Database(filePath);
  db.close();
  return filePath;
}
// API: /api/scripts/export?project=Test2&type=json|sqlite
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const projectParam = req.query.project;
  const type = (req.query.type as string) || "json";

  // Ép kiểu project về string
  const project = Array.isArray(projectParam) ? projectParam[0] : projectParam;

  if (!project) {
    return res.status(400).json({ error: "Missing project" });
  }

  try {
    const dbPath = getDbOnProject(project);

    if (type === "sqlite") {
      // Trả file SQLite
      if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: "Database file not found" });
      }

      const fileBuffer = fs.readFileSync(dbPath);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${project}.sqlite"`
      );
      return res.send(fileBuffer);
    }

    // Nếu là JSON: đọc dữ liệu từ DB và trả JSON
    const db = new sqlite3.Database(dbPath);
    db.all("SELECT * FROM processors", (err, rows) => {
      db.close();
      if (err) {
        return res.status(500).json({ error: "Failed to read DB", details: err.message });
      }
      res.setHeader("Content-Type", "application/json");
      return res.status(200).json(rows);
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}