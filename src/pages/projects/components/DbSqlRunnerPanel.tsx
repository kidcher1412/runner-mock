"use client";
import { useState } from "react";

export default function DbSqlRunnerPanel({ project, tables }: { project: string; tables: string[] }) {
    const [selectedTable, setSelectedTable] = useState("");
    const [tableData, setTableData] = useState<any[]>([]);
    const [sql, setSql] = useState("");
    const [sqlResult, setSqlResult] = useState<any[]>([]);

    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    // --- EXPORT FUNCTION ---
    const handleExport = async (type: "json" | "sqlite") => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/scripts/export?project=${project}&type=${type}`);
            if (!res.ok) throw new Error(await res.text());

            // Tạo blob để tải file
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${project}.${type}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setMessage(`✅ Export thành công: ${project}.${type}`);
        } catch (err: any) {
            setMessage(`❌ Export lỗi: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- IMPORT FUNCTION ---
    const handleImport = async () => {
        if (!file) {
            setMessage("⚠️ Vui lòng chọn file import (.json hoặc .sqlite)");
            return;
        }

        setLoading(true);
        setMessage(null);

        const formData = new FormData();
        formData.append("project", project);
        formData.append("file", file);
        formData.append("type", file.name.endsWith(".sqlite") ? "sqlite" : "json");

        try {
            const res = await fetch("/api/scripts/import", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Import failed");

            if (data.count)
                setMessage(`✅ Import thành công ${data.count} record từ ${file.name}`);
            else setMessage(`✅ Import SQLite thành công (${file.name})`);
        } catch (err: any) {
            setMessage(`❌ Import lỗi: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const previewTable = async (table: string) => {
        setSelectedTable(table);
        const res = await fetch(`/api/db/tables?project=${project}&table=${table}`);
        const data = await res.json();
        setTableData(data);
    };

    const runSql = async () => {
        const res = await fetch(`/api/db/tables?project=${project}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sql }),
        });
        const data = await res.json();
        setSqlResult(data);
    };

    const renderTable = (rows: any[]) => {
        if (rows.length === 0) return <p className="text-gray-500 italic">Không có dữ liệu</p>;
        const columns = Object.keys(rows[0]);
        return (
            <div className="overflow-auto border rounded">
                <table className="min-w-full text-xs border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            {Array.isArray(columns) && columns.map(col => (
                                <th key={col} className="border px-2 py-1 text-left font-semibold text-gray-700">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.isArray(rows) && rows.map((row, i) => (
                            <tr key={i} className="odd:bg-white even:bg-gray-50">
                                {Array.isArray(columns) && columns.map(col => {
                                    const value = String(row[col] ?? "");
                                    const preview = value.length > 30 ? value.slice(0, 30) + "..." : value;
                                    return (
                                        <td key={col} className="border px-2 py-1" title={value}>
                                            {preview}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };


    return (
        <div className="border border-gray-200 dark:border-gray-800 rounded p-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col overflow-y-auto">

            <h2 className="font-semibold text-lg mb-3">Mock Processor Tools</h2>

            {/* EXPORT SECTION */}
            <div className="mb-4">
                <h3 className="font-medium mb-2">Export dữ liệu</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleExport("json")}
                        disabled={loading}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                        Export JSON
                    </button>
                    <button
                        onClick={() => handleExport("sqlite")}
                        disabled={loading}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        Export SQLite
                    </button>
                </div>
            </div>

            {/* IMPORT SECTION */}
            <div className="mb-4">
                <h3 className="font-medium mb-2">Import dữ liệu</h3>
                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        accept=".json,.sqlite"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="border border-gray-200 dark:border-gray-700 p-1 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                    <button
                        onClick={handleImport}
                        disabled={loading || !file}
                        className="bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 disabled:opacity-50"
                    >
                        Import
                    </button>
                </div>
            </div>

            {/* STATUS / MESSAGE */}
            {message && (
                <div
                    className={`mt-3 text-sm p-2 rounded ${message.startsWith("✅")
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : message.startsWith("❌")
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        }`}
                >
                    {message}
                </div>
            )}

            {/* LOADING STATE */}
            {loading && (
                <div className="mt-2 text-gray-500 dark:text-gray-400 text-sm animate-pulse">Đang xử lý...</div>
            )}

            <h2 className="text-lg font-bold mb-4">DB Local & SQL Runner</h2>

            <label className="font-semibold block mb-2">Chọn bảng</label>
            <select
                value={selectedTable}
                onChange={e => previewTable(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded w-full mb-4"
            >
                <option value="">-- Chọn bảng --</option>
                {Array.isArray(tables) && tables.map(t => (
                    <option key={t} value={t}>
                        {t}
                    </option>
                ))}
            </select>

            {/* {tableData.length > 0 && (
        <div className="border rounded p-2 bg-white overflow-auto text-xs mb-4">
          <h3 className="font-bold mb-2">Preview bảng {selectedTable}</h3>
          <pre>{JSON.stringify(tableData, null, 2)}</pre>
        </div>
      )} */}
            {tableData.length > 0 && (
                <div className="mb-4">
                    <h3 className="font-bold mb-2">
                        Preview bảng <span className="text-blue-600 dark:text-blue-400">{selectedTable}</span>
                    </h3>
                    {renderTable(tableData)}
                </div>
            )}

            <h3 className="font-bold mb-2">SQL Runner</h3>
            <textarea
                placeholder="Nhập SQL để chạy thử"
                value={sql}
                onChange={e => setSql(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded w-full mb-2 h-20"
            />
            <button className="bg-green-500 hover:bg-green-600 text-white font-semibold p-2 rounded mb-2" onClick={runSql}>
                Run SQL
            </button>

            {sqlResult.length > 0 && (
                <div className="border rounded p-2 bg-white overflow-auto text-xs">
                    <h3 className="font-bold mb-2">SQL Result Preview</h3>
                    <pre>{JSON.stringify(sqlResult, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}
