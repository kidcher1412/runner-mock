import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import { PrismaClient } from "@/generated/prisma";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const projects = await prisma.project.findMany({
    orderBy: [
      { id: "desc" },
    ],
  });

    const enriched = await Promise.all(
      projects.map(async (p) => {
        let endpoints = 0;
        let pre = 0, post = 0, expect = 0;

        // Đếm số endpoint trong JSON
        if (fs.existsSync(p.file)) {
          const raw = fs.readFileSync(p.file, "utf-8");
          try {
            const json = JSON.parse(raw);
            endpoints = Object.keys(json.paths || {}).length;
          } catch {}
        }

        // Nếu có DB thì đếm processors
        if (p.useDB && p.dbFile && fs.existsSync(p.dbFile)) {
          let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
          try {
            db = await open({
              filename: p.dbFile, // ✅ đúng property name
              driver: sqlite3.Database, // ✅ đúng driver type
            });

            const rows = await db.all<{ type: string; cnt: number }[]>(
              "SELECT type, COUNT(*) as cnt FROM processors GROUP BY type"
            );

            for (const r of rows) {
              if (r.type === "pre") pre = r.cnt;
              else if (r.type === "post") post = r.cnt;
              else if (r.type === "expectation") expect = r.cnt;
            }
          } catch (e) {
            console.warn(`⚠️ Không đọc được DB của ${p.name}:`, e);
          } finally {
            if (db) await db.close();
          }
        }

        return {
          name: p.name,
          useDB: p.useDB,
          endpoints,
          processors: { pre, post, expect },
        };
      })
    );

    res.status(200).json(enriched);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
