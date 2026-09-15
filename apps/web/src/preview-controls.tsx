import type { JSX } from "react";
import {
  PREVIEW_CAMERA_PRESETS,
  type PreviewCameraPreset,
} from "@cyberblade/visuals/camera";
export { PREVIEW_CAMERA_PRESET_ORDER } from "@cyberblade/visuals/camera";
export type CameraPreset = PreviewCameraPreset;

/**
 * The shared preview poses, paired with this app's SVG icons for the view
 * switcher. Only the icons live here — mobile frames a blade from exactly the
 * same angles by reading the same constants.
 */
export const CAMERA_PRESETS: Record<
  CameraPreset,
  {
    label: string;
    icon: JSX.Element;
    position: readonly [number, number, number];
    target: readonly [number, number, number];
  }
> = {
  default: {
    ...PREVIEW_CAMERA_PRESETS.default,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  top: {
    ...PREVIEW_CAMERA_PRESETS.top,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  side: {
    ...PREVIEW_CAMERA_PRESETS.side,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12h16" />
        <path d="M4 7l8-3 8 3v10l-8 3-8-3V7z" />
      </svg>
    ),
  },
  bottom: {
    ...PREVIEW_CAMERA_PRESETS.bottom,
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
        <path d="M12 5v14M5 12h14" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      </svg>
    ),
  },
};

export function ExplodedLayersIcon({
  className,
}: {
  className?: string;
}): JSX.Element {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 12 12 17 22 12" />
      <polyline points="2 17 12 22 22 17" />
    </svg>
  );
}
