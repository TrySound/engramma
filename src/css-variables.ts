import { kebabCase, noCase } from "change-case";
import { compareTreeNodes, type TreeNode } from "./store";
import {
  type TokenMeta,
  type TreeNodeMeta,
  resolveTokenValue,
} from "./state.svelte";
import { serializeColor } from "./color";
import { isTokenReference } from "./tokens";
import type {
  BorderValue,
  CubicBezierValue,
  DimensionValue,
  DurationValue,
  FontFamilyValue,
  GradientValue,
  ShadowValue,
  StrokeStyleValue,
  TransitionValue,
  TypographyValue,
  Value,
} from "./schema";

export const toDimensionValue = (value: DimensionValue) => {
  return `${value.value}${value.unit}`;
};

export const toDurationValue = (value: DurationValue) => {
  return `${value.value}${value.unit}`;
};

export const toCubicBezierValue = (value: CubicBezierValue) => {
  return `cubic-bezier(${value.join(", ")})`;
};

export const toFontFamily = (value: FontFamilyValue) => {
  return Array.isArray(value) ? value.join(", ") : value;
};

export const toShadow = (value: ShadowValue) => {
  const shadows = Array.isArray(value) ? value : [value];
  const shadowStrings = shadows.map((shadow) => {
    const color = serializeColor(shadow.color);
    const inset = shadow.inset ? "inset " : "";
    const offsetX = toDimensionValue(shadow.offsetX);
    const offsetY = toDimensionValue(shadow.offsetY);
    const blur = toDimensionValue(shadow.blur);
    const spread = shadow.spread ? toDimensionValue(shadow.spread) : "";
    return `${inset}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
  });
  return shadowStrings.join(", ");
};

export const toGradient = (value: GradientValue) => {
  const stops = value.map(
    (stop) => `${serializeColor(stop.color)} ${stop.position * 100}%`,
  );
  return `linear-gradient(90deg, ${stops.join(", ")})`;
};

const toStrokeStyleValue = (value: StrokeStyleValue) => {
  return typeof value === "string" ? value : "solid";
};

const toBorderValue = (value: BorderValue) => {
  const style = toStrokeStyleValue(value.style);
  const width = toDimensionValue(value.width);
  const color = serializeColor(value.color);
  return `${width} ${style} ${color}`;
};

const toTransitionValue = (value: TransitionValue) => {
  const duration = toDurationValue(value.duration);
  const timingFunction = toCubicBezierValue(value.timingFunction);
  const delay = toDurationValue(value.delay);
  return `${duration} ${timingFunction} ${delay}`;
};

export const toStyleValue = (tokenValue: Value): undefined | string => {
  switch (tokenValue.type) {
    case "fontFamily":
      return toFontFamily(tokenValue.value);
    case "color":
      return serializeColor(tokenValue.value);
    case "shadow":
      return toShadow(tokenValue.value);
    case "duration":
      return toDurationValue(tokenValue.value);
    case "dimension":
      return toDimensionValue(tokenValue.value);
    case "fontWeight":
    case "number":
      return `${tokenValue.value}`;
    case "cubicBezier":
      return toCubicBezierValue(tokenValue.value);
    case "strokeStyle":
      return toStrokeStyleValue(tokenValue.value);
    case "border":
      return toBorderValue(tokenValue.value);
    case "transition":
      return toTransitionValue(tokenValue.value);
    case "gradient":
      return toGradient(tokenValue.value);
    case "typography":
      return;
    default:
      tokenValue satisfies never;
  }
};

const addStrokeStyle = (
  propertyName: string,
  value: StrokeStyleValue,
  lines: string[],
) => {
  if (typeof value === "string") {
    lines.push(`  ${propertyName}: ${value};`);
  } else {
    const dashArray = value.dashArray.map(toDimensionValue).join(", ");
    lines.push(`  ${propertyName}-dash-array: ${dashArray};`);
    lines.push(`  ${propertyName}-line-cap: ${value.lineCap};`);
  }
};

const addTypography = (
  propertyName: string,
  value: TypographyValue,
  lines: string[],
) => {
  const fontFamily = toFontFamily(value.fontFamily);
  const fontSize = toDimensionValue(value.fontSize);
  const letterSpacing = toDimensionValue(value.letterSpacing);
  lines.push(`  ${propertyName}-font-family: ${fontFamily};`);
  lines.push(`  ${propertyName}-font-size: ${fontSize};`);
  lines.push(`  ${propertyName}-font-weight: ${value.fontWeight};`);
  lines.push(`  ${propertyName}-line-height: ${value.lineHeight};`);
  lines.push(`  ${propertyName}-letter-spacing: ${letterSpacing};`);
  lines.push(
    `  ${propertyName}: ${value.fontWeight} ${fontSize}/${value.lineHeight} ${fontFamily};`,
  );
};

/**
 * Convert a token reference like "{colors.primary}" to a CSS variable like "var(--colors-primary)"
 */
export const referenceToVariable = (reference: string): string => {
  // Remove curly braces and split by dots
  const path = reference.replace(/[{}]/g, "").split(".");
  // Convert to kebab-case and create CSS variable
  return `var(--${kebabCase(noCase(path.join("-")))})`;
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
    const propertyName = `--${kebabCase([...path, node.meta.name].join("-"))}`;
    // Handle token aliases (references to other tokens)
    if (typeof token.value === "string" && isTokenReference(token.value)) {
      const variable = referenceToVariable(token.value);
      lines.push(`  ${propertyName}: ${variable};`);
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
        lines.push(`  ${propertyName}: ${toStyleValue(tokenValue)};`);
        break;
      case "strokeStyle":
        addStrokeStyle(propertyName, tokenValue.value, lines);
        break;
      case "typography":
        addTypography(propertyName, tokenValue.value, lines);
        break;
      default:
        tokenValue satisfies never;
        break;
    }
  }
};

export const generateCssVariables = (
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
  // render css variables in root element
  lines.push(":root {");
  const rootChildren = childrenByParent.get(undefined) ?? [];
  for (const node of rootChildren) {
    processNode(node, [], childrenByParent, nodes, lines);
  }
  lines.push("}");
  return lines.join("\n");
};
