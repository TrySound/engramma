import { test, expect, describe } from "vitest";
import { generateScssVariables } from "./scss";
import { parseDesignTokens } from "./tokens";
import type { TreeNode } from "./store";
import type { GroupMeta, TokenMeta } from "./state.svelte";

type TreeNodeMeta = GroupMeta | TokenMeta;

// Helper to convert array to Map
const nodesToMap = (nodes: TreeNode<TreeNodeMeta>[]) => {
  const map = new Map<string, TreeNode<TreeNodeMeta>>();
  for (const node of nodes) {
    map.set(node.nodeId, node);
  }
  return map;
};

describe("generateScssVariables", () => {
  test("generates empty SCSS for empty nodes", () => {
    const result = generateScssVariables(new Map());
    expect(result).toBe("");
  });

  test("generates SCSS variables for simple color token", () => {
    const parsed = parseDesignTokens({
      myColor: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [1, 0, 0] },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$my-color: rgb(100% 0% 0%);");
  });

  test("generates SCSS variables for color with alpha", () => {
    const parsed = parseDesignTokens({
      myColor: {
        $type: "color",
        $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.5 },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$my-color: rgb(0% 0% 0% / 0.5);");
  });

  test("generates SCSS variables for dimension token", () => {
    const parsed = parseDesignTokens({
      spacing: {
        $type: "dimension",
        $value: { value: 16, unit: "px" },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$spacing: 16px;");
  });

  test("generates SCSS variables for grouped tokens", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
        secondary: {
          $value: { colorSpace: "srgb", components: [0.8, 0.2, 0.5] },
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$colors-primary:");
    expect(scss).toContain("$colors-secondary:");
  });

  test("generates SCSS variables for number token", () => {
    const parsed = parseDesignTokens({
      myNumber: {
        $type: "number",
        $value: 42,
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$my-number: 42;");
  });

  test("generates SCSS variables for duration token", () => {
    const parsed = parseDesignTokens({
      fast: {
        $type: "duration",
        $value: { value: 100, unit: "ms" },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$fast: 100ms;");
  });

  test("generates SCSS variables for cubicBezier token", () => {
    const parsed = parseDesignTokens({
      ease: {
        $type: "cubicBezier",
        $value: [0.25, 0.1, 0.25, 1],
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$ease: cubic-bezier(0.25, 0.1, 0.25, 1);");
  });

  test("generates SCSS variables for fontFamily token as string", () => {
    const parsed = parseDesignTokens({
      sans: {
        $type: "fontFamily",
        $value: "Arial, sans-serif",
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$sans: Arial, sans-serif;");
  });

  test("generates SCSS variables for fontFamily token as array", () => {
    const parsed = parseDesignTokens({
      sans: {
        $type: "fontFamily",
        $value: ["Arial", "Helvetica", "sans-serif"],
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$sans: Arial, Helvetica, sans-serif;");
  });

  test("generates SCSS variables for fontWeight token", () => {
    const parsed = parseDesignTokens({
      bold: {
        $type: "fontWeight",
        $value: 700,
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$bold: 700;");
  });

  test("generates SCSS variables for transition composite token", () => {
    const parsed = parseDesignTokens({
      fast: {
        $type: "transition",
        $value: {
          duration: { value: 100, unit: "ms" },
          delay: { value: 0, unit: "ms" },
          timingFunction: [0.42, 0, 0.58, 1],
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$fast: 100ms cubic-bezier(0.42, 0, 0.58, 1) 0ms;");
  });

  test("generates SCSS variables for strokeStyle as string", () => {
    const parsed = parseDesignTokens({
      solid: {
        $type: "strokeStyle",
        $value: "solid",
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$solid: solid;");
  });

  test("generates SCSS variables for strokeStyle with dashArray", () => {
    const parsed = parseDesignTokens({
      dashed: {
        $type: "strokeStyle",
        $value: {
          dashArray: [
            { value: 4, unit: "px" },
            { value: 2, unit: "px" },
          ],
          lineCap: "round",
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$dashed-dash-array: 4px, 2px;");
    expect(scss).toContain("$dashed-line-cap: round;");
  });

  test("generates SCSS variables for shadow token", () => {
    const parsed = parseDesignTokens({
      sm: {
        $type: "shadow",
        $value: {
          color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.1 },
          offsetX: { value: 1, unit: "px" },
          offsetY: { value: 2, unit: "px" },
          blur: { value: 4, unit: "px" },
          spread: { value: 0, unit: "px" },
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$sm: 1px 2px 4px 0px rgb(0% 0% 0% / 0.1);");
  });

  test("generates SCSS variables for inset shadow", () => {
    const parsed = parseDesignTokens({
      inset: {
        $type: "shadow",
        $value: {
          color: { colorSpace: "srgb", components: [0, 0, 0, 0.1] },
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 2, unit: "px" },
          blur: { value: 4, unit: "px" },
          spread: { value: 0, unit: "px" },
          inset: true,
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("inset 0px 2px 4px 0px");
  });

  test("generates SCSS variables for multiple shadows", () => {
    const parsed = parseDesignTokens({
      multiple: {
        $type: "shadow",
        $value: [
          {
            color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.1 },
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 1, unit: "px" },
            blur: { value: 2, unit: "px" },
            spread: { value: 0, unit: "px" },
          },
          {
            color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.05 },
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 4, unit: "px" },
            blur: { value: 8, unit: "px" },
            spread: { value: 0, unit: "px" },
          },
        ],
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$multiple:");
    expect(scss).toContain("rgb(0% 0% 0% / 0.1)");
    expect(scss).toContain("rgb(0% 0% 0% / 0.05)");
  });

  test("generates SCSS variables for border token", () => {
    const parsed = parseDesignTokens({
      thin: {
        $type: "border",
        $value: {
          color: { colorSpace: "srgb", components: [0.9, 0.9, 0.9] },
          width: { value: 1, unit: "px" },
          style: "solid",
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$thin: 1px solid rgb(90% 90% 90%);");
  });

  test("generates SCSS variables for typography token", () => {
    const parsed = parseDesignTokens({
      h1: {
        $type: "typography",
        $value: {
          fontFamily: "Inter, sans-serif",
          fontSize: { value: 32, unit: "px" },
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: { value: -0.02, unit: "px" },
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$h1-font-family: Inter, sans-serif;");
    expect(scss).toContain("$h1-font-size: 32px;");
    expect(scss).toContain("$h1-font-weight: 700;");
    expect(scss).toContain("$h1-line-height: 1.2;");
    expect(scss).toContain("$h1-letter-spacing: -0.02px;");
    expect(scss).toContain("$h1: 700 32px/1.2 Inter, sans-serif;");
  });

  test("generates SCSS variables for gradient token", () => {
    const parsed = parseDesignTokens({
      primary: {
        $type: "gradient",
        $value: [
          {
            color: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
            position: 0,
          },
          {
            color: { colorSpace: "srgb", components: [0.1, 0.5, 0.9] },
            position: 1,
          },
        ],
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain(
      "$primary: linear-gradient(90deg, rgb(0% 40% 80%) 0%, rgb(10% 50% 90%) 100%);",
    );
  });

  test("generates SCSS for multiple nested groups", () => {
    const parsed = parseDesignTokens({
      design: {
        colors: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
          },
        },
        spacing: {
          $type: "dimension",
          sm: {
            $value: { value: 8, unit: "px" },
          },
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$design-colors-primary:");
    expect(scss).toContain("$design-spacing-sm:");
  });

  test("generates SCSS variables for token alias with reference", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
      myAlias: {
        $type: "color",
        $value: "{colors.primary}",
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$my-alias: $colors-primary;");
  });

  test("generates SCSS variables for nested token alias", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
      theme: {
        $type: "color",
        accent: {
          $value: "{colors.primary}",
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$theme-accent: $colors-primary;");
  });

  test("generates SCSS variables for dimension alias", () => {
    const parsed = parseDesignTokens({
      spacing: {
        $type: "dimension",
        base: {
          $value: { value: 8, unit: "px" },
        },
      },
      mySpacing: {
        $type: "dimension",
        $value: "{spacing.base}",
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$my-spacing: $spacing-base;");
  });

  test("generates SCSS variables for deeply nested token alias", () => {
    const parsed = parseDesignTokens({
      design: {
        colors: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
          },
        },
      },
      aliases: {
        $type: "color",
        buttonColor: {
          $value: "{design.colors.primary}",
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$aliases-button-color: $design-colors-primary;");
  });

  test("handles multiple aliases referencing same token", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
      primary: {
        $type: "color",
        $value: "{colors.primary}",
      },
      brand: {
        $type: "color",
        $value: "{colors.primary}",
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$primary: $colors-primary;");
    expect(scss).toContain("$brand: $colors-primary;");
  });

  test("can chain aliases through variable references", () => {
    const parsed = parseDesignTokens({
      colors: {
        $type: "color",
        primary: {
          $value: { colorSpace: "srgb", components: [0, 0.4, 0.8] },
        },
      },
      theme: {
        $type: "color",
        brand: {
          $value: "{colors.primary}",
        },
      },
      ui: {
        $type: "color",
        button: {
          $value: "{theme.brand}",
        },
      },
    });
    const scss = generateScssVariables(nodesToMap(parsed.nodes));
    expect(scss).toContain("$colors-primary: rgb(0% 40% 80%);");
    expect(scss).toContain("$theme-brand: $colors-primary;");
    expect(scss).toContain("$ui-button: $theme-brand;");
  });
});
