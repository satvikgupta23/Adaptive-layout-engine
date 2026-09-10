/**
 * surfaces.ts
 * -----------
 * Defines surface profiles: the constraints and physical properties of each
 * display surface where ads may run. These are fully independent of any AdSpec.
 *
 * Design goals:
 * - Hard constraints (minTapTarget, minTextSize) are typed and enforced by the resolver
 * - Safe areas are explicit, not approximated
 * - New surfaces can be added WITHOUT touching the resolver algorithm
 */

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

/** Insets describing "unusable" margins on each side (e.g. notch, dock, broadcast safe zone) */
export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** How far the viewer is expected to be from the display */
export type ViewingDistance = "near" | "normal" | "far" | "very-far";

/** Input modality of the surface */
export type InputModality = "touch" | "mouse" | "remote" | "none";

// ---------------------------------------------------------------------------
// SurfaceConstraints — hard rules the resolver MUST respect
// ---------------------------------------------------------------------------

/**
 * Hard constraints that the resolver must satisfy.
 * All values are optional — the resolver applies constraints only when present.
 *
 * These are "hard" constraints: violating them produces incorrect output.
 * The resolver uses priority/degradation to satisfy them.
 */
export interface SurfaceConstraints {
  /**
   * Minimum tap/click target dimension in px (applies to type=button and type=image).
   * Required on touch surfaces per WCAG 2.5.5.
   */
  minTapTarget?: number;

  /**
   * Minimum rendered font size in px. Important for broadcast/far-viewing surfaces
   * where small text is genuinely unreadable.
   */
  minTextSize?: number;

  /**
   * Maximum rendered font size in px. Prevents text from dominating small surfaces.
   */
  maxTextSize?: number;

  /** How far the audience is from the screen. Influences minimum element sizes. */
  viewingDistance?: ViewingDistance;

  /** Primary input method for this surface */
  inputModality?: InputModality;

  /**
   * If true, all interactive elements (type=button) MUST meet minTapTarget.
   * On mouse surfaces, smaller hit areas may be acceptable.
   */
  touchOnly?: boolean;

  /**
   * Maximum number of elements that can be rendered.
   * Useful for very small surfaces that can only show 2–3 elements.
   */
  maxElements?: number;

  /**
   * Minimum percentage of the surface's width that the hero element must occupy.
   * Used on display surfaces (kiosk, billboard) where visual impact is critical.
   */
  minHeroWidthRatio?: number;

  /**
   * If true, elements MUST NOT be placed over the hero image (no overlays).
   * Relevant for print-safe or broadcast-safe contexts.
   */
  noOverlayOnHero?: boolean;
}

// ---------------------------------------------------------------------------
// SurfaceProfile — the complete description of a display surface
// ---------------------------------------------------------------------------

export interface SurfaceProfile {
  /** Unique machine-readable identifier */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Short description for UI display */
  description: string;

  /** Total surface width in CSS pixels */
  width: number;
  /** Total surface height in CSS pixels */
  height: number;

  /**
   * Safe area insets — the resolver subtracts these from usable space.
   * Defaults to all-zero if omitted.
   */
  safeArea?: SafeArea;

  /** Hard constraints the resolver must respect */
  constraints: SurfaceConstraints;

  /**
   * Background color for the surface wrapper (not the ad itself).
   * Used only by the demo renderer.
   */
  surfaceBackground?: string;

  /** Emoji icon for surface picker UI */
  icon?: string;
}

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------

/** Returns the content rectangle after subtracting safe area insets */
export function getContentRect(surface: SurfaceProfile): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const sa = surface.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    x: sa.left,
    y: sa.top,
    width: surface.width - sa.left - sa.right,
    height: surface.height - sa.top - sa.bottom,
  };
}

/** Computes aspect ratio (width / height) of the content area */
export function getAspectRatio(surface: SurfaceProfile): number {
  const rect = getContentRect(surface);
  return rect.width / rect.height;
}

// ---------------------------------------------------------------------------
// Surface Profile Factory
// ---------------------------------------------------------------------------

/**
 * Creates a validated SurfaceProfile. Throws if dimensions are nonsensical
 * or if constraints contradict each other.
 */
export class SurfaceValidationError extends Error {
  constructor(message: string) {
    super(`[SurfaceProfile] ${message}`);
    this.name = "SurfaceValidationError";
  }
}

