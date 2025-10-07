"use client";
import { useState, useEffect } from "react";
import MockProcessorPanel from "./MockProcessorPanel";
import DbSqlRunnerPanel from "./DbSqlRunnerPanel";
import { schemaToExample } from "@/helper/formatJsonSchemaExample";

type EndpointOption = {
  path: string;
  method: string;
  schema: any;
};

interface ProjectEndpointMappingProps {
  projectName: string;
}

export default function ProjectEndpointMapping({ projectName }: ProjectEndpointMappingProps) {
  const [endpoints, setEndpoints] = useState<EndpointOption[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointOption | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectName) return;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // --- Load OpenAPI file ---
        const apiRes = await fetch(`/api/project-file?name=${encodeURIComponent(projectName)}`);
        if (!apiRes.ok) throw new Error("Không thể tải OpenAPI file");
        const apiJson = await apiRes.json();

        const eps: EndpointOption[] = [];
        for (const pathKey of Object.keys(apiJson.paths || {})) {
          const pathItem = apiJson.paths[pathKey];
          for (const method of Object.keys(pathItem || {})) {
            const responseSchema =
              pathItem[method]?.responses?.["200"]?.content?.["application/json"]?.schema || null;
            eps.push({ path: pathKey, method, schema: responseSchema });
          }
        }
        setEndpoints(eps);

        // --- Load bảng DB ---
        const tablesRes = await fetch(`/api/db/tables?project=${projectName}`);
        const tbls = await tablesRes.json();
        if (Array.isArray(tbls)) setTables(tbls);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectName]);

  const selectEndpoint = (value: string) => {
    const [path, method] = value.split("|");
    const ep = endpoints.find((e) => e.path === path && e.method === method) || null;
    setSelectedEndpoint(ep);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Đang tải dữ liệu dự án...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-600">
        Lỗi: {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4 h-screen">
      <MockProcessorPanel
        project={projectName}
        endpoints={endpoints}
        selectedEndpoint={selectedEndpoint}
        selectEndpoint={selectEndpoint}
        schemaToExample={schemaToExample}
      />
      <DbSqlRunnerPanel project={projectName} tables={tables} />
    </div>
  );
}
