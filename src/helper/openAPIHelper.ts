function parseOpenAPI(spec: any): Endpoint[] {
  const endpoints: Endpoint[] = [];

  for (const path in spec.paths) {
    const pathItem = spec.paths[path];
    for (const method in pathItem) {
      const operation = pathItem[method];

      endpoints.push({
        path,
        method: method.toUpperCase(),
        requestBody: operation.requestBody?.content?.["application/json"]?.schema,
        responses: Object.entries(operation.responses || {}).map(([code, res]) => {
          const r = res as any;
          return {
            status: code,
            description: r.description,
            content: r.content || {},
          };
        }),
      });
    }
  }

  return endpoints;
}
