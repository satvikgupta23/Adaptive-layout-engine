import React, { useState, useMemo, useCallback } from "react";
import { resolveLayout } from "./resolver";
import { ALL_SURFACES, defineSurface } from "./surfaces";
import { sonixAdSpec } from "./adSpec";
import type { SurfaceProfile } from "./surfaces";
import type { ResolvedLayout } from "./resolver";
import type { AdSpec } from "./spec";
import { DeviceFrame } from "./DeviceFrame";
import type { DeviceType } from "./DeviceFrame";
import { InteractiveResizer } from "./InteractiveResizer";
import { CampaignEditor } from "./CampaignEditor";
import type { ThemePreset } from "./CampaignEditor";
import { SolverPipeline } from "./SolverPipeline";
import { ExportModal } from "./ExportModal";
import { sound } from "./sound";
import { AdRenderer } from "./render-dom";
import { InteractiveBackground } from "./InteractiveBackground";
import type { BgMode } from "./InteractiveBackground";
import "./App.css";

export type WorkspaceLayout = "split" | "cinema" | "triad";
export type SidebarTab = "stats" | "campaign" | "pipeline" | "constraints" | "degrade";

// ---------------------------------------------------------------------------
// Strategy metadata
// ---------------------------------------------------------------------------
const STRATEGY_META: Record<string, { label: string; color: string; desc: string }> = {
  column: { label: "Column Stack", color: "#a78bfa", desc: "Vertical cascade for tall portrait screens" },
  row: { label: "Row Split", color: "#38bdf8", desc: "Horizontal dual-zone division for landscape" },
  grid: { label: "2×2 Quadrant", color: "#4ade80", desc: "Balanced quadrant composition for square screens" },
  "broadcast-strip": { label: "Broadcast Strip", color: "#f87171", desc: "Single-line ultra-wide telemetry ticker" },
};

