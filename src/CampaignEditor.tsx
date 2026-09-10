/**
 * CampaignEditor.tsx
 * ------------------
 * Interactive Ad Spec customization studio.
 * Lets users modify headline copy, CTA labels, toggle elements,
 * change element priority rankings, and switch theme palettes.
 */

import React from "react";
import type { AdSpec, Priority } from "./spec";
import { sound } from "./sound";

export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  accent: string;
  background: string;
  surface: string;
  textPrimary: string;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: "nebula",
    name: "🪐 Nebula Violet",
    primary: "#667eea",
    accent: "#f7931e",
    background: "#080816",
    surface: "#101026",
    textPrimary: "#ffffff",
  },
  {
    id: "cyber",
    name: "⚡ Cyber Neon",
    primary: "#06b6d4",
    accent: "#f43f5e",
    background: "#060b14",
    surface: "#0e1a2d",
    textPrimary: "#f0fdff",
  },
  {
    id: "gold",
    name: "🏆 24K Obsidian",
    primary: "#f59e0b",
    accent: "#ef4444",
    background: "#0d0b07",
    surface: "#211b0e",
    textPrimary: "#fffbeb",
  },
  {
    id: "emerald",
    name: "🌲 Emerald Titanium",
    primary: "#10b981",
    accent: "#38bdf8",
    background: "#05110d",
    surface: "#0d281e",
    textPrimary: "#ecfdf5",
  },
];

interface CampaignEditorProps {
  adSpec: AdSpec;
  onChange: (updatedSpec: AdSpec) => void;
  onReset: () => void;
  activeThemeId: string;
  onSelectTheme: (preset: ThemePreset) => void;
}

export function CampaignEditor({
  adSpec,
  onChange,
  onReset,
  activeThemeId,
  onSelectTheme,
}: CampaignEditorProps): React.ReactElement {

  // Update text content
  const handleTextChange = (id: string, newContent: string) => {
    const updatedElements = adSpec.elements.map(el => {
      if (el.id === id && el.type === "text") {
        return { ...el, content: newContent };
      }
      return el;
    });
    onChange({ ...adSpec, elements: updatedElements });
  };

  // Update button label
  const handleButtonChange = (id: string, newLabel: string) => {
    const updatedElements = adSpec.elements.map(el => {
      if (el.id === id && el.type === "button") {
        return { ...el, label: newLabel };
      }
      return el;
    });
    onChange({ ...adSpec, elements: updatedElements });
  };

  // Remove element
  const handleRemoveElement = (id: string) => {
    sound.playDrop();
    if (adSpec.elements.length <= 2) return;
    onChange({
      ...adSpec,
      elements: adSpec.elements.filter(el => el.id !== id),
    });
  };

  // Change priority
  const handlePriorityChange = (id: string, newPriority: Priority) => {
    sound.playClick();
    const updatedElements = adSpec.elements.map(el => {
      if (el.id === id) {
        return { ...el, priority: newPriority };
      }
      return el;
    });
    onChange({ ...adSpec, elements: updatedElements });
  };

  const headlineEl = adSpec.elements.find(el => el.id === "headline");
  const ctaEl = adSpec.elements.find(el => el.id === "cta");
  const priceEl = adSpec.elements.find(el => el.id === "price");

  return (
    <div className="campaign-editor">
      <div className="editor-header">
        <div className="editor-title">
          <span className="editor-icon">🎨</span>
          <span>Live Campaign Studio</span>
        </div>
        <button className="editor-reset-btn" onClick={() => { sound.playClick(); onReset(); }}>
          ↺ Reset Spec
        </button>
      </div>

      {/* Theme Presets */}
      <div className="editor-section">
        <div className="editor-section-label">Color Theme Palette</div>
        <div className="theme-grid">
          {THEME_PRESETS.map(preset => (
            <button
              key={preset.id}
              className={`theme-chip ${activeThemeId === preset.id ? "theme-active" : ""}`}
              onClick={() => { sound.playSwitch(); onSelectTheme(preset); }}
            >
              <span className="theme-dot" style={{ background: preset.primary }} />
              <span className="theme-name">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Content Copy */}
      <div className="editor-section">
        <div className="editor-section-label">Ad Copy & Messaging</div>
        
        {headlineEl && headlineEl.type === "text" && (
          <div className="editor-field">
            <label>Headline Copy</label>
            <input
              type="text"
              value={headlineEl.content}
              onChange={e => handleTextChange("headline", e.target.value)}
              placeholder="Enter headline..."
            />
          </div>
        )}

        {priceEl && priceEl.type === "text" && (
          <div className="editor-field">
            <label>Supporting Copy / Price</label>
            <input
              type="text"
              value={priceEl.content}
              onChange={e => handleTextChange("price", e.target.value)}
              placeholder="Enter price or subtitle..."
            />
          </div>
        )}

        {ctaEl && ctaEl.type === "button" && (
          <div className="editor-field">
            <label>Call-to-Action Text</label>
            <input
              type="text"
              value={ctaEl.label}
              onChange={e => handleButtonChange("cta", e.target.value)}
              placeholder="e.g. Shop Now, Learn More..."
            />
          </div>
        )}
      </div>

      {/* Elements & Priority Matrix */}
      <div className="editor-section">
        <div className="editor-section-label">
          <span>Element Priority Hierarchy</span>
          <span className="editor-subhint">P1 = Never Drop · P3 = Dropped First</span>
        </div>

        <div className="element-toggle-list">
          {adSpec.elements.map(el => (
            <div key={el.id} className="el-toggle-item">
              <div className="el-toggle-left">
                <span className={`el-badge role-${el.role}`}>{el.role}</span>
                <span className="el-toggle-name">{(el as { label?: string }).label ?? el.id}</span>
              </div>
              <div className="el-priority-stepper">
                <span className="priority-label">Priority:</span>
                {[1, 2, 3].map(p => (
                  <button
                    key={p}
                    className={`priority-num ${el.priority === p ? "priority-selected" : ""}`}
                    onClick={() => handlePriorityChange(el.id, p as Priority)}
                  >
                    P{p}
                  </button>
                ))}
                {adSpec.elements.length > 2 && (
                  <button
                    className="priority-num"
                    style={{ color: "var(--rose)", marginLeft: "4px" }}
                    onClick={() => handleRemoveElement(el.id)}
                    title="Remove this element from spec"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
