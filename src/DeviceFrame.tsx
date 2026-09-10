/**
 * DeviceFrame.tsx
 * ---------------
 * Renders realistic device chassis around the resolved ad.
 * Supports Phone (iPhone 16 Pro), Broadcast TV, Kiosk, and Clean Studio Frame.
 */

import React from "react";
import type { ResolvedLayout } from "./resolver";
import { AdRenderer } from "./render-dom";

export type DeviceType = "auto" | "clean" | "phone" | "tv" | "kiosk";

interface DeviceFrameProps {
  layout: ResolvedLayout;
  showDebug: boolean;
  deviceType: DeviceType;
  scale?: number;
}

export function DeviceFrame({ layout, showDebug, deviceType, scale = 1 }: DeviceFrameProps): React.ReactElement {
  const sw = layout.surface.width;
  const sh = layout.surface.height;
  const ar = sw / sh;

  // Resolve effective device type if "auto"
  const effectiveDevice: DeviceType = deviceType === "auto"
    ? ar < 0.8
      ? "phone"
      : ar > 2.5
        ? "tv"
        : ar >= 0.85 && ar <= 1.15
          ? "kiosk"
          : "clean"
    : deviceType;

  // Ad content renderer
  const adElement = (
    <div
      style={{
        width: sw,
        height: sh,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      <AdRenderer layout={layout} showDebug={showDebug} />
    </div>
  );

  const scaledW = sw * scale;
  const scaledH = sh * scale;

  if (effectiveDevice === "phone") {
    return (
      <div className="device-phone-outer" style={{ width: scaledW + 28, height: scaledH + 34 }}>
        {/* Phone bezel frame */}
        <div className="phone-chassis">
          {/* Dynamic Island */}
          <div className="phone-dynamic-island">
            <span className="di-camera" />
            <span className="di-sensor" />
          </div>
          {/* Screen viewport */}
          <div className="phone-screen" style={{ width: scaledW, height: scaledH }}>
            {adElement}
          </div>
          {/* Home indicator bar */}
          <div className="phone-home-indicator" />
        </div>
      </div>
    );
  }

  if (effectiveDevice === "tv") {
    return (
      <div className="device-tv-outer" style={{ width: scaledW + 24 }}>
        <div className="tv-frame">
          <div className="tv-top-bar">
            <div className="tv-live-pill">
              <span className="live-dot" /> LIVE BROADCAST
            </div>
            <div className="tv-channel-tag">4K ULTRA HD · CH 07</div>
          </div>
          <div className="tv-screen" style={{ width: scaledW, height: scaledH }}>
            {adElement}
          </div>
          <div className="tv-bottom-bezel">
            <span className="tv-brand-logo">SONIX VISION</span>
            <span className="tv-power-led" />
          </div>
        </div>
        <div className="tv-stand" />
      </div>
    );
  }

  if (effectiveDevice === "kiosk") {
    return (
      <div className="device-kiosk-outer" style={{ width: scaledW + 36 }}>
        <div className="kiosk-frame">
          <div className="kiosk-header">
            <span className="kiosk-camera" />
            <span className="kiosk-title">RETAIL INTERACTIVE HUB</span>
          </div>
          <div className="kiosk-screen" style={{ width: scaledW, height: scaledH }}>
            {adElement}
          </div>
          <div className="kiosk-footer">
            <span className="kiosk-touch-icon">👆</span>
            <span>TOUCH ANYWHERE TO INTERACT</span>
            <span className="kiosk-nfc">NFC PAY</span>
          </div>
        </div>
        <div className="kiosk-pedestal" />
      </div>
    );
  }

  // Clean studio frame default
  return (
    <div className="device-clean-outer">
      <div className="clean-chrome">
        <div className="clean-dots">
          <span className="dot-red" />
          <span className="dot-yellow" />
          <span className="dot-green" />
        </div>
        <div className="clean-title">
          <span className="clean-icon">{layout.surface.icon}</span>
          <span>{layout.surface.name}</span>
          <span className="clean-dims">{sw} × {sh}px</span>
        </div>
        <div className="clean-strategy-badge">
          {layout.flowStrategy.toUpperCase()}
        </div>
      </div>
      <div className="clean-screen" style={{ width: scaledW, height: scaledH }}>
        {adElement}
      </div>
    </div>
  );
}
