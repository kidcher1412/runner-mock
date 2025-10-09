"use client";
import { useState, useEffect } from "react";
import MockProcessorPanel from "./MockProcessorPanel";
import DbSqlRunnerPanel from "./DbSqlRunnerPanel";
import { schemaToExample } from "@/helper/formatJsonSchemaExample";
import { ChevronLeft, Database } from "lucide-react";

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
  const [dbDisabled, setDbDisabled] = useState(false);
  const [showDbPanel, setShowDbPanel] = useState(false);

  useEffect(() => {
    if (!projectName) return;
    setLoading(true);
    setError(null);
    setDbDisabled(false);

    (async () => {
      try {
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

        const tablesRes = await fetch(`/api/db/tables?project=${projectName}`);
        if (tablesRes.status === 404) {
          setDbDisabled(true);
          setTables([]);
        } else if (tablesRes.ok) {
          const tbls = await tablesRes.json();
          if (Array.isArray(tbls)) setTables(tbls);
        } else {
          throw new Error("Không thể tải danh sách bảng DB");
        }
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
    <div className="relative h-screen overflow-hidden bg-gray-50">
{/* MAIN PROCESSOR AREA */}
<div
  className={`transition-all duration-300 h-full ${
    showDbPanel ? "pr-[420px]" : "pr-0"
  } overflow-hidden`}
>
  <div className="h-full overflow-auto p-4">
    <MockProcessorPanel
      project={projectName}
      endpoints={endpoints}
      selectedEndpoint={selectedEndpoint}
      selectEndpoint={selectEndpoint}
      schemaToExample={schemaToExample}
    />
  </div>
</div>

      {/* TOGGLE BUTTON */}
      {!dbDisabled && (
        <button
          onClick={() => setShowDbPanel(!showDbPanel)}
          className={`absolute top-1/2 right-2 transform -translate-y-1/2 z-40 p-2 rounded-full shadow bg-blue-600 text-white hover:bg-blue-700 transition-all ${
            showDbPanel ? "rotate-180" : ""
          }`}
          title={showDbPanel ? "Đóng DB Panel" : "Mở DB Panel"}
        >
          {showDbPanel ? <ChevronLeft size={20} /> : <Database size={20} />}
        </button>
      )}

      {/* DB SLIDE PANEL */}
      {!dbDisabled && (
        <div
          className={`absolute top-0 right-0 h-full w-[400px] bg-white border-l shadow-xl transition-transform duration-300 z-30 ${
            showDbPanel ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="h-full overflow-auto p-4">
            <DbSqlRunnerPanel project={projectName} tables={tables} />
          </div>
        </div>
      )}

      {/* Overlay nếu DB mode tắt */}
      {dbDisabled && (
        <div className="absolute inset-0 bg-gray-200 bg-opacity-70 flex flex-col items-center justify-center backdrop-blur-sm rounded-lg">
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-700">
              Dự án này không bật <span className="font-bold text-blue-600">DB Mode</span>
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Các tính năng sử dụng cơ sở dữ liệu tạm thời bị vô hiệu hóa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
