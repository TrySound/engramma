import { prettifyError } from "zod";
import { generateKeyBetween } from "fractional-indexing";
import { compareTreeNodes, type TreeNode } from "./store";
import type { GroupMeta, TokenMeta } from "./state.svelte";
import {
  type NodeRef,
  type RawValue,
  RawValueSchema,
  type RawValueWithReference,
  isNodeRef,
} from "./schema";
import {
  nameSchema,
  referenceSchema,
  tokenSchema,
  groupSchema,
  shadowValue,
  transitionValue,
  borderValue,
  typographyValue,
  gradientValue,
  type TokenType,
  type Group,
  type Token,
} from "./dtcg.schema";

type TreeNodeMeta = GroupMeta | TokenMeta;

// Intermediary node collected during tree traversal
// Contains information needed to generate normalized tree nodes
type IntermediaryNode = {
  parentPath: string | undefined;
  name: string;
  nodeId: string;
  type: TokenType | undefined;
  payload: Token | Group;
};

const getPathFromTokenRef = (tokenRef: string) => tokenRef.replace(/[{}]/g, "");

const getTokenRefOrValue = <Value extends RawValue["value"]>(
  value: NodeRef | Value,
  pathByNodeId: Map<string, string>,
): string | Value => {
  if (isNodeRef(value)) {
    const path = pathByNodeId.get(value.ref);
    if (!path) {
      throw Error(`Alias token for ${value.ref} not found`);
    }
    return `{${path}}`;
  }
  return value;
};

// Helper to convert TokenRef back to DTCG reference format
// pathByNodeId maps node IDs to their DTCG paths
const serializeTokenValue = (
  token: RawValueWithReference,
  pathByNodeId: Map<string, string>,
): Token["$value"] => {
  if (isNodeRef(token.value)) {
    const path = pathByNodeId.get(token.value.ref);
    if (!path) {
      throw Error(`Alias token for ${token.value.ref} not found`);
    }
    return `{${path}}`;
  }
  switch (token.type) {
    case "transition": {
      const { value } = token;
      return {
        duration: getTokenRefOrValue(value.duration, pathByNodeId),
        delay: getTokenRefOrValue(value.delay, pathByNodeId),
        timingFunction: getTokenRefOrValue(value.timingFunction, pathByNodeId),
      };
    }
    case "border": {
      const { value } = token;
      return {
        color: getTokenRefOrValue(value.color, pathByNodeId),
        width: getTokenRefOrValue(value.width, pathByNodeId),
        style: getTokenRefOrValue(value.style, pathByNodeId),
      };
    }
    case "shadow": {
      const shadows = token.value.map((shadow) => ({
        color: getTokenRefOrValue(shadow.color, pathByNodeId),
        offsetX: getTokenRefOrValue(shadow.offsetX, pathByNodeId),
        offsetY: getTokenRefOrValue(shadow.offsetY, pathByNodeId),
        blur: getTokenRefOrValue(shadow.blur, pathByNodeId),
        spread: getTokenRefOrValue(shadow.spread, pathByNodeId),
        inset: shadow.inset,
      }));
      // serialize as shadow object when only one item in shadows array
      return shadows.length === 1 ? shadows[0] : shadows;
    }
    case "typography": {
      const { value } = token;
      return {
        fontFamily: getTokenRefOrValue(value.fontFamily, pathByNodeId),
        fontSize: getTokenRefOrValue(value.fontSize, pathByNodeId),
        fontWeight: getTokenRefOrValue(value.fontWeight, pathByNodeId),
        letterSpacing: getTokenRefOrValue(value.letterSpacing, pathByNodeId),
        lineHeight: getTokenRefOrValue(value.lineHeight, pathByNodeId),
      };
    }
    case "gradient": {
      return token.value.map((shadow) => ({
        color: getTokenRefOrValue(shadow.color, pathByNodeId),
        position: shadow.position,
      }));
    }
    default:
      token.type satisfies
        | "number"
        | "color"
        | "dimension"
        | "fontFamily"
        | "fontWeight"
        | "duration"
        | "cubicBezier"
        | "strokeStyle";
      return token.value;
  }
};

export type ParseResult = {
  nodes: TreeNode<TreeNodeMeta>[];
  errors: Array<{ path: string; message: string }>;
};

const zeroIndex = generateKeyBetween(null, null);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isTokenObject = (v: unknown): v is Record<string, unknown> =>
  isObject(v) && "$value" in v;

const isTokenReference = (value: unknown): value is string => {
  return referenceSchema.safeParse(value).success;
};

