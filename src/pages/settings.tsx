"use client";

import { useTheme } from "@/components/ThemeProvider";
import { useState } from "react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [saved, setSaved] = useState<string | null>(null);

  const handleSave = () => {
    setSaved("Đã lưu cài đặt");
    setTimeout(() => setSaved(null), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Cài đặt hệ thống</h1>

        <div className="space-y-6">
          <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h2 className="font-medium mb-3">Giao diện</h2>
            <div className="flex items-center gap-3">
              <label className="text-sm">Chế độ nền</label>
              <select
                className="border dark:border-gray-700 bg-white dark:bg-gray-900 rounded px-2 py-1 text-sm"
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
              >
                <option value="light">Sáng</option>
                <option value="dark">Tối</option>
                <option value="system">Theo hệ thống</option>
              </select>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h2 className="font-medium mb-3">Hệ thống</h2>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Các tuỳ chỉnh khác (ngôn ngữ, kiểm tra cập nhật, quyền riêng tư, v.v.) có thể thêm tại đây.
            </div>
          </section>

          <div>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Lưu cài đặt
            </button>
            {saved && <span className="ml-3 text-sm text-green-600">{saved}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}



