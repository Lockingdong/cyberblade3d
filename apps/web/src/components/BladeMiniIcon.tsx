import type { JSX } from "react";
import type { BeybladeType } from "@game-pool/beyblade-core";

interface BladeMiniIconProps {
  readonly type: BeybladeType;
  readonly className?: string;
}

const COMMON_PROPS = {
  width: "100%",
  height: "100%",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

const ICONS: Record<BeybladeType, JSX.Element> = {
  attack: (
    <g>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M12 4.5v4" />
      <path d="M19 17.5l-2.8-2.8" />
      <path d="M5 17.5l2.8-2.8" />
    </g>
  ),
  defense: (
    <g>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <circle cx="12" cy="11" r="1.6" />
    </g>
  ),
  stamina: (
    <g>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="19.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </g>
  ),
  balance: (
    <g>
      <path d="M12 4.5a7.5 7.5 0 0 0 0 15 5 5 0 0 1 0-15z" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 4.5a7.5 7.5 0 0 1 0 15 5 5 0 0 0 0-15z" />
      <circle cx="12" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="1.1" fill="currentColor" stroke="none" />
    </g>
  ),
};

export function BladeMiniIcon({ type, className }: BladeMiniIconProps): JSX.Element {
  return (
    <svg {...COMMON_PROPS} className={className} data-blade-icon={type}>
      {ICONS[type]}
    </svg>
  );
}
