import { kebabCase, noCase } from "change-case";
import { compareTreeNodes, type TreeNode } from "./store";
import { type GroupMeta, type TokenMeta } from "./state.svelte";
import { serializeColor } from "./color";
import {
  type CubicBezierValue,
  type DimensionValue,
  type DurationValue,
  type FontFamilyValue,
  type StrokeStyleValue,
  type RawBorderValue,
  type RawGradientValue,
  type RawShadowValue,
  type RawTransitionValue,
  type RawTypographyValue,
  isNodeRef,
  type NodeRef,
} from "./schema";

type TreeNodeMeta = GroupMeta | TokenMeta;

export const toDimensionValue = (value: DimensionValue) => {
  return `${value.value}${value.unit}`;
};

export const toDurationValue = (value: DurationValue) => {
  return `${value.value}${value.unit}`;
};

export const toCubicBezierValue = (value: CubicBezierValue) => {
  return `cubic-bezier(${value.join(", ")})`;
};

export const toFontFamilyValue = (value: FontFamilyValue) => {
  return Array.isArray(value) ? value.join(", ") : value;
};

export const toStrokeStyleValue = (value: StrokeStyleValue) => {
  return typeof value === "string" ? value : "solid";
};

/**
 * Generate CSS variable name a token reference
 */
export const referenceToVariable = (
  nodeRef: NodeRef,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  const path: string[] = [];
  let currentId: string | undefined = nodeRef.ref;
  while (currentId) {
    const node = nodes.get(currentId);
    if (!node) {
      break;
    }
    path.unshift(node.meta.name);
    currentId = node.parentId;
  }
  // Convert to kebab-case and create CSS variable
  return `var(--${kebabCase(noCase(path.join("-")))})`;
};

/**
 * Convert a value or reference to a string or nested var()
 */
const valueOrVar = <T>(
  value: T | NodeRef,
  converter: (v: T) => string,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): string => {
  if (isNodeRef(value)) {
    return referenceToVariable(value, nodes);
  }
  return converter(value as T);
};

