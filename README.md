# Adaptive Layout Engine for Multi-Surface Ads

> A constraint-based ad layout engine that takes one declarative `AdSpec` and produces correct, meaningfully different layouts across radically different surface profiles — without per-surface hardcoding.

---

## Demo

![Demo preview](./docs/demo-preview.png)

**Live surfaces included:**
| Surface | Dimensions | Aspect Ratio | Flow Strategy |
|---|---|---|---|
| 📱 Mobile Portrait | 320×480 | 0.67 | `column` |
| 📲 Mobile Landscape | 480×320 | 1.50 | `row` |
| 📺 Broadcast Lower-Third | 1920×250 | 7.68 | `broadcast-strip` |
| 🖥️ Square Kiosk | 1080×1080 | 1.00 | `grid` |
| 🪧 Print QR Panel | 400×700 | 0.57 | `column` |
| ✨ Custom (add live) | any | computed | computed |

---

## Setup

**Requirements:** Node.js 18+

```bash
# Clone and install
git clone https://github.com/your-org/adaptive-layout-engine
cd adaptive-layout-engine
npm install

# Run the dev server
npm run dev
```

Then open `http://localhost:5173`.

---

## How to Use the Demo

1. **Switch surfaces** using the tab bar at the top — the same ad spec re-resolves instantly for each surface.
2. **Click "Debug"** to overlay bounding boxes, safe-area outlines, and zone labels on the rendered ad.
3. **Click "⊞ All Surfaces"** to see all surfaces rendered side-by-side simultaneously.
4. **Click "✨ Custom"** to enter arbitrary width/height/constraints and see the engine resolve a new surface live — no code changes required.
5. **Watch the Spec Panel** at the bottom to see exact computed positions, font sizes, and degradation reasons for each element.

### Observing Degradation (Mobile Landscape)
The **Mobile Landscape** surface has `maxElements: 4` set, which forces the lowest-priority element (the logo, priority=3) to be dropped cleanly. Select it and observe:
- The **logo** disappears from the rendered ad
- The **Degradation Log** in the info panel explains the reason
- **Headline and CTA remain intact** — they are never compromised

---

## Layout Algorithm

The resolver (`src/resolver.ts`) uses a **4-pass, priority-ordered greedy placement algorithm**. It is pure TypeScript with zero React/DOM imports.

### Pass 1: Surface Analysis

```
contentRect = surface dimensions − safeArea insets
aspectRatio = contentRect.width / contentRect.height
flowStrategy = computeFlowStrategy(aspectRatio)
```

`computeFlowStrategy` is a pure function that derives the macro layout strategy purely from the aspect ratio number — it **never inspects the surface's name or ID**:

```
AR > 2.5       → broadcast-strip  (ultrawide)
AR 0.85–1.15   → grid             (square-ish)
AR 1.15–2.5    → row              (landscape)
AR < 0.85      → column           (portrait)
```

### Pass 2: Sort Elements by Priority

Elements are sorted ascending by `priority` (1 = most important). Elements with equal priority maintain their spec order (stable sort). This sort determines placement order in Pass 3.

### Pass 3: Greedy Placement with Hard Constraints

Each flow strategy has a dedicated placement function:

#### `column` (portrait)
1. Hero image gets first claim on the top ~45% of height (full width).
2. Remaining elements stack vertically in priority order below.
3. If an element's natural height doesn't fit, attempt shrinking to `minScaleFactor` (default 0.6).
4. If it still can't fit → **drop it**, record reason.

#### `row` (landscape)
1. Hero image occupies the left ~42% of width (full height).
2. Non-hero elements stack vertically in the right column in priority order.
3. Same shrink-then-drop degradation as column.

#### `grid` (square)
1. The content area is divided into 4 quadrants (52%/48% width, 56%/44% height).
2. Elements are mapped to quadrants by role: `hero→top-left`, `primary→top-right`, `action→bottom-right`, `branding→bottom-left`.
3. Multiple elements sharing a quadrant (e.g. `primary` + `secondary` both going to `top-right`) stack vertically within it.
4. If an element can't fit in its target quadrant → drop.

#### `broadcast-strip` (ultrawide)
1. **CTA button is immediately dropped** — `inputModality: none` means there is no interaction.
2. Logo occupies a stripe on the far left.
3. Hero image occupies a narrow strip beside the logo.
4. Headline and price text occupy the center area.
5. Badge (price chip) goes to the far right.
6. `minTextSize: 32` is enforced by `applyHardConstraints`, growing all text to be broadcast-legible.

