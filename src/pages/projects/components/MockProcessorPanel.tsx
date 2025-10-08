"use client";
import { httpStatusCodes } from "@/statics/data/httpStatusCodes";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import ExpectationForm from "./ExpectationForm";

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

type Condition = {
    openParen: boolean;
    closeParen: boolean;
    location: string;
    field: string;
    comparison: string;
    expectedValue: string;
    logicBefore?: "AND" | "OR"; // nối với điều kiện trước
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
    schemaToExample: (schema: any, rootSpec: any) => any;
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

    const [nextLogic, setNextLogic] = useState<"AND" | "OR">("AND");
    const [expectForm, setExpectForm] = useState({
        name: "",
        logic: "AND", // mặc định là AND giữa các điều kiện
        contentType: "application/json", // mới
        mockResponse: "",                // mới
        mockResponseStatus: "200",                // mới
        conditions: [
            {
                location: "",
                field: "",
                comparison: "",
                expectedValue: "",
                enabled: true,
                openParen: false, // có mở ngoặc trước điều kiện này không
                closeParen: false, // có đóng ngoặc sau điều kiện này không
                logicBefore: "AND", // logic giữa các điều kiện
            },
        ],
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
        const apiUrl =
            activeTab === "expectation"
                ? "/api/scripts/expectation"
                : "/api/scripts/process";

        // Trường hợp không chọn endpoint
        if (!selectedEndpoint) {
            alert("Thiếu thông tin endpoint!");
            return;
        }

        // Nếu là expectation
        if (activeTab === "expectation") {
            if (
                !expectForm.name.trim() ||
                !expectForm.conditions?.length
            ) {
                alert("Thiếu tên hoặc điều kiện expectation!");
                console.log(expectForm);
                return;
            }

            await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project,
                    endpoint: selectedEndpoint.path,
                    method: selectedEndpoint.method,
                    type: activeTab,
                    ...expectForm,
                }),
            });

            // Reset form expectation sau khi thêm
            setExpectForm({
                name: "",
                logic: "AND",
                conditions: [],
                contentType: "application/json",
                mockResponse: "",
                mockResponseStatus: "200",
            });
        }

        // Nếu là processor thông thường
        else {
            if (!newCode.trim()) {
                alert("Thiếu nội dung code!");
                console.log(expectForm);
                return;
            }

            await fetch(apiUrl, {
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

            // Reset code sau khi thêm
            setNewCode("");
        }

        // Reload lại danh sách sau khi thêm
        loadProcessors(selectedEndpoint);
    };


    const openModal = (p: Processor) => {
        setSelectedProcessor(p);
        setEditCode(p.code);
        setShowModal(true);
    };

    const deleteProcessor = async (id: number) => {
        if (!confirm("Bạn có chắc muốn xóa mục này?")) return;
        if (!project || !id) return alert("Thiếu thông tin project hoặc endpoint!");
        const apiUrl =
            activeTab === "expectation"
                ? "/api/scripts/expectation"
                : "/api/scripts/process";

        await fetch(apiUrl, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, project: project }),
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
                    code: selectedProcessor.code,
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



    // ✅ Khi thêm điều kiện mới
    const addCondition = () => {
        setExpectForm((prev) => ({
            ...prev,
            conditions: [
                ...prev.conditions,
                {
                    location: "",
                    field: "",
                    comparison: "",
                    expectedValue: "",
                    enabled: true,
                    openParen: false,
                    closeParen: false,
                    logicBefore: nextLogic, // điều kiện mới nối bằng logic hiện tại
                },
            ],
        }));
    };

    const updateCondition = (index: number, key: string, value: any) => {
        const newConditions = [...expectForm.conditions];
        (newConditions[index] as any)[key] = value;
        setExpectForm({ ...expectForm, conditions: newConditions });
    };

    const removeCondition = (index: number) => {
        setExpectForm((prev) => ({
            ...prev,
            conditions: prev.conditions.filter((_, i) => i !== index),
        }));
    };

    const renderPreview = () => {
        return expectForm.conditions
            .map((cond, i) => {
                if (!cond.location || !cond.field) return "";
                const logic = cond.logicBefore ? `${cond.logicBefore} ` : ""; // logic của điều kiện hiện tại
                const expr = `${cond.openParen ? "(" : ""}${cond.location}.${cond.field} ${cond.comparison
                    } ${cond.expectedValue}${cond.closeParen ? ")" : ""}`;
                return `${logic}${expr}`;
            })
            .filter(Boolean)
            .join(" ");
    };

    const [modeViewModal, setModeViewModal] = useState<"view" | "edit">("view");


    return (
        <div className="border rounded p-4 bg-white flex flex-col overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Processor Management</h2>

            <select
                value={selectedEndpoint ? `${selectedEndpoint.path}|${selectedEndpoint.method}` : ""}
                onChange={(e) => selectEndpoint(e.target.value)}
                className="border p-2 rounded mb-3"
            >
                <option value="">-- Chọn Endpoint --</option>
                {Array.isArray(endpoints) && endpoints.map((ep) => (
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
                        <div className="border rounded p-3 bg-gray-50 text-xs">
                            <h3 className="font-semibold mb-2">🧩 Tên Expectation</h3>
                            <input placeholder="Tên Expectation" value={expectForm.name} onChange={(e) => setExpectForm({ ...expectForm, name: e.target.value })} className="border p-1 rounded" />

                            <h3 className="font-semibold mb-2">🧩 Điều kiện kiểm tra</h3>

                            {Array.isArray(expectForm.conditions) && expectForm.conditions.map((cond, i) => (
                                <div key={i} className="border rounded p-2 mb-2 bg-white grid grid-cols-6 gap-2 items-center">
                                    {/* Dấu ngoặc */}
                                    <div className="flex flex-col items-center">
                                        <label className="text-[10px]">Mở (</label>
                                        <input
                                            type="checkbox"
                                            checked={cond.openParen}
                                            onChange={(e) => updateCondition(i, "openParen", e.target.checked)}
                                        />
                                        <label className="text-[10px]">Đóng )</label>
                                        <input
                                            type="checkbox"
                                            checked={cond.closeParen}
                                            onChange={(e) => updateCondition(i, "closeParen", e.target.checked)}
                                        />
                                    </div>

                                    {/* Vị trí */}
                                    <select
                                        value={cond.location}
                                        onChange={(e) => updateCondition(i, "location", e.target.value)}
                                        className="border p-1 rounded"
                                    >
                                        <option value="">-- Vị trí --</option>
                                        <option value="headers">Headers</option>
                                        <option value="params">Params</option>
                                        <option value="body">Body</option>
                                    </select>

                                    {/* Trường */}
                                    <input
                                        placeholder="Field"
                                        value={cond.field}
                                        onChange={(e) => updateCondition(i, "field", e.target.value)}
                                        className="border p-1 rounded"
                                    />

                                    {/* So sánh */}
                                    <select
                                        value={cond.comparison}
                                        onChange={(e) => updateCondition(i, "comparison", e.target.value)}
                                        className="border p-1 rounded"
                                    >
                                        <option value="">-- So sánh --</option>
                                        <option value="equals">=</option>
                                        <option value="not_equals">≠</option>
                                        <option value="contains">contains</option>
                                        <option value="regex">regex</option>
                                        <option value="exists">exists</option>
                                    </select>

                                    {/* Giá trị mong đợi */}
                                    <input
                                        placeholder="Giá trị"
                                        value={cond.expectedValue}
                                        onChange={(e) => updateCondition(i, "expectedValue", e.target.value)}
                                        className="border p-1 rounded"
                                    />

                                    {/* Nút xóa */}
                                    <button
                                        onClick={() => removeCondition(i)}
                                        className="bg-red-500 text-white text-xs px-2 py-1 rounded"
                                    >
                                        ✖
                                    </button>
                                </div>
                            ))}

                            <div className="flex items-center gap-2 mb-2">
                                <button
                                    onClick={addCondition}
                                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded"
                                >
                                    ➕ Thêm điều kiện
                                </button>

                                <select
                                    value={nextLogic}
                                    onChange={(e) => setNextLogic(e.target.value as "AND" | "OR")}
                                    className="border p-1 rounded text-xs"
                                >
                                    <option value="AND">Liên kết bằng AND</option>
                                    <option value="OR">Liên kết bằng OR</option>
                                </select>

                            </div>
                            {/* Preview điều kiện */}
                            <div className="border-t pt-3">
                                <h3 className="font-medium mb-2 text-sm text-gray-700">🔍 Preview Logic:</h3>
                                <div className="bg-gray-100 p-3 rounded font-mono text-sm text-gray-800">
                                    {renderPreview()}
                                </div>
                            </div>

                            {/* ⚙️ Mã lỗi + Kiểu dữ liệu trả về */}
                            <div className="flex flex-wrap gap-3">
                                {/* ⚠️ Mã lỗi HTTP Status Code */}
                                <div className="mb-3 w-full md:w-1/2">
                                    <h3 className="font-semibold mb-1 text-sm text-gray-700">
                                        ⚠️ HTTP Status Code
                                    </h3>
                                    <input
                                        type="text"
                                        list="statusList"
                                        placeholder="Nhập hoặc chọn mã lỗi..."
                                        value={expectForm.mockResponseStatus || ""}
                                        onChange={(e) =>
                                            setExpectForm({
                                                ...expectForm,
                                                mockResponseStatus: e.target.value,
                                            })
                                        }
                                        className="border p-1 rounded w-full"
                                    />
                                    <datalist id="statusList">
                                        {Array.isArray(httpStatusCodes) && httpStatusCodes.map((s) => (
                                            <option key={s.code} value={s.code}>
                                                {s.code} - {s.text}
                                            </option>
                                        ))}
                                    </datalist>

                                    {expectForm.mockResponseStatus && (
                                        <p
                                            className={`text-sm font-medium mt-1 ${Number(expectForm.mockResponseStatus) >= 200 &&
                                                Number(expectForm.mockResponseStatus) < 300
                                                ? "text-green-600"
                                                : Number(expectForm.mockResponseStatus) >= 300 &&
                                                    Number(expectForm.mockResponseStatus) < 400
                                                    ? "text-blue-600"
                                                    : Number(expectForm.mockResponseStatus) >= 400 &&
                                                        Number(expectForm.mockResponseStatus) < 500
                                                        ? "text-yellow-600"
                                                        : Number(expectForm.mockResponseStatus) >= 500
                                                            ? "text-red-600"
                                                            : "text-gray-600"
                                                }`}
                                        >
                                            {(() => {
                                                const found = httpStatusCodes.find(
                                                    (s) => s.code === Number(expectForm.mockResponseStatus)
                                                );
                                                return found
                                                    ? `${found.code} - ${found.text}`
                                                    : `⚠️ Mã lỗi ${expectForm.mockResponseStatus} không hợp lệ hoặc chưa có mô tả.`;
                                            })()}
                                        </p>
                                    )}
                                </div>

                                {/* 📦 Kiểu dữ liệu trả về */}
                                <div className="mb-3 w-full md:w-1/2">
                                    <h3 className="font-semibold mb-1 text-sm text-gray-700">
                                        📦 Kiểu dữ liệu trả về
                                    </h3>
                                    <select
                                        value={expectForm.contentType || "application/json"}
                                        onChange={(e) =>
                                            setExpectForm({ ...expectForm, contentType: e.target.value })
                                        }
                                        className="border p-1 rounded w-full"
                                    >
                                        <option value="application/json">application/json</option>
                                        <option value="text/plain">text/plain</option>
                                        <option value="application/xml">application/xml</option>
                                        <option value="text/html">text/html</option>
                                        <option value="application/octet-stream">
                                            application/octet-stream
                                        </option>
                                    </select>
                                </div>
                            </div>


                            {/* ⚙️ Dữ liệu mock trả về */}
                            <div className="mb-3">
                                <h3 className="font-semibold mb-1 text-sm text-gray-700">🧾 Mock Response Data</h3>
                                <textarea
                                    placeholder="Nhập nội dung response (JSON hoặc text)"
                                    rows={5}
                                    value={expectForm.mockResponse || ""}
                                    onChange={(e) =>
                                        setExpectForm({ ...expectForm, mockResponse: e.target.value })
                                    }
                                    className="border p-2 rounded w-full font-mono text-xs"
                                />
                            </div>

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
                            {Array.isArray(consoleOutput) && consoleOutput.map((line, i) => (
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
                            {Array.isArray(processors) && processors
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
                            <div className="bg-white rounded-lg p-4 w-[600px] shadow-lg max-h-[90vh] overflow-y-auto">
                                <h3 className="text-lg font-semibold mb-2">
                                    {activeTab === "expectation"
                                        ? `Expectation #${selectedProcessor.id}`
                                        : `Processor #${selectedProcessor.id}`}
                                </h3>

                                {activeTab === "expectation" ? (
                                    <>
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-xl font-semibold">
                                                {modeViewModal === "edit" ? "📝 Chỉnh sửa điều kiện" : "👁️ Xem chi tiết"}
                                            </h2>

                                            <button
                                                onClick={() => setModeViewModal(modeViewModal === "edit" ? "view" : "edit")}
                                                className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                                            >
                                                {modeViewModal === "edit" ? "Xem" : "Chỉnh sửa"}
                                            </button>
                                        </div>
                                        <ExpectationForm
                                            value={
                                                selectedProcessor.code
                                                    ? JSON.parse(selectedProcessor.code)
                                                    : {
                                                        name: "",
                                                        logic: "AND",
                                                        contentType: "application/json",
                                                        mockResponse: "",
                                                        mockResponseStatus: "200",
                                                        conditions: [],
                                                    }
                                            }
                                            onChange={(v) =>
                                                setSelectedProcessor({
                                                    ...selectedProcessor,
                                                    code: JSON.stringify(v, null, 2),
                                                })
                                            }

                                            readOnly={modeViewModal === "view"}

                                        />
                                    </>
                                ) : (
                                    <textarea
                                        value={editCode}
                                        onChange={(e) => setEditCode(e.target.value)}
                                        className="border p-2 rounded w-full h-48 text-xs font-mono mb-3"
                                    />
                                )}

                                <div className="flex justify-between mt-3">
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
