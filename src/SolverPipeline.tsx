/**
 * SolverPipeline.tsx
 * ------------------
 * Interactive visual representation of the layout engine's 6-stage resolution pipeline.
 * Clicking each stage displays dynamic real-time diagnostics and mathematical rationale.
 */

import React, { useState } from "react";
import type { ResolvedLayout } from "./resolver";
import { sound } from "./sound";

export function SolverPipeline({ layout }: { layout: ResolvedLayout }): React.ReactElement {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const { surface, contentRect, flowStrategy, placed, dropped, warnings, aspectRatio } = layout;

  const steps = [
    {
      id: 1,
      title: "1. Geometry",
      subtitle: `${surface.width}×${surface.height} (AR: ${aspectRatio.toFixed(2)})`,
      icon: "📐",
      details: {
        rawDimensions: `${surface.width} × ${surface.height}px`,
        aspectRatio: `${aspectRatio.toFixed(3)}:1`,
        safeArea: surface.safeArea
          ? `T:${surface.safeArea.top} R:${surface.safeArea.right} B:${surface.safeArea.bottom} L:${surface.safeArea.left}`
          : "None (Full Bleed)",
        contentRect: `${Math.round(contentRect.width)} × ${Math.round(contentRect.height)}px`,
      },
    },
    {
      id: 2,
      title: "2. Constraints",
      subtitle: `${surface.constraints.inputModality ?? "any"} modality`,
      icon: "🛡️",
      details: {
        minTapTarget: surface.constraints.minTapTarget ? `${surface.constraints.minTapTarget}px` : "None",
        minTextSize: surface.constraints.minTextSize ? `${surface.constraints.minTextSize}px` : "None",
        maxElements: surface.constraints.maxElements ?? "Unlimited",
        viewingDistance: surface.constraints.viewingDistance ?? "normal",
        inputModality: surface.constraints.inputModality ?? "touch",
      },
    },
    {
      id: 3,
      title: "3. Priority Pruning",
      subtitle: dropped.length > 0 ? `${dropped.length} dropped` : "All elements fit",
      icon: "⚖️",
      details: {
        survivingElements: `${placed.length} elements placed`,
        droppedCount: `${dropped.length} dropped`,
        dropLog: dropped.length > 0
          ? dropped.map(d => `${d.id}: ${d.reason}`).join(" | ")
          : "Zero elements dropped. Surface has sufficient area.",
      },
    },
    {
      id: 4,
      title: "4. Flow Strategy",
      subtitle: flowStrategy.toUpperCase(),
      icon: "⚡",
      details: {
        selectedStrategy: flowStrategy,
        formula: aspectRatio > 2.5
          ? "AR > 2.5 → broadcast-strip (Ultra-wide horizontal flow)"
          : aspectRatio >= 0.85 && aspectRatio <= 1.15
            ? "0.85 ≤ AR ≤ 1.15 → grid (2×2 quadrant composition)"
            : aspectRatio > 1.15
              ? "AR > 1.15 → row (Horizontal split layout)"
              : "AR < 0.85 → column (Vertical stacked flow)",
      },
    },
    {
      id: 5,
      title: "5. Auto-Scaling",
      subtitle: `${placed.filter(p => p.isShrunk).length} adjusted`,
      icon: "🔤",
      details: {
        shrunkElements: placed.filter(p => p.isShrunk).map(p => `${p.id} (${Math.round(p.scaleFactor * 100)}%)`).join(", ") || "None (100% natural size)",
        textFontSizes: placed.filter(p => p.fontSize).map(p => `${p.id}: ${Math.round(p.fontSize!)}px`).join(", "),
      },
    },
    {
      id: 6,
      title: "6. Render Matrix",
      subtitle: `${placed.length} rects ready`,
      icon: "🚀",
      details: {
        renderer: "Pure DOM / SVG Contract",
        warnings: warnings.length > 0 ? warnings.join("; ") : "Zero layout anomalies",
      },
    },
  ];

  const handleStepClick = (stepId: number) => {
    sound.playClick();
    setActiveStep(prev => (prev === stepId ? null : stepId));
  };

  return (
    <div className="pipeline-container">
      <div className="pipeline-header">
        <span className="pipeline-label">⚡ Constraint Resolution Pipeline</span>
        <span className="pipeline-hint">Click any stage to view live mathematical computation</span>
      </div>

      <div className="pipeline-track">
        {steps.map((s, idx) => {
          const isActive = activeStep === s.id;
          return (
            <React.Fragment key={s.id}>
              <button
                className={`pipeline-node ${isActive ? "pipeline-node-active" : ""}`}
                onClick={() => handleStepClick(s.id)}
              >
                <div className="node-icon-row">
                  <span className="node-icon">{s.icon}</span>
                  <span className="node-title">{s.title}</span>
                </div>
                <div className="node-subtitle">{s.subtitle}</div>
                {isActive && <div className="node-active-bar" />}
              </button>

              {idx < steps.length - 1 && (
                <div className="pipeline-connector">
                  <div className="connector-arrow">→</div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Active step details dropdown */}
      {activeStep !== null && (
        <div className="pipeline-details-panel">
          <div className="details-header">
            <div className="details-title">
              {steps[activeStep - 1].icon} {steps[activeStep - 1].title} — Live Inspection
            </div>
            <button className="details-close" onClick={() => setActiveStep(null)}>✕</button>
          </div>
          <div className="details-grid">
            {Object.entries(steps[activeStep - 1].details).map(([key, val]) => (
              <div key={key} className="details-item">
                <span className="details-key">{key}:</span>
                <span className="details-value">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
