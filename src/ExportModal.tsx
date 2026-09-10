/**
 * ExportModal.tsx
 * ---------------
 * Modal dialog for inspecting and copying the resolved layout JSON contract,
 * or copying developer integration snippets.
 */

import React, { useState } from "react";
import type { ResolvedLayout } from "./resolver";
import { sound } from "./sound";

interface ExportModalProps {
  layout: ResolvedLayout;
  onClose: () => void;
}

export function ExportModal({ layout, onClose }: ExportModalProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"json" | "embed">("json");

  // Clean JSON without circular DOM references
  const cleanJson = JSON.stringify(
    {
      surface: {
        id: layout.surface.id,
        name: layout.surface.name,
        width: layout.surface.width,
        height: layout.surface.height,
        aspectRatio: layout.aspectRatio,
      },
      flowStrategy: layout.flowStrategy,
      contentRect: layout.contentRect,
      placed: layout.placed.map(p => ({
        id: p.id,
        rect: p.rect,
        fontSize: p.fontSize,
        scaleFactor: p.scaleFactor,
        isShrunk: p.isShrunk,
        zone: p.zone,
      })),
      dropped: layout.dropped.map(d => ({
        id: d.id,
        reason: d.reason,
      })),
      warnings: layout.warnings,
    },
    null,
    2
  );

  const embedCode = `import { resolveLayout, AdRenderer } from "adaptive-layout-engine";

// 1. Resolve geometry dynamically for surface
const layout = resolveLayout(myAdSpec, {
  id: "${layout.surface.id}",
  width: ${layout.surface.width},
  height: ${layout.surface.height},
  constraints: ${JSON.stringify(layout.surface.constraints)}
});

// 2. Render purely via resolved coordinates
return <AdRenderer layout={layout} />;`;

  const handleCopy = () => {
    sound.playClick();
    navigator.clipboard.writeText(activeTab === "json" ? cleanJson : embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card export-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📦 Export Resolved Layout Contract</div>
          <div className="modal-sub">
            Zero algorithmic coupling — direct coordinate mapping for any frontend renderer
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="export-tabs">
          <button
            className={`export-tab ${activeTab === "json" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("json")}
          >
            Resolved JSON Spec
          </button>
          <button
            className={`export-tab ${activeTab === "embed" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("embed")}
          >
            React Embed Snippet
          </button>
        </div>

        <div className="export-code-box">
          <pre>{activeTab === "json" ? cleanJson : embedCode}</pre>
        </div>

        <div className="export-footer">
          <button className="copy-btn" onClick={handleCopy}>
            {copied ? "✓ Copied to Clipboard!" : "📋 Copy to Clipboard"}
          </button>
          <button className="close-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
