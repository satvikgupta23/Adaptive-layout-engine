/**
 * resolver.ts
 * -----------
 * The core constraint-based layout engine.
 *
 * This module is PURE TypeScript — zero React/DOM imports.
 * It takes an AdSpec and a SurfaceProfile and produces a ResolvedLayout.
 *
 * Algorithm overview (4 passes):
 *
 * 1. SURFACE ANALYSIS
 *    Compute the usable content rectangle (after safe-area subtraction).
 *    Derive a FlowStrategy from the content area's aspect ratio.
 *    The strategy is computed, never looked up by surface name.
 *
 * 2. ELEMENT SORTING & SIZING
 *    Sort elements by priority (1 = most important, first).
 *    For each element, compute a "natural size" based on role heuristics
 *    and the chosen flow strategy.
 *    Apply hard surface constraints (minTapTarget, minTextSize) to clamp sizes.
 *
 * 3. GREEDY PLACEMENT WITH DEGRADATION
 *    Maintain a "remaining space" cursor within the content rect.
 *    For each element (in priority order):
 *      a) Try to fit at natural size.
 *      b) If it doesn't fit, try shrinking to minScaleFactor.
 *      c) If it still can't fit, mark it DROPPED with a reason.
 *    Placed elements are tracked to prevent overlaps.
 *
 * 4. OUTPUT
 *    Return a ResolvedLayout: per-element absolute positions/sizes,
 *    dropped elements with reasons, and diagnostic warnings.
 */

import type { AdElement, AdSpec } from "./spec";
import type { SurfaceProfile } from "./surfaces";
import { getContentRect } from "./surfaces";

// ---------------------------------------------------------------------------
// Flow Strategy
// ---------------------------------------------------------------------------

/**
 * The macro layout strategy derived from the surface's aspect ratio.
 *
 * column        : tall/portrait  (AR < 0.75) — vertical stacking, hero on top
 * row           : landscape      (AR 0.75–2.5) — horizontal split, image left
 * grid          : square-ish     (AR 0.85–1.15) — 2×2 quadrant arrangement
 * broadcast-strip : ultrawide    (AR > 2.5) — logo stripe left, content right
 *
 * Note: "grid" overrides "row" in the square range so a square kiosk
 * gets its own distinct treatment (not just a short row).
 */
export type FlowStrategy = "column" | "row" | "grid" | "broadcast-strip";

/**
 * Derives FlowStrategy purely from the content area aspect ratio.
 * This is the key guarantee that the resolver never branches on surface NAME.
 */
export function computeFlowStrategy(ar: number): FlowStrategy {
  if (ar > 2.5) return "broadcast-strip";
  if (ar >= 0.85 && ar <= 1.15) return "grid";
  if (ar > 1.15) return "row";
  return "column"; // ar < 0.85
}

// ---------------------------------------------------------------------------
// Resolved Layout types
// ---------------------------------------------------------------------------

/** The absolute bounding box of a placed element within the surface coordinate space */
export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A successfully placed element with its resolved geometry */
export interface ResolvedElement {
  id: string;
  visible: true;
  rect: ElementRect;
  /** Resolved font size in px (only set for text elements) */
  fontSize?: number;
  /** Resolved scale factor applied (1.0 = natural size, < 1.0 = shrunk) */
  scaleFactor: number;
  /** Whether the element is rendered at full natural size */
  isShrunk: boolean;
  /** Which flow zone this element was placed into */
  zone: LayoutZone;
  /** The source element from the spec */
  element: AdElement;
}

/**
 * An element that could not be placed without violating constraints.
 * It is omitted from the render entirely.
 */
export interface DroppedElement {
  id: string;
  visible: false;
  reason: string;
  element: AdElement;
}

export type LayoutElement = ResolvedElement | DroppedElement;

/**
 * The complete output of the resolver.
 * This is the contract between the resolver and any renderer.
 * A renderer only needs ResolvedLayout — no knowledge of algorithm internals.
 */
export interface ResolvedLayout {
  /** The surface these dimensions are relative to */
  surface: SurfaceProfile;
  /** Content rect (after safe area subtraction) */
  contentRect: ElementRect;
  /** Flow strategy chosen for this surface */
  flowStrategy: FlowStrategy;
  /** All elements: placed or dropped */
  elements: LayoutElement[];
  /** Only placed elements */
  placed: ResolvedElement[];
  /** Only dropped elements */
  dropped: DroppedElement[];
  /** Non-fatal warnings (e.g. element shrunk to minimum) */
  warnings: string[];
  /** Diagnostic: aspect ratio of the content area */
  aspectRatio: number;
}

