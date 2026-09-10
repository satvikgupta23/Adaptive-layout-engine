import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AdRenderer } from "./render-dom";
import { resolveLayout } from "./resolver";
import { ALL_SURFACES, defineSurface } from "./surfaces";
import { sonixAdSpec } from "./adSpec";
import type { SurfaceProfile } from "./surfaces";
import type { ResolvedLayout } from "./resolver";
import "./App.css";

// ---------------------------------------------------------------------------
// Animated background particles
// ---------------------------------------------------------------------------
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; hue: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.4 + 0.05,
        hue: Math.random() * 60 + 220, // purple-blue range
      });
    }

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    const onMouse = (e: MouseEvent) => { mouseX = e.clientX; mouseY = e.clientY; };
    window.addEventListener("mousemove", onMouse);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        // Subtle mouse attraction
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          p.vx += dx * 0.00005;
          p.vy += dy * 0.00005;
        }
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.alpha})`;
        ctx.fill();
      }
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(102, 126, 234, ${0.08 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);
  return <canvas ref={canvasRef} className="particle-canvas" />;
}

// ---------------------------------------------------------------------------
// Custom surface form
// ---------------------------------------------------------------------------
interface CustomSurfaceFormProps { onAdd: (s: SurfaceProfile) => void; onClose: () => void; }
function CustomSurfaceForm({ onAdd, onClose }: CustomSurfaceFormProps) {
  const [w, setW] = useState("800");
  const [h, setH] = useState("600");
  const [name, setName] = useState("Custom Surface");
  const [minTap, setMinTap] = useState("44");
  const [minText, setMinText] = useState("14");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      try {
        const surface = defineSurface({
          id: `custom-${Date.now()}`,
          name: name || "Custom",
          description: `${w}×${h} custom surface`,
          icon: "✨",
          width: parseInt(w, 10),
          height: parseInt(h, 10),
          constraints: {
            minTapTarget: minTap ? parseInt(minTap, 10) : undefined,
            minTextSize: minText ? parseInt(minText, 10) : undefined,
            viewingDistance: "normal",
            inputModality: "touch",
          },
          surfaceBackground: "#0a0a14",
        });
        setError(null);
        onAdd(surface);
      } catch (err) {
        setError((err as Error).message);
        setSubmitting(false);
      }
    }, 400);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">✨ Define a Custom Surface</div>
          <div className="modal-sub">The resolver adapts in real-time — no code changes needed</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Surface Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Digital Billboard" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Width (px)</label>
              <input type="number" value={w} onChange={e => setW(e.target.value)} min="80" max="3840" />
            </div>
            <div className="form-group">
              <label>Height (px)</label>
              <input type="number" value={h} onChange={e => setH(e.target.value)} min="80" max="2160" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Min Tap Target (px)</label>
              <input type="number" value={minTap} onChange={e => setMinTap(e.target.value)} min="0" max="120" />
            </div>
            <div className="form-group">
              <label>Min Font Size (px)</label>
              <input type="number" value={minText} onChange={e => setMinText(e.target.value)} min="0" max="96" />
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="form-preview-hint">
            AR: <strong>{(parseInt(w || "1") / parseInt(h || "1")).toFixed(2)}</strong>
            {" → strategy: "}
            <strong>{
              (() => {
                const ar = parseInt(w || "1") / parseInt(h || "1");
                if (ar > 2.5) return "broadcast-strip";
                if (ar >= 0.85 && ar <= 1.15) return "grid";
                if (ar > 1.15) return "row";
                return "column";
              })()
            }</strong>
          </div>
          <button type="submit" className={`form-submit ${submitting ? "submitting" : ""}`} disabled={submitting}>
            {submitting ? <span className="spinner" /> : "→"} Resolve This Surface
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Strategy pill
// ---------------------------------------------------------------------------
const STRATEGY_META: Record<string, { label: string; color: string; desc: string }> = {
  column: { label: "Column", color: "#a78bfa", desc: "Vertical stack — portrait flow" },
  row: { label: "Row", color: "#fbbf24", desc: "Horizontal split — landscape flow" },
  grid: { label: "Grid", color: "#4ade80", desc: "2×2 quadrant — square composition" },
  "broadcast-strip": { label: "Broadcast", color: "#f87171", desc: "Ultra-wide strip — far viewing" },
};

function StrategyBadge({ strategy }: { strategy: string }) {
  const meta = STRATEGY_META[strategy] ?? { label: strategy, color: "#888", desc: "" };
  return (
    <div className="strategy-pill" style={{ "--s-color": meta.color } as React.CSSProperties}>
      <div className="strategy-pill-dot" />
      <span className="strategy-pill-label">{meta.label}</span>
      <span className="strategy-pill-desc">{meta.desc}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Element status card
// ---------------------------------------------------------------------------
function ElementCard({ layout, elId, label, role, priority }: {
  layout: ResolvedLayout; elId: string; label: string; role: string; priority: number;
}) {
  const resolved = layout.placed.find(p => p.id === elId);
  const dropped = layout.dropped.find(d => d.id === elId);
  const isDropped = !!dropped;
  const isShrunk = resolved?.isShrunk ?? false;

  return (
    <div className={`el-card ${isDropped ? "el-dropped" : isShrunk ? "el-shrunk" : "el-placed"}`}>
      <div className="el-card-header">
        <span className={`el-role-dot role-${role}`} />
        <span className="el-card-id">{label}</span>
        <span className={`el-priority p${priority}`}>P{priority}</span>
        <span className={`el-status ${isDropped ? "status-drop" : isShrunk ? "status-shrunk" : "status-ok"}`}>
          {isDropped ? "dropped" : isShrunk ? "shrunk" : "✓"}
        </span>
      </div>
      {resolved && (
        <div className="el-card-meta">
          <span>{Math.round(resolved.rect.x)},{Math.round(resolved.rect.y)}</span>
          <span className="el-sep">·</span>
          <span>{Math.round(resolved.rect.width)}×{Math.round(resolved.rect.height)}</span>
          {resolved.fontSize && <><span className="el-sep">·</span><span>{Math.round(resolved.fontSize)}px</span></>}
          {isShrunk && <span className="el-scale">⚠ {Math.round(resolved.scaleFactor * 100)}%</span>}
        </div>
      )}
      {dropped && <div className="el-card-reason">{dropped.reason}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat counter
// ---------------------------------------------------------------------------
function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="stat">
      <div className="stat-value" style={color ? { color } : {}}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scaled surface preview
// ---------------------------------------------------------------------------
function ScaledPreview({ layout, showDebug }: { layout: ResolvedLayout; showDebug: boolean }) {
  const MAX_W = 520;
  const MAX_H = 440;
  const sw = layout.surface.width;
  const sh = layout.surface.height;
  const scale = Math.min(MAX_W / sw, MAX_H / sh, 1);

  return (
    <div className="preview-wrap">
      <div className="preview-chrome">
        <div className="chrome-dots">
          <span /><span /><span />
        </div>
        <div className="chrome-url">{layout.surface.icon} {layout.surface.name} — {sw}×{sh}</div>
      </div>
      <div
        className="preview-viewport"
        style={{ width: sw * scale, height: sh * scale }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: sw, height: sh }}>
          <AdRenderer layout={layout} showDebug={showDebug} />
        </div>
        <div className="preview-glow" />
      </div>
      <div className="preview-footer">
        <span className="preview-scale-tag">{Math.round(scale * 100)}% scale</span>
        <span className="preview-desc">{layout.surface.description}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// All-surfaces mosaic
// ---------------------------------------------------------------------------
function AllSurfacesMosaic({
  layouts, selectedId, onSelect, showDebug,
}: {
  layouts: ResolvedLayout[];
  selectedId: string;
  onSelect: (id: string) => void;
  showDebug: boolean;
}) {
  return (
    <div className="mosaic">
      {layouts.map(l => {
        const MAX = 300;
        const scale = Math.min(MAX / l.surface.width, MAX / l.surface.height, 1);
        const isActive = l.surface.id === selectedId;
        return (
          <div
            key={l.surface.id}
            className={`mosaic-card ${isActive ? "mosaic-active" : ""}`}
            onClick={() => onSelect(l.surface.id)}
          >
            <div className="mosaic-preview" style={{ width: l.surface.width * scale, height: l.surface.height * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: l.surface.width, height: l.surface.height }}>
                <AdRenderer layout={l} showDebug={showDebug} />
              </div>
            </div>
            <div className="mosaic-info">
              <div className="mosaic-name">{l.surface.icon} {l.surface.name}</div>
              <div className="mosaic-dims">{l.surface.width}×{l.surface.height}</div>
              <div className="mosaic-badges">
                <StrategyBadge strategy={l.flowStrategy} />
                {l.dropped.length > 0 && (
                  <span className="mosaic-drop-badge">{l.dropped.length} dropped</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  const [selectedId, setSelectedId] = useState(ALL_SURFACES[0].id);
  const [extraSurfaces, setExtraSurfaces] = useState<SurfaceProfile[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const prevIdRef = useRef(selectedId);

  const allSurfaces = useMemo(() => [...ALL_SURFACES, ...extraSurfaces], [extraSurfaces]);

  const selectedSurface = useMemo(
    () => allSurfaces.find(s => s.id === selectedId) ?? allSurfaces[0],
    [allSurfaces, selectedId]
  );

  const layout = useMemo(() => resolveLayout(sonixAdSpec, selectedSurface), [selectedSurface]);

  const allLayouts = useMemo(() => allSurfaces.map(s => resolveLayout(sonixAdSpec, s)), [allSurfaces]);

  const handleSelectSurface = useCallback((id: string) => {
    if (id === selectedId) return;
    setTransitioning(true);
    setTimeout(() => {
      setSelectedId(id);
      prevIdRef.current = id;
      setTimeout(() => setTransitioning(false), 50);
    }, 220);
  }, [selectedId]);

  const handleAddCustomSurface = useCallback((surface: SurfaceProfile) => {
    setExtraSurfaces(prev => [...prev, surface]);
    setShowCustomForm(false);
    setTimeout(() => handleSelectSurface(surface.id), 100);
  }, [handleSelectSurface]);

  const meta = STRATEGY_META[layout.flowStrategy] ?? STRATEGY_META.column;

  return (
    <div className="app">
      <ParticleField />

      {/* Hero header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-hex">⬡</div>
          <div>
            <div className="brand-name">Adaptive Layout Engine</div>
            <div className="brand-tagline">One spec · Any surface · Constraint-resolved</div>
          </div>
        </div>

        <div className="header-center">
          <div className="active-surface-display" style={{ "--s-color": meta.color } as React.CSSProperties}>
            <span className="asd-icon">{selectedSurface.icon}</span>
            <span className="asd-name">{selectedSurface.name}</span>
            <span className="asd-arrow">→</span>
            <span className="asd-strategy" style={{ color: meta.color }}>{layout.flowStrategy}</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            id="btn-debug"
            className={`action-btn ${showDebug ? "btn-active" : ""}`}
            onClick={() => setShowDebug(v => !v)}
          >
            <span className={`action-btn-dot ${showDebug ? "dot-on" : ""}`} />
            Debug
          </button>
          <button
            id="btn-all-surfaces"
            className={`action-btn ${showAll ? "btn-active" : ""}`}
            onClick={() => setShowAll(v => !v)}
          >
            <span>⊞</span> All Surfaces
          </button>
          <button
            id="btn-custom"
            className="action-btn btn-accent"
            onClick={() => setShowCustomForm(true)}
          >
            <span>✨</span> Custom Surface
          </button>
        </div>
      </header>

      {/* Surface selector strip */}
      <div className="surface-strip">
        <div className="surface-strip-track">
          {allSurfaces.map(s => {
            const sl = resolveLayout(sonixAdSpec, s);
            const isActive = s.id === selectedId;
            return (
              <button
                key={s.id}
                id={`surface-tab-${s.id}`}
                className={`surface-chip ${isActive ? "chip-active" : ""} ${s.id.startsWith("custom") ? "chip-custom" : ""}`}
                onClick={() => handleSelectSurface(s.id)}
              >
                <span className="chip-icon">{s.icon}</span>
                <div className="chip-body">
                  <span className="chip-name">{s.name}</span>
                  <span className="chip-dims">{s.width}×{s.height}</span>
                </div>
                {sl.dropped.length > 0 && (
                  <span className="chip-drop-count" title={`${sl.dropped.length} element(s) dropped`}>
                    {sl.dropped.length}✕
                  </span>
                )}
                {isActive && <div className="chip-underline" style={{ background: meta.color }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main area */}
      <main className="app-main">
        {showAll ? (
          <div className="all-view">
            <div className="all-view-header">
              <h2 className="all-view-title">All Surfaces — One Spec</h2>
              <p className="all-view-sub">Click any surface to dive in</p>
            </div>
            <AllSurfacesMosaic
              layouts={allLayouts}
              selectedId={selectedId}
              onSelect={id => { handleSelectSurface(id); setShowAll(false); }}
              showDebug={showDebug}
            />
          </div>
        ) : (
          <div className={`focus-layout ${transitioning ? "fading" : "visible"}`}>
            {/* Left: preview */}
            <section className="preview-section">
              <ScaledPreview layout={layout} showDebug={showDebug} />
            </section>

            {/* Right: info panel */}
            <aside className="info-section">
              {/* Stats row */}
              <div className="stats-row">
                <Stat label="Aspect Ratio" value={layout.aspectRatio.toFixed(2)} />
                <Stat label="Placed" value={layout.placed.length} color="#4ade80" />
                <Stat label="Dropped" value={layout.dropped.length} color={layout.dropped.length > 0 ? "#f87171" : "#4ade80"} />
                <Stat label="Warnings" value={layout.warnings.length} color={layout.warnings.length > 0 ? "#fbbf24" : "#4ade80"} />
              </div>

              {/* Strategy card */}
              <div className="strategy-card" style={{ "--s-color": meta.color } as React.CSSProperties}>
                <div className="strategy-card-label">Flow Strategy</div>
                <StrategyBadge strategy={layout.flowStrategy} />
                <div className="strategy-card-detail">
                  Content rect: {Math.round(layout.contentRect.width)}×{Math.round(layout.contentRect.height)}px
                  {layout.surface.safeArea && (
                    <span> · safe area applied</span>
                  )}
                </div>
              </div>

              {/* Elements */}
              <div className="elements-section">
                <div className="section-title">
                  <span>Elements</span>
                  <span className="section-count">{layout.placed.length}/{sonixAdSpec.elements.length}</span>
                </div>
                <div className="element-cards">
                  {sonixAdSpec.elements.map(el => (
                    <ElementCard
                      key={el.id}
                      layout={layout}
                      elId={el.id}
                      label={(el as { label?: string }).label ?? el.id}
                      role={el.role}
                      priority={el.priority}
                    />
                  ))}
                </div>
              </div>

              {/* Constraints */}
              <div className="constraints-section">
                <div className="section-title">Active Constraints</div>
                <div className="constraint-chips">
                  {layout.surface.constraints.minTapTarget && (
                    <div className="c-chip c-tap">
                      <span>👆</span> minTap: {layout.surface.constraints.minTapTarget}px
                    </div>
                  )}
                  {layout.surface.constraints.minTextSize && (
                    <div className="c-chip c-text">
                      <span>🔤</span> minText: {layout.surface.constraints.minTextSize}px
                    </div>
                  )}
                  {layout.surface.constraints.maxElements && (
                    <div className="c-chip c-max">
                      <span>⬢</span> maxEl: {layout.surface.constraints.maxElements}
                    </div>
                  )}
                  {layout.surface.constraints.touchOnly && (
                    <div className="c-chip c-touch"><span>☝️</span> touchOnly</div>
                  )}
                  {layout.surface.constraints.viewingDistance && (
                    <div className="c-chip c-view"><span>👁</span> {layout.surface.constraints.viewingDistance}</div>
                  )}
                  {layout.surface.constraints.inputModality && (
                    <div className="c-chip c-input"><span>⌨</span> {layout.surface.constraints.inputModality}</div>
                  )}
                </div>
              </div>

              {/* Degradation log */}
              {(layout.dropped.length > 0 || layout.warnings.length > 0) && (
                <div className="degrade-section">
                  <div className="section-title">
                    <span>Degradation Log</span>
                    <span className="degrade-badge">{layout.dropped.length} dropped</span>
                  </div>
                  {layout.dropped.map(d => (
                    <div key={d.id} className="degrade-entry">
                      <div className="degrade-id">✕ {d.id}</div>
                      <div className="degrade-reason-text">{d.reason}</div>
                    </div>
                  ))}
                  {layout.warnings.map((w, i) => (
                    <div key={i} className="warn-entry">⚠ {w}</div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}
      </main>

      {/* Spec footer strip */}
      <div className="spec-strip">
        <div className="spec-strip-label">📋 AD SPEC — <span>sonix-pro-x-launch</span></div>
        <div className="spec-strip-elements">
          {sonixAdSpec.elements.map(el => {
            const r = layout.placed.find(p => p.id === el.id);
            const d = layout.dropped.find(x => x.id === el.id);
            return (
              <div key={el.id} className={`spec-el-chip ${d ? "sec-dropped" : r?.isShrunk ? "sec-shrunk" : "sec-ok"}`}>
                <span className={`sec-role role-${el.role}`}>{el.role}</span>
                <span className="sec-id">{(el as { label?: string }).label ?? el.id}</span>
                <span className="sec-p">P{el.priority}</span>
                {r && <span className="sec-pos">{Math.round(r.rect.x)},{Math.round(r.rect.y)}</span>}
                {d && <span className="sec-drop">✕</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom surface modal */}
      {showCustomForm && (
        <CustomSurfaceForm onAdd={handleAddCustomSurface} onClose={() => setShowCustomForm(false)} />
      )}
    </div>
  );
}
