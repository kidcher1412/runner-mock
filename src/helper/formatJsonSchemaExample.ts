export function schemaToExample(schema: any): any {
  if (!schema || typeof schema !== "object") return {};

  if (schema.type === "object" && schema.properties) {
    const obj: Record<string, any> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      obj[key] = schemaToExample(value);
    }
    return obj;
  }

  if (schema.type === "array") {
    return [schemaToExample(schema.items)];
  }

  // Với kiểu primitive
  if (schema.example !== undefined) return schema.example;
  if (schema.enum) return schema.enum[0];
  if (schema.type === "string") return "string";
  if (schema.type === "number" || schema.type === "integer") return 0;
  if (schema.type === "boolean") return true;

  return null;
}
export function formatResponseSchemaWithExamples(schemaObj: any) {
  if (!schemaObj || typeof schemaObj !== "object") return "No schema";

  const content = schemaObj.content?.["application/json"];
  const schema = content?.schema;
  const examples = content?.examples;
  const example = content?.example; 

  let output = "";

  // 🧩 Schema
  if (schema) {
    output += "📘 Schema:\n";
    output += JSON.stringify(schemaToExample(schema), null, 2);
  }

  // 🧪 Nếu có nhiều examples
  if (examples && Object.keys(examples).length > 0) {
    output += "\n\n🧪 Examples:\n";
    Object.entries(examples).forEach(([key, ex]: [string, any]) => {
      output += `\n▶ ${ex.summary || key}:\n`;
      output += JSON.stringify(ex.value, null, 2) + "\n";
    });
  }
  // 🧪 Nếu chỉ có 1 example duy nhất
  else if (example) {
    output += "\n\n🧪 Example:\n";
    output += JSON.stringify(example, null, 2) + "\n";
  }

  return output.trim();
}