function StrategyBadge({ strategy }: { strategy: string }) {
  const meta = STRATEGY_META[strategy] ?? { label: strategy, color: "#888", desc: "" };
  return (
    <div className="strategy-pill" style={{ "--s-color": meta.color } as React.CSSProperties}>
      <span className="strategy-pill-dot" />
      <span className="strategy-pill-label">{meta.label}</span>
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
// Stat block
// ---------------------------------------------------------------------------
function Stat({ label, value, color, unit }: { label: string; value: string | number; color?: string; unit?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : {}}>
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// All Surfaces Mosaic view
// ---------------------------------------------------------------------------
function AllSurfacesMosaic({
  layouts,
  selectedId,
  onSelect,
  showDebug,
}: {
  layouts: ResolvedLayout[];
  selectedId: string;
  onSelect: (id: string) => void;
  showDebug: boolean;
}) {
  return (
    <div className="mosaic">
      {layouts.map(l => {
        const MAX = 280;
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
              <div className="mosaic-dims">{l.surface.width}×{l.surface.height} (AR: {l.aspectRatio.toFixed(2)})</div>
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
// Custom Surface Modal
// ---------------------------------------------------------------------------
function CustomSurfaceForm({ onAdd, onClose }: { onAdd: (s: SurfaceProfile) => void; onClose: () => void }) {
  const [w, setW] = useState("800");
  const [h, setH] = useState("600");
  const [name, setName] = useState("Custom Surface");
  const [minTap, setMinTap] = useState("44");
  const [minText, setMinText] = useState("14");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">✨ Define Any Custom Surface</div>
          <div className="modal-sub">Unknown at design-time: resolver adapts mathematically without hardcoding</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Surface Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Times Square Billboard" />
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
          <button type="submit" className="form-submit">
            Resolve Surface →
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Application Component
// ---------------------------------------------------------------------------
export default function App(): React.ReactElement {
  // State
  const [currentSpec, setCurrentSpec] = useState<AdSpec>(sonixAdSpec);
  const [selectedId, setSelectedId] = useState<string>(ALL_SURFACES[0].id);
  const [extraSurfaces, setExtraSurfaces] = useState<SurfaceProfile[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<string>("nebula");

  // Interactive Background & Formatting states
  const [bgMode, setBgMode] = useState<BgMode>("cyber-grid");
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>("split");
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("stats");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Dynamic Fluid Dimensions (for interactive resizer)
  const [freeformWidth, setFreeformWidth] = useState<number>(ALL_SURFACES[0].width);
  const [freeformHeight, setFreeformHeight] = useState<number>(ALL_SURFACES[0].height);
  const [isFreeformActive, setIsFreeformActive] = useState<boolean>(false);

  // Interactive Constraints Lab state (live tweaks)
  const [customMinTap, setCustomMinTap] = useState<number>(44);
  const [customMinText, setCustomMinText] = useState<number>(14);

  // View Options
  const [deviceType, setDeviceType] = useState<DeviceType>("auto");
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [showAll, setShowAll] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showCustomForm, setShowCustomForm] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [scaleFactor, setScaleFactor] = useState<number>(1);

  // Surface list
  const allSurfaces = useMemo(() => [...ALL_SURFACES, ...extraSurfaces], [extraSurfaces]);

  const activeSurface = useMemo(() => {
    const base = allSurfaces.find(s => s.id === selectedId) ?? allSurfaces[0];
    if (!isFreeformActive) {
      return base;
    }

    return defineSurface({
      ...base,
      id: `freeform-${base.id}`,
      name: `${base.name} (Fluid)`,
      width: freeformWidth,
      height: freeformHeight,
      constraints: {
        ...base.constraints,
        minTapTarget: customMinTap || base.constraints.minTapTarget,
        minTextSize: customMinText || base.constraints.minTextSize,
      },
    });
  }, [allSurfaces, selectedId, isFreeformActive, freeformWidth, freeformHeight, customMinTap, customMinText]);

  // Resolve layout
  const layout = useMemo(() => resolveLayout(currentSpec, activeSurface), [currentSpec, activeSurface]);
  const allLayouts = useMemo(() => allSurfaces.map(s => resolveLayout(currentSpec, s)), [allSurfaces, currentSpec]);

  // Triad layout surfaces (Mobile, Broadcast, Kiosk)
  const triadLayouts = useMemo(() => {
    const s1 = allSurfaces.find(s => s.id === "mobile-interstitial") ?? allSurfaces[0];
    const s2 = allSurfaces.find(s => s.id === "broadcast-lower-third") ?? allSurfaces[2];
    const s3 = allSurfaces.find(s => s.id === "retail-kiosk") ?? allSurfaces[3];
    return [
      { surface: s1, layout: resolveLayout(currentSpec, s1), device: "phone" as DeviceType },
      { surface: s2, layout: resolveLayout(currentSpec, s2), device: "tv" as DeviceType },
      { surface: s3, layout: resolveLayout(currentSpec, s3), device: "kiosk" as DeviceType },
    ];
  }, [allSurfaces, currentSpec]);

  // Surface selection
  const handleSelectSurface = useCallback((id: string) => {
    sound.playSwitch();
    setSelectedId(id);
    setIsFreeformActive(false);
    const s = allSurfaces.find(x => x.id === id);
    if (s) {
      setFreeformWidth(s.width);
      setFreeformHeight(s.height);
      setCustomMinTap(s.constraints.minTapTarget ?? 44);
      setCustomMinText(s.constraints.minTextSize ?? 14);
    }
  }, [allSurfaces]);

  // Dimension drag change
  const handleDimensionChange = useCallback((w: number, h: number) => {
    setIsFreeformActive(true);
    setFreeformWidth(w);
    setFreeformHeight(h);
  }, []);

  // Audio Toggle
  const toggleSound = () => {
    sound.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) sound.playSwitch();
  };

  // Theme selection
  const handleSelectTheme = (preset: ThemePreset) => {
    setActiveThemeId(preset.id);
    setCurrentSpec(prev => ({
      ...prev,
      theme: {
        primary: preset.primary,
        accent: preset.accent,
        background: preset.background,
        surface: preset.surface,
        textPrimary: preset.textPrimary,
        textSecondary: `${preset.textPrimary}b3`,
      },
    }));
  };

  // Reset Campaign Spec
  const handleResetSpec = () => {
    setCurrentSpec(sonixAdSpec);
    setActiveThemeId("nebula");
  };

  // Custom Surface Add
  const handleAddCustomSurface = useCallback((surface: SurfaceProfile) => {
    sound.playSwitch();
    setExtraSurfaces(prev => [...prev, surface]);
    setShowCustomForm(false);
    setSelectedId(surface.id);
    setFreeformWidth(surface.width);
    setFreeformHeight(surface.height);
    setIsFreeformActive(false);
  }, []);

  // Compute adaptive preview scale
  const autoScale = useMemo(() => {
    const maxW = workspaceLayout === "cinema" ? 780 : 560;
    const maxH = workspaceLayout === "cinema" ? 560 : 440;
    return Math.min(maxW / activeSurface.width, maxH / activeSurface.height, 1);
  }, [activeSurface.width, activeSurface.height, workspaceLayout]);

  const effectiveScale = autoScale * scaleFactor;
  const meta = STRATEGY_META[layout.flowStrategy] ?? STRATEGY_META.column;

  return (
    <div className={`app layout-${workspaceLayout}`}>
      {/* ── INTERACTIVE DYNAMIC BACKGROUND CANVAS ── */}
      <InteractiveBackground mode={bgMode} onModeChange={setBgMode} />

      {/* ── TOP HEADER ── */}
      <header className="app-header">
        <div className="header-left">
          <div className="brand-hex">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div className="brand-titles">
            <div className="brand-name">
              Adaptive Layout Studio
              <span className="brand-badge">v2.0 PRO</span>
            </div>
            <div className="brand-tagline">Constraint-Driven Cross-Surface Ad Engine</div>
          </div>
        </div>

        {/* Center: Live Strategy Badge */}
        <div className="header-center">
          <div className="active-pill" style={{ "--s-color": meta.color } as React.CSSProperties}>
            <span className="active-pill-icon">{activeSurface.icon}</span>
            <span className="active-pill-title">{activeSurface.name}</span>
            <span className="active-pill-arrow">→</span>
            <span className="active-pill-strategy" style={{ color: meta.color }}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* Right: Interactive Format Switcher & Tools */}
        <div className="header-actions">
          {/* Format / Workspace Mode Selector */}
          <div className="format-mode-bar">
            <button
              className={`format-btn ${workspaceLayout === "split" ? "format-active" : ""}`}
              onClick={() => {
                sound.playClick();
                setWorkspaceLayout("split");
                setShowAll(false);
              }}
              title="Studio Split View (Canvas + Inspector Dock)"
            >
              <span>🖥️</span> Studio
            </button>
            <button
              className={`format-btn ${workspaceLayout === "cinema" ? "format-active" : ""}`}
              onClick={() => {
                sound.playClick();
                setWorkspaceLayout("cinema");
                setShowAll(false);
              }}
              title="Cinema Showcase View (Full focus grand stage)"
            >
              <span>🎬</span> Cinema
            </button>
            <button
              className={`format-btn ${workspaceLayout === "triad" ? "format-active" : ""}`}
              onClick={() => {
                sound.playClick();
                setWorkspaceLayout("triad");
                setShowAll(false);
              }}
              title="Synchronized Triad Wall (Phone + TV + Kiosk live together)"
            >
              <span>📱</span> Triad Wall
            </button>
          </div>

          {/* Audio toggle */}
          <button
            className={`action-btn icon-only-btn ${soundEnabled ? "btn-active" : ""}`}
            onClick={toggleSound}
            title={soundEnabled ? "Mute tactile audio" : "Enable tactile audio"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>

          {/* Device Mockup Switcher */}
          <div className="device-select-box">
            <span className="select-icon">🖥️</span>
            <select
              value={deviceType}
              onChange={e => {
                sound.playClick();
                setDeviceType(e.target.value as DeviceType);
              }}
              title="Select realistic device frame"
            >
              <option value="auto">Auto Frame</option>
              <option value="phone">iPhone 16 Pro</option>
              <option value="tv">Broadcast TV (4K)</option>
              <option value="kiosk">Retail Kiosk</option>
              <option value="clean">Clean Studio</option>
            </select>
          </div>

          {/* Debug Overlay */}
          <button
            id="btn-debug"
            className={`action-btn ${showDebug ? "btn-active" : ""}`}
            onClick={() => {
              sound.playClick();
              setShowDebug(v => !v);
            }}
          >
            <span className={`dot-indicator ${showDebug ? "dot-active" : ""}`} />
            Debug
          </button>

          {/* All Surfaces Matrix */}
          <button
            id="btn-all-surfaces"
            className={`action-btn ${showAll ? "btn-active" : ""}`}
            onClick={() => {
              sound.playClick();
              setShowAll(v => !v);
            }}
          >
            <span>⊞</span> Matrix
          </button>

          {/* Custom Surface */}
          <button
            id="btn-custom"
            className="action-btn btn-gradient"
            onClick={() => {
              sound.playClick();
              setShowCustomForm(true);
            }}
          >
            <span>✨</span> New Surface
          </button>

          {/* Export */}
          <button
            className="action-btn btn-export"
            onClick={() => {
              sound.playClick();
              setShowExportModal(true);
            }}
          >
            <span>📦</span> Export
          </button>
        </div>
      </header>

      {/* ── SURFACE PRESET HORIZONTAL CHIP STRIP ── */}
      <div className="surface-strip">
        <div className="surface-strip-label">PRESET SURFACES:</div>
        <div className="surface-strip-track">
          {allSurfaces.map(s => {
            const sl = resolveLayout(currentSpec, s);
            const isActive = !isFreeformActive && s.id === selectedId;
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
                  <span className="chip-drop-count" title={`${sl.dropped.length} elements dropped under constraints`}>
                    {sl.dropped.length}✕
                  </span>
                )}
                {isActive && <div className="chip-glow-underline" style={{ background: meta.color }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN WORKSPACE (INTERACTIVE FORMATTING) ── */}
      <main className="app-main">
        {showAll ? (
          /* Multi-surface side-by-side grid */
          <div className="all-view">
            <div className="all-view-header">
              <div>
                <h2 className="all-view-title">Multi-Surface Comparison Matrix</h2>
                <p className="all-view-sub">
                  One declarative AdSpec correctly adapted across wildly different aspect ratios, without per-surface hardcoded layouts.
                </p>
              </div>
              <button className="action-btn btn-accent" onClick={() => setShowAll(false)}>
                ← Back to Studio
              </button>
            </div>
            <AllSurfacesMosaic
              layouts={allLayouts}
              selectedId={selectedId}
              onSelect={id => {
                handleSelectSurface(id);
                setShowAll(false);
              }}
              showDebug={showDebug}
            />
          </div>
        ) : workspaceLayout === "triad" ? (
          /* ── FORMAT 3: SYNCHRONIZED TRIAD WALL ── */
          <div className="triad-wall">
            <div className="triad-header">
              <div>
                <h2 className="triad-title">Synchronized Multi-Device Live Wall</h2>
                <p className="triad-sub">
                  Watch three fundamentally different surfaces adapt simultaneously in real time as you edit content or tweak constraints.
                </p>
              </div>
              <button
                className="action-btn btn-gradient"
                onClick={() => {
                  sound.playClick();
                  setWorkspaceLayout("split");
                  setActiveSidebarTab("campaign");
                }}
              >
                🎨 Open Campaign Studio
              </button>
            </div>

            <div className="triad-grid">
              {triadLayouts.map(item => (
                <div key={item.surface.id} className="triad-card">
                  <div className="triad-card-header">
                    <span className="triad-icon">{item.surface.icon}</span>
                    <div className="triad-name-box">
                      <span className="triad-name">{item.surface.name}</span>
                      <span className="triad-dims">{item.surface.width}×{item.surface.height} (AR: {item.layout.aspectRatio.toFixed(2)})</span>
                    </div>
                    <StrategyBadge strategy={item.layout.flowStrategy} />
                  </div>
                  <div className="triad-device-viewport">
                    <DeviceFrame
                      layout={item.layout}
                      showDebug={showDebug}
                      deviceType={item.device}
                      scale={Math.min(340 / item.surface.width, 340 / item.surface.height, 0.9)}
                    />
                  </div>
                  <div className="triad-footer">
                    <span className="triad-status">
                      {item.layout.placed.length} placed · {item.layout.dropped.length} dropped
                    </span>
                    <button
                      className="triad-inspect-btn"
                      onClick={() => {
                        handleSelectSurface(item.surface.id);
                        setWorkspaceLayout("split");
                      }}
                    >
                      Focus in Studio →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── FORMAT 1 & 2: STUDIO SPLIT OR CINEMA FOCUS ── */
          <div className={`studio-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
            {/* Center Canvas */}
            <div className="canvas-section">
              <InteractiveResizer
                currentWidth={activeSurface.width}
                currentHeight={activeSurface.height}
                onChange={handleDimensionChange}
                aspectRatio={layout.aspectRatio}
                flowStrategy={layout.flowStrategy}
                placedCount={layout.placed.length}
                totalCount={currentSpec.elements.length}
              >
                <div className="preview-centering-wrap">
                  <DeviceFrame
                    layout={layout}
                    showDebug={showDebug}
                    deviceType={deviceType}
                    scale={effectiveScale}
                  />
                </div>
              </InteractiveResizer>

              {/* Viewport Scale Control Slider */}
              <div className="zoom-bar">
                <span className="zoom-label">Canvas Zoom:</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.6"
                  step="0.05"
                  value={scaleFactor}
                  onChange={e => setScaleFactor(parseFloat(e.target.value))}
                />
                <span className="zoom-value">{Math.round(scaleFactor * 100)}%</span>
                <button className="zoom-reset" onClick={() => setScaleFactor(1)}>Reset</button>

                {workspaceLayout === "cinema" && (
                  <button
                    className="action-btn icon-only-btn"
                    style={{ marginLeft: "auto" }}
                    onClick={() => {
                      sound.playClick();
                      setWorkspaceLayout("split");
                    }}
                    title="Exit Cinema View"
                  >
                    Exit Cinema ✕
                  </button>
                )}
              </div>
            </div>

            {/* Right: Interactive Tabbed Telemetry Dock */}
            {workspaceLayout === "split" && (
              <aside className="sidebar-dock">
                {/* Dock Header Tabs */}
                <div className="dock-tabs">
                  <button
                    className={`dock-tab ${activeSidebarTab === "stats" ? "tab-active" : ""}`}
                    onClick={() => {
                      sound.playClick();
                      setActiveSidebarTab("stats");
                    }}
                    title="Real-time Layout Telemetry"
                  >
                    📊 Stats
                  </button>
                  <button
                    className={`dock-tab ${activeSidebarTab === "campaign" ? "tab-active" : ""}`}
                    onClick={() => {
                      sound.playClick();
                      setActiveSidebarTab("campaign");
                    }}
                    title="Campaign Copy, Priorities & Themes"
                  >
                    🎨 Campaign
                  </button>
                  <button
                    className={`dock-tab ${activeSidebarTab === "pipeline" ? "tab-active" : ""}`}
                    onClick={() => {
                      sound.playClick();
                      setActiveSidebarTab("pipeline");
                    }}
                    title="6-Stage Algorithmic Resolution Pipeline"
                  >
                    ⚡ Pipeline
                  </button>
                  <button
                    className={`dock-tab ${activeSidebarTab === "constraints" ? "tab-active" : ""}`}
                    onClick={() => {
                      sound.playClick();
                      setActiveSidebarTab("constraints");
                    }}
                    title="Interactive Constraint Testing Lab"
                  >
                    🛡️ Lab
                  </button>

                  <button
                    className="dock-tab dock-collapse-btn"
                    onClick={() => {
                      sound.playClick();
                      setSidebarCollapsed(v => !v);
                    }}
                    title={sidebarCollapsed ? "Expand Inspector Dock" : "Collapse Inspector Dock"}
                  >
                    {sidebarCollapsed ? "◀" : "▶"}
                  </button>
                </div>

                {/* Tab Content Panes */}
                <div className="dock-content">
                  {activeSidebarTab === "stats" && (
                    <div className="dock-pane stats-pane">
                      {/* Top Stats */}
                      <div className="stats-grid">
                        <Stat label="Aspect Ratio" value={layout.aspectRatio.toFixed(2)} unit=":1" />
                        <Stat label="Placed Elements" value={layout.placed.length} color="#4ade80" />
                        <Stat
                          label="Dropped Elements"
                          value={layout.dropped.length}
                          color={layout.dropped.length > 0 ? "#f87171" : "#4ade80"}
                        />
                        <Stat
                          label="Scale Adjustments"
                          value={layout.placed.filter(p => p.isShrunk).length}
                          color="#fbbf24"
                        />
                      </div>

                      {/* Flow Strategy Card */}
                      <div className="strategy-feature-card" style={{ "--s-color": meta.color } as React.CSSProperties}>
                        <div className="feature-card-header">
                          <span className="feature-tag">RESOLVED STRATEGY</span>
                          <span className="feature-value" style={{ color: meta.color }}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="feature-desc">{meta.desc}</p>
                        <div className="feature-metrics">
                          <div className="fm-item">
                            <span className="fm-key">Content Rect:</span>
                            <span className="fm-val">{Math.round(layout.contentRect.width)}×{Math.round(layout.contentRect.height)}px</span>
                          </div>
                          {layout.surface.safeArea && (
                            <div className="fm-item">
                              <span className="fm-key">Safe Margin:</span>
                              <span className="fm-val">
                                T:{layout.surface.safeArea.top} B:{layout.surface.safeArea.bottom} L:{layout.surface.safeArea.left} R:{layout.surface.safeArea.right}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Elements Placement Hierarchy */}
                      <div className="sidebar-card">
                        <div className="card-header-row">
                          <span className="card-title">Element Resolution Ledger</span>
                          <span className="card-count">{layout.placed.length}/{currentSpec.elements.length} placed</span>
                        </div>
                        <div className="element-cards-list">
                          {currentSpec.elements.map(el => (
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
                    </div>
                  )}

                  {activeSidebarTab === "campaign" && (
                    <div className="dock-pane campaign-pane">
                      <CampaignEditor
                        adSpec={currentSpec}
                        onChange={setCurrentSpec}
                        onReset={handleResetSpec}
                        activeThemeId={activeThemeId}
                        onSelectTheme={handleSelectTheme}
                      />
                    </div>
                  )}

                  {activeSidebarTab === "pipeline" && (
                    <div className="dock-pane pipeline-pane">
                      <SolverPipeline layout={layout} />
                    </div>
                  )}

                  {activeSidebarTab === "constraints" && (
                    <div className="dock-pane constraints-pane">
                      <div className="sidebar-card">
                        <div className="card-header-row">
                          <span className="card-title">🧪 Live Constraint Testing Lab</span>
                        </div>
                        <p className="feature-desc">
                          Tweak constraints in real time to observe how the mathematical solver guarantees readability and touch accessibility.
                        </p>

                        <div className="lab-controls">
                          <div className="lab-control-row">
                            <div className="lab-label-row">
                              <span className="lab-label">Min Tap Target (Touch Target)</span>
                              <span className="lab-val">{customMinTap}px</span>
                            </div>
                            <input
                              type="range"
                              min="24"
                              max="88"
                              step="2"
                              value={customMinTap}
                              onChange={e => {
                                setIsFreeformActive(true);
                                setCustomMinTap(parseInt(e.target.value, 10));
                              }}
                            />
                          </div>

                          <div className="lab-control-row">
                            <div className="lab-label-row">
                              <span className="lab-label">Min Font Size (Legibility)</span>
                              <span className="lab-val">{customMinText}px</span>
                            </div>
                            <input
                              type="range"
                              min="8"
                              max="48"
                              step="1"
                              value={customMinText}
                              onChange={e => {
                                setIsFreeformActive(true);
                                setCustomMinText(parseInt(e.target.value, 10));
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Active Surface Constraints */}
                      <div className="sidebar-card">
                        <div className="card-header-row">
                          <span className="card-title">Active Surface Profile Constraints</span>
                        </div>
                        <div className="constraint-tags">
                          {layout.surface.constraints.minTapTarget && (
                            <div className="c-tag">
                              <span>👆</span> minTapTarget: <strong>{layout.surface.constraints.minTapTarget}px</strong>
                            </div>
                          )}
                          {layout.surface.constraints.minTextSize && (
                            <div className="c-tag">
                              <span>🔤</span> minTextSize: <strong>{layout.surface.constraints.minTextSize}px</strong>
                            </div>
                          )}
                          {layout.surface.constraints.maxElements && (
                            <div className="c-tag">
                              <span>⬢</span> maxElements: <strong>{layout.surface.constraints.maxElements}</strong>
                            </div>
                          )}
                          {layout.surface.constraints.touchOnly && (
                            <div className="c-tag"><span>☝️</span> touchOnly: <strong>true</strong></div>
                          )}
                          {layout.surface.constraints.viewingDistance && (
                            <div className="c-tag"><span>👁️</span> distance: <strong>{layout.surface.constraints.viewingDistance}</strong></div>
                          )}
                          {layout.surface.constraints.inputModality && (
                            <div className="c-tag"><span>⌨️</span> modality: <strong>{layout.surface.constraints.inputModality}</strong></div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSidebarTab === "degrade" && (
                    <div className="dock-pane degrade-pane">
                      <div className="sidebar-card drop-ledger-card">
                        <div className="card-header-row">
                          <span className="card-title error-text">Constraint Drop Auditor</span>
                          <span className="drop-pill">{layout.dropped.length} omitted</span>
                        </div>
                        {layout.dropped.length > 0 ? (
                          <div className="drop-list">
                            {layout.dropped.map(d => (
                              <div key={d.id} className="drop-item">
                                <div className="drop-id">✕ {d.id}</div>
                                <div className="drop-reason">{d.reason}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="feature-desc" style={{ color: "var(--emerald)" }}>
                            ✓ Zero dropped elements. The surface budget accommodates all content elements.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </main>

      {/* ── MODALS ── */}
      {showCustomForm && (
        <CustomSurfaceForm onAdd={handleAddCustomSurface} onClose={() => setShowCustomForm(false)} />
      )}

      {showExportModal && (
        <ExportModal layout={layout} onClose={() => setShowExportModal(false)} />
      )}
    </div>
  );
}