// ---------------------------------------------------------------------------
// Layout zones
// ---------------------------------------------------------------------------

/**
 * Named regions within the content rect, assigned per flow strategy.
 * The resolver allocates elements into zones, then positions them within.
 */
export type LayoutZone =
  | "full"           // occupies entire content rect (hero image in column mode)
  | "top"            // top portion of a column layout
  | "middle"         // middle strip of a column layout
  | "bottom"         // bottom strip of a column layout
  | "left"           // left panel of row/broadcast layout
  | "right"          // right panel of row/broadcast layout
  | "center"         // center panel (broadcast: main content area)
  | "top-left"       // grid quadrant
  | "top-right"      // grid quadrant
  | "bottom-left"    // grid quadrant
  | "bottom-right";  // grid quadrant

// ---------------------------------------------------------------------------
// Sizing heuristics
// ---------------------------------------------------------------------------

/**
 * Computes the "natural size" of an element — what it would prefer given
 * unlimited space. Returns { width, height, fontSize? } in surface pixels.
 *
 * These are role-based heuristics, not fixed values:
 * the proportions are scaled to the content rect dimensions.
 */
function computeNaturalSize(
  el: AdElement,
  contentWidth: number,
  contentHeight: number,
  strategy: FlowStrategy
): { width: number; height: number; fontSize?: number } {
  const area = contentWidth * contentHeight;

  switch (el.role) {
    case "hero": {
      // Hero image wants a large portion of the dominant axis
      if (strategy === "column") {
        const w = contentWidth;
        const h = contentHeight * 0.45;
        return { width: w, height: h };
      } else if (strategy === "broadcast-strip") {
        // In broadcast, hero is replaced by logo — hero takes a left strip
        const w = contentHeight * 1.2; // roughly square-ish strip
        const h = contentHeight;
        return { width: w, height: h };
      } else if (strategy === "grid") {
        // Hero occupies top-left quadrant
        const w = contentWidth * 0.55;
        const h = contentHeight * 0.55;
        return { width: w, height: h };
      } else {
        // row: hero on the left
        const w = contentWidth * 0.42;
        const h = contentHeight;
        return { width: w, height: h };
      }
    }

    case "primary": {
      // Primary headline text
      const preferredSize = (el as { preferredFontSize?: number }).preferredFontSize;
      let fontSize: number;
      if (strategy === "broadcast-strip") {
        fontSize = preferredSize ?? Math.min(72, Math.max(32, contentHeight * 0.28));
      } else if (strategy === "column") {
        fontSize = preferredSize ?? Math.min(32, Math.max(14, contentWidth * 0.08));
      } else {
        fontSize = preferredSize ?? Math.min(48, Math.max(16, Math.sqrt(area) * 0.035));
      }
      const lineHeight = fontSize * 1.2;
      const lines = strategy === "broadcast-strip" ? 1 : 2;
      const w = strategy === "broadcast-strip" ? contentWidth * 0.4 : contentWidth;
      return { width: w, height: lineHeight * lines + 8, fontSize };
    }

    case "secondary": {
      const preferredSize = (el as { preferredFontSize?: number }).preferredFontSize;
      let fontSize: number;
      if (strategy === "broadcast-strip") {
        fontSize = preferredSize ?? Math.min(48, Math.max(32, contentHeight * 0.18));
      } else {
        fontSize = preferredSize ?? Math.min(24, Math.max(12, Math.sqrt(area) * 0.022));
      }
      const w = strategy === "broadcast-strip" ? contentWidth * 0.25 : contentWidth * 0.6;
      return { width: w, height: fontSize * 1.4 + 8, fontSize };
    }

    case "action": {
      // CTA button always respects minTapTarget
      if (strategy === "broadcast-strip") {
        // No tap target on broadcast (inputModality: none)
        return { width: 0, height: 0 };
      }
      const minH = 48;
      const h = Math.max(minH, contentHeight * 0.12);
      const w = Math.min(contentWidth * 0.8, Math.max(140, contentWidth * 0.55));
      return { width: w, height: h };
    }

    case "branding": {
      // Logo — compact, lowest priority
      if (strategy === "broadcast-strip") {
        const h = contentHeight * 0.55;
        return { width: h, height: h }; // square logo
      }
      const logoSize = Math.min(contentWidth * 0.22, contentHeight * 0.15, 80);
      return { width: logoSize * 2.5, height: logoSize };
    }

    case "badge": {
      const fontSize = Math.min(18, Math.max(12, Math.sqrt(area) * 0.015));
      return { width: contentWidth * 0.3, height: fontSize * 1.6 + 8, fontSize };
    }

    default:
      return { width: contentWidth * 0.5, height: contentHeight * 0.1 };
  }
}

