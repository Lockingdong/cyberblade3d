import Svg, { Circle, Line, Path, Polygon } from "react-native-svg";

/**
 * React Native counterparts of the web garage icons
 * (apps/web/src/components/CustomizerIcons.tsx). Path data is copied verbatim
 * so both platforms draw the same marks; only the element names differ.
 */

type IconProps = { color?: string; size?: number };

const STROKE = {
  fill: "none",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function GarageIcon({ color = "#f8fafc", size = 20 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...STROKE}
      stroke={color}
    >
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

export function BladeSlotIcon({ color = "#f8fafc", size = 20 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...STROKE}
      stroke={color}
    >
      <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Svg>
  );
}

export function RatchetSlotIcon({ color = "#f8fafc", size = 20 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...STROKE}
      stroke={color}
    >
      <Circle cx="12" cy="12" r="8" />
      <Path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.34 6.34l2.83 2.83M14.83 14.83l2.83 2.83M6.34 17.66l2.83-2.83M14.83 9.17l2.83-2.83" />
    </Svg>
  );
}

export function BitSlotIcon({ color = "#f8fafc", size = 20 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...STROKE}
      stroke={color}
    >
      <Path d="M12 2v20M12 18l-4-4h8l-4 4z" />
      <Circle cx="12" cy="8" r="5" />
      <Circle cx="12" cy="8" r="2" fill={color} />
    </Svg>
  );
}

export function ChipSlotIcon({ color = "#f8fafc", size = 20 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...STROKE}
      stroke={color}
    >
      <Path d="M6 3h12l4 6-10 12L2 9l4-6z" />
      <Path d="M11 3l-4 6 5 12" />
      <Path d="M13 3l4 6-5 12" />
      <Path d="M2 9h20" />
    </Svg>
  );
}

export function StatsChartIcon({ color = "#f8fafc", size = 20 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...STROKE}
      stroke={color}
    >
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
    </Svg>
  );
}

export function InfoIcon({ color = "#f8fafc", size = 18 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...STROKE}
      stroke={color}
    >
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="16" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12.01" y2="8" />
    </Svg>
  );
}

export function ExplodedLayersIcon({
  color = "#f8fafc",
  size = 18,
}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...STROKE}
      stroke={color}
    >
      <Polygon points="12 2 2 7 12 12 22 7 12 2" />
      <Path d="M2 12l10 5 10-5" />
      <Path d="M2 17l10 5 10-5" />
    </Svg>
  );
}

/** The garage's camera-cycle button, one icon per shared preview preset. */
export function CameraPresetIcon({
  preset,
  color = "#f8fafc",
  size = 18,
}: IconProps & { preset: "default" | "top" | "side" | "bottom" }) {
  if (preset === "top") {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        {...STROKE}
        stroke={color}
      >
        <Circle cx="12" cy="12" r="9" />
        <Circle cx="12" cy="12" r="4" />
        <Circle cx="12" cy="12" r="1.5" fill={color} />
      </Svg>
    );
  }
  if (preset === "side") {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        {...STROKE}
        stroke={color}
      >
        <Path d="M4 12h16" />
        <Path d="M4 7l8-3 8 3v10l-8 3-8-3V7z" />
      </Svg>
    );
  }
  if (preset === "bottom") {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        {...STROKE}
        stroke={color}
      >
        <Circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
        <Path d="M12 5v14M5 12h14" />
        <Circle cx="12" cy="12" r="2.5" fill={color} />
      </Svg>
    );
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...STROKE}
      stroke={color}
    >
      <Path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <Path d="M3.27 6.96L12 12.01l8.73-5.05" />
      <Line x1="12" y1="22.08" x2="12" y2="12" />
    </Svg>
  );
}
