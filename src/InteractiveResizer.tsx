/**
 * InteractiveResizer.tsx
 * ----------------------
 * Provides a freeform fluid canvas resizer with live drag handles,
 * preset aspect ratio shortcuts, and an automated "Stress Test / Fluid Morph" mode.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { sound } from "./sound";

interface InteractiveResizerProps {
  currentWidth: number;
  currentHeight: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  onChange: (width: number, height: number) => void;
  aspectRatio: number;
  flowStrategy: string;
  placedCount: number;
  totalCount: number;
  children: React.ReactNode;
}

export function InteractiveResizer({
  currentWidth,
  currentHeight,
  minWidth = 280,
  maxWidth = 1920,
  minHeight = 120,
  maxHeight = 1200,
  onChange,
  aspectRatio,
  flowStrategy,
  placedCount,
  totalCount,
  children,
}: InteractiveResizerProps): React.ReactElement {
  const [isDragging, setIsDragging] = useState<"corner" | "right" | "bottom" | null>(null);
  const [isStressTesting, setIsStressTesting] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number }>({
    mouseX: 0,
    mouseY: 0,
    startW: currentWidth,
    startH: currentHeight,
  });

  // Handle Dragging
  const handleMouseDown = useCallback((type: "corner" | "right" | "bottom", e: React.MouseEvent) => {
    e.preventDefault();
    if (isStressTesting) setIsStressTesting(false);
    setIsDragging(type);
    sound.playClick();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: currentWidth,
      startH: currentHeight,
    };
  }, [currentWidth, currentHeight, isStressTesting]);

  useEffect(() => {
    if (!isDragging) return;

    let lastTickTime = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      let newW = dragStartRef.current.startW;
      let newH = dragStartRef.current.startH;

      if (isDragging === "right" || isDragging === "corner") {
        newW = Math.max(minWidth, Math.min(maxWidth, Math.round(dragStartRef.current.startW + dx * 1.5)));
      }
      if (isDragging === "bottom" || isDragging === "corner") {
        newH = Math.max(minHeight, Math.min(maxHeight, Math.round(dragStartRef.current.startH + dy * 1.5)));
      }

      const now = performance.now();
      if (now - lastTickTime > 80) {
        sound.playTick();
        lastTickTime = now;
      }

      onChange(newW, newH);
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minWidth, maxWidth, minHeight, maxHeight, onChange]);

  // Automated Stress Test Animation
  useEffect(() => {
    if (!isStressTesting) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    startTimeRef.current = performance.now();

    const loop = (timestamp: number) => {
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      // Oscillate width and height through extreme aspect ratios
      const w = Math.round(620 + 380 * Math.sin(elapsed * 0.9));
      const h = Math.round(480 + 320 * Math.cos(elapsed * 0.7));

      onChange(w, h);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isStressTesting, onChange]);

  const toggleStressTest = () => {
    sound.playSwitch();
    setIsStressTesting(prev => !prev);
  };

  const applyPreset = (w: number, h: number) => {
    sound.playSwitch();
    if (isStressTesting) setIsStressTesting(false);
    onChange(w, h);
  };

  return (
    <div className="resizer-container">
      {/* Top HUD bar */}
      <div className="resizer-hud">
        <div className="hud-left">
          <div className="hud-pill hud-resolution">
            <span className="hud-icon">📐</span>
            <span className="hud-value">{currentWidth} × {currentHeight}</span>
            <span className="hud-unit">px</span>
          </div>
          <div className="hud-pill hud-ar">
            <span className="hud-label">AR</span>
            <span className="hud-value">{aspectRatio.toFixed(2)}:1</span>
          </div>
          <div className={`hud-pill hud-strategy strategy-${flowStrategy}`}>
            <span className="strategy-indicator" />
            <span className="hud-value">{flowStrategy.toUpperCase()}</span>
          </div>
        </div>

        <div className="hud-right">
          <div className="hud-pill hud-budget">
            <span className="hud-label">Placed:</span>
            <span className={`hud-value ${placedCount < totalCount ? "budget-dropped" : "budget-full"}`}>
              {placedCount}/{totalCount}
            </span>
          </div>

          <button
            className={`stress-test-btn ${isStressTesting ? "stress-active" : ""}`}
            onClick={toggleStressTest}
            title="Auto-animate surface dimensions to continuously test layout adaptation"
          >
            <span className="stress-icon">{isStressTesting ? "⏹" : "▶"}</span>
            <span>{isStressTesting ? "Stop Stress Test" : "Fluid Stress Test"}</span>
          </button>
        </div>
      </div>

      {/* Main preview viewport wrapper */}
      <div className="resizer-viewport-box">
        {children}

        {/* Drag handles */}
        <div
          className="resize-handle handle-right"
          onMouseDown={e => handleMouseDown("right", e)}
          title="Drag to adjust width"
        >
          <div className="handle-bar" />
        </div>
        <div
          className="resize-handle handle-bottom"
          onMouseDown={e => handleMouseDown("bottom", e)}
          title="Drag to adjust height"
        >
          <div className="handle-bar" />
        </div>
        <div
          className="resize-handle handle-corner"
          onMouseDown={e => handleMouseDown("corner", e)}
          title="Drag corner to adjust dimensions freely"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M10 2L2 10M10 6L6 10M10 10L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Quick Ratio Presets */}
      <div className="resizer-presets">
        <span className="preset-label">Quick Ratios:</span>
        <button className="preset-chip" onClick={() => applyPreset(390, 844)}>
          📱 9:16 Mobile
        </button>
        <button className="preset-chip" onClick={() => applyPreset(800, 800)}>
          ⬛ 1:1 Square
        </button>
        <button className="preset-chip" onClick={() => applyPreset(1024, 768)}>
          📟 4:3 Tablet
        </button>
        <button className="preset-chip" onClick={() => applyPreset(1280, 720)}>
          💻 16:9 Landscape
        </button>
        <button className="preset-chip" onClick={() => applyPreset(1920, 280)}>
          📺 32:9 Broadcast
        </button>
        <button className="preset-chip" onClick={() => applyPreset(1400, 420)}>
          🏙️ Banner
        </button>
      </div>
    </div>
  );
}