export const parseDesignTokens = (input: unknown): ParseResult => {
  const intermediaryNodes = new Map<string, IntermediaryNode>();
  const nodes: TreeNode<TreeNodeMeta>[] = [];
  const collectedErrors: Array<{ path: string; message: string }> = [];
  const lastChildIndexPerParent = new Map<string | undefined, string>();
  const pathToNodeId = new Map<string, string>(); // Map DTCG paths to node IDs

  if (!isObject(input)) {
    return { nodes, errors: collectedErrors };
  }

  const recordError = (path: string, message: string) => {
    collectedErrors.push({ path: path, message });
  };

  // recursively traverse JSON objects and collect intermediary nodes
  // validate input data and infer inherited types
  const parseNode = (
    parentPath: undefined | string[],
    name: string,
    data: unknown,
    inheritedType: TokenType | undefined,
  ) => {
    const path = parentPath ? [...parentPath, name] : [name];
    if (!nameSchema.safeParse(name).success && name !== "$root") {
      recordError(path.join("."), `Invalid name "${name}"`);
      return;
    }
    // explicitly distinct token from group based on $value
    const payload = isTokenObject(data)
      ? tokenSchema.safeParse(data)
      : groupSchema.safeParse(data);
    if (!payload.success) {
      recordError(path.join("."), prettifyError(payload.error));
      return;
    }
    // pass through inherited type from root group to token
    inheritedType = payload.data.$type ?? inheritedType;
    const nodeId = crypto.randomUUID();
    const pathStr = path.join(".");
    intermediaryNodes.set(pathStr, {
      parentPath: parentPath?.join("."),
      name,
      nodeId,
      type: inheritedType,
      payload: payload.data,
    });
    pathToNodeId.set(pathStr, nodeId);
    // skip traversing children on token
    if (!("$value" in payload.data) && isObject(data)) {
      for (const [name, value] of Object.entries(data)) {
        // skip reserved name except for $root which is special token name
        if (name.startsWith("$") && name !== "$root") {
          continue;
        }
        parseNode(path, name, value, inheritedType);
      }
    }
  };

  for (const [name, value] of Object.entries(input)) {
    parseNode(undefined, name, value, undefined);
  }

  // Helper to resolve the type of a token alias by following the reference chain
  const resolveAliasType = (value: string): TokenType | undefined => {
    const visited = new Set<string>();
    let currentPath = value;
    // Follow the chain of references until we find a token with a type
    while (currentPath) {
      // Prevent infinite loops in circular references
      if (visited.has(currentPath)) {
        return;
      }
      visited.add(currentPath);
      const node = intermediaryNodes.get(currentPath);
      if (!node || !("$value" in node.payload)) {
        return;
      }
      // If referenced token has explicit type, return it
      if (node.type) {
        return node.type;
      }
      // Referenced token has no explicit type and is not an alias
      if (!isTokenReference(node.payload.$value)) {
        return;
      }
      // If referenced token is itself an alias, follow to the next reference
      currentPath = node.payload.$value.replace(/[{}]/g, "");
    }
  };

  const getNodeRefOrValue = <Value extends RawValue["value"]>(
    value: string | Value,
  ): NodeRef | Value => {
    if (isTokenReference(value)) {
      const node = intermediaryNodes.get(getPathFromTokenRef(value));
      if (!node) {
        throw Error(`Node ${value} not found`);
      }
      const nodeRef = { ref: node.nodeId };
      return nodeRef;
    }
    return value;
  };

  const parseTokenTypeAndValue = (
    path: string,
    intermediaryType: undefined | TokenType,
    token: Token,
  ): undefined | RawValueWithReference => {
    // convert token reference to node reference format
    if (isTokenReference(token.$value)) {
      const type = token.$type ?? resolveAliasType(path) ?? intermediaryType;
      const node = intermediaryNodes.get(getPathFromTokenRef(token.$value));
      if (!type || !node) {
        return;
      }
      const nodeRef = { ref: node.nodeId };
      return { type, value: nodeRef };
    }
    switch (intermediaryType) {
      // resolve composite tokens
      case "transition": {
        const value = transitionValue.parse(token.$value);
        return {
          type: "transition",
          value: {
            duration: getNodeRefOrValue(value.duration),
            delay: getNodeRefOrValue(value.delay),
            timingFunction: getNodeRefOrValue(value.timingFunction),
          },
        };
      }
      case "border": {
        const value = borderValue.parse(token.$value);
        return {
          type: "border",
          value: {
            color: getNodeRefOrValue(value.color),
            width: getNodeRefOrValue(value.width),
            style: getNodeRefOrValue(value.style),
          },
        };
      }
      case "shadow": {
        const value = shadowValue.parse(token.$value);
        // Convert single shadow objects to arrays for internal storage
        const shadows = Array.isArray(value) ? value : [value];
        return {
          type: "shadow",
          value: shadows.map((shadow) => ({
            color: getNodeRefOrValue(shadow.color),
            offsetX: getNodeRefOrValue(shadow.offsetX),
            offsetY: getNodeRefOrValue(shadow.offsetY),
            blur: getNodeRefOrValue(shadow.blur),
            spread: getNodeRefOrValue(shadow.spread),
            inset: shadow.inset,
          })),
        };
      }
      case "typography": {
        const value = typographyValue.parse(token.$value);
        return {
          type: "typography",
          value: {
            fontFamily: getNodeRefOrValue(value.fontFamily),
            fontSize: getNodeRefOrValue(value.fontSize),
            fontWeight: getNodeRefOrValue(value.fontWeight),
            letterSpacing: getNodeRefOrValue(value.letterSpacing),
            lineHeight: getNodeRefOrValue(value.lineHeight),
          },
        };
      }
      case "gradient": {
        const value = gradientValue.parse(token.$value);
        return {
          type: "gradient",
          value: value.map((stop) => ({
            color: getNodeRefOrValue(stop.color),
            position: stop.position,
          })),
        };
      }

      // validate primitive tokens
      case "number":
      case "color":
      case "dimension":
      case "duration":
      case "cubicBezier":
      case "fontFamily":
      case "fontWeight":
      case "strokeStyle": {
        return RawValueSchema.parse({
          type: intermediaryType,
          value: token.$value,
        });
      }
      default:
        intermediaryType satisfies undefined;
    }
  };

  for (const [path, intermediaryNode] of intermediaryNodes) {
    const parentNode = intermediaryNode.parentPath
      ? intermediaryNodes.get(intermediaryNode.parentPath)
      : undefined;
    const parentId = parentNode?.nodeId;
    const nodeId = intermediaryNode.nodeId;
    let meta: TokenMeta | GroupMeta;
    if ("$value" in intermediaryNode.payload) {
      // token node

      const token = intermediaryNode.payload;
      const typeAndValue = parseTokenTypeAndValue(
        path,
        intermediaryNode.type,
        token,
      );
      if (!typeAndValue) {
        recordError(path, "Token type cannot be determined");
        continue;
      }
      meta = {
        nodeType: "token",
        name: intermediaryNode.name,
        description: token.$description,
        deprecated: token.$deprecated,
        extensions: token.$extensions,
        ...typeAndValue,
      };
    } else {
      // group node

      const group = intermediaryNode.payload;
      meta = {
        nodeType: "token-group",
        name: intermediaryNode.name,
        type: intermediaryNode.type,
        description: group.$description,
        deprecated: group.$deprecated,
        extensions: group.$extensions,
      };
    }

    const prevIndex = lastChildIndexPerParent.get(parentId);
    const index = generateKeyBetween(prevIndex ?? zeroIndex, null);
    lastChildIndexPerParent.set(parentId, index);
    nodes.push({ nodeId, parentId, index, meta });
  }

  return {
    nodes,
    errors: collectedErrors,
  };
};