### Pass 4: Hard Constraint Enforcement

After computing a natural size for each element, `applyHardConstraints` clamps it:

```
minTextSize / maxTextSize   → clamp fontSize, recalculate height
minTapTarget                → grow button width/height to minimum tap size
```

Constraints are applied before placement, so the resolver always produces physically valid sizes.

### Pass 5: Output Assembly

All placed elements become `ResolvedElement` records with absolute `{x, y, width, height}` and optional `fontSize`. All dropped elements become `DroppedElement` records with a human-readable `reason` string.

---

## Priority & Degradation Logic

The priority system works in two layers:

**Layer 1 — maxElements (pre-placement)**
If `surface.constraints.maxElements` is set and the spec has more elements, the lowest-priority elements are dropped before placement even begins. This is how Mobile Landscape forces the logo to drop.

**Layer 2 — space exhaustion (during placement)**
If an element can't fit at its natural size during greedy placement:
1. Try shrinking to `element.minScaleFactor` (spec-defined, defaults to 0.6).
2. If the shrunk size still doesn't fit → drop with reason.
3. Higher-priority elements (placed first) are **never evicted** once placed.

**Guarantee:** No element is placed if it would overflow the surface bounds or overlap an already-placed element. The resolver enforces this geometrically (cursor tracking + zone bounds checking), not via CSS.

---

## TypeScript Design

### Preventing invalid specs

```typescript
// Role/type combinations are enforced by the discriminated union:
type AdElement = TextElement | ImageElement | ButtonElement;

// TextElement only allows text roles:
interface TextElement { type: "text"; role: "primary" | "secondary" | "badge"; ... }

// ImageElement only allows image roles:
interface ImageElement { type: "image"; role: "hero" | "branding"; ... }

// ButtonElement only allows action role:
interface ButtonElement { type: "button"; role: "action"; ... }

// This would be a TypeScript compile error:
// const bad: AdElement = { type: "button", role: "hero", ... };
```

### Typed resolver output

```typescript
// Discriminated union — renderers never need to guess:
type LayoutElement = ResolvedElement | DroppedElement;

interface ResolvedElement {
  visible: true;
  rect: ElementRect;        // absolute position/size
  fontSize?: number;        // resolved font size
  scaleFactor: number;      // 1.0 = natural, < 1.0 = shrunk
  zone: LayoutZone;         // which layout region
  element: AdElement;       // back-reference to spec
}

interface DroppedElement {
  visible: false;
  reason: string;           // human-readable explanation
  element: AdElement;
}
```

### Surface constraints are optional and additive

A surface without `minTapTarget` will not have tap-target enforcement. A surface without `minTextSize` will not clamp font sizes. New constraint types can be added to `SurfaceConstraints` without breaking existing surfaces.

---

## Known Limitations

- **No text measurement** — font sizes are estimated from heuristics, not measured from actual rendered text. A production implementation would use `canvas.measureText()` or a hidden DOM measurement pass.
- **Fixed element type set** — only `text`, `image`, and `button` are supported. Video, carousel, countdown, etc. would require extending `AdElement`.
- **No animated transitions** — switching surfaces re-renders immediately. A production version would animate position/size changes with the FLIP technique.
- **No Canvas renderer** — only the DOM renderer is implemented. The architecture supports a Canvas renderer (same `ResolvedLayout` input), but it was not built in this assignment.
- **Heuristic sizing** — natural sizes are estimated proportionally. A real system would use content-aware sizing (e.g., measuring actual text, respecting image intrinsic dimensions).
- **No i18n** — text truncation and font-size estimates assume Latin scripts. RTL and CJK would require different heuristics.

---

## Time Spent

- Architecture & algorithm design: ~2h
- `spec.ts` + `surfaces.ts`: ~1h
- `resolver.ts` (core algorithm): ~3h
- `render-dom.tsx`: ~1.5h
- `App.tsx` + `App.css` (demo UI): ~2h
- `README.md` + `ARCHITECTURE.md`: ~1h

**Total: ~10.5 hours**

---

## AI Tool Disclosure

This assignment was built with assistance from **Google Gemini (Antigravity IDE)**. Specifically:
- The overall architecture, algorithm design, and type system were designed collaboratively.
- All code was generated with AI assistance and reviewed for correctness.
- The layout algorithm logic (4-pass greedy resolver, zone mapping, degradation logic) was designed by the author and implemented with AI help.
- I can explain every line of code in the repository and walk through the algorithm step-by-step.
