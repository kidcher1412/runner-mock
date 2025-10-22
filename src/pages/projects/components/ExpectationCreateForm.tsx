"use client";
import { httpStatusCodes } from "@/statics/data/httpStatusCodes";
import React from "react";

// --- Kiểu dữ liệu ---
export type ConditionLocation = "headers" | "params" | "body" | "";
export type ComparisonOp =
  | "equals"
  | "notequals"
  | "contains"
  | "notcontains"
  | "greaterthan"
  | "greaterthanorequalto"
  | "lessthan"
  | "lessthanorequalto"
  | "exists"
  | "notexists"
  | "";

export interface Condition {
  location: ConditionLocation;
  field: string;
  comparison: ComparisonOp;
  expectedValue: string;
  enabled: boolean;
  openParen: boolean;
  closeParen: boolean;
  logicBefore: string;
}

export interface ExpectationFormDto {
  name: string;
  logic: string;
  contentType: string;
  mockResponse: string;
  mockResponseStatus: string;
  conditions: Condition[];
}



interface Props {
  expectForm: ExpectationFormDto;
  setExpectForm: (v: ExpectationFormDto) => void;
  renderPreview: () => string;
  addCondition: () => void;
  updateCondition: (index: number, key: keyof Condition, value: any) => void;
  removeCondition: (index: number) => void;
  nextLogic: "AND" | "OR";
  setNextLogic: (v: "AND" | "OR") => void;
}

