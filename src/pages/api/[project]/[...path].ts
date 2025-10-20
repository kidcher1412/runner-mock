import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@/generated/prisma";
import { loadOpenApi, generateMock, pickResponseStatus } from "@/lib/mock";
import { OpenAPIObject, PathItemObject, ParameterObject, SchemaObject } from "openapi3-ts/oas31";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import jp from "jsonpath";
import path from "path";
import { resolveToAbsolute } from "@/lib/utils";
import { createDbHelper } from "@/helper/dbHelper";
import { checkExpectations } from "@/helper/expectationHelper";

const prisma = new PrismaClient();

async function runSQLMapping(dbFile: string, sql: string, responseTemplate: any, jsonPath: string) {
  const db = await open({ filename: resolveToAbsolute(dbFile), driver: sqlite3.Database });
  const rows = await db.all(sql);
  await db.close();

  if (!rows || rows.length === 0) return responseTemplate;

  jp.value(responseTemplate, jsonPath, rows.length === 1 ? rows[0] : rows);
  return responseTemplate;
}


// ================= Processor Helper =================

import { ReferenceObject } from "openapi3-ts/oas31";
import { collectMissingFieldsFromSchema, generateFakeDataFromSchema, normalizeType } from "@/helper/schemaHelper";

// function generateFakeDataFromSchema(
//   schema: SchemaObject | ReferenceObject,
//   missingFields: { field: string; type: string }[] = [],
//   rootSpec?: OpenAPIObject,
//   depth = 0
// ): any {
//   if (!schema) return "string_example_return_no_schema";

//   if ("$ref" in schema && rootSpec) {
//     const refPath = schema.$ref!.replace(/^#\//, "").split("/");
//     let resolved: any = rootSpec;
//     for (const part of refPath) resolved = resolved?.[part];
//     return generateFakeDataFromSchema(resolved, missingFields, rootSpec, depth + 1);
//   }

//   // Tới đây thì schema chắc chắn là SchemaObject
//   const s = schema as SchemaObject;

//   if (s.oneOf?.length)
//     return generateFakeDataFromSchema(s.oneOf[0], missingFields, rootSpec, depth + 1);
//   if (s.anyOf?.length)
//     return generateFakeDataFromSchema(s.anyOf[0], missingFields, rootSpec, depth + 1);
//   if (s.allOf?.length) {
//     const merged = Object.assign({}, ...s.allOf.map(sub => 
//       generateFakeDataFromSchema(sub, missingFields, rootSpec, depth + 1)
//     ));
//     return merged;
//   }

//   if (s.type === "object" && s.properties) {
//     const obj: any = {};
//     for (const [key, prop] of Object.entries(s.properties)) {
//       const type = Array.isArray((prop as any).type)
//         ? (prop as any).type[0]
//         : (prop as any).type;

//       switch (type) {
//         case "string":
//           obj[key] = "string_example";
//           break;
//         case "number":
//         case "integer":
//           obj[key] = 0;
//           break;
//         case "boolean":
//           obj[key] = false;
//           break;
//         case "array":
//           obj[key] = [
//             generateFakeDataFromSchema(
//               (prop as SchemaObject).items || {},
//               missingFields,
//               rootSpec,
//               depth + 1
//             ),
//           ];
//           break;
//         case "object":
//         default:
//           obj[key] = generateFakeDataFromSchema(
//             prop as SchemaObject,
//             missingFields,
//             rootSpec,
//             depth + 1
//           );
//       }
//     }
//     return obj;
//   }

//   if (s.type === "array" && s.items) {
//     return [generateFakeDataFromSchema(s.items, missingFields, rootSpec, depth + 1)];
//   }

//   switch (s.type) {
//     case "string":
//       return "string_example";
//     case "number":
//     case "integer":
//       return 0;
//     case "boolean":
//       return false;
//     default:
//       return null;
//   }
// }



async function loadProcessors(project: string, endpoint: string, method: string) {
  const dbFile = path.join(process.cwd(), "mock-data", `${project}.sqlite`);
  console.log(`checker ${dbFile}`)
  const db = await open({ filename: dbFile, driver: sqlite3.Database });
  const rows = await db.all(
    `SELECT * FROM processors WHERE project=? AND endpoint=? AND method=? and enabled = 1 ORDER BY id ASC`,
    [project, endpoint, method]
  );
  await db.close();
  return rows;
}

