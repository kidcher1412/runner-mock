"use client";
import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState } from "react";
const CytoscapeComponent = dynamic(() => import("react-cytoscapejs"), { ssr: false });
import cytoscape from "cytoscape";

export interface Condition {
  enabled: boolean;
  location: string;
  field: string;
  comparison: string;
  expectedValue: string;
}

export interface ExpectationFormDto {
  id: string;
  name: string;
  conditions: Condition[];
}

interface Props {
  expectList: ExpectationFormDto[];
}

// ================== Logic detect conflict ==================

function compareValuesAsNumber(v1: string, v2: string): [number, number, boolean] {
  const n1 = parseFloat(v1);
  const n2 = parseFloat(v2);
  const valid = !isNaN(n1) && !isNaN(n2);
  return [n1, n2, valid];
}

function numericOverlap(c1: Condition, c2: Condition): boolean {
  const [v1, v2, ok] = compareValuesAsNumber(c1.expectedValue, c2.expectedValue);
  if (!ok) return false;
  const gt = ["greaterthan", "greaterthanorequalto"];
  const lt = ["lessthan", "lessthanorequalto"];
  if (c1.comparison === "equals" && c2.comparison === "equals") return v1 === v2;
  if (c1.comparison === "equals" && gt.includes(c2.comparison)) return v1 > v2;
  if (c1.comparison === "equals" && lt.includes(c2.comparison)) return v1 < v2;
  if (c2.comparison === "equals" && gt.includes(c1.comparison)) return v2 > v1;
  if (c2.comparison === "equals" && lt.includes(c1.comparison)) return v2 < v1;
  if (gt.includes(c1.comparison) && lt.includes(c2.comparison)) return v1 < v2;
  if (gt.includes(c2.comparison) && lt.includes(c1.comparison)) return v2 < v1;
  if (gt.includes(c1.comparison) && gt.includes(c2.comparison)) return true;
  if (lt.includes(c1.comparison) && lt.includes(c2.comparison)) return true;
  return false;
}

function isConflict(c1: Condition, c2: Condition): boolean {
  if (!c1.enabled || !c2.enabled) return false;
  if (c1.location !== c2.location || c1.field !== c2.field) return false;
  if (numericOverlap(c1, c2)) return true;
  if (c1.comparison === "equals" && c2.comparison === "contains") {
    return c1.expectedValue.includes(c2.expectedValue);
  }
  if (c2.comparison === "equals" && c1.comparison === "contains") {
    return c2.expectedValue.includes(c1.expectedValue);
  }
  return false;
}

function findConflicts(a: ExpectationFormDto, b: ExpectationFormDto): Condition[] {
  return a.conditions.filter((c1) => b.conditions.some((c2) => isConflict(c1, c2)));
}

// ================== Main Component ==================

export default function ExpectationConflictGraph({ expectList = [] }: Props) {
  const [mounted, setMounted] = useState(false);
  const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!expectList || expectList.length === 0) return;

    const els: cytoscape.ElementDefinition[] = [];

    // Nodes
    for (const ex of expectList) {
      els.push({ data: { id: ex.id, label: ex.name } });
    }

    // Edges (conflicts)
    for (let i = 0; i < expectList.length; i++) {
      for (let j = i + 1; j < expectList.length; j++) {
        const overlap = findConflicts(expectList[i], expectList[j]);
        if (overlap.length > 0) {
          const color = overlap.length > 2 ? "#ef4444" : "#f59e0b";
          const label = overlap.length.toString();
          const details = overlap
            .map((c) => `⚠️ ${c.location}.${c.field} ${c.comparison} ${c.expectedValue}`)
            .join("<br/>");

          els.push({
            data: {
              id: `${expectList[i].id}-${expectList[j].id}`,
              source: expectList[i].id,
              target: expectList[j].id,
              label,
              color,
              details,
            },
          });
        }
      }
    }

    setElements(els);
  }, [expectList]);

  // Handle hover tooltip
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    const tooltip = document.createElement("div");
    tooltip.className =
      "absolute bg-white border border-gray-300 rounded-lg shadow-md p-2 text-xs text-gray-800 max-w-xs z-50 hidden";
    document.body.appendChild(tooltip);
    tooltipRef.current = tooltip;

    const showTooltip = (event: cytoscape.EventObject) => {
      const edge = event.target;
      const details = edge.data("details");
      if (!details) return;
      const pos = event.renderedPosition || { x: 0, y: 0 };
      tooltip.innerHTML = details;
      tooltip.style.left = `${pos.x + 10}px`;
      tooltip.style.top = `${pos.y + 80}px`;
      tooltip.style.position = "fixed";
      tooltip.style.display = "block";
    };

    const hideTooltip = () => {
      if (tooltipRef.current) tooltipRef.current.style.display = "none";
    };

    cy.on("mouseover", "edge", showTooltip);
    cy.on("mouseout", "edge", hideTooltip);

    return () => {
      cy.removeListener("mouseover", "edge", showTooltip);
      cy.removeListener("mouseout", "edge", hideTooltip);
      tooltip.remove();
    };
  }, [mounted]);

  if (!mounted) return null;
  if (!elements.length) return <div>⚠️ Không có expectation nào.</div>;

  return (
    <div style={{ width: "60%", height: 200, position: "relative", border: "1px solid #000" }}>
      <CytoscapeComponent
        elements={elements}
        cy={(cy) => (cyRef.current = cy)}
        layout={{ name: "cose", animate: false }}
        style={{ width: "100%", height: "100%" }}
        stylesheet={[
          {
            selector: "node",
            style: {
              "background-color": "#f9fafb",
              "border-width": 1,
              "border-color": "#94a3b8",
              label: "data(label)",
              "text-valign": "center",
              "text-halign": "center",
              shape: "round-rectangle",
              padding: "3px", // 👈 giảm padding
              "font-size": 3, // 👈 giảm cỡ chữ
              width: "label", // 👈 node co theo nhãn
              height: "label", // 👈 giúp node nhỏ gọn hơn
            },
          },
          {
            selector: "edge",
            style: {
              width: 1.5,
              "line-color": "data(color)",
              "target-arrow-color": "data(color)",
              "curve-style": "bezier",
              "target-arrow-shape": "triangle",
              label: "data(label)",
              "font-size": 3, // 👈 nhỏ hơn
              "text-background-color": "#fff",
              "text-background-opacity": 1,
              "text-background-padding": 1,
            },
          },
        ]}
      />

    </div>
  );
}
