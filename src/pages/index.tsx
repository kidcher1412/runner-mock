"use client";

export default function DashboardLinks() {
  const pages = [
    {
      name: "Upload Project",
      url: "/projects/upload",
      description: "Upload file OpenAPI, tạo project mới và SQLite DB nếu cần",
    },
        {
      name: "List Project",
      url: "/projects/upload/list",
      description: "Quản lý các API đã tạo",
    },
    {
      name: "Project List & Endpoints",
      url: "/projects",
      description: "Xem danh sách project và tất cả endpoints với method màu sắc",
    }
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <div className="grid gap-4">
        {pages.map((p, idx) => (
          <a
            key={idx}
            href={p.url}
            className="block border rounded p-4 hover:shadow-lg transition-shadow bg-white"
          >
            <div className="font-bold text-lg mb-1">{p.name}</div>
            <div className="text-gray-600">{p.description}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
