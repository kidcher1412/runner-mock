import fs from "fs";
import path from "path";
import { faker } from "@faker-js/faker";
import { OpenAPIObject, SchemaObject, ReferenceObject } from "openapi3-ts/oas31";
import { resolveToAbsolute } from "@/lib/utils";

/** ===== Tuỳ chỉnh hành vi sinh dữ liệu ===== */
const DEPTH_LIMIT = 10;
const NULL_PROBABILITY = 0.3;
const DEFAULT_ARRAY_MIN = 0;
const DEFAULT_ARRAY_MAX = 3;

/** ===== Utils: random (ưu tiên crypto nếu có) ===== */
function randInt(min: number, max: number) {
  if (max < min) [min, max] = [max, min];
  // @ts-ignore
  if (typeof crypto !== "undefined") {
    // Node >= 16
    // @ts-ignore
    if (typeof crypto.randomInt === "function") {
      // @ts-ignore
      return crypto.randomInt(min, max + 1);
    }
    // Browser
    const buf = new Uint32Array(1);
    // @ts-ignore
    crypto.getRandomValues(buf);
    const r = buf[0] / 0xffffffff;
    return Math.floor(r * (max - min + 1)) + min;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const chance = (p: number) => randInt(1, 10_000) <= Math.floor(p * 10_000);

/** ===== I/O ===== */
export function loadOpenApi(filePath: string): OpenAPIObject {
  const abs = resolveToAbsolute(filePath) || filePath;
  const raw = fs.readFileSync(abs, "utf-8");
  return JSON.parse(raw) as OpenAPIObject;
}

/** ===== Type helpers ===== */
function isRef(s: SchemaObject | ReferenceObject): s is ReferenceObject {
  return (s as ReferenceObject).$ref !== undefined;
}
function resolveRef<T = any>(ref: string, root: OpenAPIObject): T | undefined {
  const parts = ref.replace(/^#\//, "").split("/");
  let cur: any = root;
  for (const p of parts) cur = cur?.[p];
  return cur as T;
}

// OAS3.0: nullable; OAS3.1: có thể là type ['null', ...]
function isNullable(s: SchemaObject): boolean {
  const n = (s as any).nullable === true;
  const typeArr = Array.isArray(s.type) ? (s.type as string[]) : [];
  return n || typeArr.includes("null");
}
function pickNonNullType(t?: string | string[]): string | undefined {
  if (!t) return undefined;
  if (Array.isArray(t)) {
    const nonNull = t.filter((x) => x !== "null");
    return nonNull.length ? nonNull[0] : undefined;
  }
  return t === "null" ? undefined : t;
}
function branchHasNull(arr?: (SchemaObject | ReferenceObject)[], root?: OpenAPIObject) {
  return !!arr?.some((sub) => {
    if (isRef(sub) && root) {
      const r = resolveRef<SchemaObject>(sub.$ref!, root);
      return !!r && (isNullable(r) || r.type === "null");
    }
    const ss = sub as SchemaObject;
    return isNullable(ss) || ss.type === "null";
  });
}

/** ===== Fake theo format ===== */
function fakeByFormat(format?: string) {
  switch (format) {
    case "date-time":
      return new Date().toISOString();
    case "date":
      return new Date().toISOString().split("T")[0];
    case "uuid":
      return faker.string.uuid();
    case "email":
      return faker.internet.email();
    case "uri":
    case "url":
      return faker.internet.url();
    case "phone":
      return faker.phone.number();
    case "ipv4":
      return "192.168.1.100";
    case "ipv6":
      return "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
    default:
      return undefined;
  }
}

/** ===== enum helper (random) ===== */
function pickEnumValue<T = any>(values: T[]): T {
  return values[randInt(0, values.length - 1)];
}

/**
 * Sinh dữ liệu giả lập từ OpenAPI schema — deref $ref, hỗ trợ nullable/oneOf/allOf
 */
export function generateMock(
  schema: SchemaObject | ReferenceObject | undefined,
  rootSpec?: OpenAPIObject,
  depth = 0
): any {
  if (!schema) return null;
  if (depth > DEPTH_LIMIT) return null;

  // Resolve $ref
  if ("$ref" in (schema as any) && rootSpec) {
    const refPath = (schema as any).$ref.replace(/^#\//, "").split("/");
    let resolved: any = rootSpec;
    for (const p of refPath) resolved = resolved?.[p];
    if (!resolved) return null;
    return generateMock(resolved, rootSpec, depth + 1);
  }

  const s = schema as SchemaObject;

  // Ưu tiên example / default / enum (enum: random)
  if (s.example !== undefined) return s.example;
  if (s.default !== undefined) return s.default;
  if (Array.isArray(s.enum) && s.enum.length) return pickEnumValue(s.enum);

  // oneOf / anyOf / allOf
  if (s.oneOf?.length) {
    if ((isNullable(s) || branchHasNull(s.oneOf, rootSpec)) && chance(NULL_PROBABILITY)) return null;
    const idx = randInt(0, s.oneOf.length - 1);
    return generateMock(s.oneOf[idx], rootSpec, depth + 1);
  }
  if (s.anyOf?.length) {
    if ((isNullable(s) || branchHasNull(s.anyOf, rootSpec)) && chance(NULL_PROBABILITY)) return null;
    const idx = randInt(0, s.anyOf.length - 1);
    return generateMock(s.anyOf[idx], rootSpec, depth + 1);
  }
  if (s.allOf?.length) {
    if (isNullable(s) && chance(NULL_PROBABILITY)) return null;
    return s.allOf.reduce((acc, sub) => {
      const val = generateMock(sub, rootSpec, depth + 1);
      if (val && typeof val === "object" && !Array.isArray(val)) return { ...acc, ...val };
      return acc ?? val;
    }, {} as any);
  }

  // nullable của schema hiện tại
  if (isNullable(s) && chance(NULL_PROBABILITY)) return null;

  const mainType = pickNonNullType(s.type);

  // OBJECT
  if (mainType === "object" || (!mainType && s.properties)) {
    const obj: any = {};
    for (const [key, prop] of Object.entries(s.properties || {})) {
      obj[key] = generateMock(prop as SchemaObject, rootSpec, depth + 1);
    }
    // additionalProperties là schema → thêm 1 cặp minh họa
    if (s.additionalProperties && typeof s.additionalProperties === "object") {
      obj["extraKey"] = generateMock(s.additionalProperties as SchemaObject, rootSpec, depth + 1);
    }
    return obj;
  }

  // ARRAY
  if (mainType === "array" || s.items) {
    if (isNullable(s) && chance(NULL_PROBABILITY)) return null;

    const minItems =
      typeof (s as any).minItems === "number" ? (s as any).minItems : DEFAULT_ARRAY_MIN;
    const maxItems =
      typeof (s as any).maxItems === "number" ? (s as any).maxItems : DEFAULT_ARRAY_MAX;

    const low = Math.max(0, Math.min(minItems, maxItems));
    const high = Math.max(low, Math.max(minItems, maxItems));
    const count = randInt(low, high);

    const arr: any[] = [];
    for (let i = 0; i < count; i++) {
      const itemsSchema = s.items as SchemaObject | ReferenceObject | undefined;

      // Item cũng có thể null nếu items nullable
      let itemsNullable = false;
      if (itemsSchema) {
        if (isRef(itemsSchema) && rootSpec) {
          const resolved = resolveRef<SchemaObject>(itemsSchema.$ref!, rootSpec);
          itemsNullable = !!resolved && isNullable(resolved);
        } else {
          itemsNullable = isNullable(itemsSchema as SchemaObject);
        }
      }
      if (itemsNullable && chance(NULL_PROBABILITY)) {
        arr.push(null);
      } else {
        arr.push(generateMock(itemsSchema as any, rootSpec, depth + 1));
      }
    }
    return arr;
  }

  // SCALAR
  const byFmt = fakeByFormat(s.format);
  if (byFmt !== undefined) return byFmt;

  switch (mainType) {
    case "string":
      return faker.lorem.word();
    case "integer":
      return faker.number.int({ min: 0, max: 9999 });
    case "number":
      return parseFloat((faker.number.int({ min: 0, max: 9999 }) + Math.random()).toFixed(2));
    case "boolean":
      return faker.datatype.boolean();
    case undefined:
      // Không rõ type → null cho an toàn
      return null;
    default:
      return faker.lorem.word();
  }
}

/** ===== Media picking giữ nguyên hành vi cũ ===== */
function pickPreferredMedia(content?: Record<string, any>) {
  if (!content) return { mediaType: null, contentJson: null, schema: null };
  const keys = Object.keys(content);
  if (!keys.length) return { mediaType: null, contentJson: null, schema: null };
  const prefer = ["application/json", "application/*+json", "text/json", "*/*"];
  const mediaType = prefer.find((mt) => keys.includes(mt)) || keys[0];
  const contentJson = content[mediaType] || null;
  const schema = contentJson?.schema || null;
  return { mediaType, contentJson, schema };
}

export function pickResponseStatus(
  operation: any,
  desired?: string
): { status: string; mediaType: string | null; contentJson: any; schema: any } {
  const responses = operation?.responses || {};
  const codes = Object.keys(responses);
  if (!codes.length) return { status: "200", mediaType: null, contentJson: null, schema: null };

  // Nếu client chỉ định rõ ràng (x-mock-status / __status) và spec có, ưu tiên dùng
  if (desired && responses[desired]) {
    const { mediaType, contentJson, schema } = pickPreferredMedia(responses[desired].content);
    return { status: desired, mediaType, contentJson, schema };
  }

  // Không chỉ định → ưu tiên 200 -> 201 -> 202
  const prefer = ["200", "201", "202"];
  const chosen = prefer.find((code) => responses[code]) || codes[0];

  const { mediaType, contentJson, schema } = pickPreferredMedia(responses[chosen].content);
  return { status: chosen, mediaType, contentJson, schema };
}