export const serializeDesignTokens = (
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): Record<string, unknown> => {
  const childrenMap = new Map<string | undefined, TreeNode<TreeNodeMeta>[]>();
  const nodeIdToPath = new Map<string, string>();

  for (const node of nodes.values()) {
    const children = childrenMap.get(node.parentId) ?? [];
    children.push(node);
    childrenMap.set(node.parentId, children);
  }
  for (const children of childrenMap.values()) {
    children.sort(compareTreeNodes);
  }

  const buildPathMap = (
    nodeId: string | undefined,
    parentPath: string[] = [],
  ): void => {
    const nodeChildren = childrenMap.get(nodeId) ?? [];
    for (const node of nodeChildren) {
      const nodePath = [...parentPath, node.meta.name];
      const pathStr = nodePath.join(".");
      nodeIdToPath.set(node.nodeId, pathStr);
      buildPathMap(node.nodeId, nodePath);
    }
  };
  buildPathMap(undefined);

  const serializeNode = (
    node: TreeNode<TreeNodeMeta>,
    inheritedType: undefined | string,
  ): Group | Token => {
    const meta = node.meta;
    // Only include $type if it's different from inherited type
    // make token inherit type from group
    const type =
      meta.type && inheritedType !== meta.type ? meta.type : undefined;

    if (meta.nodeType === "token-group") {
      const group: Group = {
        $type: type,
        $description: meta.description,
        $deprecated: meta.deprecated,
        $extensions: meta.extensions,
      };
      // Add children
      const children = childrenMap.get(node.nodeId) ?? [];
      for (const child of children) {
        (group as any)[child.meta.name] = serializeNode(
          child,
          meta.type ?? inheritedType,
        );
      }
      return group;
    }

    if (meta.nodeType === "token") {
      const token: Token = {
        $type: type,
        $description: meta.description,
        $deprecated: meta.deprecated,
        $extensions: meta.extensions,
        $value: serializeTokenValue(meta, nodeIdToPath),
      };
      return token;
    }

    meta satisfies never;
    throw Error("Asset impossible branch");
  };

  const result: Record<string, unknown> = {};
  const rootChildren = childrenMap.get(undefined) ?? [];
  for (const node of rootChildren) {
    result[node.meta.name] = serializeNode(node, undefined);
  }
  return result;
};
