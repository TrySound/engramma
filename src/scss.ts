import { kebabCase, noCase } from "change-case";
import { compareTreeNodes, type TreeNode } from "./store";
import {
  type TokenMeta,
  type TreeNodeMeta,
  resolveTokenValue,
} from "./state.svelte";
import type { StrokeStyleValue, TypographyValue } from "./schema";
import { toDimensionValue, toFontFamily, toStyleValue } from "./css-variables";
import { isTokenReference } from "./tokens";

const addStrokeStyle = (
  variableName: string,
  value: StrokeStyleValue,
  lines: string[],
) => {
  if (typeof value === "string") {
    lines.push(`${variableName}: ${value};`);
  } else {
    const dashArray = value.dashArray.map(toDimensionValue).join(", ");
    lines.push(`${variableName}-dash-array: ${dashArray};`);
    lines.push(`${variableName}-line-cap: ${value.lineCap};`);
  }
};

const addTypography = (
  variableName: string,
  value: TypographyValue,
  lines: string[],
) => {
  const fontFamily = toFontFamily(value.fontFamily);
  const fontSize = toDimensionValue(value.fontSize);
  const letterSpacing = toDimensionValue(value.letterSpacing);
  lines.push(`${variableName}-font-family: ${fontFamily};`);
  lines.push(`${variableName}-font-size: ${fontSize};`);
  lines.push(`${variableName}-font-weight: ${value.fontWeight};`);
  lines.push(`${variableName}-line-height: ${value.lineHeight};`);
  lines.push(`${variableName}-letter-spacing: ${letterSpacing};`);
  lines.push(
    `${variableName}: ${value.fontWeight} ${fontSize}/${value.lineHeight} ${fontFamily};`,
  );
};

/**
 * Convert a token reference like "{colors.primary}" to an SCSS variable like "$colors-primary"
 */
const referenceToVariable = (reference: string): string => {
  // Remove curly braces and split by dots
  const path = reference.replace(/[{}]/g, "").split(".");
  // Convert to kebab-case and create SCSS variable
  return `$${kebabCase(path.join("-"))}`;
};

const processNode = (
  node: TreeNode<TreeNodeMeta>,
  path: string[],
  childrenByParent: Map<string | undefined, TreeNode<TreeNodeMeta>[]>,
  allNodes: Map<string, TreeNode<TreeNodeMeta>>,
  lines: string[],
) => {
  // group is only added to variable name
  if (node.meta.nodeType === "token-group") {
    const children = childrenByParent.get(node.nodeId) ?? [];
    for (const child of children) {
      processNode(
        child,
        [...path, node.meta.name],
        childrenByParent,
        allNodes,
        lines,
      );
    }
  }

  if (node.meta.nodeType === "token") {
    const token = node.meta as TokenMeta;
    const variableName = `$${kebabCase(noCase([...path, node.meta.name].join("-")))}`;
    // Handle token aliases (references to other tokens)
    if (typeof token.value === "string" && isTokenReference(token.value)) {
      const variable = referenceToVariable(token.value);
      lines.push(`${variableName}: ${variable};`);
      return;
    }
    const tokenValue = resolveTokenValue(node, allNodes);
    switch (tokenValue.type) {
      case "color":
      case "dimension":
      case "duration":
      case "cubicBezier":
      case "number":
      case "fontFamily":
      case "fontWeight":
      case "shadow":
      case "gradient":
      case "border":
      case "transition":
        lines.push(`${variableName}: ${toStyleValue(tokenValue)};`);
        break;
      case "strokeStyle":
        addStrokeStyle(variableName, tokenValue.value, lines);
        break;
      case "typography":
        addTypography(variableName, tokenValue.value, lines);
        break;
      default:
        tokenValue satisfies never;
        break;
    }
  }
};

export const generateScssVariables = (
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  const lines: string[] = [];
  const childrenByParent = new Map<
    string | undefined,
    TreeNode<TreeNodeMeta>[]
  >();
  // build index for children
  for (const node of nodes.values()) {
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }
  for (const children of childrenByParent.values()) {
    children.sort(compareTreeNodes);
  }
  // render scss variables
  const rootChildren = childrenByParent.get(undefined) ?? [];
  for (const node of rootChildren) {
    processNode(node, [], childrenByParent, nodes, lines);
  }
  return lines.join("\n");
};
