/**
 * render-dom.tsx
 * -------------
 * DOM/React renderer for a ResolvedLayout.
 * Zero knowledge of resolver algorithm — reads only ResolvedLayout.
 */

import React from "react";
import type { ResolvedLayout, ResolvedElement } from "./resolver";
import type { AdElement, TextElement, ImageElement, ButtonElement } from "./spec";

// ---------------------------------------------------------------------------
// Role → visual style mapping
// ---------------------------------------------------------------------------

function getRoleStyles(el: AdElement, resolved: ResolvedElement): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    left: resolved.rect.x,
    top: resolved.rect.y,
    width: resolved.rect.width,
    height: resolved.rect.height,
    boxSizing: "border-box",
    overflow: "hidden",
    transition: "all 0.38s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  switch (el.role) {
    case "hero":
      return {
        ...base,
        borderRadius: 10,
        overflow: "hidden",
        background: "linear-gradient(135deg, #0d0d24 0%, #101028 50%, #0a0a20 100%)",
      };

    case "branding":
      return {
        ...base,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 6,
      };

    case "primary":
      return {
        ...base,
        display: "flex",
        alignItems: "center",
        padding: "4px 10px",
        fontWeight: 900,
        lineHeight: 1.1,
        letterSpacing: "-0.03em",
        color: "#ffffff",
        fontSize: resolved.fontSize ?? 20,
        textShadow: "0 2px 16px rgba(0,0,0,0.6)",
        fontFamily: "'Inter', system-ui, sans-serif",
      };

    case "secondary":
      return {
        ...base,
        display: "flex",
        alignItems: "center",
        padding: "2px 10px",
        fontWeight: 600,
        color: "rgba(255,255,255,0.75)",
        fontSize: resolved.fontSize ?? 14,
        fontFamily: "'Inter', system-ui, sans-serif",
        letterSpacing: "0.01em",
      };

    case "badge":
      return {
        ...base,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        background: "linear-gradient(135deg, #ff6b35, #f7931e)",
        fontWeight: 800,
        color: "#fff",
        fontSize: resolved.fontSize ?? 13,
        boxShadow: "0 4px 20px rgba(255,107,53,0.6)",
        padding: "2px 8px",
        letterSpacing: "0.02em",
        fontFamily: "'Inter', system-ui, sans-serif",
      };

    case "action":
      return {
        ...base,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        background: "linear-gradient(135deg, #667eea, #764ba2)",
        fontWeight: 800,
        color: "#fff",
        fontSize: Math.min((resolved.fontSize ?? 16), resolved.rect.height * 0.42),
        letterSpacing: "0.05em",
        cursor: "pointer",
        boxShadow: "0 4px 24px rgba(102,126,234,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
        border: "none",
        gap: 8,
        userSelect: "none",
        fontFamily: "'Inter', system-ui, sans-serif",
        textTransform: "uppercase" as const,
      };

    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Individual element renderers
// ---------------------------------------------------------------------------

