"use client";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UploadOpenApi() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [useDB, setUseDB] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const [host, setHost] = useState("");
  const router = useRouter();
  useEffect(() => {
    setHost(window.location.host);
  }, []);

  const handleFile = async (f: File) => {
    if (f.type !== "application/json" && !f.name.endsWith(".json")) {
      setIsError(true);
      setErrorMsg("Only JSON files are allowed");
      setFile(null);
      return;
    }

    try {
      const text = await f.text();
      const json = JSON.parse(text);

      // Kiểm tra OpenAPI version
      const version = json.openapi;
      if (!version) {
        setIsError(true);
        setErrorMsg("Missing 'openapi' version field");
        setFile(null);
        return;
      }

      // chỉ cho >=3.0.1
      const [major, minor] = version.split(".").map(Number);
      if (major < 3 || (major === 3 && minor < 0)) {
        setIsError(true);
        setErrorMsg("OpenAPI version must be >= 3.0.1");
        setFile(null);
        return;
      }

      // Kiểm tra ít nhất 1 endpoint
      if (!json.paths || Object.keys(json.paths).length === 0) {
        setIsError(true);
        setErrorMsg("OpenAPI JSON must have at least one endpoint in 'paths'");
        setFile(null);
        return;
      }

      // ✅ tất cả ok
      setFile(f);
      setIsError(false);
      setErrorMsg("");
    } catch (err) {
      setIsError(true);
      setErrorMsg("Invalid JSON file");
      setFile(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !projectName) {
      setError("Vui lòng chọn file và nhập tên project");
      setMessage(null);
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectName", projectName);
      formData.append("useDB", String(useDB));

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) setError(data.error || "Upload thất bại");
      else {
        setMessage(`Upload thành công: ${data.project.name}`);
        setFile(null);
        setProjectName("");
        setUseDB(false);
      }
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };
  const openProjects = (name: string) => {
    router.push(`/projects/upload/list`);
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-4">Tạo Project Mới</h2>
      <input type="text" placeholder="Project Name" value={projectName} onChange={e => setProjectName(e.target.value)} className="border p-2 mb-3 w-full rounded" />
      <p className="text-gray-500 text-sm">
        Base mock: <code>{host ? `${host}/api/${projectName || "<projectName>"}` : "..."}</code>
      </p>
      {/* <input type="file" accept=".json" onChange={e => setFile(e.target.files?.[0] || null)} className="mb-3" /> */}

      <div
        className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg w-full max-w-md mx-auto transition-colors
        ${isDragging ? (isError ? "bg-red-100 border-red-400" : "bg-blue-100 border-blue-400") : (isError ? "bg-red-100 border-red-400" : "bg-white border-gray-300")}
      `}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
          setIsError(false);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
          }
        }}
      >
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center justify-center w-full h-32 text-gray-500 hover:text-gray-700"
        >
          <FileText className="h-12 w-12 mb-2" />
          <span>
            {file
              ? file.name
              : isError
                ? errorMsg
                : "Click or drag OpenAPI JSON file to upload"}
          </span>
          <input
            id="file-upload"
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleChange}
          />
        </label>
        {file && (
          <div className="mt-2 text-sm text-gray-600">
            File size: {(file.size / 1024).toFixed(2)} KB
          </div>
        )}
      </div>

      <label className="flex items-center mb-3">
        <input type="checkbox" checked={useDB} onChange={e => setUseDB(e.target.checked)} className="mr-2" />
        Tạo SQLite DB riêng cho project
      </label>
      <button className={`w-full p-2 text-white font-semibold rounded ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"}`} onClick={handleUpload} disabled={loading}>
        {loading ? "Uploading..." : "Upload"}
      </button>
      {/* {file && <p className="mt-2 text-gray-600">File đã chọn: <span className="font-mono">{file.name}</span></p>} */}
      {message && <p className="mt-2 text-green-600">{message}</p>}
      {error && <p className="mt-2 text-red-600">{error}</p>}
      {/* 🟢 Nút chuyển hướng sang danh sách dự án */}
      <div className="mt-4 text-center">
        <button
          onClick={() => router.push("/projects/upload/list")}
          className="text-blue-600 hover:underline font-medium"
        >
          → Chuyển hướng sang danh sách dự án đã upload
        </button>
      </div>
    </div>
  );
}