/**
 * Applies hard surface constraints to a computed size.
 * Returns the adjusted size. May also return a clamped fontSize.
 */
function applyHardConstraints(
  el: AdElement,
  size: { width: number; height: number; fontSize?: number },
  constraints: SurfaceProfile["constraints"]
): { width: number; height: number; fontSize?: number } {
  let { width, height, fontSize } = size;

  // Clamp font size
  if (fontSize !== undefined) {
    if (constraints.minTextSize !== undefined) {
      fontSize = Math.max(fontSize, constraints.minTextSize);
    }
    if (constraints.maxTextSize !== undefined) {
      fontSize = Math.min(fontSize, constraints.maxTextSize);
    }
    // Recalculate height based on clamped fontSize
    const lines = el.role === "primary" ? 2 : 1;
    height = Math.max(height, fontSize * 1.3 * lines + 8);
  }

  // Clamp tap target for touch/button elements
  if (constraints.minTapTarget !== undefined) {
    if (el.type === "button") {
      width = Math.max(width, constraints.minTapTarget * 2.5);
      height = Math.max(height, constraints.minTapTarget);
    }
    if (el.type === "image" && el.role === "branding") {
      height = Math.max(height, constraints.minTapTarget * 0.8);
      width = Math.max(width, height * 2);
    }
  }

  return { width, height, fontSize };
}

// ---------------------------------------------------------------------------
// Column layout placement
// ---------------------------------------------------------------------------

/**
 * Places elements in a single-column vertical flow.
 * The hero image gets first claim on the top portion.
 * Remaining elements stack vertically below.
 */
function placeColumn(
  elements: AdElement[],
  contentRect: ElementRect,
  constraints: SurfaceProfile["constraints"]
): { placements: Map<string, { rect: ElementRect; fontSize?: number; scaleFactor: number; zone: LayoutZone }>; dropped: Map<string, string> } {
  const placements = new Map<string, { rect: ElementRect; fontSize?: number; scaleFactor: number; zone: LayoutZone }>();
  const dropped = new Map<string, string>();
  const { x, y, width, height } = contentRect;

  let cursor = y; // next available Y position
  const GAP = 8;

  // First pass: hero gets top allocation
  const hero = elements.find((e) => e.role === "hero");
  if (hero) {
    const naturalSize = computeNaturalSize(hero, width, height, "column");
    const constrained = applyHardConstraints(hero, naturalSize, constraints);
    const heroHeight = Math.min(constrained.height, height * 0.48);
    placements.set(hero.id, {
      rect: { x, y: cursor, width, height: heroHeight },
      scaleFactor: heroHeight / constrained.height,
      zone: "top",
    });
    cursor += heroHeight + GAP;
  }

  // Second pass: remaining elements stack below hero
  const nonHero = elements.filter((e) => e.role !== "hero");

  for (const el of nonHero) {
    const remaining = y + height - cursor;
    if (remaining <= 0) {
      dropped.set(el.id, "No vertical space remaining in column layout");
      continue;
    }

    const naturalSize = computeNaturalSize(el, width, height, "column");
    const constrained = applyHardConstraints(el, naturalSize, constraints);

    // Try natural size first
    if (constrained.height <= remaining - GAP) {
      placements.set(el.id, {
        rect: { x: x + (width - constrained.width) / 2, y: cursor, width: constrained.width, height: constrained.height },
        fontSize: constrained.fontSize,
        scaleFactor: 1.0,
        zone: cursor < y + height * 0.5 ? "top" : cursor < y + height * 0.75 ? "middle" : "bottom",
      });
      cursor += constrained.height + GAP;
      continue;
    }

    // Try shrinking to minScaleFactor or 0.6 minimum
    const minScale = (el as AdElement & { minScaleFactor?: number }).minScaleFactor ?? 0.6;
    const minHeight = constrained.height * minScale;
    if (minHeight <= remaining - GAP) {
      const scale = (remaining - GAP) / constrained.height;
      const shrunkHeight = constrained.height * scale;
      const shrunkWidth = Math.min(constrained.width, width);
      const shrunkFontSize = constrained.fontSize ? constrained.fontSize * scale : undefined;
      // Still respect minTextSize after shrink
      const finalFontSize = shrunkFontSize !== undefined && constraints.minTextSize !== undefined
        ? Math.max(shrunkFontSize, constraints.minTextSize)
        : shrunkFontSize;

      placements.set(el.id, {
        rect: { x: x + (width - shrunkWidth) / 2, y: cursor, width: shrunkWidth, height: shrunkHeight },
        fontSize: finalFontSize,
        scaleFactor: scale,
        zone: "bottom",
      });
      cursor += shrunkHeight + GAP;
      continue;
    }

    // Cannot fit even at minimum scale → drop
    dropped.set(
      el.id,
      `Element height ${Math.round(constrained.height * minScale)}px exceeds remaining space ${Math.round(remaining)}px`
    );
  }

  return { placements, dropped };
}