export const toShadowValue = (
  value: RawShadowValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const shadows = Array.isArray(value) ? value : [value];
  const shadowStrings = shadows.map((shadow) => {
    const color = valueOrVar(shadow.color, serializeColor, nodes);
    const inset = shadow.inset ? "inset " : "";
    const offsetX = valueOrVar(shadow.offsetX, toDimensionValue, nodes);
    const offsetY = valueOrVar(shadow.offsetY, toDimensionValue, nodes);
    const blur = valueOrVar(shadow.blur, toDimensionValue, nodes);
    const spread = valueOrVar(shadow.spread, toDimensionValue, nodes);
    return `${inset}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
  });
  return shadowStrings.join(", ");
};

export const toGradientValue = (
  value: RawGradientValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const stops = value.map((stop) => {
    const color = valueOrVar(stop.color, serializeColor, nodes);
    return `${color} ${stop.position * 100}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
};

const toBorderValue = (
  value: RawBorderValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const style = valueOrVar(value.style, toStrokeStyleValue, nodes);
  const width = valueOrVar(value.width, toDimensionValue, nodes);
  const color = valueOrVar(value.color, serializeColor, nodes);
  return `${width} ${style} ${color}`;
};

const toTransitionValue = (
  value: RawTransitionValue,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const duration = valueOrVar(value.duration, toDurationValue, nodes);
  const timingFunction = valueOrVar(
    value.timingFunction,
    toCubicBezierValue,
    nodes,
  );
  const delay = valueOrVar(value.delay, toDurationValue, nodes);
  return `${duration} ${timingFunction} ${delay}`;
};

const addStrokeStyle = (
  propertyName: string,
  value: StrokeStyleValue | string,
  lines: string[],
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  if (isNodeRef(value)) {
    lines.push(`  ${propertyName}: ${referenceToVariable(value, nodes)};`);
    return;
  }
  if (typeof value === "string") {
    lines.push(`  ${propertyName}: ${value};`);
  } else {
    const dashArray = value.dashArray
      .map((d) => valueOrVar(d, toDimensionValue, nodes))
      .join(", ");
    lines.push(`  ${propertyName}-dash-array: ${dashArray};`);
    lines.push(`  ${propertyName}-line-cap: ${value.lineCap};`);
  }
};

const addTypography = (
  propertyName: string,
  value: RawTypographyValue,
  lines: string[],
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  const fontFamily = valueOrVar(value.fontFamily, toFontFamilyValue, nodes);
  const fontSize = valueOrVar(value.fontSize, toDimensionValue, nodes);
  const letterSpacing = valueOrVar(
    value.letterSpacing,
    toDimensionValue,
    nodes,
  );
  const fontWeight = valueOrVar(value.fontWeight, (v) => `${v}`, nodes);
  const lineHeight = valueOrVar(value.lineHeight, (v) => `${v}`, nodes);
  lines.push(`  ${propertyName}-font-family: ${fontFamily};`);
  lines.push(`  ${propertyName}-font-size: ${fontSize};`);
  lines.push(`  ${propertyName}-font-weight: ${fontWeight};`);
  lines.push(`  ${propertyName}-line-height: ${lineHeight};`);
  lines.push(`  ${propertyName}-letter-spacing: ${letterSpacing};`);
  lines.push(
    `  ${propertyName}: ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily};`,
  );
};

const processNode = (
  node: TreeNode<TreeNodeMeta>,
  path: string[],
  childrenByParent: Map<string | undefined, TreeNode<TreeNodeMeta>[]>,
  lines: string[],
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
) => {
  // group is only added to variable name
  if (node.meta.nodeType === "token-group") {
    const children = childrenByParent.get(node.nodeId) ?? [];
    for (const child of children) {
      processNode(
        child,
        [...path, node.meta.name],
        childrenByParent,
        lines,
        nodes,
      );
    }
  }

  if (node.meta.nodeType === "token") {
    const token = node.meta;
    const propertyName = `--${kebabCase([...path, node.meta.name].join("-"))}`;
    // Handle token aliases (references to other tokens)
    if (isNodeRef(token.value)) {
      const variable = referenceToVariable(token.value, nodes);
      lines.push(`  ${propertyName}: ${variable};`);
      return;
    }
    switch (token.type) {
      case "color":
        lines.push(`  ${propertyName}: ${serializeColor(token.value)};`);
        break;
      case "dimension":
        lines.push(`  ${propertyName}: ${toDimensionValue(token.value)};`);
        break;
      case "duration":
        lines.push(`  ${propertyName}: ${toDurationValue(token.value)};`);
        break;
      case "cubicBezier":
        lines.push(`  ${propertyName}: ${toCubicBezierValue(token.value)};`);
        break;
      case "number":
      case "fontWeight":
        lines.push(`  ${propertyName}: ${token.value};`);
        break;
      case "fontFamily":
        lines.push(`  ${propertyName}: ${toFontFamilyValue(token.value)};`);
        break;
      case "shadow":
        lines.push(`  ${propertyName}: ${toShadowValue(token.value, nodes)};`);
        break;
      case "gradient":
        lines.push(
          `  ${propertyName}: ${toGradientValue(token.value, nodes)};`,
        );
        break;
      case "border":
        lines.push(`  ${propertyName}: ${toBorderValue(token.value, nodes)};`);
        break;
      case "transition":
        lines.push(
          `  ${propertyName}: ${toTransitionValue(token.value, nodes)};`,
        );
        break;
      case "strokeStyle":
        addStrokeStyle(propertyName, token.value, lines, nodes);
        break;
      case "typography":
        addTypography(propertyName, token.value, lines, nodes);
        break;
      default:
        token satisfies never;
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
    processNode(node, [], childrenByParent, lines, nodes);
  }
  lines.push("}");
  return lines.join("\n");
};
