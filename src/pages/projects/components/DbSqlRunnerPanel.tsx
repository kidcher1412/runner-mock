"use client";
import { useState } from "react";

export default function DbSqlRunnerPanel({ project, tables }: { project: string; tables: string[] }) {
    const [selectedTable, setSelectedTable] = useState("");
    const [tableData, setTableData] = useState<any[]>([]);
    const [sql, setSql] = useState("");
    const [sqlResult, setSqlResult] = useState<any[]>([]);

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
                            {columns.map(col => (
                                <th key={col} className="border px-2 py-1 text-left font-semibold text-gray-700">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className="odd:bg-white even:bg-gray-50">
                                {columns.map(col => {
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
        <div className="border rounded p-4 bg-gray-50 flex flex-col overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">DB Local & SQL Runner</h2>

            <label className="font-semibold block mb-2">Chọn bảng</label>
            <select
                value={selectedTable}
                onChange={e => previewTable(e.target.value)}
                className="border p-2 rounded w-full mb-4"
            >
                <option value="">-- Chọn bảng --</option>
                {tables.map(t => (
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
                        Preview bảng <span className="text-blue-600">{selectedTable}</span>
                    </h3>
                    {renderTable(tableData)}
                </div>
            )}

            <h3 className="font-bold mb-2">SQL Runner</h3>
            <textarea
                placeholder="Nhập SQL để chạy thử"
                value={sql}
                onChange={e => setSql(e.target.value)}
                className="border p-2 rounded w-full mb-2 h-20"
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
