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
import { prettifyError } from "zod";

type TreeNodeMeta = GroupMeta | TokenMeta;

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
  const nodes: TreeNode<TreeNodeMeta>[] = [];
  const collectedErrors: Array<{ path: string; message: string }> = [];
  const lastChildIndexPerParent = new Map<string | undefined, string>();

  if (!isObject(input)) {
    return { nodes, errors: collectedErrors };
  }

  const addNode = (parentId: string | undefined, meta: TreeNodeMeta) => {
    const nodeId = crypto.randomUUID();
    const prevIndex = lastChildIndexPerParent.get(parentId);
    const index = generateKeyBetween(prevIndex ?? zeroIndex, null);
    lastChildIndexPerParent.set(parentId, index);
    nodes.push({ nodeId, parentId, index, meta });
    return nodeId;
  };

  const recordError = (path: string[], message: string) => {
    collectedErrors.push({ path: path.join("."), message });
  };

  const parseGroup = (
    name: string,
    data: unknown,
    path: string[],
    parentNodeId: string | undefined,
    inheritedType: TokenType | undefined,
  ) => {
    if (!nameSchema.safeParse(name).success) {
      recordError(path, "Invalid group name");
      return;
    }
    const group = groupSchema.parse(data);
    const groupMeta: GroupMeta = {
      nodeType: "token-group",
      name,
      type: group.$type,
      description: group.$description,
      deprecated: group.$deprecated,
      extensions: group.$extensions,
    };
    inheritedType = groupMeta.type ?? inheritedType;
    const nodeId = addNode(parentNodeId, groupMeta);
    if (isObject(data)) {
      for (const [name, value] of Object.entries(data)) {
        const childPath = [...path, name];
        // special token name
        if (name === "$root") {
          parseToken(name, value, childPath, nodeId, inheritedType);
          continue;
        }
        // skip reserved name
        if (name.startsWith("$")) {
          continue;
        }
        if (isTokenObject(value)) {
          parseToken(name, value, childPath, nodeId, inheritedType);
          continue;
        }
        parseGroup(name, value, childPath, nodeId, inheritedType);
      }
    }
  };

  const parseToken = (
    name: string,
    data: unknown,
    path: string[],
    parentNodeId: string | undefined,
    inheritedType?: TokenType,
  ) => {
    if (!nameSchema.safeParse(name).success && name !== "$root") {
      recordError(path, "Invalid token name");
      return;
    }
    const tokenMeta = tokenSchema.safeParse(data);
    if (!tokenMeta.success) {
      recordError(path, prettifyError(tokenMeta.error));
      return;
    }
    const description = tokenMeta.data.$description;
    const deprecated = tokenMeta.data.$deprecated;
    const extensions = tokenMeta.data.$extensions;
    const type = tokenMeta.data.$type;
    let value = tokenMeta.data.$value;
    // Check if value is a token reference (curly brace syntax in $value)
    if (isTokenReference(value)) {
      addNode(parentNodeId, {
        nodeType: "token",
        name,
        description,
        deprecated,
        extensions,
        type,
        value,
      });
      return;
    }

    inheritedType = type ?? inheritedType;
    if (!inheritedType) {
      recordError(path, "Token type cannot be determined");
      return;
    }

    // Convert single shadow objects to arrays for internal storage
    if (inheritedType === "shadow") {
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
      type: inheritedType,
      value,
    });
    if (!parsed.success) {
      const error = prettifyError(parsed.error);
      recordError(path, `Invalid ${inheritedType}: ${error}`);
      return;
    }
    addNode(parentNodeId, {
      nodeType: "token",
      name,
      description,
      deprecated,
      extensions,
      // when value exists always infer and store type in tokens
      // to alloww groups lock and unlock type freely
      type: inheritedType,
      value: parsed.data.value,
    });
  };

  for (const [name, value] of Object.entries(input)) {
    if (isTokenObject(value)) {
      parseToken(name, value, [name], undefined, undefined);
    } else {
      parseGroup(name, value, [name], undefined, undefined);
    }
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

    if (meta.nodeType === "token-group") {
      const group: Group = {
        $type: meta.type,
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
        // Only include $type if it's different from inherited type
        // make token inherit type from group
        $type: meta.type && inheritedType !== meta.type ? meta.type : undefined,
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
