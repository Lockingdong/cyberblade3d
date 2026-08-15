import { describe, expect, it } from "vitest";
import { palette, webThemeVariables } from "./index";

describe("webThemeVariables", () => {
  it("maps the canonical native palette to Web CSS variables", () => {
    const variables = webThemeVariables();
    expect(variables["--cb-ink"]).toBe(palette.ink);
    expect(variables["--cb-paper"]).toBe(palette.paper);
    expect(variables["--cb-cyan"]).toBe(palette.cyan);
    expect(variables["--cb-purple"]).toBe(palette.purple);
  });
});
