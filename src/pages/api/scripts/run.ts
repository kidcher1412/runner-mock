import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@/generated/prisma";
import { loadOpenApi, generateMock } from "@/lib/mock";
import { OpenAPIObject, PathItemObject, ParameterObject, SchemaObject } from "openapi3-ts/oas31";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import jp from "jsonpath";
import path from "path";

const prisma = new PrismaClient();

// helper: đọc processors trong sqlite
async function loadProcessors(project: string, endpoint: string, method: string) {
  const dbFile = path.join(process.cwd(), "mock-data", `${project}.sqlite`);
  const db = await open({ filename: dbFile, driver: sqlite3.Database });
  const rows = await db.all(
    `SELECT * FROM processors WHERE project=? AND endpoint=? AND method=? ORDER BY id ASC`,
    [project, endpoint, method]
  );
  await db.close();
  return rows;
}

function runCode(code: string, fakeReq: any, fakeRes: any, dbHelper: any, logs: string[]) {
  const fakeConsole = {
    log: (...args: any[]) => {
      logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
    },
  };

  const fn = new Function("req", "res", "console", "db", `
    return (async () => {
      ${code}
    })();
  `);

  return fn(fakeReq, fakeRes, fakeConsole, dbHelper);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { project, path: pathArray } = req.query as { project: string; path: string[] };
    const proj = await prisma.project.findUnique({ where: { name: project } });
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const api: OpenAPIObject = loadOpenApi(proj.file);
    if (!api.paths) return res.status(500).json({ error: "No paths found in OpenAPI" });

    const reqPath = "/" + (pathArray?.join("/") || "");
    const pathKey = Object.keys(api.paths).find((p) => p === reqPath);
    if (!pathKey) return res.status(404).json({ error: "Endpoint not found" });

    const pathItem: PathItemObject | undefined = api.paths[pathKey];
    if (!pathItem) return res.status(404).json({ error: "PathItem not found" });

    const method = req.method?.toLowerCase() as keyof PathItemObject;
    const operation = pathItem[method];
    if (!operation) return res.status(405).json({ error: "Method not allowed" });

    // fake req/res truyền vào processor
    const fakeReq = { body: req.body, headers: req.headers, query: req.query };
    let mockResponse: any = null;
    let logs: string[] = [];

    // ------------------- chạy pre-processors -------------------
    const processors = await loadProcessors(project, pathKey, method);
    const pre = processors.filter((p) => p.type === "pre");
    for (const p of pre) {
      try {
        const result = await runCode(p.code, fakeReq, {}, {}, logs);
        if (result) {
          // nếu pre trả về → override mock luôn
          mockResponse = result;
          break;
        }
      } catch (err: any) {
        return res.status(500).json({ error: `Pre-processor failed: ${err.message}`, logs });
      }
    }

    // ------------------- nếu chưa có mock từ pre → tạo mặc định -------------------
    if (!mockResponse) {
      mockResponse = generateMock(operation.responses?.["200"]?.content?.["application/json"]?.schema);
    }

    // ------------------- chạy post-processors -------------------
    const post = processors.filter((p) => p.type === "post");
    for (const p of post) {
      try {
        const result = await runCode(p.code, fakeReq, mockResponse, {}, logs);
        if (result) {
          mockResponse = result;
        }
      } catch (err: any) {
        return res.status(500).json({ error: `Post-processor failed: ${err.message}`, logs });
      }
    }

    res.status(200).json(mockResponse);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
