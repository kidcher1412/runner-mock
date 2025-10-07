"use client";

import { formatResponseSchemaWithExamples, schemaToExample } from "@/helper/formatJsonSchemaExample";
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

    // Collapse state
    const [showReqMap, setShowReqMap] = useState<Record<string, boolean>>({});
    const [showResMap, setShowResMap] = useState<Record<string, boolean>>({}); // key = idx-method-status

    // Inputs: body/query/header per endpoint
    const [inputs, setInputs] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch("/api/projects")
            .then(res => res.json())
            .then(data => setProjects(data))
            .catch(err => console.error(err));
    }, []);

    // useEffect(() => {
    //     if (!selectedProject) return;

    //     fetch(`/api/project-file?name=${encodeURIComponent(selectedProject.name)}`)
    //         .then(res => res.json())
    //         .then((api: any) => {
    //             const eps: Endpoint[] = Object.entries(api.paths || {}).map(([path, pathItem]) => ({
    //                 path,
    //                 methods: Object.keys(pathItem || {}),
    //                 requestBody: Object.values(pathItem || {}).map(
    //                     (m: any) => m.requestBody?.content?.["application/json"]?.schema
    //                 ),
    //                 responses: Object.values(pathItem || {}).map((m: any) => m.responses || {}),
    //             }));
    //             setEndpoints(eps);
    //         })
    //         .catch(err => console.error(err));
    // }, [selectedProject]);

    useEffect(() => {
        if (!selectedProject) return;

        fetch(`/api/project-file?name=${encodeURIComponent(selectedProject.name)}`)
            .then(res => res.json())
            .then((api: any) => {
                const eps: Endpoint[] = [];

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

        // Chuẩn bị body
        let bodyData: any = undefined;
        if (opts?.body) {
            try {
                bodyData = JSON.parse(opts.body);
                fetchHeaders["Content-Type"] = "application/json";
            } catch {
                bodyData = opts.body; // nếu không phải JSON thì gửi raw
            }
        }

        try {
            const res = await fetch(url.toString(), {
                method: ep.methods[0] || "GET",
                headers: fetchHeaders,
                body: ep.methods[0] !== "GET" ? JSON.stringify(bodyData) : undefined,
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
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-64 bg-gray-100 border-r p-4 overflow-y-auto">
                <h2 className="font-bold mb-2">Projects</h2>
                <ul>
                    {projects.map(p => (
                        <li
                            key={p.name}
                            className={`p-2 cursor-pointer rounded ${selectedProject?.name === p.name ? "bg-blue-200" : "hover:bg-gray-200"
                                }`}
                            onClick={() => setSelectedProject(p)}
                        >
                            {p.name}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Main content */}
            <div className="flex-1 p-4 overflow-y-auto">
                {selectedProject ? (
                    <>
                        <h2 className="font-bold text-xl mb-4">{selectedProject.name} Endpoints</h2>
                        <div className="space-y-4">
                            {endpoints.map((ep, idx) => {
                                // Tạo key duy nhất
                                const epKey = `${ep.methods}-${ep.path}`;
                                return (

                                    <div key={idx} className="border rounded p-4 bg-white shadow-sm">
                                        <div className="mb-2 font-mono text-sm text-gray-600">
                                            Base URL:
                                            <span className="text-blue-600">{` /api/${selectedProject?.name}${ep.path}`}</span>
                                        </div>
                                        <div className="mb-2 font-bold">{ep.path}</div>

                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {ep.methods.map((m, i) => (
                                                <button
                                                    key={i}
                                                    className={`px-2 py-1 text-white rounded hover:opacity-80 ${methodColors[m.toLowerCase()]}`}
                                                    onClick={() => testEndpointWithValidation(ep, epKey)}
                                                >
                                                    {m.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Request Body input */}
                                        {ep.requestBody?.[0] && (
                                            <div className="mb-2">
                                                {/* Request Schema hiển thị */}
                                                {ep.requestBody.map((rb, j) => (
                                                    <div key={j} className="mb-2">
                                                        <button
                                                            className="text-sm text-blue-600 underline mb-1"
                                                            onClick={() =>
                                                                setShowReqMap(prev => ({ ...prev, [`${idx}-schema-${j}`]: !prev[`${idx}-schema-${j}`] }))
                                                            }
                                                        >
                                                            {showReqMap[`${idx}-schema-${j}`]
                                                                ? `Hide Request Schema (${rb.contentType})`
                                                                : `Show Request Schema (${rb.contentType})`}
                                                        </button>

                                                        {showReqMap[`${idx}-schema-${j}`] && (
                                                            <pre className="bg-gray-50 p-2 rounded overflow-auto text-sm">
                                                                {JSON.stringify(schemaToExample(rb.schema), null, 2)}
                                                            </pre>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    className="text-sm text-blue-600 underline mb-1"
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
                                                                    className={`px-3 py-1 rounded ${activeTab[idx] === tab ? "bg-blue-600 text-white" : "bg-gray-200"
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
                                                                            className="border p-1 flex-1"
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
                                                                            className="border p-1 flex-1"
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
                                                                    className="text-sm text-blue-600 underline"
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
                                                                            className="border p-1 flex-1"
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
                                                                            className="border p-1 flex-1"
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
                                                                    className="text-sm text-blue-600 underline"
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
                                                                <textarea
                                                                    className="w-full border rounded p-1 font-mono text-sm"
                                                                    rows={6}
                                                                    value={inputs[`${epKey}-body`] || ""}
                                                                    onChange={e => handleInputChange(`${epKey}-body`, e.target.value)}
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
              className={`font-bold ${
                responses[epKey].status >= 200 && responses[epKey].status < 300
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              Response: {responses[epKey].status}
            </h3>
            <pre className="bg-gray-200 p-2 rounded overflow-auto text-sm">
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
                                                                className="text-sm text-blue-600 underline mb-1"
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
                                                                <pre className="bg-gray-50 p-2 rounded overflow-auto text-sm whitespace-pre-wrap">
                                                                {formatResponseSchemaWithExamples(schema)}
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
                    <div className="text-gray-500">Chọn project để xem endpoint</div>
                )}
            </div>
        </div>
    );
}
