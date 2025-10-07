import type { NextApiRequest, NextApiResponse } from "next";
import sqlite3 from "sqlite3";
import path from "path";

function getDbPath(project: string) {
  return path.join(process.cwd(), "mock-data", `${project}.sqlite`);
}

function runQuery(dbPath: string, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { project, code, mock } = req.body;
  if (!project) return res.status(400).json({ error: "Missing project" });
  if (!code) return res.status(400).json({ error: "Missing code" });

  // ✅ dựng req giả lập từ mock
  const fakeReq = {
    body: mock?.body || {},
    headers: mock?.headers || {},
    query: mock?.params || {},
  };

  let logs: string[] = [];
  const fakeConsole = {
    log: (...args: any[]) => {
      logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
    },
  };

  const dbHelper = {
    query: async (sql: string, params: any[] = []) => {
      fakeConsole.log(`[DB] Using file: ${getDbPath(project)}`);
      return await runQuery(getDbPath(project), sql, params);
    },
  };

  try {
    const fn = new Function("req", "res", "console", "db", `
      return (async () => {
        ${code}
      })();
    `);

    let result = await fn(fakeReq, {}, fakeConsole, dbHelper);

    if (result === undefined) {
      result = { status: 200, body: "OK" };
    }

    return res.status(200).json({ result, logs, mock });
  } catch (err: any) {
    return res.status(400).json({ error: err.message, logs, mock });
  }
}
