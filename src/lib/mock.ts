import fs from "fs";
import path from "path";
import { OpenAPIObject, SchemaObject } from "openapi3-ts/oas31";
import { faker } from "@faker-js/faker";

export function loadOpenApi(filePath: string): OpenAPIObject {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as OpenAPIObject;
}

export function generateMock(schema: SchemaObject): any {
  if (!schema) return null;
  if (schema.type === "string") return faker.lorem.words(3);
  if (schema.type === "number") return faker.number.int({ min: 0, max: 100000000 });
  if (schema.type === "boolean") return faker.datatype.boolean();
  if (schema.type === "array" && schema.items) {
    return [generateMock(schema.items as SchemaObject)];
  }
  if (schema.type === "object" && schema.properties) {
    const obj: any = {};
    for (const key in schema.properties) {
      obj[key] = generateMock(schema.properties[key] as SchemaObject);
    }
    return obj;
  }
  return null;
}
