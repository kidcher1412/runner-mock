"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { Folder, Database } from "lucide-react"; // icon đẹp, dùng chung shadcn/lucide
import clsx from "clsx";

const ProjectEndpointMapping = dynamic(
    () => import("./components/ProjectEndpointMapping"),
    { ssr: false }
);
type Project = {
    id: number;
    name: string;
    file: string;
    useDB?: boolean;
    dbFile?: string;
};

export default function ProjectPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    useEffect(() => {
        // Fetch danh sách project từ API
        (async () => {
            const res = await fetch("/api/projects");
            const data = await res.json();
            if (Array.isArray(data)) {
                setProjects(data);
                setSelectedProject(data[0].name)
            }

        })();
    }, []);

    return (
        <div className="h-screen flex bg-gray-100">
            {/* --- Sidebar --- */}
            <aside className="w-64 bg-white border-r shadow-sm flex flex-col">
                <div className="p-4 border-b flex items-center gap-2 font-semibold text-lg text-gray-700">
                    <Database className="w-5 h-5 text-blue-600" />
                    Dự án có sẵn
                </div>
                <div className="flex-1 overflow-y-auto">
                    {projects.length === 0 ? (
                        <p className="p-4 text-gray-500 italic text-sm">
                            Chưa có project nào
                        </p>
                    ) : (
                        <ul>
                            {projects.map((p) => (
                                <li
                                    key={p.id || p.name}
                                    onClick={() => setSelectedProject(p)}
                                    className={clsx(
                                        "px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-blue-50 transition-colors",
                                        selectedProject === p
                                            ? "bg-blue-100 text-blue-700 font-semibold"
                                            : "text-gray-700"
                                    )}
                                >
                                    <Folder className="w-4 h-4" />
                                    {p.name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </aside>

            {/* --- Main Content --- */}
            <main className="flex-1 overflow-auto">
                {selectedProject?.name ? (
                    <>
                        <ProjectEndpointMapping projectName={selectedProject.name} />
                    </>

                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <Database className="w-10 h-10 mb-3 opacity-40" />
                        <p className="text-lg font-medium">
                            Vui lòng chọn một dự án ở menu bên trái 👈
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
