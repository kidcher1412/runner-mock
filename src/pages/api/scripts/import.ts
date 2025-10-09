import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

// Đảm bảo Next.js không tự xử lý body (vì dùng formidable)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper tạo đường dẫn DB
function getDbPath(project: string) {
  return path.join(process.cwd(), "mock-data", `${project}.sqlite`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  // Parse multipart/form-data
  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: "Failed to parse form data" });

    const project = fields.project?.toString();
    const type = fields.type?.toString() || "json";
    const file = files.file;

    if (!project || !file) {
      return res.status(400).json({ error: "Missing project or file" });
    }

    const dbPath = getDbPath(project);

    try {
      if (type === "sqlite") {
        // Nếu import SQLite: copy file sang thư mục mock-data
        const dest = dbPath;
        fs.copyFileSync(file[0].filepath, dest);
        return res.status(200).json({ message: `SQLite imported to ${dest}` });
      }

      // Nếu import JSON
      const fileContent = fs.readFileSync(file[0].filepath, "utf-8");
      const data = JSON.parse(fileContent);

      if (!Array.isArray(data)) {
        return res.status(400).json({ error: "JSON must be an array of processors" });
      }

      const db = new sqlite3.Database(dbPath);

      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS processors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project TEXT,
            endpoint TEXT,
            method TEXT,
            type TEXT,
            code TEXT,
            created_at TEXT,
            enabled INTEGER
          )
        `);

        const stmt = db.prepare(`
          INSERT INTO processors (project, endpoint, method, type, code, created_at, enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const p of data) {
          stmt.run(
            project,
            p.endpoint || "",
            p.method || "",
            p.type || "expectation",
            p.code || JSON.stringify(p.expectation || {}),
            p.created_at || new Date().toISOString(),
            p.enabled ? 1 : 0
          );
        }

        stmt.finalize();
      });

      db.close();
      return res.status(200).json({ message: `JSON imported successfully`, count: data.length });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });
}