// ---------------------------------------------------------------------------
// Row layout placement
// ---------------------------------------------------------------------------

/**
 * Places elements in a horizontal split: image on the left, text content on the right.
 * Used for landscape surfaces.
 */
function placeRow(
  elements: AdElement[],
  contentRect: ElementRect,
  constraints: SurfaceProfile["constraints"]
): { placements: Map<string, { rect: ElementRect; fontSize?: number; scaleFactor: number; zone: LayoutZone }>; dropped: Map<string, string> } {
  const placements = new Map<string, { rect: ElementRect; fontSize?: number; scaleFactor: number; zone: LayoutZone }>();
  const dropped = new Map<string, string>();
  const { x, y, width, height } = contentRect;
  const GAP = 10;

  const heroEl = elements.find((e) => e.role === "hero");
  const leftWidth = width * 0.42;
  const rightX = x + leftWidth + GAP;
  const rightWidth = width - leftWidth - GAP;

  // Place hero in left column
  if (heroEl) {
    placements.set(heroEl.id, {
      rect: { x, y, width: leftWidth, height },
      scaleFactor: 1.0,
      zone: "left",
    });
  }

  // Stack text/button/branding in right column
  const nonHero = elements.filter((e) => e.role !== "hero");
  let cursor = y;

  for (const el of nonHero) {
    const remaining = y + height - cursor;
    if (remaining <= 4) {
      dropped.set(el.id, "No vertical space remaining in right column");
      continue;
    }

    const naturalSize = computeNaturalSize(el, rightWidth, height, "row");
    const constrained = applyHardConstraints(el, naturalSize, constraints);

    if (constrained.height <= remaining - GAP || el === nonHero[nonHero.length - 1]) {
      const elHeight = Math.min(constrained.height, remaining);
      placements.set(el.id, {
        rect: {
          x: rightX,
          y: cursor,
          width: Math.min(constrained.width, rightWidth),
          height: elHeight,
        },
        fontSize: constrained.fontSize,
        scaleFactor: elHeight / constrained.height,
        zone: "right",
      });
      cursor += elHeight + GAP;
    } else {
      const minScale = (el as AdElement & { minScaleFactor?: number }).minScaleFactor ?? 0.55;
      const minH = constrained.height * minScale;
      if (minH <= remaining - GAP) {
        const scale = Math.max(minScale, (remaining - GAP) / constrained.height);
        const fs = constrained.fontSize ? Math.max(
          constraints.minTextSize ?? 0,
          constrained.fontSize * scale
        ) : undefined;
        placements.set(el.id, {
          rect: { x: rightX, y: cursor, width: Math.min(constrained.width, rightWidth), height: remaining - GAP },
          fontSize: fs,
          scaleFactor: scale,
          zone: "right",
        });
        cursor += remaining;
      } else {
        dropped.set(el.id, `Element cannot fit in right column (need ${Math.round(minH)}px, have ${Math.round(remaining)}px)`);
      }
    }
  }

  return { placements, dropped };
}

// ---------------------------------------------------------------------------
// Grid (2×2 quadrant) layout
// ---------------------------------------------------------------------------

