import { prettifyError } from "zod";
import { generateKeyBetween } from "fractional-indexing";
import { compareTreeNodes, type TreeNode } from "./store";
import type { GroupMeta, TokenMeta } from "./state.svelte";
import { RawValueSchema } from "./schema";
import {
  nameSchema,
  referenceSchema,
  tokenSchema,
  groupSchema,
  shadowValue,
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

export type ParseResult = {
  nodes: TreeNode<TreeNodeMeta>[];
  errors: Array<{ path: string; message: string }>;
};

const zeroIndex = generateKeyBetween(null, null);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isTokenObject = (v: unknown): v is Record<string, unknown> =>
  isObject(v) && "$value" in v;

export const isTokenReference = (value: unknown): value is string => {
  return referenceSchema.safeParse(value).success;
};

export const parseDesignTokens = (input: unknown): ParseResult => {
  const intermediaryNodes = new Map<string, IntermediaryNode>();
  const nodes: TreeNode<TreeNodeMeta>[] = [];
  const collectedErrors: Array<{ path: string; message: string }> = [];
  const lastChildIndexPerParent = new Map<string | undefined, string>();

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
    intermediaryNodes.set(path.join("."), {
      parentPath: parentPath?.join("."),
      name,
      nodeId: crypto.randomUUID(),
      type: inheritedType,
      payload: payload.data,
    });
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

  const resolveTokenTypeAndValue = (
    path: string,
    intermediaryNode: IntermediaryNode,
    token: Token,
  ) => {
    // Check if value is a token reference (curly brace syntax in $value)
    if (isTokenReference(token.$value)) {
      const type =
        token.$type ?? resolveAliasType(path) ?? intermediaryNode.type;
      const value = token.$value;
      if (!type) {
        return;
      }
      return { type, value };
    }
    let value = token.$value;
    if (!intermediaryNode.type) {
      return;
    }
    // Convert single shadow objects to arrays for internal storage
    if (intermediaryNode.type === "shadow") {
      const parsed = shadowValue.safeParse(value);
      if (
        parsed.success &&
        !Array.isArray(parsed.data) &&
        typeof parsed.data !== "string"
      ) {
        value = [parsed.data];
      }
    }
    const parsed = RawValueSchema.safeParse({
      type: intermediaryNode.type,
      value,
    });
    if (!parsed.success) {
      const error = prettifyError(parsed.error);
      recordError(path, `Invalid ${intermediaryNode.type}: ${error}`);
      return;
    }
    // when value exists always infer and store type in tokens
    // to alloww groups lock and unlock type freely
    return {
      type: intermediaryNode.type,
      value: parsed.data.value,
    };
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
      const typeAndValue = resolveTokenTypeAndValue(
        path,
        intermediaryNode,
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

  for (const node of nodes.values()) {
    const children = childrenMap.get(node.parentId) ?? [];
    children.push(node);
    childrenMap.set(node.parentId, children);
  }
  for (const children of childrenMap.values()) {
    children.sort(compareTreeNodes);
  }

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
        $value: meta.value,
      };
      // For shadow tokens stored as arrays, serialize as non-array if there's only one item
      if (
        meta.type === "shadow" &&
        Array.isArray(meta.value) &&
        meta.value.length === 1
      ) {
        const parsed = shadowValue.safeParse(meta.value);
        if (
          parsed.success &&
          Array.isArray(parsed.data) &&
          parsed.data.length === 1
        ) {
          token.$value = parsed.data[0];
        }
      }
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