function renderHero(el: ImageElement, resolved: ResolvedElement): React.ReactElement {
  return (
    <div key={el.id} style={getRoleStyles(el, resolved)}>
      <img
        src={el.src}
        alt={el.alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          transition: "transform 0.6s ease",
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      {/* Cinematic gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function renderBranding(el: ImageElement, resolved: ResolvedElement): React.ReactElement {
  return (
    <div key={el.id} style={getRoleStyles(el, resolved)}>
      <img
        src={el.src}
        alt={el.alt}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          filter: "brightness(0) invert(1)",
          opacity: 0.85,
          transition: "opacity 0.3s",
        }}
        onError={(e) => {
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent) {
            (e.target as HTMLImageElement).style.display = "none";
            parent.style.fontWeight = "900";
            parent.style.color = "rgba(255,255,255,0.85)";
            parent.style.fontSize = `${Math.min(resolved.rect.height * 0.45, 18)}px`;
            parent.style.letterSpacing = "0.18em";
            parent.style.fontFamily = "Inter, system-ui, sans-serif";
            parent.innerText = el.alt.toUpperCase();
          }
        }}
      />
    </div>
  );
}

function renderText(el: TextElement, resolved: ResolvedElement): React.ReactElement {
  return (
    <div key={el.id} style={getRoleStyles(el, resolved)}>
      <span
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: el.multiline ? 3 : 1,
          overflow: "hidden",
          width: "100%",
        }}
      >
        {el.content}
      </span>
    </div>
  );
}

function renderButton(el: ButtonElement, resolved: ResolvedElement): React.ReactElement {
  return (
    <button
      key={el.id}
      style={getRoleStyles(el, resolved)}
      type="button"
    >
      {el.icon && (
        <span style={{ fontSize: "1em", lineHeight: 1, fontStyle: "normal" }}>{el.icon}</span>
      )}
      <span>{el.label}</span>
    </button>
  );
}

function renderElement(resolved: ResolvedElement): React.ReactElement | null {
  const el = resolved.element;
  switch (el.type) {
    case "image":
      return el.role === "hero"
        ? renderHero(el, resolved)
        : renderBranding(el, resolved);
    case "text":
      return renderText(el, resolved);
    case "button":
      return renderButton(el, resolved);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Debug overlay
// ---------------------------------------------------------------------------

const ZONE_COLORS: Record<string, string> = {
  "top-left":    "rgba(248,113,113,0.12)",
  "top-right":   "rgba(96,165,250,0.12)",
  "bottom-left": "rgba(74,222,128,0.12)",
  "bottom-right":"rgba(251,191,36,0.12)",
  top:           "rgba(248,113,113,0.08)",
  middle:        "rgba(167,139,250,0.08)",
  bottom:        "rgba(74,222,128,0.08)",
  left:          "rgba(251,146,60,0.12)",
  right:         "rgba(96,165,250,0.12)",
  center:        "rgba(251,191,36,0.08)",
  full:          "rgba(255,255,255,0.04)",
};

function DebugOverlay({ layout }: { layout: ResolvedLayout }): React.ReactElement {
  return (
    <>
      {/* Safe area */}
      <div
        style={{
          position: "absolute",
          left: layout.surface.safeArea?.left ?? 0,
          top: layout.surface.safeArea?.top ?? 0,
          width: layout.contentRect.width,
          height: layout.contentRect.height,
          border: "1px dashed rgba(96,165,250,0.5)",
          pointerEvents: "none",
          zIndex: 100,
          boxSizing: "border-box",
        }}
      />
      {layout.placed.map((p) => (
        <div
          key={`dbg-${p.id}`}
          style={{
            position: "absolute",
            left: p.rect.x,
            top: p.rect.y,
            width: p.rect.width,
            height: p.rect.height,
            background: ZONE_COLORS[p.zone] ?? "rgba(255,255,255,0.04)",
            border: `1px solid ${p.isShrunk ? "rgba(251,191,36,0.7)" : "rgba(74,222,128,0.5)"}`,
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 101,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2, left: 3,
              fontSize: 8,
              fontFamily: "'JetBrains Mono', monospace",
              color: "rgba(255,255,255,0.9)",
              background: "rgba(0,0,0,0.7)",
              padding: "1px 3px",
              borderRadius: 2,
              lineHeight: 1.4,
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            {p.id}{p.isShrunk ? ` ⚠${Math.round(p.scaleFactor * 100)}%` : ""}{p.fontSize ? ` ${Math.round(p.fontSize)}px` : ""}
          </span>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main AdRenderer
// ---------------------------------------------------------------------------

export interface AdRendererProps {
  layout: ResolvedLayout;
  showDebug?: boolean;
  background?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AdRenderer({ layout, showDebug = false, background, className, style }: AdRendererProps): React.ReactElement {
  const { surface } = layout;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: surface.width,
        height: surface.height,
        background: background ?? "linear-gradient(135deg, #08080f 0%, #0e0e1e 60%, #0a0a18 100%)",
        overflow: "hidden",
        borderRadius: 2,
        flexShrink: 0,
        ...style,
      }}
      role="img"
      aria-label={`Ad preview for ${surface.name}`}
    >
      {/* Subtle ambient gradient */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 80% 60% at 30% 20%, rgba(102,126,234,0.08) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />
      {layout.placed.map((resolved) => renderElement(resolved))}
      {showDebug && <DebugOverlay layout={layout} />}
    </div>
  );
}
