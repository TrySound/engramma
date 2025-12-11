import { generateKeyBetween } from "fractional-indexing";
import { compareTreeNodes, type TreeNode } from "./store";
import type { GroupMeta, TokenMeta } from "./state.svelte";
import { RawValueSchema, type RawValue } from "./schema";

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

const isValidGroupName = (name: string) => {
  if (name.startsWith("$")) {
    return false;
  }
  return !/[{}.]/.test(name);
};

const isValidTokenName = (name: string) => {
  // $root is reserved
  if (name === "$root") {
    return true;
  }
  return isValidGroupName(name);
};

export const isTokenReference = (value: unknown): value is string => {
  if (typeof value !== "string") {
    return false;
  }
  // Check if value matches the reference syntax: {group.token} or {group.nested.token}
  return /^\{[a-zA-Z0-9_$][a-zA-Z0-9_$-]*(\.[a-zA-Z0-9_$][a-zA-Z0-9_$-]*)*\}$/.test(
    value,
  );
};

const getMeta = (data: Record<string, unknown>) => {
  const type = typeof data.$type === "string" ? data.$type : undefined;
  const description =
    typeof data.$description === "string" ? data.$description : undefined;
  const deprecated =
    typeof data.$deprecated === "string" ||
    typeof data.$deprecated === "boolean"
      ? data.$deprecated
      : undefined;
  const extensions = isObject(data.$extensions) ? data.$extensions : undefined;
  return { type, description, deprecated, extensions };
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

  const recordError = (path: string, message: string) => {
    collectedErrors.push({ path, message });
  };

  const parseGroup = (
    name: string,
    data: Record<string, unknown>,
    parentPath: string[] | undefined,
    parentNodeId: string | undefined,
    inheritedType: string | undefined,
  ) => {
    const path = parentPath ? [...parentPath, name] : [name];
    const serializedPath = path.join(".");
    if (!isValidGroupName(name)) {
      recordError(serializedPath, `Invalid group name "${name}"`);
      return;
    }
    const meta = getMeta(data);
    const groupMeta: GroupMeta = {
      nodeType: "token-group",
      name,
      type: meta.type as GroupMeta["type"],
      description: meta.description,
      deprecated: meta.deprecated,
      extensions: meta.extensions,
    };
    inheritedType = groupMeta.type ?? inheritedType;
    const nodeId = addNode(parentNodeId, groupMeta);
    for (const childName of Object.keys(data)) {
      // include $root as a token, skip other $-props (group meta)
      if (childName.startsWith("$") && childName !== "$root") {
        continue;
      }
      const child = data[childName];
      if (isTokenObject(child)) {
        parseToken(childName, child, path, nodeId, inheritedType);
      } else if (isObject(child)) {
        parseGroup(childName, child, path, nodeId, inheritedType);
      }
    }
  };

  const parseToken = (
    name: string,
    obj: Record<string, unknown>,
    parentPath: string[],
    parentNodeId: string | undefined,
    inheritedType?: string,
  ) => {
    const path = [...parentPath, name];
    const serializedPath = path.join(".");
    if (!isValidTokenName(name)) {
      recordError(serializedPath, `Invalid token name "${name}"`);
      return;
    }
    // Token meta
    const { description, type, deprecated, extensions } = getMeta(obj);

    const value = (obj as any).$value;

    // Check if value is a token reference (curly brace syntax in $value)
    if (isTokenReference(value)) {
      addNode(parentNodeId, {
        nodeType: "token",
        name,
        description,
        deprecated,
        extensions,
        ...(type && { type: type as RawValue["type"] }),
        value,
      });
      return;
    }

    inheritedType = type ?? inheritedType;
    if (!inheritedType) {
      recordError(serializedPath, "Token type cannot be determined");
      return;
    }

    // Convert single shadow objects to arrays for internal storage
    let valueToValidate = value;
    if (
      inheritedType === "shadow" &&
      isObject(valueToValidate) &&
      !Array.isArray(valueToValidate)
    ) {
      valueToValidate = [valueToValidate];
    }

    const parsed = RawValueSchema.safeParse({
      type: inheritedType,
      value: valueToValidate,
    });
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((issue) => issue.message)
        .join(", ");
      recordError(serializedPath, `Invalid ${inheritedType}: ${errorMessages}`);
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
      type: inheritedType as RawValue["type"],
      value: parsed.data.value,
    });
  };

  for (const name of Object.keys(input)) {
    const child = input[name];
    if (isTokenObject(child)) {
      parseToken(name, child, [], undefined, undefined);
    } else if (isObject(child)) {
      parseGroup(name, child, undefined, undefined, undefined);
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
  ): Record<string, unknown> => {
    const meta = node.meta;

    if (meta.nodeType === "token-group") {
      const group: Record<string, unknown> = {};
      // Add group metadata
      if (meta.type !== undefined) {
        group.$type = meta.type;
      }
      if (meta.description !== undefined) {
        group.$description = meta.description;
      }
      if (meta.deprecated !== undefined) {
        group.$deprecated = meta.deprecated;
      }
      if (meta.extensions !== undefined) {
        group.$extensions = meta.extensions;
      }
      // Add children
      const children = childrenMap.get(node.nodeId) ?? [];
      for (const child of children) {
        group[child.meta.name] = serializeNode(
          child,
          meta.type ?? inheritedType,
        );
      }
      return group;
    }

    if (meta.nodeType === "token") {
      // Token node
      const token: Record<string, unknown> = {};

      // For shadow tokens stored as arrays, serialize as non-array if there's only one item
      if (
        meta.type === "shadow" &&
        Array.isArray(meta.value) &&
        meta.value.length === 1
      ) {
        token.$value = meta.value[0];
      } else {
        token.$value = meta.value;
      }

      // Only include $type if it's different from inherited type
      // make token inherit type from group
      if (meta.type && inheritedType !== meta.type) {
        token.$type = meta.type;
      }
      if (meta.description !== undefined) {
        token.$description = meta.description;
      }
      if (meta.deprecated !== undefined) {
        token.$deprecated = meta.deprecated;
      }
      if (meta.extensions !== undefined) {
        token.$extensions = meta.extensions;
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
