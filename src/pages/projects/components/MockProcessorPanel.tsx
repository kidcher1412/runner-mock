"use client";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

type EndpointOption = {
    path: string;
    method: string;
    schema: any;
};

type Processor = {
    id: number;
    project: string;
    endpoint: string;
    method: string;
    type: "pre" | "post" | "expectation";
    code: string;
    enabled?: number;
    created_at?: string;
};


export default function MockProcessorPanel({
    project,
    endpoints,
    selectedEndpoint,
    selectEndpoint,
    schemaToExample,
}: {
    project: string;
    endpoints: EndpointOption[];
    selectedEndpoint: EndpointOption | null;
    selectEndpoint: (v: string) => void;
    schemaToExample: (schema: any) => any;
}) {
    const [activeTab, setActiveTab] = useState<"pre" | "post" | "expectation">("pre");
    const [processors, setProcessors] = useState<Processor[]>([]);
    const [selectedProcessor, setSelectedProcessor] = useState<Processor | null>(null);
    const [editCode, setEditCode] = useState("");
    const [showModal, setShowModal] = useState(false);

    const [newCode, setNewCode] = useState("");
    const [showConsole, setShowConsole] = useState(false);
    const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
    const [showConfig, setShowConfig] = useState(false);
    const [configTab, setConfigTab] = useState<"headers" | "params" | "body">("headers");

    const [httpHeaders, setHttpHeaders] = useState([{ key: "", value: "" }]);
    const [httpParams, setHttpParams] = useState([{ key: "", value: "" }]);
    const [httpBody, setHttpBody] = useState("{}");

    const [expectMode, setExpectMode] = useState(false);
    const [loadingMode, setLoadingMode] = useState(false);


    const [expectForm, setExpectForm] = useState({
        name: "",
        location: "",
        field: "",
        comparison: "",
        expectedValue: "",
        enabled: true,
    });

    const loadProcessors = async (ep: EndpointOption) => {
        const res = await fetch(
            `/api/scripts/process?project=${project}&endpoint=${ep.path}&method=${ep.method}`
        );
        const data: Processor[] = await res.json();
        setProcessors(data);
        const isExpectActive = data.some(
            (p) => p.type === "expectation" && p.enabled === 1
        );
        setExpectMode(isExpectActive);
        if (isExpectActive) setActiveTab("expectation");
    };

    useEffect(() => {
        if (selectedEndpoint) loadProcessors(selectedEndpoint);
    }, [selectedEndpoint]);

    const toggleExpectMode = async () => {
        if (!selectedEndpoint) return;
        setLoadingMode(true);
        try {
            const res = await fetch(`/api/scripts/expectation`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project,
                    endpoint: selectedEndpoint.path,
                    method: selectedEndpoint.method,
                    enabled: !expectMode,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(!expectMode ? "🧪 Expect Mode bật" : "⚙️ Process Mode bật");
            setExpectMode(!expectMode);
            setActiveTab(!expectMode ? "expectation" : "pre");
            loadProcessors(selectedEndpoint);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoadingMode(false);
        }
    };

    const addProcessor = async () => {
        if (!selectedEndpoint || !newCode.trim()) return;
        await fetch(`/api/scripts/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                project,
                endpoint: selectedEndpoint.path,
                method: selectedEndpoint.method,
                type: activeTab,
                code: newCode,
            }),
        });
        setNewCode("");
        loadProcessors(selectedEndpoint);
    };

    const openModal = (p: Processor) => {
        setSelectedProcessor(p);
        setEditCode(p.code);
        setShowModal(true);
    };

    const deleteProcessor = async (id: number) => {
        if (!confirm("Bạn có chắc muốn xóa mục này?")) return;

        const apiUrl =
            activeTab === "expectation"
                ? "/api/scripts/expectation"
                : "/api/scripts/process";

        await fetch(apiUrl, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });

        setShowModal(false);
        if (selectedEndpoint) loadProcessors(selectedEndpoint);
    };

    const saveEdit = async () => {
        if (!selectedProcessor) return;
        if (!project || !selectedEndpoint) return alert("Thiếu thông tin project hoặc endpoint!");

        const apiUrl =
            activeTab === "expectation"
                ? "/api/scripts/expectation"
                : "/api/scripts/process";

        const body =
            activeTab === "expectation"
                ? {
                    id: selectedProcessor.id,
                    project,
                    endpoint: selectedEndpoint.path,
                    method: selectedEndpoint.method,
                    code: editCode,
                }
                : {
                    id: selectedProcessor.id,
                    project,
                    endpoint: selectedEndpoint.path,
                    method: selectedEndpoint.method,
                    code: editCode,
                };

        const res = await fetch(apiUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
            console.error("❌ Lỗi cập nhật:", data);
            alert("Cập nhật thất bại: " + data.error);
            return;
        }

        console.log("✅ Cập nhật thành công:", data);
        setShowModal(false);
        if (selectedEndpoint) loadProcessors(selectedEndpoint);
    };


    const addHeader = () => setHttpHeaders([...httpHeaders, { key: "", value: "" }]);
    const addParam = () => setHttpParams([...httpParams, { key: "", value: "" }]);
    const removeHeader = (i: number) =>
        setHttpHeaders(httpHeaders.filter((_, idx) => idx !== i));
    const removeParam = (i: number) =>
        setHttpParams(httpParams.filter((_, idx) => idx !== i));

    const testProcessor = async () => {
        if (!newCode.trim()) return;
        const headersObj = Object.fromEntries(
            httpHeaders.filter((h) => h.key).map((h) => [h.key, h.value])
        );
        const paramsObj = Object.fromEntries(
            httpParams.filter((p) => p.key).map((p) => [p.key, p.value])
        );
        let bodyObj = {};
        try {
            bodyObj = JSON.parse(httpBody || "{}");
        } catch {
            alert("Body không phải JSON hợp lệ");
            return;
        }

        const res = await fetch("/api/scripts/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                project,
                code: newCode,
                mode: "processor",
                mock: { headers: headersObj, params: paramsObj, body: bodyObj },
            }),
        });

        const data = await res.json();
        setConsoleOutput(data.logs || []);
        alert("Kết quả test: " + JSON.stringify(data.result, null, 2));
    };

    const testExpectation = async () => {
        const headersObj = Object.fromEntries(
            httpHeaders.filter(h => h.key).map(h => [h.key, h.value])
        );
        const paramsObj = Object.fromEntries(
            httpParams.filter(p => p.key).map(p => [p.key, p.value])
        );
        let bodyObj = {};
        try {
            bodyObj = JSON.parse(httpBody || "{}");
        } catch {
            alert("Body không phải JSON hợp lệ");
            return;
        }

        //   const { location, field, comparison, expectedValue } = expectForm;
        //   if (!location || !field || !comparison) {
        //     alert("Vui lòng nhập đầy đủ thông tin Expect để test");
        //     return;
        //   }

        const res = await fetch(`/api/${project}${selectedEndpoint!.path}`, {
            method: selectedEndpoint!.method,
            headers: { "Content-Type": "application/json", ...headersObj },
            body: JSON.stringify(bodyObj),
        });

        const data = await res.json();
        setConsoleOutput([JSON.stringify(data, null, 2)]);
        alert("Kết quả test Expectation:\n" + JSON.stringify(data, null, 2));
    };



    const addExpectation = async () => {
        if (!selectedEndpoint) return;
        const { name, location, field, comparison, expectedValue, enabled } = expectForm;
        if (!name || !location || !field || !comparison) {
            alert("Vui lòng nhập đầy đủ thông tin expectation");
            return;
        }

        await fetch(`/api/scripts/expectation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                project,
                endpoint: selectedEndpoint.path,
                method: selectedEndpoint.method,
                name,
                location,
                field,
                comparison,
                expectedValue,
                enabled,
            }),
        });

        setExpectForm({
            name: "",
            location: "",
            field: "",
            comparison: "",
            expectedValue: "",
            enabled: true,
        });
        loadProcessors(selectedEndpoint);
    };

    return (
        <div className="border rounded p-4 bg-white flex flex-col overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Processor Management</h2>

            <select
                value={selectedEndpoint ? `${selectedEndpoint.path}|${selectedEndpoint.method}` : ""}
                onChange={(e) => selectEndpoint(e.target.value)}
                className="border p-2 rounded mb-3"
            >
                <option value="">-- Chọn Endpoint --</option>
                {endpoints.map((ep) => (
                    <option key={ep.path + ep.method} value={`${ep.path}|${ep.method}`}>
                        {ep.method.toUpperCase()} {ep.path}
                    </option>
                ))}
            </select>

            {selectedEndpoint && (
                <>
                    {/* Trạng thái chế độ */}
                    <div className="flex justify-between items-center mb-3">
                        <span className={`font-semibold ${expectMode ? "text-pink-600" : "text-blue-600"}`}>
                            {expectMode ? "🧪 Expect Mode đang chạy" : "⚙️ Process Mode đang chạy"}
                        </span>
                        <button
                            onClick={toggleExpectMode}
                            disabled={loadingMode}
                            className={`px-3 py-1 rounded text-sm ${expectMode
                                ? "bg-blue-100 hover:bg-blue-200"
                                : "bg-pink-100 hover:bg-pink-200"
                                }`}
                        >
                            {expectMode ? "Tắt Expect Mode" : "Bật Expect Mode"}
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 mb-2">
                        {["pre", "post", "expectation"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                disabled={expectMode && tab !== "expectation"}
                                className={`px-2 py-1 rounded text-xs transition-all ${activeTab === tab
                                    ? tab === "expectation"
                                        ? "bg-pink-500 text-white"
                                        : "bg-blue-600 text-white"
                                    : "bg-gray-200 hover:bg-gray-300"
                                    } ${expectMode && tab !== "expectation" ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                {tab === "pre"
                                    ? "Pre Processor"
                                    : tab === "post"
                                        ? "Post Processor"
                                        : "Expectations"}
                            </button>
                        ))}
                    </div>

                    {/* Thêm mới */}
                    {activeTab !== "expectation" ? (
                        <>
                            <textarea
                                placeholder={`Nhập code cho ${activeTab}`}
                                value={newCode}
                                onChange={(e) => setNewCode(e.target.value)}
                                className="border p-2 rounded w-full mb-2 h-20 text-xs font-mono"
                            />
                            <button
                                className="bg-purple-500 hover:bg-purple-600 text-white font-semibold p-2 rounded mb-4"
                                onClick={addProcessor}
                            >
                                ➕ Thêm {activeTab}
                            </button>
                        </>
                    ) : (
                        <div className="border rounded p-3 mb-3 bg-gray-50 text-xs">
                            <h3 className="font-semibold mb-2">Tạo Expectation</h3>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <input
                                    placeholder="Tên Expectation"
                                    value={expectForm.name}
                                    onChange={(e) => setExpectForm({ ...expectForm, name: e.target.value })}
                                    className="border p-1 rounded"
                                />
                                <select
                                    value={expectForm.location}
                                    onChange={(e) => setExpectForm({ ...expectForm, location: e.target.value })}
                                    className="border p-1 rounded"
                                >
                                    <option value="">-- Chọn Vị trí --</option>
                                    <option value="headers">Headers</option>
                                    <option value="params">Params</option>
                                    <option value="body">Body</option>
                                </select>
                                <input
                                    placeholder="Field cần kiểm tra (ví dụ: userId)"
                                    value={expectForm.field}
                                    onChange={(e) => setExpectForm({ ...expectForm, field: e.target.value })}
                                    className="border p-1 rounded"
                                />
                                <select
                                    value={expectForm.comparison}
                                    onChange={(e) => setExpectForm({ ...expectForm, comparison: e.target.value })}
                                    className="border p-1 rounded"
                                >
                                    <option value="">-- Chọn kiểu so sánh --</option>
                                    <option value="equals">= (equals)</option>
                                    <option value="not_equals">≠ (not equals)</option>
                                    <option value="contains">contains</option>
                                    <option value="regex">regex</option>
                                    <option value="exists">exists</option>
                                </select>
                            </div>
                            <input
                                placeholder="Giá trị mong đợi"
                                value={expectForm.expectedValue}
                                onChange={(e) => setExpectForm({ ...expectForm, expectedValue: e.target.value })}
                                className="border p-1 rounded w-full mb-2"
                            />
                            <label className="flex items-center gap-2 mb-3">
                                <input
                                    type="checkbox"
                                    checked={expectForm.enabled}
                                    onChange={(e) => setExpectForm({ ...expectForm, enabled: e.target.checked })}
                                />
                                Bật Expect này
                            </label>
                            <button
                                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold p-2 rounded"
                                onClick={addExpectation}
                            >
                                ➕ Thêm Expectation
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2 mb-3 items-center">
                        <button
                            className="bg-purple-500 hover:bg-purple-600 text-white font-semibold p-2 rounded"
                            onClick={addProcessor}
                        >
                            ➕ Thêm {activeTab}
                        </button>
                        {/* Nút test chỉ hiện theo tab đang chọn */}
                        {activeTab !== "expectation" ? (
                            <button
                                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold p-2 rounded"
                                onClick={testProcessor}
                            >
                                ▶️ Test Process
                            </button>
                        ) : (
                            <button
                                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold p-2 rounded"
                                onClick={testExpectation}
                            >
                                🧪 Test Expectation
                            </button>
                        )}
                        <label className="flex items-center gap-1 text-xs">
                            <input
                                type="checkbox"
                                checked={showConsole}
                                onChange={(e) => setShowConsole(e.target.checked)}
                            />
                            Console
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                            <input
                                type="checkbox"
                                checked={showConfig}
                                onChange={(e) => setShowConfig(e.target.checked)}
                            />
                            HTTP Config
                        </label>
                    </div>

                    {showConfig && (
                        <div className="border rounded p-2 mb-3 bg-gray-50 text-xs">
                            <div className="flex gap-2 mb-2">
                                {["headers", "params", "body"].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setConfigTab(tab as any)}
                                        className={`px-2 py-1 rounded text-xs ${configTab === tab ? "bg-blue-500 text-white" : "bg-gray-200"
                                            }`}
                                    >
                                        {tab.toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            {configTab === "body" ? (
                                <textarea
                                    value={httpBody}
                                    onChange={(e) => setHttpBody(e.target.value)}
                                    className="border p-2 rounded w-full h-24 font-mono text-xs"
                                />
                            ) : (
                                <div>
                                    {(configTab === "headers" ? httpHeaders : httpParams).map((x, i) => (
                                        <div key={i} className="flex gap-1 mb-1">
                                            <input
                                                placeholder="Key"
                                                value={x.key}
                                                onChange={(e) => {
                                                    const arr = configTab === "headers" ? [...httpHeaders] : [...httpParams];
                                                    arr[i].key = e.target.value;
                                                    configTab === "headers" ? setHttpHeaders(arr) : setHttpParams(arr);
                                                }}
                                                className="border p-1 flex-1 rounded"
                                            />
                                            <input
                                                placeholder="Value"
                                                value={x.value}
                                                onChange={(e) => {
                                                    const arr = configTab === "headers" ? [...httpHeaders] : [...httpParams];
                                                    arr[i].value = e.target.value;
                                                    configTab === "headers" ? setHttpHeaders(arr) : setHttpParams(arr);
                                                }}
                                                className="border p-1 flex-1 rounded"
                                            />
                                            <button
                                                onClick={() =>
                                                    configTab === "headers" ? removeHeader(i) : removeParam(i)
                                                }
                                                className="px-2 bg-red-500 text-white rounded"
                                            >
                                                ✖
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={configTab === "headers" ? addHeader : addParam}
                                        className="mt-1 text-blue-600 text-xs hover:underline"
                                    >
                                        ➕ Thêm {configTab === "headers" ? "Header" : "Param"}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {showConsole && (
                        <div className="mt-2 border rounded bg-black text-green-400 p-2 text-xs font-mono h-32 overflow-auto">
                            {consoleOutput.map((line, i) => (
                                <div key={i}>{line}</div>
                            ))}
                        </div>
                    )}

                    {/* Table */}
                    <table className="w-full border text-xs mt-4">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-2 border">ID</th>
                                <th className="p-2 border">Type</th>
                                <th className="p-2 border">Enabled</th>
                                <th className="p-2 border">Created</th>
                                <th className="p-2 border">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processors
                                .filter((p) => p.type === activeTab)
                                .map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="p-2 border text-center">{p.id}</td>
                                        <td className="p-2 border text-center">{p.type}</td>
                                        <td className="p-2 border text-center">{p.enabled ? "✅" : "❌"}</td>
                                        <td className="p-2 border text-center text-gray-500">
                                            {p.created_at || ""}
                                        </td>
                                        <td className="p-2 border text-center">
                                            <button
                                                className="text-blue-600 hover:underline"
                                                onClick={() => openModal(p)}
                                            >
                                                Xem
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>

                    {/* Modal */}
                    {showModal && selectedProcessor && (
                        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                            <div className="bg-white rounded-lg p-4 w-[600px] shadow-lg">
                                <h3 className="text-lg font-semibold mb-2">
                                    Processor #{selectedProcessor.id}
                                </h3>
                                <textarea
                                    value={editCode}
                                    onChange={(e) => setEditCode(e.target.value)}
                                    className="border p-2 rounded w-full h-48 text-xs font-mono mb-3"
                                />
                                <div className="flex justify-between">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                                    >
                                        Đóng
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => deleteProcessor(selectedProcessor.id)}
                                            className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                                        >
                                            🗑 Xóa
                                        </button>
                                        <button
                                            onClick={saveEdit}
                                            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                        >
                                            💾 Lưu
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