// --- Component chính ---
export default function ExpectationCreateForm({
  expectForm,
  setExpectForm,
  renderPreview,
  addCondition,
  updateCondition,
  removeCondition,
  nextLogic,
  setNextLogic,
}: Props) {
  if (!expectForm) {
    return <div className="text-gray-500 dark:text-gray-400 italic">Đang tải dữ liệu Expectation...</div>;
  }
  return (
  <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100">
    <h3 className="font-semibold mb-2 text-base">🧩 Tên Expectation</h3>
    <input
      placeholder="Tên Expectation"
      value={expectForm.name}
      onChange={(e) => setExpectForm({ ...expectForm, name: e.target.value })}
      className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded w-full text-sm"
    />

    <h3 className="font-semibold mb-3 mt-4 text-base">🧩 Điều kiện kiểm tra</h3>

    {Array.isArray(expectForm.conditions) &&
      expectForm.conditions.map((cond: Condition, i: number) => (
        <div
          key={i}
          className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 mb-3 bg-white dark:bg-gray-950 grid grid-cols-6 gap-3 items-center shadow-sm"
        >
          {/* Dấu ngoặc */}
          <div className="flex flex-col items-center text-xs">
            <label className="text-[11px] font-medium">Mở (</label>
            <input
              type="checkbox"
              checked={!!cond.openParen}
              onChange={(e) =>
                updateCondition(i, "openParen", e.target.checked)
              }
            />
            <label className="text-[11px] font-medium mt-1">Đóng )</label>
            <input
              type="checkbox"
              checked={!!cond.closeParen}
              onChange={(e) =>
                updateCondition(i, "closeParen", e.target.checked)
              }
            />
          </div>

          {/* Vị trí */}
          <select
            value={cond.location}
            onChange={(e) =>
              updateCondition(i, "location", e.target.value as Condition["location"])
            }
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded text-sm"
          >
            <option value="">-- Vị trí --</option>
            <option value="headers">Headers</option>
            <option value="params">Params</option>
            <option value="body">Body</option>
          </select>

          {/* Trường */}
          <input
            placeholder="Field"
            value={cond.field}
            onChange={(e) => updateCondition(i, "field", e.target.value)}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded text-sm"
          />

          {/* So sánh */}
          <select
            value={cond.comparison}
            onChange={(e) =>
              updateCondition(i, "comparison", e.target.value as Condition["comparison"])
            }
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded text-sm"
          >
            <option value="">-- Chọn phép so sánh --</option>
            <option value="equals">Bằng (=)</option>
            <option value="notequals">Khác (≠)</option>
            <option value="contains">Chứa (contains)</option>
            <option value="notcontains">Không chứa (not contains)</option>
            <option value="greaterthan">Lớn hơn (&gt;)</option>
            <option value="greaterthanorequalto">Lớn hơn hoặc bằng (≥)</option>
            <option value="lessthan">Nhỏ hơn (&lt;)</option>
            <option value="lessthanorequalto">Nhỏ hơn hoặc bằng (≤)</option>
            <option value="exists">Tồn tại (exists)</option>
            <option value="notexists">Không tồn tại (not exists)</option>
          </select>

          {/* Giá trị mong đợi */}
          <input
            placeholder="Giá trị"
            value={cond.expectedValue}
            onChange={(e) => updateCondition(i, "expectedValue", e.target.value)}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded text-sm"
          />

          {/* Nút xóa */}
          <button
            onClick={() => removeCondition(i)}
            className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded"
          >
            ✖
          </button>
        </div>
      ))}

    <div className="flex items-center gap-3 mb-3">
      <button
        onClick={addCondition}
        className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded"
      >
        ➕ Thêm điều kiện
      </button>

      <select
        value={nextLogic}
        onChange={(e) => setNextLogic(e.target.value as "AND" | "OR")}
        className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded text-sm"
      >
        <option value="AND">Liên kết bằng AND</option>
        <option value="OR">Liên kết bằng OR</option>
      </select>
    </div>

    {/* Preview điều kiện */}
    <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
      <h3 className="font-medium mb-2 text-base text-gray-700 dark:text-gray-300">🔍 Preview Logic:</h3>
      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
        {renderPreview()}
      </div>
    </div>

    {/* ⚙️ HTTP Status + Kiểu dữ liệu */}
    <div className="flex flex-wrap gap-4 mt-5">
      <div className="w-full md:w-1/2">
        <h3 className="font-semibold mb-1 text-base text-gray-700 dark:text-gray-300">
          ⚠️ HTTP Status Code
        </h3>
        <input
          type="text"
          list="statusList"
          placeholder="Nhập hoặc chọn mã lỗi..."
          value={expectForm.mockResponseStatus || ""}
          onChange={(e) =>
            setExpectForm({ ...expectForm, mockResponseStatus: e.target.value })
          }
          className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded w-full text-sm"
        />
        <datalist id="statusList">
          {Array.isArray(httpStatusCodes) &&
            httpStatusCodes.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} - {s.text}
              </option>
            ))}
        </datalist>
        {expectForm.mockResponseStatus && (
          <p className="text-sm mt-1 font-medium text-gray-700">
            {(() => {
              const found = httpStatusCodes.find(
                (s) => s.code === Number(expectForm.mockResponseStatus)
              );
              return found
                ? `${found.code} - ${found.text}`
                : `⚠️ Mã lỗi ${expectForm.mockResponseStatus} không hợp lệ.`;
            })()}
          </p>
        )}
      </div>

      <div className="w-full md:w-1/2">
        <h3 className="font-semibold mb-1 text-base text-gray-700 dark:text-gray-300">
          📦 Kiểu dữ liệu trả về
        </h3>
        <select
          value={expectForm.contentType || "application/json"}
          onChange={(e) =>
            setExpectForm({ ...expectForm, contentType: e.target.value })
          }
          className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded w-full text-sm"
        >
          <option value="application/json">application/json</option>
          <option value="text/plain">text/plain</option>
          <option value="application/xml">application/xml</option>
          <option value="text/html">text/html</option>
          <option value="application/octet-stream">application/octet-stream</option>
        </select>
      </div>
    </div>

    {/* 🧾 Mock Response Data */}
    <div className="mt-4">
      <h3 className="font-semibold mb-2 text-base text-gray-700 dark:text-gray-300">
        🧾 Mock Response Data
      </h3>
      <textarea
        placeholder="Nhập nội dung response (JSON hoặc text)"
        rows={6}
        value={expectForm.mockResponse || ""}
        onChange={(e) =>
          setExpectForm({ ...expectForm, mockResponse: e.target.value })
        }
        className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-3 rounded w-full font-mono text-sm"
      />
    </div>
  </div>
);

}
