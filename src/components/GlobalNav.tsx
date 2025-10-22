"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, FolderOpen, Settings, ChevronUp, ChevronDown, DatabaseZap } from "lucide-react";
import Link from "next/link";

export default function GlobalNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center">
      {/* Thanh chính (toggle button) */}
      <button
        onClick={() => setOpen(!open)}
        className="bg-blue-600 text-white p-2 rounded-t-xl shadow-lg hover:bg-blue-700 transition flex items-center space-x-2"
      >
        {open ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        <span className="font-medium">{open ? "Thu gọn" : "Mở menu"}</span>
      </button>

      {/* Menu ẩn/hiện trượt */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 120 }}
            className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg w-full max-w-md rounded-t-2xl overflow-hidden"
          >
            <div className="flex justify-around py-4 text-gray-700 dark:text-gray-200">
              <Link href="/" className="flex flex-col items-center hover:text-blue-600 dark:hover:text-blue-400 transition">
                <Home className="h-6 w-6" />
                <span className="text-xs mt-1">Trang chủ</span>
              </Link>
              <Link href="/projects/upload/list" className="flex flex-col items-center hover:text-blue-600 dark:hover:text-blue-400 transition">
                <FolderOpen className="h-6 w-6" />
                <span className="text-xs mt-1">Dự án</span>
              </Link>
              <Link href="/projects/browser" className="flex flex-col items-center hover:text-blue-600 dark:hover:text-blue-400 transition">
                <DatabaseZap className="h-6 w-6" />
                <span className="text-xs mt-1">Mock dữ liệu</span>
              </Link>
              <Link href="/projects/upload" className="flex flex-col items-center hover:text-blue-600 dark:hover:text-blue-400 transition">
                <DatabaseZap className="h-6 w-6" />
                <span className="text-xs mt-1">Tạo dự án</span>
              </Link>
              <Link href="/settings" className="flex flex-col items-center hover:text-blue-600 dark:hover:text-blue-400 transition">
                <Settings className="h-6 w-6" />
                <span className="text-xs mt-1">Cài đặt</span>
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
