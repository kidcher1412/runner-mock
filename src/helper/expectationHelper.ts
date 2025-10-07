import { NextApiRequest, NextApiResponse } from "next";

/**
 * Kiểm tra nhiều expectation (hỗ trợ nhiều điều kiện + contentType + mockResponse)
 */
export async function checkExpectations(
  req: NextApiRequest,
  res: NextApiResponse,
  expectations: any[]
) {
  const logs: any[] = [];

  if (!expectations || expectations.length === 0) {
    return { matched: false, logs };
  }

  // ===== Helpers =====
  const getActualValue = (req: any, location: string, field: string) => {
    if (!location) return undefined;
    location = String(location).toLowerCase();

    if (location === "header" || location === "headers") {
      const keys = Object.keys(req.headers || {});
      const foundKey = keys.find(k => k.toLowerCase() === field.toLowerCase());
      let v = foundKey ? req.headers[foundKey] : req.headers[field.toLowerCase()];
      if (Array.isArray(v)) v = v[0];
      if (typeof v === "string") v = v.trim();
      return v;
    }

    if (["query", "param", "params"].includes(location)) {
      let v =
        (req.query && (req.query[field] ?? req.query[decodeURIComponent(field)])) ??
        undefined;
      if (Array.isArray(v)) v = v[0];
      if (typeof v === "string") v = v.trim();
      return v;
    }

    if (location === "body") {
      const body = req.body ?? {};
      if (!field) return body;
      const parts = field.split(".");
      let cur: any = body;
      for (const p of parts) {
        if (cur == null) {
          cur = undefined;
          break;
        }
        cur = cur[p];
      }
      return cur;
    }

    return undefined;
  };

  const normalizeComp = (c: any) => {
    if (!c && c !== 0) return "";
    return String(c)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/equals?/, "eq")
      .replace(/notequals?/, "ne")
      .replace(/contains?/, "inc")
      .replace(/notcontains?/, "ninc")
      .replace(/greaterthanorequalto?/, "gte")
      .replace(/greaterthan?/, "gt")
      .replace(/lessthanorequalto?/, "lte")
      .replace(/lessthan?/, "lt")
      .replace(/exists?/, "exists")
      .replace(/notexists?/, "notexists");
  };

  const compare = (actual: any, expected: any, compRaw: any) => {
    const comp = normalizeComp(compRaw);
    const aStr = actual === undefined || actual === null ? "" : String(actual);
    const eStr = expected === undefined || expected === null ? "" : String(expected);
    const aNum = Number(aStr);
    const eNum = Number(eStr);
    const bothNumeric = !isNaN(aNum) && !isNaN(eNum);

    switch (comp) {
      case "eq": return aStr === eStr;
      case "ne": return aStr !== eStr;
      case "gt": return bothNumeric ? aNum > eNum : aStr > eStr;
      case "gte": return bothNumeric ? aNum >= eNum : aStr >= eStr;
      case "lt": return bothNumeric ? aNum < eNum : aStr < eStr;
      case "lte": return bothNumeric ? aNum <= eNum : aStr <= eStr;
      case "inc": return aStr.includes(eStr);
      case "ninc": return !aStr.includes(eStr);
      case "exists": return actual !== undefined && actual !== null && aStr !== "";
      case "notexists": return actual === undefined || actual === null || aStr === "";
      default: return aStr === eStr;
    }
  };

  // ===== Evaluate Each Expectation =====
  for (const expRow of expectations) {
    try {
      const e = typeof expRow.code === "string" ? JSON.parse(expRow.code) : expRow.code;
      const conditions = e.conditions || [];
      const overallLogic = e.logic || "AND";

      if (!Array.isArray(conditions) || conditions.length === 0) continue;

      let groupResult = overallLogic === "AND";

      for (const [i, c] of conditions.entries()) {
        if (!c.enabled) continue;
        const actual = getActualValue(req, c.location, c.field);
        const passed = compare(actual, c.expectedValue, c.comparison);

        logs.push({
          expectation: e.name,
          index: i,
          location: c.location,
          field: c.field,
          expected: c.expectedValue,
          actual,
          comparison: c.comparison,
          logicBefore: c.logicBefore,
          pass: passed,
        });

        // Xử lý logic liên kết giữa các điều kiện
        if (i === 0) {
          groupResult = passed;
        } else {
          const link = (c.logicBefore || overallLogic).toUpperCase();
          if (link === "AND") groupResult = groupResult && passed;
          else if (link === "OR") groupResult = groupResult || passed;
        }
      }

      if (groupResult) {
        // ✅ Khi tất cả điều kiện trong expectation đều khớp
        const contentType = e.contentType || "application/json";
        const mockResponseRaw = e.mockResponse || "{}";
        const mockResponseStatus = Number(e.mockResponseStatus) || 200;

        let mockResponse: any = mockResponseRaw;
        if (typeof mockResponse === "string") {
          try {
            mockResponse = JSON.parse(mockResponse);
          } catch {
            // giữ nguyên chuỗi nếu không phải JSON
          }
        }

        res.setHeader("Content-Type", contentType);
        res.status(mockResponseStatus).send(mockResponse);
        return { matched: true, matchedExp: e, logs };
      }
    } catch (err: any) {
      logs.push({ error: `Parse expectation error: ${err.message}` });
    }
  }

  // ❌ Không expectation nào khớp
  return { matched: false, logs };
}
