import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Resolve a possibly-relative path like "./mock-data/xxx" to an absolute path under process.cwd()
export function resolveToAbsolute(filePath: string | null | undefined): string {
  if (!filePath) return "";
  try {
    // If already absolute, return as-is
    const isAbsolute = /^(?:[a-zA-Z]:\\|\\\\|\/)/.test(filePath);
    if (isAbsolute) return filePath;
    // Normalize leading ./ if present
    const normalized = filePath.replace(/^\.\//, "");
    // Join with cwd
    const cwd = process.cwd();
    // Avoid importing path here to keep tree light; use require lazily
    const path = require("path") as typeof import("path");
    return path.join(cwd, normalized);
  } catch {
    return String(filePath);
  }
}