/**
 * Places elements into a 2×2 quadrant grid.
 * Quadrant assignment is role-based:
 *   top-left     → hero image
 *   top-right    → headline + price
 *   bottom-left  → branding
 *   bottom-right → CTA button
 */
function placeGrid(
  elements: AdElement[],
  contentRect: ElementRect,
  constraints: SurfaceProfile["constraints"]
): { placements: Map<string, { rect: ElementRect; fontSize?: number; scaleFactor: number; zone: LayoutZone }>; dropped: Map<string, string> } {
  const placements = new Map<string, { rect: ElementRect; fontSize?: number; scaleFactor: number; zone: LayoutZone }>();
  const dropped = new Map<string, string>();
  const { x, y, width, height } = contentRect;
  const GAP = 16;

  const col1W = width * 0.52;
  const col2W = width - col1W - GAP;
  const row1H = height * 0.56;
  const row2H = height - row1H - GAP;

  const zones: Record<LayoutZone, ElementRect> = {
    "top-left": { x, y, width: col1W, height: row1H },
    "top-right": { x: x + col1W + GAP, y, width: col2W, height: row1H },
    "bottom-left": { x, y: y + row1H + GAP, width: col1W, height: row2H },
    "bottom-right": { x: x + col1W + GAP, y: y + row1H + GAP, width: col2W, height: row2H },
    full: { x, y, width, height },
    top: { x, y, width, height: row1H },
    middle: { x, y: y + row1H / 2, width, height: row1H },
    bottom: { x, y: y + row1H + GAP, width, height: row2H },
    left: { x, y, width: col1W, height },
    right: { x: x + col1W + GAP, y, width: col2W, height },
    center: { x, y, width, height },
  };

  // Role → preferred quadrant mapping
  const roleZoneMap: Partial<Record<AdElement["role"], LayoutZone>> = {
    hero: "top-left",
    primary: "top-right",
    secondary: "top-right",
    action: "bottom-right",
    branding: "bottom-left",
    badge: "top-right",
  };

  // Track which zones have been used (for secondary elements to stack in same zone)
  const zoneUsed = new Map<LayoutZone, number>(); // zone → y cursor offset

  for (const el of elements) {
    const targetZone = roleZoneMap[el.role] ?? "center";
    const zoneRect = zones[targetZone];
    const usedHeight = zoneUsed.get(targetZone) ?? 0;
    const availH = zoneRect.height - usedHeight - (usedHeight > 0 ? GAP / 2 : 0);

    const naturalSize = computeNaturalSize(el, zoneRect.width, zoneRect.height, "grid");
    const constrained = applyHardConstraints(el, naturalSize, constraints);

    if (availH <= 0) {
      dropped.set(el.id, `Zone "${targetZone}" is full`);
      continue;
    }

    if (constrained.height <= availH) {
      const elY = zoneRect.y + usedHeight + (usedHeight > 0 ? GAP / 2 : 0);
      placements.set(el.id, {
        rect: {
          x: zoneRect.x + (zoneRect.width - Math.min(constrained.width, zoneRect.width)) / 2,
          y: elY,
          width: Math.min(constrained.width, zoneRect.width),
          height: constrained.height,
        },
        fontSize: constrained.fontSize,
        scaleFactor: 1.0,
        zone: targetZone,
      });
      zoneUsed.set(targetZone, usedHeight + constrained.height + (usedHeight > 0 ? GAP / 2 : 0));
    } else {
      const minScale = (el as AdElement & { minScaleFactor?: number }).minScaleFactor ?? 0.55;
      const minH = constrained.height * minScale;
      if (minH <= availH) {
        const scale = availH / constrained.height;
        const elY = zoneRect.y + usedHeight + (usedHeight > 0 ? GAP / 2 : 0);
        const fs = constrained.fontSize
          ? Math.max(constraints.minTextSize ?? 0, constrained.fontSize * scale)
          : undefined;
        placements.set(el.id, {
          rect: {
            x: zoneRect.x + (zoneRect.width - Math.min(constrained.width, zoneRect.width)) / 2,
            y: elY,
            width: Math.min(constrained.width, zoneRect.width),
            height: availH,
          },
          fontSize: fs,
          scaleFactor: scale,
          zone: targetZone,
        });
        zoneUsed.set(targetZone, usedHeight + availH);
      } else {
        dropped.set(
          el.id,
          `Zone "${targetZone}" too small: need ${Math.round(minH)}px, have ${Math.round(availH)}px`
        );
      }
    }
  }

  return { placements, dropped };
}