export function defineSurface(profile: SurfaceProfile): SurfaceProfile {
  if (profile.width <= 0 || profile.height <= 0) {
    throw new SurfaceValidationError(
      `Surface "${profile.id}" has non-positive dimensions: ${profile.width}×${profile.height}`
    );
  }

  const sa = profile.safeArea;
  if (sa) {
    if (sa.left + sa.right >= profile.width) {
      throw new SurfaceValidationError(
        `Surface "${profile.id}" safe area horizontal insets exceed surface width`
      );
    }
    if (sa.top + sa.bottom >= profile.height) {
      throw new SurfaceValidationError(
        `Surface "${profile.id}" safe area vertical insets exceed surface height`
      );
    }
  }

  const c = profile.constraints;
  if (c.minTextSize !== undefined && c.maxTextSize !== undefined) {
    if (c.minTextSize > c.maxTextSize) {
      throw new SurfaceValidationError(
        `Surface "${profile.id}" minTextSize (${c.minTextSize}) > maxTextSize (${c.maxTextSize})`
      );
    }
  }

  return profile;
}

// ---------------------------------------------------------------------------
// Predefined surfaces
// ---------------------------------------------------------------------------

export const mobilePortrait: SurfaceProfile = defineSurface({
  id: "mobile-portrait",
  name: "Mobile Portrait",
  description: "Full-screen interstitial on a smartphone (320×480)",
  icon: "📱",
  width: 320,
  height: 480,
  safeArea: { top: 12, right: 0, bottom: 12, left: 0 },
  constraints: {
    minTapTarget: 44,
    minTextSize: 12,
    maxTextSize: 48,
    viewingDistance: "near",
    inputModality: "touch",
    touchOnly: true,
  },
  surfaceBackground: "#0f0f1a",
});

export const mobileLandscape: SurfaceProfile = defineSurface({
  id: "mobile-landscape",
  name: "Mobile Landscape",
  description: "Landscape interstitial — tight height forces degradation",
  icon: "📲",
  width: 480,
  height: 320,
  safeArea: { top: 8, right: 20, bottom: 8, left: 20 },
  constraints: {
    minTapTarget: 44,
    minTextSize: 12,
    maxTextSize: 36,
    viewingDistance: "near",
    inputModality: "touch",
    touchOnly: true,
    // The deliberately tight maxElements triggers branding degradation
    maxElements: 4,
  },
  surfaceBackground: "#0f0f1a",
});

export const broadcastLowerThird: SurfaceProfile = defineSurface({
  id: "broadcast-lower-third",
  name: "Broadcast Lower-Third",
  description: "TV/stream lower-third banner (1920×250) — far viewing distance",
  icon: "📺",
  width: 1920,
  height: 250,
  safeArea: { top: 16, right: 80, bottom: 16, left: 80 },
  constraints: {
    minTextSize: 32,
    maxTextSize: 96,
    viewingDistance: "far",
    inputModality: "none",
    noOverlayOnHero: false,
    minHeroWidthRatio: 0.08, // logo stripe only
  },
  surfaceBackground: "#0a0a0f",
});

export const squareKiosk: SurfaceProfile = defineSurface({
  id: "square-kiosk",
  name: "Square Kiosk",
  description: "Retail touchscreen kiosk (1080×1080) — large tap targets required",
  icon: "🖥️",
  width: 1080,
  height: 1080,
  safeArea: { top: 40, right: 40, bottom: 40, left: 40 },
  constraints: {
    minTapTarget: 60,
    minTextSize: 20,
    maxTextSize: 120,
    viewingDistance: "normal",
    inputModality: "touch",
    touchOnly: true,
  },
  surfaceBackground: "#080812",
});

// Bonus — print-to-digital QR panel: tall, narrow, read-only
export const printQRPanel: SurfaceProfile = defineSurface({
  id: "print-qr-panel",
  name: "Print QR Panel",
  description: "Tall narrow print-to-digital panel (400×700) with QR landing",
  icon: "🪧",
  width: 400,
  height: 700,
  safeArea: { top: 24, right: 16, bottom: 24, left: 16 },
  constraints: {
    minTextSize: 14,
    maxTextSize: 60,
    viewingDistance: "near",
    inputModality: "none",
    noOverlayOnHero: true,
  },
  surfaceBackground: "#0f0f1a",
});

/** All predefined surfaces, ordered for the demo picker */
export const ALL_SURFACES: SurfaceProfile[] = [
  mobilePortrait,
  mobileLandscape,
  broadcastLowerThird,
  squareKiosk,
  printQRPanel,
];