async function runProcessor(
  code: string,
  fakeReq: any,
  fakeRes: any,
  logs: string[],
  dbHelper: any   // 👈 thêm dbHelper
) {
  const fakeConsole = {
    log: (...args: any[]) =>
      logs.push(
        args
          .map((a) =>
            typeof a === "object" ? JSON.stringify(a) : String(a)
          )
          .join(" ")
      ),
  };

  // 👇 thêm "db" vào danh sách tham số
  const fn = new Function("req", "res", "console", "db", `
    return (async () => {
      ${code}
    })();
  `);

  // 👇 truyền dbHelper vào
  return fn(fakeReq, fakeRes, fakeConsole, dbHelper);
}

// ====================================================
export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { project, path: pathArray } = req.query as { project: string; path: string[] };
    const proj = await prisma.project.findUnique({ where: { name: project } });
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const api: OpenAPIObject = loadOpenApi(proj.file);
    if (!api.paths) return res.status(500).json({ error: "No paths found in OpenAPI" });

    const reqPath = "/" + (pathArray?.join("/") || "");
    const pathKey = Object.keys(api.paths).find(p => p === reqPath);
    if (!pathKey) return res.status(404).json({ error: "Endpoint not found" });

    const pathItem: PathItemObject | undefined = api.paths[pathKey];
    if (!pathItem) return res.status(404).json({ error: "PathItem not found" });

    const method = req.method?.toLowerCase() as keyof PathItemObject;
    const operation = pathItem[method];
    if (!operation) return res.status(405).json({ error: "Method not allowed" });

    const missing: { field: string; type: string }[] = [];
    (operation.parameters as ParameterObject[] | undefined)?.forEach(p => {
      if (p.required) {
        const value =
          p.in === "header"
            ? req.headers[p.name.toLowerCase()]
            : p.in === "query"
              ? req.query[p.name]
              : p.in === "path"
                ? pathArray?.join("/").includes(p.name)
                : undefined;
        if (value === undefined || value === "") {
          const expectedType = normalizeType((p.schema as SchemaObject)?.type);
          missing.push({ field: `${p.in}: ${p.name}`, type: expectedType });
        }
      }
    });

    if (operation.requestBody?.content?.["application/json"]?.schema) {
      const bodySchema = operation.requestBody.content["application/json"].schema as SchemaObject;
      let bodyObj: any = {};
      try {
        bodyObj = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body as string);
      } catch {
        missing.push({ field: "Body", type: "object (invalid JSON)" });
      }

      // if (bodySchema.required) {
      //   (bodySchema.required as string[]).forEach(reqKey => {
      //     if (bodyObj[reqKey] === undefined || bodyObj[reqKey] === "") {
      //       const expectedType = normalizeType((bodySchema.properties?.[reqKey] as SchemaObject)?.type);
      //       missing.push({ field: `Body: ${reqKey}`, type: expectedType });
      //     }
      //   });
      // }
      collectMissingFieldsFromSchema(bodySchema, bodyObj, "", api, missing);
    }
    //----------------------------missing filed-----------------------------
    if (missing.length > 0) {
      const schema400 = operation.responses?.["400"]?.content?.["application/json"]?.schema as SchemaObject | undefined;

      if (schema400) {
        const contentJson = operation.responses["400"].content["application/json"];

        // Lấy example trực tiếp
        let exampleReturn: any = contentJson?.example;

        // Nếu không có example thì lấy giá trị đầu tiên trong examples
        if (!exampleReturn && contentJson?.examples) {
          const examplesObj = contentJson.examples as Record<string, { value: any }>;
          const firstExampleKey = Object.keys(examplesObj)[0];
          if (firstExampleKey) {
            exampleReturn = examplesObj[firstExampleKey].value;
          }
        }

        if (exampleReturn) {
          exampleReturn.systemLogMock = missing.length > 0
            ? `Validation error. Missing: ${missing
              .map(m => `${m.field} (${m.type})`)
              .join(", ")}`
            : "Validation error";
          return res.status(400).json(exampleReturn);
        }
        // nếu không có cả 2, cho code tự gen ra
        const fakeCase400 = generateFakeDataFromSchema(schema400, missing);
        fakeCase400.systemLogMock = missing.length > 0
          ? `Validation error. Missing: ${missing
            .map(m => `${m.field} (${m.type})`)
            .join(", ")}`
          : "Validation error";
        return res.status(400).json(fakeCase400);
      }

      const schema200 = operation.responses?.["200"]?.content?.["application/json"]?.schema as SchemaObject;
      const fakeCase200 = generateFakeDataFromSchema(schema200, missing);
      fakeCase200.systemLogMock = missing.length > 0
        ? `Validation error. Missing: ${missing
          .map(m => `${m.field} (${m.type})`)
          .join(", ")}`
        : "Validation error";
      return res.status(400).json(fakeCase200);
    }

    // ------------------- Processor -------------------
    const logs: string[] = [];
    const processors = await loadProcessors(project, pathKey, method);
    const dbHelper = createDbHelper(project);

    // ------------------- Expectation -------------------
    // sau khi load processors xong:
    const expectations = processors.filter(
      (x: any) => x.type === "expectation" && (x.enabled === 1 || x.enabled === true)
    );
    console.log(expectations)
    if (expectations.length > 0) {
      const { matched, logs } = await checkExpectations(req, res, expectations);
      if (matched) return; // đã trả response ở trong hàm rồi (đã set Content-Type theo expectation)
    }

    // chạy pre
    for (const p of processors.filter(x => x.type === "pre")) {
      try {
        const result = await runProcessor(p.code, { body: req.body, headers: req.headers, query: req.query }, {}, logs, dbHelper);
        if (result) {
          return res.status(200).json(result); // trả luôn nếu pre trả ra data
        }
      } catch (e: any) {
        console.log(e)
        return res.status(500).json({ error: `Pre processor error: ${e.message}`, logs });
      }
    }

