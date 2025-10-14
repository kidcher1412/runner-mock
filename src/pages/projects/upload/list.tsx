"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Edit2, Database, FileJson, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

type Project = {
  name: string;
  useDB: boolean;
  endpoints: number;
  processors: { pre: number; post: number; expect: number };
};

export default function ProjectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "db" | "file">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const [sortField, setSortField] = useState<"name" | "endpoints">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const router = useRouter();

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setProjects(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (filterMode === "db" && !p.useDB) return false;
        if (filterMode === "file" && p.useDB) return false;
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        const fieldA = a[sortField];
        const fieldB = b[sortField];
        if (typeof fieldA === "string" && typeof fieldB === "string") {
          return sortOrder === "asc"
            ? fieldA.localeCompare(fieldB)
            : fieldB.localeCompare(fieldA);
        }
        if (typeof fieldA === "number" && typeof fieldB === "number") {
          return sortOrder === "asc" ? fieldA - fieldB : fieldB - fieldA;
        }
        return 0;
      });
  }, [projects, filterMode, search, sortField, sortOrder]);


  const deleteProject = async (name: string) => {
    if (!confirm(`Xóa project "${name}"?`)) return;
    try {
      const res = await fetch(`/api/update-project/project-delete?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      fetchProjects();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const editProject = (name: string) => {
    alert(`TODO: Mở giao diện sửa project "${name}"`);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // // 🧠 Lọc + tìm kiếm
  // const filteredProjects = useMemo(() => {
  //   return projects
  //     .filter((p) => {
  //       if (filterMode === "db" && !p.useDB) return false;
  //       if (filterMode === "file" && p.useDB) return false;
  //       if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
  //       return true;
  //     })
  //     .sort((a, b) => a.name.localeCompare(b.name));
  // }, [projects, filterMode, search]);

  // 📄 Phân trang
  const totalPages = Math.ceil(filteredProjects.length / pageSize);
  const currentProjects = filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset về trang 1 khi lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterMode]);
  const openProject = (name: string) => {
    router.push(`/projects?name=${encodeURIComponent(name)}`);
  };
  const openBrowser = (name: string) => {
    router.push(`/projects/browser?name=${encodeURIComponent(name)}`);
  };
  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen">
      {/* Header + Actions */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Danh sách Dự án</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="🔍 Tìm theo tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
          />
          {/* 🔼 Chọn hướng sắp xếp */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded px-2 py-1 text-sm"
          >
            <option value="desc">Giảm dần</option>
            <option value="asc">Tăng dần</option>
          </select>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as "all" | "db" | "file")}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded px-2 py-1 text-sm"
          >
            <option value="all">Tất cả</option>
            <option value="db">Chỉ DB Mode</option>
            <option value="file">Chỉ File Mode</option>
          </select>
          <button
            onClick={fetchProjects}
            className="flex items-center gap-1 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
          >
            <RefreshCcw size={14} /> Làm mới
          </button>
        </div>
      </div>

      {/* Nội dung */}
      {loading ? (
        <p className="text-gray-700 dark:text-gray-300">Đang tải...</p>
      ) : error ? (
        <p className="text-red-600 dark:text-red-400">{error}</p>
      ) : projects.length === 0 ? (
        <p className="text-gray-700 dark:text-gray-300">Chưa có dự án nào. Hãy upload file OpenAPI JSON mới.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {currentProjects.map((p) => (
              <div
                key={p.name}
                className="border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-4 bg-white dark:bg-gray-900 hover:shadow-md transition"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100" onClick={() => openProject(p.name)}>{p.name}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${p.useDB
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                  >
                    {p.useDB ? <Database size={14} /> : <FileJson size={14} />}
                    {p.useDB ? "SQLite mode" : "File mode"}
                  </span>
                </div>

                <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  <p onClick={() => openProject(p.name)}>📘 Endpoint: {p.endpoints}</p>
                  <p onClick={() => openBrowser(p.name)}>
                    ⚙️ Processors:{" "}
                    <span className="text-blue-600 dark:text-blue-400">pre: {p.processors.pre}</span>,{" "}
                    <span className="text-orange-600 dark:text-orange-400">post: {p.processors.post}</span>,{" "}
                    <span className="text-purple-600 dark:text-purple-400">expect: {p.processors.expect}</span>
                  </p>
                </div>

                <div className="flex justify-end gap-3 mt-3">
                  <button
                    onClick={() => editProject(p.name)}
                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Edit2 size={16} /> Sửa
                  </button>
                  <button
                    onClick={() => deleteProject(p.name)}
                    className="flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline"
                  >
                    <Trash2 size={16} /> Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 📄 Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded disabled:opacity-40"
              >
                ← Trước
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded disabled:opacity-40"
              >
                Sau →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
