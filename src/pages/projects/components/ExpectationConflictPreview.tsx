"use client";
import React, { useEffect, useState } from "react";
import ExpectationConflictGraph from "./ExpectationConflictGraph";

interface Condition {
  enabled: boolean;
  location: string;
  field: string;
  comparison: string;
  expectedValue: string;
}

interface ExpectationFormDto {
  id: string;
  name: string;
  conditions: Condition[];
}

interface Props {
  project: string;
  endpoint: string;
  method: string;
  currentExpect?: ExpectationFormDto; // expect đang thêm/sửa
}

export default function ExpectationConflictPreview({
  project,
  endpoint,
  method,
  currentExpect,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [expectList, setExpectList] = useState<ExpectationFormDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project || !endpoint || !method) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/scripts/expectation?project=${project}&endpoint=${encodeURIComponent(
            endpoint
          )}&method=${method}`,
          { method: "GET" }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        // parse expectations từ backend
        const list: ExpectationFormDto[] = data
          .filter((r: any) => r.expectation)
          .map((r: any) => ({
            id: String(r.id),
            name: r.expectation.name,
            conditions: (r.expectation.conditions || []).map((c: any) => ({
              enabled: c.enabled,
              location: c.location,
              field: c.field,
              comparison: c.comparison,
              expectedValue: c.expectedValue,
            })),
          }));

        // Nếu đang thêm mới → gắn thêm vào list để so sánh luôn
        if (currentExpect && currentExpect.conditions?.length > 0) {
          list.push({
            ...currentExpect,
            id: "temp-current",
            name: currentExpect.name || "🟢 New Expect",
          });
        }

        setExpectList(list);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [project, endpoint, method, currentExpect]);

  if (loading)
    return <div className="text-gray-500 text-sm">⏳ Đang tải dữ liệu...</div>;

  if (error)
    return (
      <div className="text-red-500 text-sm">
        ⚠️ Lỗi khi tải expectation: {error}
      </div>
    );

  if (!expectList.length)
    return (
      <div className="text-gray-500 text-sm italic">
        Không có expectation nào cho endpoint này.
      </div>
    );

  return (
    <div className="mt-3">
      <h3 className="font-semibold mb-2 text-gray-700">
        🔍 Xem trước xung đột expectation
      </h3>
      <ExpectationConflictGraph expectList={expectList} />
    </div>
  );
}
