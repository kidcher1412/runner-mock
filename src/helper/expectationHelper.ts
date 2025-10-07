import { Description } from "@radix-ui/react-dialog";
import { NextApiRequest, NextApiResponse } from "next";

/**
 * Hàm kiểm tra danh sách expectation với request hiện tại
 * @param req request hiện tại
 * @param res response hiện tại (để trả kết quả nếu match)
 * @param expectations danh sách expectation (từ DB)
 * @returns object chứa logs và kết quả
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

    const getActualValue = (req: any, location: string, field: string) => {
        if (!location) return undefined;
        location = String(location).toLowerCase();

        if (location === "header" || location === "headers") {
            const keys = Object.keys(req.headers || {});
            const foundKey = keys.find((k) => k.toLowerCase() === field.toLowerCase());
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
            case "eq":
                return aStr === eStr;
            case "ne":
                return aStr !== eStr;
            case "gt":
                return bothNumeric ? aNum > eNum : aStr > eStr;
            case "gte":
                return bothNumeric ? aNum >= eNum : aStr >= eStr;
            case "lt":
                return bothNumeric ? aNum < eNum : aStr < eStr;
            case "lte":
                return bothNumeric ? aNum <= eNum : aStr <= eStr;
            case "inc":
                return aStr.includes(eStr);
            case "ninc":
                return !aStr.includes(eStr);
            case "exists":
                return actual !== undefined && actual !== null && aStr !== "";
            case "notexists":
                return actual === undefined || actual === null || aStr === "";
            default:
                return aStr === eStr;
        }
    };

    for (const expRow of expectations) {
        try {
            const e = typeof expRow.code === "string" ? JSON.parse(expRow.code) : expRow.code;
            const loc = e.location;
            const field = e.field;
            const expectedValue = e.expectedValue;
            const compName = e.comparison;

            const actual = getActualValue(req, loc, field);
            const passed = compare(actual, expectedValue, compName);

            logs.push({
                expectation: e.name || `${loc}:${field}`,
                location: loc,
                field,
                expected: expectedValue,
                actual,
                comparison: compName,
                pass: passed,
            });

            //   if (passed) {
            //     // Nếu thỏa -> trả về responseBody nếu có
            //     if (e.responseBody) {
            //       res.status(200).json(e.responseBody);
            //       return { matched: true, matchedExp: e, logs };
            //     }
            //     res.status(200).json({
            //       matched: e.name || `${loc}:${field}`,
            //       expectation: e,
            //     });
            //     return { matched: true, matchedExp: e, logs };
            //   }
            if (passed) {
                // Nếu thỏa -> trả về responseBody nếu có
                if (e.responseBody) {
                    res.status(200).json(e.responseBody);
                    return { matched: true, matchedExp: e, logs };
                }

                // Nếu không có responseBody thì trả object đơn giản để báo match
                res.status(200).json({
                    matched: e.name || `${loc}:${field}`,
                    expectation: e,
                    description: "Has item Pass, but it's responseBody is Null, recheck and retry"
                });
                return { matched: true, matchedExp: e, logs };
            }
        } catch (err: any) {
            logs.push({ error: `Parse expectation error: ${err.message}` });
        }
    }

    res.status(400).json({
        error: "No expectation matched",
        checked: expectations.length,
        logs,
    });
    return { matched: false, logs };
}
