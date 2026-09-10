/**
 * spec.ts
 * -------
 * Defines the AdSpec type system: the declarative, surface-agnostic description
 * of an ad's content and layout intent.
 *
 * Design goals:
 * - Elements are defined ONCE, independent of any surface
 * - Role/type combinations are constrained at the type level
 * - Invalid specs are caught at compile time (type errors) or clearly at runtime
 */

// ---------------------------------------------------------------------------
// Primitive branded types
// ---------------------------------------------------------------------------

/** Priority 1 = highest importance (must be shown); higher numbers = lower importance */
export type Priority = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------
// Element Role & Type vocabulary
// ---------------------------------------------------------------------------

/**
 * The semantic role of an ad element. Drives layout heuristics.
 * - "primary"   : Main headline / title text
 * - "hero"      : Dominant visual (product image / background)
 * - "action"    : Call-to-action button — always a touch/click target
 * - "branding"  : Logo / brand mark — decorative, can be sacrificed
 * - "secondary" : Supporting text (price, tagline, legal copy)
 * - "badge"     : Small label overlay (sale badge, rating chip)
 */
export type ElementRole =
  | "primary"
  | "hero"
  | "action"
  | "branding"
  | "secondary"
  | "badge";

/** The structural type of the element content */
export type ElementType = "text" | "image" | "button" | "group";

// ---------------------------------------------------------------------------
// Discriminated union: valid Role × Type combinations
// ---------------------------------------------------------------------------

/**
 * Each AdElement is a discriminated union keyed on (type, role).
 * This prevents nonsensical combinations like { type: "button", role: "hero" }
 * at the TypeScript type level.
 */
export type AdElement =
  | TextElement
  | ImageElement
  | ButtonElement;

interface BaseElement {
  /** Unique identifier within the spec */
  id: string;
  /**
   * Priority 1 = must show. Priority 5 = first to drop under constraint.
   * Elements with the same priority are treated as a tied group.
   */
  priority: Priority;
  /** Minimum percentage of dimension to retain before dropping (0–1) */
  minScaleFactor?: number;
  /** Human-readable label for debug/demo panels */
  label?: string;
}

export interface TextElement extends BaseElement {
  type: "text";
  role: "primary" | "secondary" | "badge";
  content: string;
  /** Preferred font size in px. Resolver may shrink/grow within constraints. */
  preferredFontSize?: number;
  /** Allow the text to wrap to multiple lines */
  multiline?: boolean;
}

export interface ImageElement extends BaseElement {
  type: "image";
  role: "hero" | "branding";
  /** URL or data-URI for the image */
  src: string;
  alt: string;
  /**
   * Preferred aspect ratio (width / height).
   * Used by the resolver to size the image correctly.
   */
  aspectRatio?: number;
}

export interface ButtonElement extends BaseElement {
  type: "button";
  role: "action";
  label: string;
  /** Icon emoji or SVG string to display alongside label */
  icon?: string;
}

// ---------------------------------------------------------------------------
// AdSpec — the top-level surface-agnostic declaration
// ---------------------------------------------------------------------------

export interface AdSpec {
  /** Unique identifier for this ad creative */
  id: string;
  /** Human-readable name */
  name: string;
  /** Ordered list of elements. Order does NOT imply visual order — use priority. */
  elements: AdElement[];
  /**
   * Brand color palette. Used by the renderer for theming.
   * The resolver does not use these, maintaining clean separation.
   */
  theme?: AdTheme;
}

export interface AdTheme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
}

// ---------------------------------------------------------------------------
// defineAd — factory with runtime validation
// ---------------------------------------------------------------------------

export class AdSpecValidationError extends Error {
  constructor(
    message: string,
    public readonly elementId?: string
  ) {
    super(`[AdSpec] ${message}${elementId ? ` (element: "${elementId}")` : ""}`);
    this.name = "AdSpecValidationError";
  }
}

/**
 * Creates a validated AdSpec. Throws AdSpecValidationError if:
 * - Duplicate element IDs are found
 * - An element has an invalid role/type combination
 * - An element priority is out of range
 */
export function defineAd(spec: AdSpec): AdSpec {
  const ids = new Set<string>();

  for (const el of spec.elements) {
    // Check for duplicate IDs
    if (ids.has(el.id)) {
      throw new AdSpecValidationError(`Duplicate element id "${el.id}"`);
    }
    ids.add(el.id);

    // Validate priority range
    if (el.priority < 1 || el.priority > 5 || !Number.isInteger(el.priority)) {
      throw new AdSpecValidationError(
        `Priority must be an integer 1–5, got ${el.priority}`,
        el.id
      );
    }

    // Validate role/type combinations
    if (el.type === "text" && !["primary", "secondary", "badge"].includes(el.role)) {
      throw new AdSpecValidationError(
        `Text element has invalid role "${el.role}". Must be one of: primary, secondary, badge`,
        el.id
      );
    }
    if (el.type === "image" && !["hero", "branding"].includes(el.role)) {
      throw new AdSpecValidationError(
        `Image element has invalid role "${el.role}". Must be one of: hero, branding`,
        el.id
      );
    }
    if (el.type === "button" && el.role !== "action") {
      throw new AdSpecValidationError(
        `Button element has invalid role "${el.role}". Must be: action`,
        el.id
      );
    }
  }

  // Warn if no priority-1 elements
  const hasMustShow = spec.elements.some((el) => el.priority === 1);
  if (!hasMustShow) {
    console.warn(`[AdSpec] "${spec.id}" has no priority-1 elements. All elements could be dropped under severe constraints.`);
  }

  return spec;
}
