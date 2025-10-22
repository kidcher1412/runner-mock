"use client";
import { useState } from "react";
import { httpStatusCodes } from "@/statics/data/httpStatusCodes";
import { ExpectationFormDto } from "./ExpectationCreateForm";

export type Condition = {
  openParen: boolean;
  closeParen: boolean;
  location: string;
  field: string;
  comparison: string;
  expectedValue: string;
  enabled?: boolean;
  logicBefore?: "AND" | "OR";
};

export type ExpectForm = {
  name: string;
  logic: "AND" | "OR";
  contentType: string;
  mockResponse: string;
  mockResponseStatus: string;
  conditions: Condition[];
};

export default function ExpectationForm({
  value,
  onChange,
  readOnly = false,
}: {
  value: ExpectationFormDto;
  onChange: (v: ExpectationFormDto) => void;
  readOnly?: boolean;
}) {
  if (!value) {
    return <div className="text-gray-500 dark:text-gray-400 italic">Đang tải dữ liệu Expectation...</div>;
  }
  const [nextLogic, setNextLogic] = useState<"AND" | "OR">("AND");

  const updateCondition = (index: number, key: string, val: any) => {
    const newConditions = [...value.conditions];
    (newConditions[index] as any)[key] = val;
    onChange({ ...value, conditions: newConditions });
  };

  const addCondition = () => {
    onChange({
      ...value,
      conditions: [
        ...value.conditions,
        {
          location: "",
          field: "",
          comparison: "",
          expectedValue: "",
          enabled: true,
          openParen: false,
          closeParen: false,
          logicBefore: nextLogic,
        },
      ],
    });
  };

  const removeCondition = (index: number) =>
    onChange({
      ...value,
      conditions: value.conditions.filter((_, i) => i !== index),
    });

  const renderPreview = () =>
    value.conditions
      .map((c, i) => {
        if (!c.location || !c.field) return "";
        const logic = c.logicBefore ? `${c.logicBefore} ` : "";
        const expr = `${c.openParen ? "(" : ""}${c.location}.${c.field} ${c.comparison} ${c.expectedValue}${c.closeParen ? ")" : ""}`;
        return `${logic}${expr}`;
      })
      .filter(Boolean)
      .join(" ");

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded p-3 bg-gray-50 dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-100">
      {/* 🧩 Tên Expectation */}
      <h3 className="font-semibold mb-2">🧩 Tên Expectation</h3>
      <input
        disabled={readOnly}
        placeholder="Tên Expectation"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-1 rounded w-full mb-2"
      />

      {/* 🔧 Điều kiện */}
      <h3 className="font-semibold mb-2">🧩 Điều kiện kiểm tra</h3>

      {value.conditions.map((cond, i) => (
        <div
          key={i}
          className="border border-gray-200 dark:border-gray-800 rounded p-2 mb-2 bg-white dark:bg-gray-950 grid grid-cols-6 gap-2 items-center"
        >
          <div className="flex flex-col items-center">
            <label className="text-[10px]">Mở (</label>
            <input
              type="checkbox"
              disabled={readOnly}
              checked={cond.openParen}
              onChange={(e) => updateCondition(i, "openParen", e.target.checked)}
            />
            <label className="text-[10px]">Đóng )</label>
            <input
              type="checkbox"
              disabled={readOnly}
              checked={cond.closeParen}
              onChange={(e) => updateCondition(i, "closeParen", e.target.checked)}
            />
          </div>

          <select
            disabled={readOnly}
            value={cond.location}
            onChange={(e) => updateCondition(i, "location", e.target.value)}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-1 rounded"
          >
            <option value="">-- Vị trí --</option>
            <option value="headers">Headers</option>
            <option value="params">Params</option>
            <option value="body">Body</option>
          </select>

          <input
            disabled={readOnly}
            placeholder="Field"
            value={cond.field}
            onChange={(e) => updateCondition(i, "field", e.target.value)}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-1 rounded"
          />

          <select
            disabled={readOnly}
            value={cond.comparison}
            onChange={(e) => updateCondition(i, "comparison", e.target.value)}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-1 rounded"
          >
            <option value="">-- Chọn phép so sánh --</option>
            <option value="equals">Bằng (=)</option>
            <option value="notequals">Khác (≠)</option>
            <option value="contains">Chứa (contains)</option>
            <option value="notcontains">Không chứa (not contains)</option>
            <option value="greaterthan">Lớn hơn ({">"})</option>
            <option value="greaterthanorequalto">Lớn hơn hoặc bằng (≥)</option>
            <option value="lessthan">Nhỏ hơn (&lt;)</option>
            <option value="lessthanorequalto">Nhỏ hơn hoặc bằng (≤)</option>
            <option value="exists">Tồn tại (exists)</option>
            <option value="notexists">Không tồn tại (not exists)</option>
          </select>


          <input
            disabled={readOnly}
            placeholder="Giá trị"
            value={cond.expectedValue}
            onChange={(e) =>
              updateCondition(i, "expectedValue", e.target.value)
            }
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-1 rounded"
          />

          {!readOnly && (
            <button
              onClick={() => removeCondition(i)}
              className="bg-red-500 text-white text-xs px-2 py-1 rounded"
            >
              ✖
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={addCondition}
            className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded"
          >
            ➕ Thêm điều kiện
          </button>

          <select
            value={nextLogic}
            onChange={(e) => setNextLogic(e.target.value as "AND" | "OR")}
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-1 rounded text-xs"
          >
            <option value="AND">Liên kết bằng AND</option>
            <option value="OR">Liên kết bằng OR</option>
          </select>
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-gray-800 pt-3 mb-2">
        <h3 className="font-medium mb-2 text-sm text-gray-700 dark:text-gray-300">
          🔍 Preview Logic:
        </h3>
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm text-gray-800 dark:text-gray-100">
          {renderPreview()}
        </div>
      </div>

      {/* ⚙️ HTTP Status + ContentType */}
      <div className="flex flex-wrap gap-3">
        <div className="mb-3 w-full md:w-1/2">
          <h3 className="font-semibold mb-1 text-sm text-gray-700 dark:text-gray-300">
            ⚠️ HTTP Status Code
          </h3>
          <input
            disabled={readOnly}
            type="text"
            list="statusList"
            placeholder="Nhập hoặc chọn mã lỗi..."
            value={value.mockResponseStatus}
            onChange={(e) =>
              onChange({ ...value, mockResponseStatus: e.target.value })
            }
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-1 rounded w-full"
          />
          <datalist id="statusList">
            {httpStatusCodes.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} - {s.text}
              </option>
            ))}
          </datalist>
        </div>

        <div className="mb-3 w-full md:w-1/2">
          <h3 className="font-semibold mb-1 text-sm text-gray-700 dark:text-gray-300">
            📦 Kiểu dữ liệu trả về
          </h3>
          <select
            disabled={readOnly}
            value={value.contentType}
            onChange={(e) =>
              onChange({ ...value, contentType: e.target.value })
            }
            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-1 rounded w-full"
          >
            <option value="application/json">application/json</option>
            <option value="text/plain">text/plain</option>
            <option value="application/xml">application/xml</option>
            <option value="text/html">text/html</option>
          </select>
        </div>
      </div>

      {/* Mock response */}
      <div className="mb-3">
        <h3 className="font-semibold mb-1 text-sm text-gray-700 dark:text-gray-300">
          🧾 Mock Response Data
        </h3>
        <textarea
          disabled={readOnly}
          rows={5}
          value={value.mockResponse}
          onChange={(e) =>
            onChange({ ...value, mockResponse: e.target.value })
          }
          className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-2 rounded w-full font-mono text-xs"
        />
      </div>
    </div>
  );
}
