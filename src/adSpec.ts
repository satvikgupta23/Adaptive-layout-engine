/**
 * adSpec.ts
 * ---------
 * The single, surface-agnostic ad spec used by the demo.
 * Defined once — never changes regardless of which surface is selected.
 *
 * Product: SONIX Pro X — Premium Wireless Headphones
 */

import { defineAd } from "./spec";
import type { AdSpec } from "./spec";

export const sonixAdSpec: AdSpec = defineAd({
  id: "sonix-pro-x-launch",
  name: "SONIX Pro X Launch Campaign",
  elements: [
    {
      id: "product-image",
      type: "image",
      role: "hero",
      priority: 1,
      src: "/hero.jpg",
      alt: "SONIX Pro X headphones",
      aspectRatio: 1.0,
      label: "Hero Image",
    },
    {
      id: "headline",
      type: "text",
      role: "primary",
      priority: 1,
      content: "Silence Everything. Hear Everything.",
      preferredFontSize: 28,
      multiline: true,
      minScaleFactor: 0.65,
      label: "Headline",
    },
    {
      id: "cta",
      type: "button",
      role: "action",
      priority: 2,
      label: "Shop Now",
      icon: "→",
      minScaleFactor: 0.85,
    },
    {
      id: "price",
      type: "text",
      role: "secondary",
      priority: 2,
      content: "From $299 · Free Shipping",
      preferredFontSize: 15,
      minScaleFactor: 0.7,
      label: "Price",
    },
    {
      id: "logo",
      type: "image",
      role: "branding",
      priority: 3,
      src: "/logo.jpg",
      alt: "SONIX",
      aspectRatio: 2.5,
      minScaleFactor: 0.5,
      label: "Logo",
    },
  ],
  theme: {
    primary: "#667eea",
    accent: "#f7931e",
    background: "#0a0a14",
    surface: "#12121f",
    textPrimary: "#ffffff",
    textSecondary: "rgba(255,255,255,0.75)",
  },
});
