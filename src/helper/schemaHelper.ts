import {
  OpenAPIObject,
  ReferenceObject,
  SchemaObject,
} from "openapi3-ts/oas31";
declare module "openapi3-ts/oas31" {
  interface SchemaObject {
    nullable?: boolean;
  }
}
/** ---- Tùy chỉnh behavior ---- **/

/** ---- Tùy chỉnh ---- **/
const NULL_PROBABILITY = 0.3;
const DEFAULT_ARRAY_MIN = 0;
const DEFAULT_ARRAY_MAX = 3;
const DEPTH_LIMIT = 10;

/** ---- Random helpers (ưu tiên crypto) ---- **/
function randInt(min: number, max: number) {
  if (max < min) [min, max] = [max, min];
  // Node 16+/Browser
  // @ts-ignore
  if (typeof crypto !== "undefined") {
    // Node: crypto.randomInt; Browser: getRandomValues
    // @ts-ignore
    if (typeof crypto.randomInt === "function") {
      // Node
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
  // Fallback
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const chance = (p: number) => randInt(1, 10_000) <= Math.floor(p * 10_000);

/** ---- Type guards / resolvers ---- **/
function isRef(s: SchemaObject | ReferenceObject): s is ReferenceObject {
  return (s as ReferenceObject).$ref !== undefined;
}
function resolveRef<T = any>(ref: string, root: OpenAPIObject): T | undefined {
  const parts = ref.replace(/^#\//, "").split("/");
  let cur: any = root;
  for (const p of parts) cur = cur?.[p];
  return cur as T;
}

// OpenAPI 3.0 có nullable; oas31 đôi khi không khai báo trong type
function isNullable(s: SchemaObject): boolean {
  const n = (s as any).nullable === true;
  // cũng xem xét kiểu dạng ["null", "object"] hoặc ["string","null"]
  const typeArr = Array.isArray(s.type) ? (s.type as string[]) : [];
  return n || typeArr.includes("null");
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

/** ---- enum / format ---- **/
function pickEnumValue<T = any>(values: T[]): T {
  return values[randInt(0, values.length - 1)];
}
function fakeByFormat(fmt?: string): string {
  switch (fmt) {
    case "date": return new Date().toISOString().slice(0, 10);
    case "date-time": return new Date().toISOString();
    case "email": return "user@example.com";
    case "uuid": return "123e4567-e89b-12d3-a456-426614174000";
    case "uri":
    case "url": return "https://example.com";
    case "ipv4": return "192.168.1.100";
    case "ipv6": return "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
    default: return "string_example";
  }
}

export function generateFakeDataFromSchema(
  schema: SchemaObject | ReferenceObject,
  missingFields: { field: string; type: string }[] = [],
  rootSpec?: OpenAPIObject,
  depth = 0
): any {
    console.log("fake new")
  if (!schema) return "string_example_return_no_schema";
  if (depth > DEPTH_LIMIT) return null;

  // $ref
  if (isRef(schema) && rootSpec) {
    const resolved = resolveRef<SchemaObject>(schema.$ref!, rootSpec);
    return generateFakeDataFromSchema(resolved as any, missingFields, rootSpec, depth + 1);
  }

  const s = schema as SchemaObject;

  // allOf
  if (s.allOf?.length) {
    if ((isNullable(s) || branchHasNull(s.allOf, rootSpec)) && chance(NULL_PROBABILITY)) return null;
    const merged: any = {};
    for (const sub of s.allOf) {
      const subVal = generateFakeDataFromSchema(sub as any, missingFields, rootSpec, depth + 1);
      if (subVal && typeof subVal === "object" && !Array.isArray(subVal)) Object.assign(merged, subVal);
      else if (subVal != null) merged.$value = subVal;
    }
    return merged;
  }

  // oneOf / anyOf
  if (s.oneOf?.length) {
    if ((isNullable(s) || branchHasNull(s.oneOf, rootSpec)) && chance(NULL_PROBABILITY)) return null;
    const idx = randInt(0, s.oneOf.length - 1);
    return generateFakeDataFromSchema(s.oneOf[idx] as any, missingFields, rootSpec, depth + 1);
  }
  if (s.anyOf?.length) {
    if ((isNullable(s) || branchHasNull(s.anyOf, rootSpec)) && chance(NULL_PROBABILITY)) return null;
    const idx = randInt(0, s.anyOf.length - 1);
    return generateFakeDataFromSchema(s.anyOf[idx] as any, missingFields, rootSpec, depth + 1);
  }

  // nullable chính schema
  if (isNullable(s) && chance(NULL_PROBABILITY)) return null;

  // object
  if (s.type === "object" || (s.properties && s.type !== "array")) {
    const obj: any = {};
    const required = new Set<string>(s.required ?? []);
    for (const [key, prop] of Object.entries(s.properties ?? {})) {
      const val = generateFakeDataFromSchema(prop as any, missingFields, rootSpec, depth + 1);
      if (val === undefined && required.has(key)) {
        missingFields.push({ field: key, type: "required-missing" });
      }
      obj[key] = val;
    }
    if (s.additionalProperties && typeof s.additionalProperties === "object") {
      obj["extraKey"] = generateFakeDataFromSchema(
        s.additionalProperties as SchemaObject,
        missingFields,
        rootSpec,
        depth + 1
      );
    }
    return obj;
  }

  // array (mảng có thể null nếu schema nullable)
  if (s.type === "array") {
    if (isNullable(s) && chance(NULL_PROBABILITY)) return null;

    const min = typeof s.minItems === "number" ? s.minItems : DEFAULT_ARRAY_MIN;
    const max = typeof s.maxItems === "number" ? s.maxItems : DEFAULT_ARRAY_MAX;
    const low = Math.max(0, Math.min(min, max));
    const high = Math.max(low, Math.max(min, max));
    const count = randInt(low, high); // 0..3 mặc định

    const arr: any[] = [];
    for (let i = 0; i < count; i++) {
      const itemSchema = s.items as any;
      // Item cũng có thể null nếu nullable
      if (itemSchema && !isRef(itemSchema)) {
        const nullableItem = isNullable(itemSchema as SchemaObject);
        if (nullableItem && chance(NULL_PROBABILITY)) {
          arr.push(null);
          continue;
        }
      }
      arr.push(generateFakeDataFromSchema(itemSchema, missingFields, rootSpec, depth + 1));
    }
    return arr;
  }

  // enum
  if (Array.isArray(s.enum) && s.enum.length > 0) {
    return pickEnumValue(s.enum as any[]);
  }

  // primitives
  switch (s.type) {
    case "string": return fakeByFormat(s.format);
    case "integer": return 0;
    case "number": return 0.0;
    case "boolean": return chance(0.5);
    case "null": return null;
    default:
      if (s.format) return fakeByFormat(s.format);
      return null;
  }
}


export function collectMissingFieldsFromSchema(
  schema: SchemaObject,
  data: any,
  pathPrefix = "",
  rootSpec?: OpenAPIObject,
  missing: { field: string; type: string }[] = []
) {
  if (!schema) return missing;

  // Resolve $ref nếu có
  if (schema.$ref && rootSpec) {
    const refPath = schema.$ref.replace("#/", "").split("/");
    let ref: any = rootSpec;
    for (const p of refPath) ref = ref?.[p];
    if (ref) return collectMissingFieldsFromSchema(ref, data, pathPrefix, rootSpec, missing);
  }

  // Nếu là object
  if (schema.type === "object" && schema.properties) {
    const objData = data && typeof data === "object" ? data : {};
    const required = schema.required || [];
    for (const key of required) {
      const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      const propSchema = schema.properties[key] as SchemaObject;

      if (objData[key] === undefined || objData[key] === "") {
        const expectedType = normalizeType(propSchema?.type);
        missing.push({ field: `Body: ${fullPath}`, type: expectedType });
      } else {
        // Nếu là object hoặc array lồng thì đệ quy tiếp
        collectMissingFieldsFromSchema(propSchema, objData[key], fullPath, rootSpec, missing);
      }
    }
  }

  // Nếu là array
  if (schema.type === "array" && schema.items) {
    const arrData = Array.isArray(data) ? data : [];
    if (arrData.length === 0 && (schema as any).minItems > 0) {
      missing.push({ field: `Body: ${pathPrefix}`, type: "array (minItems > 0)" });
    } else {
      arrData.forEach((item, idx) =>
        collectMissingFieldsFromSchema(schema.items as SchemaObject, item, `${pathPrefix}[${idx}]`, rootSpec, missing)
      );
    }
  }

  return missing;
}
export function normalizeType(t: string | string[] | undefined): string {
  if (!t) return "unknown";
  return Array.isArray(t) ? t.join("|") : t;
}