// ---------------------------------------------------------------------------
// Broadcast-strip layout
// ---------------------------------------------------------------------------

/**
 * Horizontal strip layout for ultrawide surfaces (broadcast lower-third).
 * Structure: [LOGO STRIPE | HERO/IMAGE] [HEADLINE + SECONDARY] [CTA badge]
 * 
 * No CTA button is shown on broadcast (inputModality: none).
 * Text sizes are forced to minTextSize (32px for broadcast).
 */
function placeBroadcastStrip(
  elements: AdElement[],
  contentRect: ElementRect,
  constraints: SurfaceProfile["constraints"]
): { placements: Map<string, { rect: ElementRect; fontSize?: number; scaleFactor: number; zone: LayoutZone }>; dropped: Map<string, string> } {
  const placements = new Map<string, { rect: ElementRect; fontSize?: number; scaleFactor: number; zone: LayoutZone }>();
  const dropped = new Map<string, string>();
  const { x, y, width, height } = contentRect;
  const GAP = 24;

  // Drop CTA buttons on broadcast (no interaction)
  const actionEl = elements.find((e) => e.role === "action");
  if (actionEl) {
    dropped.set(actionEl.id, "CTA buttons are not shown on broadcast (no input modality)");
  }

  // Logo stripe on the left
  const brandEl = elements.find((e) => e.role === "branding");
  const logoWidth = height * 1.0;
  if (brandEl) {
    placements.set(brandEl.id, {
      rect: { x, y: y + height * 0.1, width: logoWidth, height: height * 0.8 },
      scaleFactor: 1.0,
      zone: "left",
    });
  }

  // Separator / hero image strip next
  const heroEl = elements.find((e) => e.role === "hero");
  const heroStripWidth = height * 1.1;
  const heroX = x + logoWidth + GAP;
  if (heroEl) {
    placements.set(heroEl.id, {
      rect: { x: heroX, y, width: heroStripWidth, height },
      scaleFactor: 1.0,
      zone: "left",
    });
  }

  // Text content in the center
  const textAreaX = heroX + heroStripWidth + GAP * 2;
  const textAreaWidth = width * 0.55;

  const primaryEl = elements.find((e) => e.role === "primary");
  const secondaryEl = elements.find((e) => e.role === "secondary");

  let textCursor = y + height * 0.08;

  if (primaryEl) {
    const naturalSize = computeNaturalSize(primaryEl, textAreaWidth, height, "broadcast-strip");
    const constrained = applyHardConstraints(primaryEl, naturalSize, constraints);
    placements.set(primaryEl.id, {
      rect: { x: textAreaX, y: textCursor, width: Math.min(constrained.width, textAreaWidth), height: constrained.height },
      fontSize: constrained.fontSize,
      scaleFactor: 1.0,
      zone: "center",
    });
    textCursor += constrained.height + GAP * 0.5;
  }

  if (secondaryEl) {
    const naturalSize = computeNaturalSize(secondaryEl, textAreaWidth, height, "broadcast-strip");
    const constrained = applyHardConstraints(secondaryEl, naturalSize, constraints);
    const remainingH = y + height - textCursor;
    if (constrained.height <= remainingH) {
      placements.set(secondaryEl.id, {
        rect: { x: textAreaX, y: textCursor, width: Math.min(constrained.width, textAreaWidth), height: constrained.height },
        fontSize: constrained.fontSize,
        scaleFactor: 1.0,
        zone: "center",
      });
    } else {
      dropped.set(secondaryEl.id, `No vertical space for secondary text in broadcast strip`);
    }
  }

  // Badge (price highlight) on the right
  const badgeEl = elements.find((e) => e.role === "badge");
  if (badgeEl) {
    const naturalSize = computeNaturalSize(badgeEl, width * 0.12, height, "broadcast-strip");
    const constrained = applyHardConstraints(badgeEl, naturalSize, constraints);
    const badgeX = x + width - constrained.width - GAP;
    placements.set(badgeEl.id, {
      rect: {
        x: badgeX,
        y: y + (height - constrained.height) / 2,
        width: constrained.width,
        height: constrained.height,
      },
      fontSize: constrained.fontSize,
      scaleFactor: 1.0,
      zone: "right",
    });
  }

  return { placements, dropped };
}

