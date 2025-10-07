"use client";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

const ProjectEndpointMapping = dynamic(
  () => import("./components/ProjectEndpointMapping"),
  { ssr: false } // tránh lỗi "window is not defined"
);

export default function ProjectPage() {
  const router = useRouter();
  const { project } = router.query as { project?: string };

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Đang tải thông tin dự án...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <ProjectEndpointMapping projectName={project} />
    </div>
  );
}
