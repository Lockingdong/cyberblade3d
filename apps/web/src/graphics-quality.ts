import { createContext } from "react";
export type GraphicsQuality = "low" | "medium" | "high";
export const GraphicsQualityContext = createContext<GraphicsQuality>("medium");
export const GRAPHICS_QUALITY = {
  low: { label: "低", dpr: 1, shadows: false, shadowSize: 512, bloom: false },
  medium: {
    label: "中",
    dpr: 1.25,
    shadows: true,
    shadowSize: 1024,
    bloom: false,
  },
  high: { label: "高", dpr: 1.5, shadows: true, shadowSize: 2048, bloom: true },
} as const;
export function loadGraphicsQuality(): GraphicsQuality {
  try {
    const value = localStorage.getItem("cyberblade.graphics-quality");
    if (value === "low" || value === "medium" || value === "high") return value;
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  return "medium";
}
export function saveGraphicsQuality(value: GraphicsQuality): void {
  try {
    localStorage.setItem("cyberblade.graphics-quality", value);
  } catch {
    /* Session selection remains usable. */
  }
}
