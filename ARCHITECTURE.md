# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  SPEC LAYER (spec.ts, adSpec.ts)                                    │
│  Surface-agnostic declaration of ad content and layout intent.      │
│  No positions, no sizes, no surface awareness.                      │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ AdSpec
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│  SURFACE LAYER (surfaces.ts)                                        │
│  Physical constraints of each display environment.                  │
│  No knowledge of AdSpec or rendering.                               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ SurfaceProfile
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│  RESOLVER LAYER (resolver.ts)                                       │
│  Pure TypeScript. Takes AdSpec + SurfaceProfile.                    │
│  Produces ResolvedLayout. No React, no DOM imports.                 │
│                                                                     │
│  resolveLayout(spec, surface) → ResolvedLayout                      │
│                                                                     │
│  Internal passes:                                                   │
│    1. computeFlowStrategy(aspectRatio)                              │
│    2. Sort elements by priority                                     │
│    3. placeColumn / placeRow / placeGrid / placeBroadcastStrip      │
│    4. applyHardConstraints per element                              │
│    5. Assemble ResolvedLayout                                       │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ ResolvedLayout
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│  RENDERER LAYER (render-dom.tsx)                                    │
│  React component. Reads only ResolvedLayout.                        │
│  Renders absolutely-positioned divs.                                │
│  Zero knowledge of resolver algorithm.                              │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ React elements
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│  DEMO LAYER (App.tsx)                                               │
│  Surface picker, live re-resolution, debug overlay, spec panel.     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Invariants

### 1. The resolver never branches on surface name
`resolver.ts` derives all behavior from numeric surface properties (dimensions, constraint values). It never does:
```typescript
// ❌ Never
if (surface.id === "mobile-portrait") { ... }
if (surface.name.includes("broadcast")) { ... }
```

Instead:
```typescript
// ✅ Always
const ar = contentRect.width / contentRect.height;
const strategy = computeFlowStrategy(ar); // pure number → strategy
```

This means a new surface with the same aspect ratio will automatically get the same flow strategy and same algorithm path — no code change required.

### 2. The renderer never touches the resolver
`render-dom.tsx` receives only a `ResolvedLayout`. It never calls `resolveLayout`, reads `SurfaceConstraints`, or knows about priorities. It only reads absolute positions and sizes.

This enables swapping renderers: a Canvas renderer would accept the same `ResolvedLayout` and produce an identical visual output on a `<canvas>` element.

### 3. Dropped elements never clip or overflow
The resolver's geometry checks guarantee that an element is either fully within bounds or dropped. There is no partial rendering. A placed element's `rect.x + rect.width ≤ surface.width` is always true.

### 4. Hard constraints are applied before placement
`applyHardConstraints` runs on every element's natural size *before* it enters the placement algorithm. This means a button on a touch surface is guaranteed to be `minTapTarget` tall before we even try to fit it in the remaining space.

---

## Adding a New Surface

```typescript
// surfaces.ts — add this, nothing else changes
export const billboard: SurfaceProfile = defineSurface({
  id: "billboard",
  name: "Digital Billboard",
  description: "16:9 outdoor LED billboard",
  icon: "🪟",
  width: 3840,
  height: 2160,
  safeArea: { top: 80, right: 80, bottom: 80, left: 80 },
  constraints: {
    minTextSize: 48,
    viewingDistance: "very-far",
    inputModality: "none",
  },
  surfaceBackground: "#000",
});
```

The resolver will:
1. Compute AR = 3760 / 2000 = 1.88 → `row` strategy
2. Apply `minTextSize: 48` to all text elements
3. Produce a valid layout with no code change to `resolver.ts`, `render-dom.tsx`, or `App.tsx`

---

## Adding a New Element Type

To add a new element type (e.g., `video`):

1. **`spec.ts`**: Add `VideoElement` to the `AdElement` union
2. **`resolver.ts`**: Add a case in `computeNaturalSize` for the new role
3. **`render-dom.tsx`**: Add a `renderVideo` function and a case in `renderElement`

The resolver algorithm itself does not change — new element types participate in the same priority-ordered greedy placement.

---

## Adding a New Renderer (Canvas)

```typescript
// render-canvas.ts — new file, no changes to resolver.ts
import type { ResolvedLayout, ResolvedElement } from "./resolver";

export function renderToCanvas(
  layout: ResolvedLayout,
  canvas: HTMLCanvasElement
): void {
  const ctx = canvas.getContext("2d")!;
  canvas.width = layout.surface.width;
  canvas.height = layout.surface.height;

  for (const el of layout.placed) {
    // Use el.rect.x, el.rect.y, el.rect.width, el.rect.height
    // Use el.fontSize for text elements
    // Same ResolvedLayout, different output target
  }
}
```

---

## Type System Design

### Discriminated unions prevent invalid specs

```typescript
type AdElement = TextElement | ImageElement | ButtonElement;
//                  ^               ^               ^
//           role: primary    role: hero       role: action
//                secondary        branding
//                badge
```

TypeScript narrows the type correctly in all switch branches:
```typescript
switch (el.type) {
  case "text":   el.role // "primary" | "secondary" | "badge"
  case "image":  el.role // "hero" | "branding"
  case "button": el.role // "action"
}
```

### ResolvedLayout is a complete, self-contained contract

A renderer needs exactly one argument — `ResolvedLayout` — to produce output:
- `surface` → for container dimensions
- `placed[]` → elements to render with absolute positions
- `dropped[]` → elements to skip (or log)
- `warnings[]` → diagnostic information

No resolver internals leak into the renderer.

---

## File Dependency Graph

```
adSpec.ts
  └── spec.ts

surfaces.ts (no dependencies)

resolver.ts
  ├── spec.ts    (types only)
  └── surfaces.ts (types + getContentRect helper)

render-dom.tsx
  ├── resolver.ts (types only: ResolvedLayout, ResolvedElement)
  └── spec.ts    (types only: AdElement subtypes for rendering)

App.tsx
  ├── render-dom.tsx
  ├── resolver.ts   (resolveLayout function)
  ├── surfaces.ts   (ALL_SURFACES, defineSurface)
  └── adSpec.ts     (sonixAdSpec)
```

The critical property: **`resolver.ts` has no upward dependencies on `render-dom.tsx` or `App.tsx`**. The data flow is strictly one-directional.
