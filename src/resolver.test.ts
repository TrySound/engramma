import { test, expect, describe } from "vitest";
import { parseTokenResolver, isResolverFormat } from "./resolver";
import type { TreeNode } from "./store";
import type { TreeNodeMeta } from "./state.svelte";

describe("isResolverFormat", () => {
  test("detects valid resolver format", () => {
    const resolver = {
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Test",
          sources: [],
        },
      ],
    };
    expect(isResolverFormat(resolver)).toBe(true);
  });

  test("rejects non-object input", () => {
    expect(isResolverFormat("not an object")).toBe(false);
    expect(isResolverFormat(123)).toBe(false);
    expect(isResolverFormat(null)).toBe(false);
  });

  test("rejects object without version", () => {
    expect(isResolverFormat({ resolutionOrder: [] })).toBe(false);
  });

  test("rejects object without resolutionOrder", () => {
    expect(isResolverFormat({ version: "2025.10" })).toBe(false);
  });

  test("rejects object with wrong version", () => {
    expect(
      isResolverFormat({
        version: "2024.01",
        resolutionOrder: [],
      }),
    ).toBe(false);
  });

  test("rejects object with non-array resolutionOrder", () => {
    expect(
      isResolverFormat({
        version: "2025.10",
        resolutionOrder: "not an array",
      }),
    ).toBe(false);
  });
});