// ---------------------------------------------------------------------------
// Main resolver entry point
// ---------------------------------------------------------------------------

/**
 * Resolves an AdSpec against a SurfaceProfile into a ResolvedLayout.
 *
 * This is the single public entry point of the layout engine.
 * It:
 *   1. Analyses the surface (content rect, aspect ratio, flow strategy)
 *   2. Sorts elements by priority
 *   3. Delegates placement to the appropriate strategy function
 *   4. Applies max-element constraint (drops lowest-priority first)
 *   5. Assembles and returns the ResolvedLayout
 *
 * CONTRACT: The resolver never imports React, DOM, or renderer code.
 * CONTRACT: The resolver never branches on surface.id or surface.name.
 */
export function resolveLayout(spec: AdSpec, surface: SurfaceProfile): ResolvedLayout {
  const warnings: string[] = [];

  // --- Pass 1: Surface Analysis ---
  const contentRect = getContentRect(surface);
  const ar = contentRect.width / contentRect.height;
  const flowStrategy = computeFlowStrategy(ar);

  // --- Pass 2: Sort elements by priority ---
  // Elements with the same priority are kept in spec order (stable sort)
  const sorted = [...spec.elements].sort((a, b) => a.priority - b.priority);

  // Apply maxElements constraint: drop lowest-priority elements first
  let elementsToPlace = sorted;
  const { maxElements } = surface.constraints;
  const preDropped = new Map<string, string>();

  if (maxElements !== undefined && sorted.length > maxElements) {
    const toPlace = sorted.slice(0, maxElements);
    const toDrop = sorted.slice(maxElements);
    elementsToPlace = toPlace;
    for (const el of toDrop) {
      preDropped.set(
        el.id,
        `Dropped: surface "${surface.name}" only supports ${maxElements} elements (element priority=${el.priority})`
      );
      warnings.push(
        `Element "${el.id}" (priority=${el.priority}) dropped due to surface maxElements=${maxElements}`
      );
    }
  }

  // --- Pass 3: Placement ---
  let strategyResult: {
    placements: Map<string, { rect: ElementRect; fontSize?: number; scaleFactor: number; zone: LayoutZone }>;
    dropped: Map<string, string>;
  };

  switch (flowStrategy) {
    case "column":
      strategyResult = placeColumn(elementsToPlace, contentRect, surface.constraints);
      break;
    case "row":
      strategyResult = placeRow(elementsToPlace, contentRect, surface.constraints);
      break;
    case "grid":
      strategyResult = placeGrid(elementsToPlace, contentRect, surface.constraints);
      break;
    case "broadcast-strip":
      strategyResult = placeBroadcastStrip(elementsToPlace, contentRect, surface.constraints);
      break;
  }

  // --- Pass 4: Assemble output ---
  const allDropped = new Map([...preDropped, ...strategyResult.dropped]);

  const placed: ResolvedElement[] = [];
  const dropped: DroppedElement[] = [];

  // Process all elements from original spec (in priority order)
  for (const el of sorted) {
    if (allDropped.has(el.id)) {
      dropped.push({
        id: el.id,
        visible: false,
        reason: allDropped.get(el.id)!,
        element: el,
      });
    } else if (strategyResult.placements.has(el.id)) {
      const placement = strategyResult.placements.get(el.id)!;

      // Warn on shrunk elements
      if (placement.scaleFactor < 0.95) {
        warnings.push(
          `Element "${el.id}" shrunk to ${Math.round(placement.scaleFactor * 100)}% of natural size`
        );
      }

      placed.push({
        id: el.id,
        visible: true,
        rect: placement.rect,
        fontSize: placement.fontSize,
        scaleFactor: placement.scaleFactor,
        isShrunk: placement.scaleFactor < 0.95,
        zone: placement.zone,
        element: el,
      });
    }
    // Elements not in preDropped and not placed get a warning
    // (shouldn't happen in correct implementation but guards against edge cases)
  }

  return {
    surface,
    contentRect,
    flowStrategy,
    elements: [...placed, ...dropped].sort(
      (a, b) => a.element.priority - b.element.priority
    ),
    placed,
    dropped,
    warnings,
    aspectRatio: ar,
  };
}
