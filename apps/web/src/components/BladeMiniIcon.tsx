import type { JSX } from "react";
import type { BeybladeType } from "@cyberblade/core";

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

// Minimalist Vector Icons matching the exact 3D Face Chip Emblems defined in chip-art.ts
const ICONS: Record<BeybladeType, JSX.Element> = {
  // 1. 赤強晶片 (attack_core) Emblem: 狂龍皇冠與雙龍牙 (Crimson Dragon Crown & Fangs Crest)
  attack: (
    <g>
      {/* Central Dragon Core Orb */}
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      {/* Dragon Eye Diamond Frame */}
      <polygon points="7.5,12 12,9.6 16.5,12 12,14.4" strokeWidth="1.4" />
      {/* Triple Dragon Horn Crown (Center, Left & Right Horns) */}
      <path d="M12 9.6V5.5" strokeWidth="1.8" />
      <path d="M10.1 10.4L5.5 4.8l3 0.6" strokeWidth="1.5" />
      <path d="M13.9 10.4l4.6-5.6-3 0.6" strokeWidth="1.5" />
      {/* Dragon Jaw & Lower Fangs */}
      <path d="M9.1 13.3L6.8 18.7l2.8 1" strokeWidth="1.5" />
      <path d="M14.9 13.3l2.3 5.4-2.8 1" strokeWidth="1.5" />
      <path d="M12 14.4V20.8" strokeWidth="1.6" />
    </g>
  ),

  // 2. 玄武晶片 (defense_core) Emblem: 重裝盾牌與三段裝甲 (Iron Turtle Shell / Armor Shield Crest)
  defense: (
    <g>
      {/* Shield Outer Outline */}
      <path d="M5.2 6.8h13.6l-1.4 7.7L12 21.2 6.6 14.5z" strokeWidth="1.6" fill="currentColor" fillOpacity="0.08" />
      {/* Center Reinforcement Spine */}
      <path d="M12 8.8v8.6" strokeWidth="1.5" />
      {/* Three Inset Horizontal Armor Bars */}
      <path d="M8.3 10.4h7.4" strokeWidth="1.5" />
      <path d="M9 13.1h6" strokeWidth="1.5" />
      <path d="M10.2 15.8h3.6" strokeWidth="1.5" />
    </g>
  ),

  // 3. 持久晶片 (stamina_core) Emblem: 雙重耐力環與中心轉軸 (Endurance Rings & Spindle Crest)
  stamina: (
    <g>
      {/* Outer Endurance Ring */}
      <circle cx="12" cy="12" r="9.1" strokeWidth="1.4" />
      {/* Inner Endurance Ring */}
      <circle cx="12" cy="12" r="5.6" strokeWidth="1.5" />
      {/* Center Balanced Spindle Cross */}
      <path d="M12 8.8v6.4" strokeWidth="1.6" />
      <path d="M8.8 12h6.4" strokeWidth="1.6" />
      {/* Central Gyro Hub */}
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </g>
  ),

  // 4. 平衡晶片 (balance_core) Emblem: 平衡菱形與四極穩定翼 (Balance Diamond & Stabilizer Arms Crest)
  balance: (
    <g>
      {/* Centered Balance Diamond */}
      <polygon points="12,8.2 15.8,12 12,15.8 8.2,12" strokeWidth="1.6" fill="currentColor" fillOpacity="0.12" />
      {/* Core Orb */}
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      {/* Four Equal Radial Stabilizer Arms */}
      <path d="M12 7.5V2.7" strokeWidth="1.6" />
      <path d="M12 16.5v4.8" strokeWidth="1.6" />
      <path d="M7.5 12H2.7" strokeWidth="1.6" />
      <path d="M16.5 12h4.8" strokeWidth="1.6" />
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