describe("parseTokenResolver", () => {
  test("rejects input without version field", () => {
    const result = parseTokenResolver({
      resolutionOrder: [],
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("version");
  });

  test("rejects input with wrong version", () => {
    const result = parseTokenResolver({
      version: "2024.01",
      resolutionOrder: [],
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("2025.10");
  });

  test("rejects root-level sets object with property keys", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      sets: { someSet: { sources: [] } },
      resolutionOrder: [],
    } as unknown);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("rejects root-level modifiers object with property keys", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      modifiers: { someModifier: { contexts: {} } },
      resolutionOrder: [],
    } as unknown);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("accepts valid minimal resolver with empty resolutionOrder", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [],
    });
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(0); // No sets when no Sets in resolutionOrder
  });

  test("accepts optional name and description", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      name: "My Design System",
      description: "Design tokens for my app",
      resolutionOrder: [],
    });
    expect(result.errors).toHaveLength(0);
  });

  test("parses single set with single source", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Should have Foundation set and color token
    expect(result.nodes.length).toBeGreaterThanOrEqual(2);
    // First node should be the Foundation set with correct name
    const setNode = result.nodes.find((n) => n.meta.nodeType === "token-set");
    expect(setNode).toBeDefined();
    expect(setNode?.meta.name).toBe("Foundation");
  });

  test("parses single set with empty sources array", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Empty",
          sources: [],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Empty set should still create a root set node
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].meta.nodeType).toBe("token-set");
    expect(result.nodes[0].meta.name).toBe("Empty");
  });

  test("merges multiple sources within a set respecting order", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Colors",
          sources: [
            {
              primary: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [1, 0, 0] },
              },
            },
            {
              secondary: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [0, 1, 0] },
              },
            },
            {
              primary: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [0, 0, 1] },
              }, // Override with blue
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Should have Colors set with merged sources
    expect(result.nodes.length).toBeGreaterThan(1);
    const setNode = result.nodes.find((n) => n.meta.nodeType === "token-set");
    expect(setNode?.meta.name).toBe("Colors");
  });

  test("processes multiple sets in resolutionOrder sequentially", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              spacing: {
                sm: {
                  $type: "dimension",
                  $value: { value: 8, unit: "px" },
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Semantic",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Should have multiple root sets
    const setNodes = result.nodes.filter(
      (n) => n.meta.nodeType === "token-set",
    );
    expect(setNodes).toHaveLength(2);
    expect(setNodes.map((n) => n.meta.name)).toEqual([
      "Foundation",
      "Semantic",
    ]);
    // All root sets should have parentId: undefined
    expect(setNodes.every((n) => n.parentId === undefined)).toBe(true);
  });

  test("keeps sets separate without merging between them", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [
            {
              color: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [1, 0, 0] },
                },
              },
            },
          ],
        },
        {
          type: "set",
          name: "Semantic",
          sources: [
            {
              color: {
                accent: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Should have two separate root sets
    const setNodes = result.nodes.filter(
      (n) => n.meta.nodeType === "token-set",
    );
    expect(setNodes).toHaveLength(2);
    expect(setNodes.map((n) => n.meta.name)).toEqual([
      "Foundation",
      "Semantic",
    ]);
  });

  test("silently skips modifier items in resolutionOrder", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Base",
          sources: [
            {
              colors: {
                primary: {
                  $type: "color",
                  $value: { colorSpace: "srgb", components: [0, 0, 1] },
                },
              },
            },
          ],
        },
        {
          type: "modifier",
          name: "Theme",
          contexts: {
            light: [],
            dark: [
              {
                colors: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 1, 1] },
                  },
                },
              },
            ],
          },
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Modifier should be silently skipped, only Base set processed
    expect(result.nodes.length).toBeGreaterThan(1);
  });

  test("collects errors from invalid tokens in sources", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Invalid",
          sources: [
            {
              badToken: {
                $type: "color",
                $value: "not-a-valid-color",
              },
            },
          ],
        },
      ],
    });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.path.includes("badToken"))).toBe(true);
  });

  test("merges nested group structures within a set", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Colors",
          sources: [
            {
              semantic: {
                $type: "color",
                button: {
                  primary: {
                    $value: { colorSpace: "srgb", components: [0, 0, 1] },
                  },
                },
              },
            },
            {
              semantic: {
                $type: "color",
                text: {
                  default: {
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                  },
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Nested sources within the set should be merged
    expect(result.nodes.length).toBeGreaterThan(1);
    const setNode = result.nodes.find((n) => n.meta.nodeType === "token-set");
    expect(setNode?.meta.name).toBe("Colors");
  });

  test("preserves nested token group hierarchy within sets", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "SemanticColors",
          sources: [
            {
              semantic: {
                button: {
                  primary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 1] },
                  },
                  secondary: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 0, 0] },
                  },
                },
                text: {
                  default: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                  },
                },
              },
            },
          ],
        },
      ],
    });

    expect(result.errors).toHaveLength(0);

    // Find the Set node
    const setNode = result.nodes.find((n) => n.meta.nodeType === "token-set");
    expect(setNode).toBeDefined();
    expect(setNode?.meta.name).toBe("SemanticColors");

    // Find root group "semantic" - should be child of Set
    const semanticGroup = result.nodes.find(
      (n) => n.meta.nodeType === "token-group" && n.meta.name === "semantic",
    );
    expect(semanticGroup).toBeDefined();
    expect(semanticGroup?.parentId).toBe(setNode?.nodeId);

    // Find nested group "button" - should be child of "semantic"
    const buttonGroup = result.nodes.find(
      (n) => n.meta.nodeType === "token-group" && n.meta.name === "button",
    );
    expect(buttonGroup).toBeDefined();
    expect(buttonGroup?.parentId).toBe(semanticGroup?.nodeId);

    // Find nested group "text" - should also be child of "semantic"
    const textGroup = result.nodes.find(
      (n) => n.meta.nodeType === "token-group" && n.meta.name === "text",
    );
    expect(textGroup).toBeDefined();
    expect(textGroup?.parentId).toBe(semanticGroup?.nodeId);

    // Find token "primary" - should be child of "button"
    const primaryToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "primary",
    );
    expect(primaryToken).toBeDefined();
    expect(primaryToken?.parentId).toBe(buttonGroup?.nodeId);

    // Find token "secondary" - should be child of "button"
    const secondaryToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "secondary",
    );
    expect(secondaryToken).toBeDefined();
    expect(secondaryToken?.parentId).toBe(buttonGroup?.nodeId);

    // Find token "default" - should be child of "text"
    const defaultToken = result.nodes.find(
      (n) => n.meta.nodeType === "token" && n.meta.name === "default",
    );
    expect(defaultToken).toBeDefined();
    expect(defaultToken?.parentId).toBe(textGroup?.nodeId);
  });

  test("preserves set name and metadata on root set node", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "CustomSet",
          description: "Custom set description",
          sources: [],
          $extensions: { "custom.key": { data: "value" } },
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    const setNode = result.nodes.find((n) => n.meta.nodeType === "token-set");
    expect(setNode?.meta.name).toBe("CustomSet");
    expect(setNode?.meta.description).toBe("Custom set description");
    expect(setNode?.meta.extensions).toEqual({
      "custom.key": { data: "value" },
    });
  });

  test("preserves token descriptions and extensions from sources", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Documented",
          sources: [
            {
              brand: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [0, 0, 1] },
                $description: "Brand primary color",
                $extensions: { "custom.key": { data: "value" } },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    const brandTokens = result.nodes.filter(
      (n) => n.meta.nodeType === "token" && n.meta.name === "brand",
    );
    expect(brandTokens.length).toBeGreaterThan(0);
    if (brandTokens[0]?.meta.nodeType === "token") {
      expect(brandTokens[0].meta.description).toBe("Brand primary color");
      expect(brandTokens[0].meta.extensions).toEqual({
        "custom.key": { data: "value" },
      });
    }
  });

  test("handles complex token types (shadow, border, typography)", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Complex",
          sources: [
            {
              shadows: {
                $type: "shadow",
                drop: {
                  $value: {
                    color: {
                      colorSpace: "srgb",
                      components: [0, 0, 0],
                      alpha: 0.2,
                    },
                    offsetX: { value: 0, unit: "px" },
                    offsetY: { value: 4, unit: "px" },
                    blur: { value: 8, unit: "px" },
                    spread: { value: 0, unit: "px" },
                  },
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.errors).toHaveLength(0);
    // Complex token types should parse successfully
    expect(result.nodes.length).toBeGreaterThan(1);
  });

  test("rejects invalid set without name", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          sources: [],
        } as unknown,
      ],
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("rejects invalid set without sources", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "NoSources",
        } as unknown,
      ],
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("rejects modifier without contexts", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "BadModifier",
        } as unknown,
      ],
    });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("accepts modifier with optional default", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "Theme",
          contexts: {
            light: [],
            dark: [],
          },
          default: "light",
        },
      ],
    });
    // Modifier is skipped, but should validate correctly
    expect(result.errors.length).toBe(0);
  });

  test("accepts modifier with optional description and extensions", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "modifier",
          name: "Theme",
          description: "Color theme selector",
          contexts: {
            light: [],
            dark: [],
          },
          $extensions: { "custom.meta": { version: "1" } },
        },
      ],
    });
    expect(result.errors.length).toBe(0);
  });

  test("accepts set with optional description and extensions", () => {
    const result = parseTokenResolver({
      version: "2025.10",
      resolutionOrder: [
        {
          type: "set",
          name: "Foundation",
          sources: [],
          description: "Foundation tokens",
          $extensions: { "custom.meta": { category: "foundation" } },
        },
      ],
    });
    expect(result.errors.length).toBe(0);
  });
});
