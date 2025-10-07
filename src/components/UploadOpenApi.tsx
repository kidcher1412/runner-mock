"use client";

import { useState } from "react";

export default function UploadOpenApi() {
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [useDB, setUseDB] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload thất bại");
      } else {
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

  return (
    <div className="p-6 max-w-md mx-auto bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-4">Tạo Project Mới</h2>

      <input
        type="text"
        placeholder="Project Name"
        value={projectName}
        onChange={e => setProjectName(e.target.value)}
        className="border p-2 mb-3 w-full rounded"
      />

      <input
        type="file"
        accept=".json"
        onChange={e => setFile(e.target.files?.[0] || null)}
        className="mb-3"
      />

      <label className="flex items-center mb-3">
        <input
          type="checkbox"
          checked={useDB}
          onChange={e => setUseDB(e.target.checked)}
          className="mr-2"
        />
        Tạo SQLite DB riêng cho project
      </label>

      <button
        className={`w-full p-2 text-white font-semibold rounded ${
          loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
        }`}
        onClick={handleUpload}
        disabled={loading}
      >
        {loading ? "Uploading..." : "Upload"}
      </button>

      {file && (
        <p className="mt-2 text-gray-600">
          File đã chọn: <span className="font-mono">{file.name}</span>
        </p>
      )}

      {message && <p className="mt-2 text-green-600">{message}</p>}
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </div>
  );
}
