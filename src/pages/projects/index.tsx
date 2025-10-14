"use client";

import { formatResponseSchemaWithExamples, schemaToExample } from "@/helper/formatJsonSchemaExample";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Project = {
    name: string;
    file: string;
};

type Endpoint = {
    path: string;
    methods: string[];
    requestBody?: any[];
    responses?: Record<string, any>[]; // statusCode -> schema
};

export default function ProjectManager() {
    type KeyValue = { key: string; value: string };
    type TabType = "headers" | "params" | "body" | null;

    // Map mỗi endpoint idx → tab đang chọn
    const [activeTab, setActiveTab] = useState<Record<number, TabType>>({});

    // Map mỗi endpoint idx → list headers
    const [headers, setHeaders] = useState<Record<number, KeyValue[]>>({});

    // Map mỗi endpoint idx → list params
    const [params, setParams] = useState<Record<number, KeyValue[]>>({});

    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [selectedContentTypes, setSelectedContentTypes] = useState<Record<number, string>>({});

    // Collapse state
    const [showReqMap, setShowReqMap] = useState<Record<string, boolean>>({});
    const [showResMap, setShowResMap] = useState<Record<string, boolean>>({}); // key = idx-method-status

    // Inputs: body/query/header per endpoint
    const [inputs, setInputs] = useState<Record<string, string>>({});
    const [rootSpec, setRootSpec] = useState<any>(null);

    const searchParams = useSearchParams(); // phải có ngoặc ()

    // --- Lấy danh sách project ---
    useEffect(() => {
        fetch("/api/projects")
            .then(res => res.json())
            .then((data: Project[]) => setProjects(data))
            .catch(err => console.error(err));

    }, []);

    // --- Khi có projects + name trên URL ---
    useEffect(() => {
        const name = searchParams.get("name");
        if (!name || projects.length === 0) return;

        // 🔹 Tìm project trong danh sách
        const found = projects.find(p => p.name === name);
        if (found) setSelectedProject(found);

        // 🔹 Lấy dữ liệu OpenAPI tương ứng
        fetch(`/api/project-file?name=${encodeURIComponent(name)}`)
            .then(res => res.json())
            .then((api: any) => {
                const eps: Endpoint[] = [];
                setRootSpec(api);

                Object.entries(api.paths || {}).forEach(([path, pathItem]: [string, any]) => {
                    Object.entries(pathItem || {}).forEach(([method, operation]: [string, any]) => {
                        eps.push({
                            path,
                            methods: [method.toUpperCase()],
                            requestBody: operation.requestBody
                                ? Object.entries(operation.requestBody.content || {}).map(([ctype, obj]: [string, any]) => ({
                                    contentType: ctype,
                                    ...obj,
                                }))
                                : [],
                            responses: [operation.responses || {}],
                        });
                    });
                });

                setEndpoints(eps);
            })
            .catch(err => console.error(err));
    }, [searchParams, projects]);
    // Khởi tạo input mặc định sau khi endpoints & rootSpec có dữ liệu
    useEffect(() => {
        if (!rootSpec || endpoints.length === 0) return;

        const newInputs: Record<string, string> = {};

        endpoints.forEach((ep) => {
            const epKey = `${ep.methods}-${ep.path}`;
            const req = ep?.requestBody?.find(
                (r) => r.contentType === "application/json"
            );
            const reqSchema = req?.schema || {};
            try {
                newInputs[`${epKey}-body`] = JSON.stringify(
                    schemaToExample(reqSchema, rootSpec),
                    null,
                    2
                );
            } catch {
                newInputs[`${epKey}-body`] = "{}";
            }
        });

        setInputs(newInputs);
    }, [endpoints, rootSpec]);

    useEffect(() => {
        if (!selectedProject) return;

        fetch(`/api/project-file?name=${encodeURIComponent(selectedProject.name)}`)
            .then(res => res.json())
            .then((api: any) => {
                const eps: Endpoint[] = [];
                setRootSpec(api); // 🧩 Lưu spec gốc để xử lý $ref

                Object.entries(api.paths || {}).forEach(([path, pathItem]: [string, any]) => {
                    Object.entries(pathItem || {}).forEach(([method, operation]: [string, any]) => {
                        eps.push({
                            path,
                            methods: [method.toUpperCase()],
                            // giữ nguyên toàn bộ content để UI hiển thị đúng schema + example
                            requestBody: operation.requestBody
                                ? Object.entries(operation.requestBody.content || {}).map(([ctype, obj]: [string, any]) => ({
                                    contentType: ctype,
                                    ...obj,   // có schema, example, examples
                                }))
                                : [],
                            // responses vẫn gom nguyên để UI show (200,400,...)
                            responses: [operation.responses || {}],
                        });
                    });
                });
                setEndpoints(eps);
            })
            .catch(err => console.error(err));
        endpoints.map((ep, idx) => {
            // Tạo key duy nhất
            const epKey = `${ep.methods}-${ep.path}`;
            const req = ep?.requestBody?.find(
                (r) => r.contentType === "application/json"
            );
            const reqSchema = req?.schema || {};
            inputs[`${epKey}-body`] = JSON.stringify(schemaToExample(reqSchema, rootSpec), null, 2);
        })
    }, [selectedProject]);



    const methodColors: Record<string, string> = {
        get: "bg-green-500",
        post: "bg-yellow-500",
        put: "bg-orange-500",
        delete: "bg-red-500",
        patch: "bg-purple-500",
    };

    const handleInputChange = (key: string, value: string) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    const resolveRef = (schema: any): any => {
        if (!schema || typeof schema !== "object") return schema;
        if (schema.$ref && rootSpec) {
            const refPath = schema.$ref.replace(/^#\//, "").split("/");
            return refPath.reduce((obj: any, key: string) => obj?.[key], rootSpec);
        }
        return schema;
    };

    const inferTypeLabel = (schema: any): string => {
        if (!schema || typeof schema !== "object") return typeof schema;
        if (schema.type) return schema.type;
        if (schema.enum) return "enum";
        if (schema.properties) return "object";
        if (schema.items) return "array";
        return "any";
    };

    const schemaToTypeShape = (schema: any): any => {
        const s = resolveRef(schema) || {};
        if (s.type === "object" && s.properties) {
            const obj: Record<string, any> = {};
            Object.entries(s.properties).forEach(([k, v]: [string, any]) => {
                obj[k] = schemaToTypeShape(v);
            });
            return obj;
        }
        if (s.type === "array") {
            return [schemaToTypeShape(s.items)];
        }
        if (s.enum) return `enum<${(s.type || "string")}>`;
        if (s.format) return `${s.type || "any"}<${s.format}>`;
        return s.type || inferTypeLabel(s);
    };

    const getBodyExampleByContentType = (ep: Endpoint, contentType: string) => {
        const rb = ep?.requestBody?.find((r: any) => r.contentType === contentType);
        const schema = rb?.schema || {};
        try {
            return JSON.stringify(schemaToExample(schema, rootSpec), null, 2);
        } catch {
            return "{}";
        }
    };

    // const testEndpointWithValidation = async (ep: Endpoint, epKey: string, opts?: {
    //   headers: KeyValue[];
    //   params: KeyValue[];
    //   body?: any;
    //   method: string;
    // }) => {
    //   try {
    //     const url = `/api/${selectedProject?.name}${ep.path}`;
    //     const res = await fetch(url, {
    //       method: opts.method,
    //       headers: Object.fromEntries(opts.headers.map(h => [h.key, h.value])),
    //       body: opts.method !== "GET" ? opts.body : undefined,
    //     });

    //     const data = await res.json();
    //     setResponses(prev => ({ ...prev, [epKey]: { status: res.status, data } }));
    //   } catch (err: any) {
    //     setResponses(prev => ({ ...prev, [epKey]: { status: 500, data: { error: err.message } } }));
    //   }
    // };


    const testEndpointWithValidation = async (
        ep: Endpoint,
        epKey: string,
        opts?: {
            headers?: KeyValue[];
            params?: KeyValue[];
            body?: string;
            contentType?: string;
        }
    ) => {
        // Xây URL (thêm query param nếu có)
        const url = new URL(`/api/${selectedProject?.name}${ep.path}`, window.location.origin);
        opts?.params?.forEach(p => {
            if (p.key) url.searchParams.append(p.key, p.value);
        });

        // Chuẩn bị headers
        const fetchHeaders: Record<string, string> = {};
        opts?.headers?.forEach(h => {
            if (h.key) fetchHeaders[h.key] = h.value;
        });

        // Chuẩn bị body theo content-type
        let bodyToSend: any = undefined;
        const ct = opts?.contentType || "application/json";
        if (opts?.body && ep.methods[0] !== "GET") {
            if (ct === "application/json") {
                try {
                    const parsed = JSON.parse(opts.body);
                    bodyToSend = JSON.stringify(parsed);
                } catch {
                    bodyToSend = opts.body;
                }
                fetchHeaders["Content-Type"] = "application/json";
            } else if (ct === "application/x-www-form-urlencoded") {
                try {
                    const obj = JSON.parse(opts.body);
                    const sp = new URLSearchParams();
                    Object.entries(obj as any).forEach(([k, v]) => sp.append(k, String(v)));
                    bodyToSend = sp;
                    fetchHeaders["Content-Type"] = "application/x-www-form-urlencoded";
                } catch {
                    bodyToSend = opts.body;
                    fetchHeaders["Content-Type"] = "application/x-www-form-urlencoded";
                }
            } else if (ct === "multipart/form-data") {
                try {
                    const obj = JSON.parse(opts.body);
                    const fd = new FormData();
                    Object.entries(obj as any).forEach(([k, v]) => fd.append(k, String(v)));
                    bodyToSend = fd;
                    // Let browser set boundary; do not set Content-Type manually
                } catch {
                    const fd = new FormData();
                    fd.append("payload", opts.body);
                    bodyToSend = fd;
                }
            } else {
                bodyToSend = opts.body;
                fetchHeaders["Content-Type"] = ct;
            }
        }

        try {
            const res = await fetch(url.toString(), {
                method: ep.methods[0] || "GET",
                headers: fetchHeaders,
                body: ep.methods[0] !== "GET" ? bodyToSend : undefined,
            });

            // const text = await res.text();
            // let json: any;
            // try {
            //     json = JSON.parse(text);
            // } catch {
            //     json = text;
            // }
            const data = await res.json();
            setResponses(prev => ({ ...prev, [epKey]: { status: res.status, data } }));
        } catch (err: any) {
            setResponses(prev => ({ ...prev, [epKey]: { status: 500, data: { error: err.message } } }));
        }
    };


    return (
        <div className="flex h-screen bg-background text-foreground">
            {/* Sidebar */}
            <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 overflow-y-auto">
                <h2 className="font-bold mb-2 text-gray-800 dark:text-gray-100">Projects</h2>
                <ul>
                    {projects.map(p => (
                        <li
                            key={p.name}
                            className={`p-2 cursor-pointer rounded ${selectedProject?.name === p.name ? "bg-blue-200 dark:bg-blue-900/40 text-gray-900 dark:text-gray-100" : "hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                                }`}
                            onClick={() => setSelectedProject(p)}
                        >
                            {p.name}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Main content */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-950">
                {selectedProject ? (
                    <>
                        <h2 className="font-bold text-xl mb-4 text-gray-900 dark:text-gray-100">{selectedProject.name} Endpoints</h2>
                        <div className="space-y-4">
                            {endpoints.map((ep, idx) => {
                                // Tạo key duy nhất
                                const epKey = `${ep.methods}-${ep.path}`;
                                return (

                                    <div key={idx} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-900 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="font-mono text-sm text-gray-600 dark:text-gray-300">
                                                Base URL:
                                                <span className="text-blue-600">{` /api/${selectedProject?.name}${ep.path}`}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                {ep.methods.map((m, i) => (
                                                    <span key={i} className={`px-2 py-0.5 text-xs text-white rounded ${methodColors[m.toLowerCase()]}`}>
                                                        {m.toUpperCase()}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mb-3 font-semibold text-gray-800 dark:text-gray-100">{ep.path}</div>

                                        <div className="flex flex-wrap gap-2 mb-2">
                                            <button
                                                className="px-3 py-1 bg-blue-600 text-white rounded hover:opacity-90"
                                                onClick={() => testEndpointWithValidation(ep, epKey, {
                                                    headers: headers[idx] || [],
                                                    params: params[idx] || [],
                                                    body: inputs[`${epKey}-body`],
                                                    contentType: selectedContentTypes[idx] || ep.requestBody?.[0]?.contentType || "application/json",
                                                })}
                                            >
                                                Send Request
                                            </button>
                                        </div>

                                        {/* Request Body input */}
                                        {ep.requestBody?.[0] && (
                                            <div className="mb-2">
                                                {/* Request Schema hiển thị */}
                                                {ep.requestBody.map((rb, j) => (
                                                    <div key={j} className="mb-2">
                                                        <button
                                                            className="text-sm text-blue-400 dark:text-blue-300 underline mb-1"
                                                            onClick={() =>
                                                                setShowReqMap(prev => ({ ...prev, [`${idx}-schema-${j}`]: !prev[`${idx}-schema-${j}`] }))
                                                            }
                                                        >
                                                            {showReqMap[`${idx}-schema-${j}`]
                                                                ? `Hide Request Schema (${rb.contentType})`
                                                                : `Show Request Schema (${rb.contentType})`}
                                                        </button>

                                                        {showReqMap[`${idx}-schema-${j}`] && (
                                                            <div className="grid md:grid-cols-2 gap-2">
                                                                <div>
                                                                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Example</div>
                                                                    <pre className="bg-gray-50 dark:bg-gray-950 p-2 rounded overflow-auto text-sm text-gray-800 dark:text-gray-100">
                                                                        {JSON.stringify(schemaToExample(rb.schema, rootSpec), null, 2)}
                                                                    </pre>
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Type</div>
                                                                    <pre className="bg-gray-50 dark:bg-gray-950 p-2 rounded overflow-auto text-sm text-gray-800 dark:text-gray-100">
                                                                        {JSON.stringify(schemaToTypeShape(rb.schema), null, 2)}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    className="text-sm text-blue-400 dark:text-blue-300 underline mb-1"
                                                    onClick={() => setShowReqMap(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                                >
                                                    {showReqMap[idx] ? "Hide Request Tester" : "Show Request Tester"}
                                                </button>

                                                {showReqMap[idx] && (
                                                    <>
                                                        {/* Tabs */}
                                                        <div className="flex space-x-2 mb-2">
                                                            {(["headers", "params", "body"] as TabType[]).map(tab => (
                                                                <button
                                                                    key={tab}
                                                                    className={`px-3 py-1 rounded ${activeTab[idx] === tab ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                                                                        }`}
                                                                    onClick={() =>
                                                                        setActiveTab(prev => ({
                                                                            ...prev,
                                                                            [idx]: prev[idx] === tab ? null : tab, // tab bây giờ đúng kiểu TabType
                                                                        }))
                                                                    }
                                                                >
                                                                    {tab!.toUpperCase()}
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Headers */}
                                                        {activeTab[idx] === "headers" && (
                                                            <div className="mb-2">
                                                                {(headers[idx] || [{ key: "", value: "" }]).map((h, i) => (
                                                                    <div key={i} className="flex space-x-2 mb-1">
                                                                        <input
                                                                            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 p-1 flex-1"
                                                                            placeholder="Key"
                                                                            value={h.key}
                                                                            onChange={e => {
                                                                                const newHeaders = [...(headers[idx] || [])];
                                                                                if (!newHeaders[i]) newHeaders[i] = { key: "", value: "" }; // đảm bảo tồn tại
                                                                                newHeaders[i].key = e.target.value;
                                                                                setHeaders(prev => ({ ...prev, [idx]: newHeaders }));
                                                                            }}
                                                                        />
                                                                        <input
                                                                            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 p-1 flex-1"
                                                                            placeholder="Value"
                                                                            value={h.value}
                                                                            onChange={e => {
                                                                                const newHeaders = [...(headers[idx] || [])];
                                                                                if (!newHeaders[i]) newHeaders[i] = { key: "", value: "" }; // đảm bảo tồn tại
                                                                                newHeaders[i].value = e.target.value;
                                                                                setHeaders(prev => ({ ...prev, [idx]: newHeaders }));
                                                                            }}
                                                                        />
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    className="text-sm text-blue-400 dark:text-blue-300 underline"
                                                                    onClick={() =>
                                                                        setHeaders(prev => ({
                                                                            ...prev,
                                                                            [idx]: [...(headers[idx] || []), { key: "", value: "" }],
                                                                        }))
                                                                    }
                                                                >
                                                                    + Add Header
                                                                </button>
                                                            </div>
                                                        )}


                                                        {/* Params */}
                                                        {activeTab[idx] === "params" && (
                                                            <div className="mb-2">
                                                                {(params[idx] || [{ key: "", value: "" }]).map((p, i) => (
                                                                    <div key={i} className="flex space-x-2 mb-1">
                                                                        {/* Key */}
                                                                        <input
                                                                            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 p-1 flex-1"
                                                                            placeholder="Key"
                                                                            value={p.key}
                                                                            onChange={e => {
                                                                                const newParams = [...(params[idx] || [])];
                                                                                if (!newParams[i]) newParams[i] = { key: "", value: "" }; // đảm bảo tồn tại
                                                                                newParams[i].key = e.target.value;
                                                                                setParams(prev => ({ ...prev, [idx]: newParams }));
                                                                            }}
                                                                        />

                                                                        {/* Value */}
                                                                        <input
                                                                            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 p-1 flex-1"
                                                                            placeholder="Value"
                                                                            value={p.value}
                                                                            onChange={e => {
                                                                                const newParams = [...(params[idx] || [])];
                                                                                if (!newParams[i]) newParams[i] = { key: "", value: "" }; // đảm bảo tồn tại
                                                                                newParams[i].value = e.target.value;
                                                                                setParams(prev => ({ ...prev, [idx]: newParams }));
                                                                            }}
                                                                        />
                                                                    </div>
                                                                ))}

                                                                <button
                                                                    className="text-sm text-blue-400 dark:text-blue-300 underline"
                                                                    onClick={() =>
                                                                        setParams(prev => ({
                                                                            ...prev,
                                                                            [idx]: [...(params[idx] || []), { key: "", value: "" }],
                                                                        }))
                                                                    }
                                                                >
                                                                    + Add Param
                                                                </button>
                                                            </div>
                                                        )}


                                                        {/* Body */}
                                                        {activeTab[idx] === "body" && (
                                                            <div className="mb-2">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <label className="text-sm text-gray-600">Content-Type</label>
                                                                    <select
                                                                        className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm"
                                                                        value={selectedContentTypes[idx] || ep.requestBody?.[0]?.contentType || "application/json"}
                                                                        onChange={(e) => {
                                                                            const v = e.target.value;
                                                                            setSelectedContentTypes(prev => ({ ...prev, [idx]: v }));
                                                                            handleInputChange(`${epKey}-body`, getBodyExampleByContentType(ep, v));
                                                                        }}
                                                                    >
                                                                        {(ep.requestBody || []).map((rb: any) => (
                                                                            <option key={rb.contentType} value={rb.contentType}>{rb.contentType}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <textarea
                                                                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 rounded p-1 font-mono text-sm"
                                                                    rows={6}
                                                                    value={
                                                                        inputs[`${epKey}-body`]
                                                                    }
                                                                    onChange={(e) =>
                                                                        handleInputChange(`${epKey}-body`, e.target.value)
                                                                    }
                                                                />
                                                            </div>
                                                        )}


                                                        {/* Run button */}
                                                        <button
                                                            className="mt-1 px-3 py-1 bg-blue-500 text-white rounded hover:opacity-80"
                                                            onClick={() =>
                                                                testEndpointWithValidation(ep, epKey, {
                                                                    headers: headers[idx] || [],
                                                                    params: params[idx] || [],
                                                                    body: inputs[`${epKey}-body`],
                                                                    contentType: selectedContentTypes[idx] || ep.requestBody?.[0]?.contentType || "application/json",
                                                                })
                                                            }
                                                        >
                                                            Run
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Response Preview chỉ riêng cho epKey này */}
                                        {responses[epKey] && (
                                            <div className="mt-4">
                                                <h3
                                                    className={`font-bold ${responses[epKey].status >= 200 && responses[epKey].status < 300
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                        }`}
                                                >
                                                    Response: {responses[epKey].status}
                                                </h3>
                                                <pre className="bg-gray-100 dark:bg-gray-950 p-2 rounded overflow-auto text-sm text-gray-800 dark:text-gray-100">
                                                    {JSON.stringify(responses[epKey].data, null, 2)}
                                                </pre>
                                            </div>
                                        )}

                                        {/* Response Schema */}
                                        {(ep.responses || []).map((respObj, methodIdx) =>
                                            ep.methods.map((m, i) =>
                                                Object.entries(respObj || {}).map(([status, schema]) =>
                                                    schema ? (
                                                        <div key={`${methodIdx}-${i}-${status}`} className="mb-1">
                                                            <button
                                                                className="text-sm text-blue-400 dark:text-blue-300 underline mb-1"
                                                                onClick={() =>
                                                                    setShowResMap(prev => ({
                                                                        ...prev,
                                                                        [`${methodIdx}-${i}-${status}`]: !prev[`${methodIdx}-${i}-${status}`],
                                                                    }))
                                                                }
                                                            >
                                                                {showResMap[`${methodIdx}-${i}-${status}`]
                                                                    ? `Hide Response Schema (${status})`
                                                                    : `Show Response Schema (${status})`}
                                                            </button>
                                                            {showResMap[`${methodIdx}-${i}-${status}`] && (
                                                                <pre className="bg-gray-50 dark:bg-gray-950 p-2 rounded overflow-auto text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-100">
                                                                    {formatResponseSchemaWithExamples(schema, rootSpec)}
                                                                </pre>
                                                            )}
                                                        </div>
                                                    ) : null
                                                )
                                            )
                                        )}

                                    </div>
                                )
                            }
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-gray-600 dark:text-gray-300">Chọn project để xem endpoint</div>
                )}
            </div>
        </div>
    );
}
