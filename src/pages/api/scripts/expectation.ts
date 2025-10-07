import type { NextApiRequest, NextApiResponse } from "next";
import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { open } from "sqlite";

function getDbPath(project: string) {
  return path.join(process.cwd(), "mock-data", `${project}.sqlite`);
}

async function ensureTable(project: string) {
  const filePath = getDbPath(project);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "");
  const db = new sqlite3.Database(filePath);
  db.run(`
    CREATE TABLE IF NOT EXISTS processors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project TEXT,
      endpoint TEXT,
      method TEXT,
      type TEXT,
      code TEXT,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.close();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const httpMethod = req.method?.toUpperCase();
    const project = (req.body?.project as string) || (req.query?.project as string);
    if (!project) return res.status(400).json({ error: "Missing project" });

    await ensureTable(project);
    const dbFile = getDbPath(project);
    const db = await open({ filename: dbFile, driver: sqlite3.Database });

    // === GET: Lấy toàn bộ expectation của endpoint/method ===
    if (httpMethod === "GET") {
      const endpoint = req.query.endpoint as string | undefined;
      const m = req.query.method as string | undefined;

      const rows = await db.all(
        `SELECT * FROM processors 
         WHERE project = ? AND type='expectation'
         ${endpoint ? "AND endpoint = ?" : ""} 
         ${m ? "AND method = ?" : ""}
         ORDER BY id ASC`,
        ...(endpoint && m
          ? [project, endpoint, m]
          : endpoint
            ? [project, endpoint]
            : m
              ? [project, m]
              : [project])
      );

      await db.close();

      const parsed = rows.map((r: any) => ({
        ...r,
        expectation: (() => {
          try {
            return JSON.parse(r.code);
          } catch {
            return null;
          }
        })(),
      }));

      return res.status(200).json(parsed);
    }

    // === POST: Thêm expectation mới ===
    if (httpMethod === "POST") {
      const {
        endpoint,
        method,
        name,
        logic,
        contentType,
        mockResponse,
        mockResponseStatus,
        conditions,
        enabled = true,
      } = req.body;

      if (!endpoint || !method || !name || !Array.isArray(conditions) || conditions.length === 0) {
        await db.close();
        return res.status(400).json({ error: "Missing or invalid fields (endpoint, method, name, conditions[] required)" });
      }

      // Tạo cấu trúc expectation đầy đủ
      const expectation = {
        name,
        logic: logic || "AND",
        contentType: contentType || "application/json",
        mockResponse: mockResponse || "",
        mockResponseStatus: mockResponseStatus || "",
        conditions,
      };

      const info = await db.run(
        `INSERT INTO processors (project, endpoint, method, type, code, enabled)
         VALUES (?, ?, ?, 'expectation', ?, ?)`,
        [project, endpoint, method, JSON.stringify(expectation), enabled ? 1 : 0]
      );

      // Nếu bật expectation → disable pre/post
      if (enabled) {
        await db.run(
          `UPDATE processors 
           SET enabled = 0 
           WHERE project = ? AND endpoint = ? AND method = ? 
             AND type IN ('pre','post')`,
          [project, endpoint, method]
        );
      }

      await db.close();
      return res.status(201).json({ id: info.lastID, expectation });
    }

    // === PUT: Bật / Tắt Expect Mode hoặc cập nhật expectation ===
    if (httpMethod === "PUT") {
      const { id, endpoint, method, enabled, code } = req.body;

      // ✅ Cập nhật code expectation
      if (id && code) {
        await db.run(`UPDATE processors SET code = ? WHERE id = ?`, [code, id]);
        await db.close();
        return res.status(200).json({ updated: id });
      }

      if (enabled == true) {
        console.log('bật mode expectation');

        // UPDATE và trả về các id affected
        const updatedRows: { id: number }[] = await db.all(
          `UPDATE processors
     SET enabled = CASE
       WHEN type = 'expectation' THEN 1
       WHEN type IN ('pre','post') THEN 0
       ELSE enabled
     END
     WHERE project = ? AND endpoint = ? AND method = ?
     RETURNING id`,
          [project, endpoint, method]
        );

        return res.status(200).json({
          enabled: enabled,
          updatedIds: updatedRows.map(r => r.id),
        });
      } else if (enabled == false) {
        console.log('tắt mode expectation');

        const updatedRows: { id: number }[] = await db.all(
          `UPDATE processors
     SET enabled = CASE
       WHEN type = 'expectation' THEN 0
       WHEN type IN ('pre','post') THEN 1
       ELSE enabled
     END
     WHERE project = ? AND endpoint = ? AND method = ?
     RETURNING id`,
          [project, endpoint, method]
        );

        return res.status(200).json({
          enabled: enabled,
          updatedIds: updatedRows.map(r => r.id),
        });
      }


      await db.close();
      return res.status(400).json({ error: "Invalid PUT payload" });
    }

    // === DELETE: Xóa expectation ===
    if (httpMethod === "DELETE") {
      const { id } = req.body;
      if (!id) {
        await db.close();
        return res.status(400).json({ error: "Missing id" });
      }

      await db.run(`DELETE FROM processors WHERE id = ? AND type='expectation'`, [id]);
      await db.close();
      return res.status(200).json({ deleted: id });
    }

    await db.close();
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("Expectation error:", err);
    return res.status(500).json({ error: err.message });
  }
}
