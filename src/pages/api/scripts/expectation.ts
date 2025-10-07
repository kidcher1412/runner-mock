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
        location,
        field,
        comparison,
        expectedValue,
        requestBody,
        responseBody,
        enabled = true,
      } = req.body;

      if (!endpoint || !method || !name || !location || !field || !comparison) {
        await db.close();
        return res.status(400).json({ error: "Missing required fields" });
      }

      const expectation = {
        name,
        location,
        field,
        comparison,
        expectedValue,
        requestBody: requestBody || null,
        responseBody: responseBody || null,
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

      // ✅ Bật/tắt Expect Mode
      // if (endpoint && method && enabled !== undefined) {
      //   if (enabled) {
      //     // Bật Expect Mode: bật expectation, tắt pre/post
      //     await db.run(
      //       `UPDATE processors 
      //        SET enabled = CASE 
      //          WHEN type = 'expectation' THEN 1 
      //          ELSE 0 
      //        END
      //        WHERE project = ? AND endpoint = ? AND method = ?`,
      //       [project, endpoint, method]
      //     );
      //   } else {
      //     // Tắt Expect Mode: bật pre/post, tắt expectation
      //     await db.run(
      //       `UPDATE processors 
      //        SET enabled = CASE 
      //          WHEN type IN ('pre','post') THEN 1 
      //          ELSE 0 
      //        END
      //        WHERE project = ? AND endpoint = ? AND method = ?`,
      //       [project, endpoint, method]
      //     );
      //   }

      //   await db.close();
      //   return res.status(200).json({
      //     project,
      //     endpoint,
      //     method,
      //     expectMode: enabled,
      //   });
      // }
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