// //-------------------- Example (200/201/202 ưu tiên) ----------------------
  const desiredStatus = String(req.headers["x-mock-status"] ?? req.query.__status ?? "");
  const { status: chosenStatus, contentJson: chosenContent, schema: chosenSchema } =
    pickResponseStatus(operation, desiredStatus || undefined);

  let exampleReturn: any = undefined;
  if (chosenContent) {
    // Ưu tiên examples[name] nếu được chỉ định __example/x-mock-example
    const exampleName = String(req.headers["x-mock-example"] ?? req.query.__example ?? "");
    if (exampleName && chosenContent.examples?.[exampleName]?.value !== undefined) {
      exampleReturn = chosenContent.examples[exampleName].value;
    } else if (chosenContent.examples) {
      const firstKey = Object.keys(chosenContent.examples)[0];
      if (firstKey) exampleReturn = chosenContent.examples[firstKey].value;
    } else if (chosenContent.example !== undefined) {
      exampleReturn = chosenContent.example;
    }
  }
  // Nếu spec có example → trả theo status đã chọn
  if (exampleReturn !== undefined) {
    return res.status(Number(chosenStatus)).json(exampleReturn);
  }


    //-------------------- Example----------------------
    const schema200 = operation.responses?.["200"]?.content?.["application/json"]?.schema as SchemaObject;
    if (schema200) {
      const contentJson = operation.responses["200"].content["application/json"];
      // Lấy example trực tiếp
      let exampleReturn: any = contentJson?.example;

      // Nếu không có example thì lấy giá trị đầu tiên trong examples
      if (contentJson?.examples) {
        const examplesObj = contentJson.examples as Record<string, { value: any }>;
        const firstExampleKey = Object.keys(examplesObj)[0];
        if (firstExampleKey) {
          exampleReturn = examplesObj[firstExampleKey].value;
        }
      }

      if (exampleReturn) {
        return res.status(200).json(exampleReturn);
      }
    }

    // ------------------- Mock data -------------------
    let mockData = generateMock(
      operation.responses?.["200"]?.content?.["application/json"]?.schema,
      api // <== truyền rootSpec để deref $ref
    );
    if (proj.useDB && proj.dbFile) {
      const mapping = await prisma.mapping.findUnique({
        where: { endpoint_method: { endpoint: pathKey, method } },
      });
      if (mapping) {
        mockData = await runSQLMapping(proj.dbFile, mapping.sql, mockData, mapping.jsonPath);
      }
    }

    // chạy post
    for (const p of processors.filter(x => x.type === "post")) {
      try {
        await runProcessor(p.code, { body: req.body, headers: req.headers, query: req.query }, mockData, logs, dbHelper);
      } catch (e: any) {
        logs.push("Post error: " + e.message);
      }
    }

    return res.status(200).json(mockData);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
