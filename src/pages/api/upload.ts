import { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm, Fields, Files } from "formidable";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@/generated/prisma";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

const prisma = new PrismaClient();

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = new IncomingForm({ uploadDir: path.join(process.cwd(), "mock-data"), keepExtensions: true });

  form.parse(req, async (err, fields: Fields, files: Files) => {
    if (err) return res.status(500).json({ error: err.message });

    const projectNameRaw = fields.projectName;
    if (!projectNameRaw) return res.status(400).json({ error: "projectName is required" });
    const projectName = Array.isArray(projectNameRaw) ? projectNameRaw[0] : projectNameRaw;

    const fileRaw = files.file;
    if (!fileRaw) return res.status(400).json({ error: "file is required" });
    const file = Array.isArray(fileRaw) ? fileRaw[0] : fileRaw;

    const useDBRaw = fields.useDB;
    const useDBStr = Array.isArray(useDBRaw) ? useDBRaw[0] : useDBRaw;
    const useDB = useDBStr === "true";

    const newFilePath = path.join(process.cwd(), "mock-data", `${projectName}.json`);
    fs.renameSync(file.filepath, newFilePath);

    try {
      const existing = await prisma.project.findUnique({ where: { name: projectName } });
      if (existing) return res.status(400).json({ error: "Project already exists" });

      let dbFilePath: string | null = null;
      if (useDB) {
        dbFilePath = path.join(process.cwd(), "mock-data", `${projectName}.sqlite`);
        const db = await open({ filename: dbFilePath, driver: sqlite3.Database });
    // 🧱 Tạo bảng mock_data (dữ liệu mẫu)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS mock_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        value TEXT
      );
    `);

    // 🧠 Tạo bảng processors (lưu script pre/post/expectation)
    await db.exec(`
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
        await db.close();
      }

      const project = await prisma.project.create({
        data: { name: projectName, file: newFilePath, useDB, dbFile: dbFilePath || undefined },
      });

      res.status(200).json({ message: "Project uploaded", project });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
}
