/**
 * InteractiveBackground.tsx
 * -------------------------
 * Highly interactive, multi-mode visual canvas background.
 * Reacts dynamically to mouse position, clicks (shockwave ripples), and user mode selection.
 *
 * Modes:
 * 1. "cyber-grid": 3D perspective cybernetic grid with topographic cursor warping
 * 2. "nebula": Gravitational particle constellation with fluid mouse vortex
 * 3. "matrix": Digital reactive glow mesh with pulsating cyber dots
 * 4. "studio": Sleek Apple-inspired ambient spotlight glow with chromatic dispersion
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { sound } from "./sound";

export type BgMode = "cyber-grid" | "nebula" | "matrix" | "studio";

interface InteractiveBackgroundProps {
  mode: BgMode;
  onModeChange: (mode: BgMode) => void;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export function InteractiveBackground({
  mode,
  onModeChange,
}: InteractiveBackgroundProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 500,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 500,
    targetX: typeof window !== "undefined" ? window.innerWidth / 2 : 500,
    targetY: typeof window !== "undefined" ? window.innerHeight / 2 : 500,
  });

  const [controlsOpen, setControlsOpen] = useState(false);

  // Click shockwave ripple handler
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    sound.playClick();
    const colors = ["#6366f1", "#06b6d4", "#ec4899", "#8b5cf6", "#10b981"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    ripplesRef.current.push({
      x: e.clientX,
      y: e.clientY,
      radius: 5,
      maxRadius: 350,
      alpha: 0.8,
      color: randomColor,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Particles for Nebula & Matrix modes
    const particleCount = mode === "nebula" ? 85 : 60;
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      baseX: number;
      baseY: number;
      hue: number;
      pulse: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      particles.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: Math.random() * 2.5 + 1,
        hue: Math.random() * 70 + 210, // Cyan, Indigo, Violet
        pulse: Math.random() * Math.PI * 2,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.02;

      // Smooth mouse interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ──────────────────────────────────────────
      // Mode 1: 3D CYBER GRID (Topographic Warping)
      // ──────────────────────────────────────────
      if (mode === "cyber-grid") {
        const horizon = canvas.height * 0.45;
        const gridSpacing = 42;

        // Subtle dark ambient gradient
        const bgGrad = ctx.createRadialGradient(
          mx, my, 50,
          canvas.width / 2, canvas.height / 2, canvas.width * 0.8
        );
        bgGrad.addColorStop(0, "rgba(99, 102, 241, 0.14)");
        bgGrad.addColorStop(0.5, "rgba(14, 18, 38, 0.6)");
        bgGrad.addColorStop(1, "rgba(6, 8, 19, 0.95)");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Perspective grid lines
        ctx.strokeStyle = "rgba(99, 102, 241, 0.16)";
        ctx.lineWidth = 1;

        // Vertical radiating lines
        for (let x = -canvas.width * 0.5; x <= canvas.width * 1.5; x += gridSpacing * 1.4) {
          ctx.beginPath();
          // Interactive warp near mouse
          const dx = x - mx;
          const warp = Math.sin(dx * 0.005 + time) * 35;
          ctx.moveTo(canvas.width / 2 + (x - canvas.width / 2) * 0.1, horizon);
          ctx.lineTo(x + warp, canvas.height);
          ctx.stroke();
        }

        // Horizontal perspective lines with ripple
        for (let y = horizon; y <= canvas.height; y += gridSpacing) {
          const depth = (y - horizon) / (canvas.height - horizon);
          const py = horizon + Math.pow(depth, 1.8) * (canvas.height - horizon);
          ctx.beginPath();
          for (let px = 0; px <= canvas.width; px += 30) {
            const distToMouse = Math.sqrt((px - mx) ** 2 + (py - my) ** 2);
            const mouseLift = Math.max(0, 1 - distToMouse / 280) * 35;
            const wave = Math.sin(px * 0.02 + time * 2) * 4;
            const finalY = py - mouseLift + wave;
            if (px === 0) ctx.moveTo(px, finalY);
            else ctx.lineTo(px, finalY);
          }
          ctx.strokeStyle = `rgba(99, 102, 241, ${0.08 + depth * 0.22})`;
          ctx.stroke();
        }
      }

      // ──────────────────────────────────────────
      // Mode 2: NEBULA CONSTELLATION (Gravitational Vortex)
      // ──────────────────────────────────────────
      else if (mode === "nebula") {
        ctx.fillStyle = "rgba(6, 8, 19, 0.2)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.pulse += 0.03;

          // Mouse gravity pull
          const dx = mx - p.x;
          const dy = my - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 260) {
            const force = (1 - dist / 260) * 0.8;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }

          // Friction & position update
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.x += p.vx + Math.sin(p.pulse) * 0.3;
          p.y += p.vy + Math.cos(p.pulse) * 0.3;

          // Boundary wrap
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;

          // Draw particle
          ctx.beginPath();
          const currentSize = p.size + Math.sin(p.pulse) * 0.8;
          ctx.arc(p.x, p.y, Math.max(0.5, currentSize), 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, 0.7)`;
          ctx.shadowColor = `hsla(${p.hue}, 100%, 65%, 0.6)`;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Connect nearby particles
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const pdist = Math.hypot(p.x - p2.x, p.y - p2.y);
            if (pdist < 130) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(147, 112, 219, ${0.18 * (1 - pdist / 130)})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
      }

      // ──────────────────────────────────────────
      // Mode 3: DIGITAL MATRIX (Pulse Grid)
      // ──────────────────────────────────────────
      else if (mode === "matrix") {
        const step = 48;
        ctx.fillStyle = "rgba(6, 8, 19, 0.95)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let x = 20; x < canvas.width; x += step) {
          for (let y = 20; y < canvas.height; y += step) {
            const dist = Math.hypot(x - mx, y - my);
            const intensity = Math.max(0, 1 - dist / 220);
            const radius = 1.4 + intensity * 4;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = intensity > 0
              ? `rgba(6, 182, 212, ${0.2 + intensity * 0.8})`
              : "rgba(255, 255, 255, 0.05)";
            if (intensity > 0.4) {
              ctx.shadowColor = "#06b6d4";
              ctx.shadowBlur = 8;
            }
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // ──────────────────────────────────────────
      // Mode 4: STUDIO OBSIDIAN (Apple Pro Spotlight)
      // ──────────────────────────────────────────
      else if (mode === "studio") {
        ctx.fillStyle = "#060813";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Fluid spotlight following mouse
        const grad = ctx.createRadialGradient(
          mx, my, 10,
          mx, my, 550
        );
        grad.addColorStop(0, "rgba(99, 102, 241, 0.22)");
        grad.addColorStop(0.3, "rgba(139, 92, 246, 0.12)");
        grad.addColorStop(0.6, "rgba(6, 182, 212, 0.05)");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Secondary ambient backlight
        const backGrad = ctx.createRadialGradient(
          canvas.width * 0.8, canvas.height * 0.2, 50,
          canvas.width * 0.8, canvas.height * 0.2, 600
        );
        backGrad.addColorStop(0, "rgba(244, 63, 94, 0.08)");
        backGrad.addColorStop(1, "transparent");
        ctx.fillStyle = backGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // ──────────────────────────────────────────
      // RIPPLE SHOCKWAVES (Interactive on click)
      // ──────────────────────────────────────────
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const r = ripplesRef.current[i];
        r.radius += 7;
        r.alpha *= 0.94;

        if (r.radius > r.maxRadius || r.alpha < 0.01) {
          ripplesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3 * (r.alpha);
        ctx.globalAlpha = r.alpha;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [mode]);

  return (
    <div className="interactive-bg-wrapper">
      <canvas
        ref={canvasRef}
        className="interactive-bg-canvas"
        onClick={handleCanvasClick}
        title="Click anywhere on the background to send dynamic shockwave ripples"
      />

      {/* Floating Background Selector Dock */}
      <div className={`bg-dock ${controlsOpen ? "bg-dock-expanded" : ""}`}>
        <button
          className="bg-dock-toggle"
          onClick={() => {
            sound.playClick();
            setControlsOpen(v => !v);
          }}
          title="Customize interactive background animation"
        >
          <span className="bg-dock-icon">✨</span>
          <span className="bg-dock-label">
            {mode === "cyber-grid" ? "Cyber Grid" : mode === "nebula" ? "Nebula Vortex" : mode === "matrix" ? "Matrix Pulse" : "Studio Glow"}
          </span>
          <span className="bg-dock-arrow">{controlsOpen ? "▾" : "▴"}</span>
        </button>

        {controlsOpen && (
          <div className="bg-dock-menu">
            <div className="bg-menu-header">
              <span>Interactive Atmosphere</span>
              <span className="bg-menu-sub">Click anywhere to create energy ripples</span>
            </div>
            <div className="bg-option-buttons">
              <button
                className={`bg-opt-btn ${mode === "cyber-grid" ? "opt-selected" : ""}`}
                onClick={() => {
                  sound.playSwitch();
                  onModeChange("cyber-grid");
                }}
              >
                <span className="opt-icon">🌐</span>
                <div className="opt-text">
                  <strong>3D Cyber Grid</strong>
                  <small>Warping perspective mesh</small>
                </div>
              </button>

              <button
                className={`bg-opt-btn ${mode === "nebula" ? "opt-selected" : ""}`}
                onClick={() => {
                  sound.playSwitch();
                  onModeChange("nebula");
                }}
              >
                <span className="opt-icon">🌌</span>
                <div className="opt-text">
                  <strong>Cosmic Nebula</strong>
                  <small>Gravitational particle vortex</small>
                </div>
              </button>

              <button
                className={`bg-opt-btn ${mode === "matrix" ? "opt-selected" : ""}`}
                onClick={() => {
                  sound.playSwitch();
                  onModeChange("matrix");
                }}
              >
                <span className="opt-icon">⚡</span>
                <div className="opt-text">
                  <strong>Matrix Pulse</strong>
                  <small>Reactive digital grid dots</small>
                </div>
              </button>

              <button
                className={`bg-opt-btn ${mode === "studio" ? "opt-selected" : ""}`}
                onClick={() => {
                  sound.playSwitch();
                  onModeChange("studio");
                }}
              >
                <span className="opt-icon">🪐</span>
                <div className="opt-text">
                  <strong>Apple Studio Glow</strong>
                  <small>Subtle fluid spotlight</small>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
