import { prettifyError } from "zod";
import { generateKeyBetween } from "fractional-indexing";
import {
  resolverDocumentSchema,
  type ResolverDocument,
  type ResolverSet,
} from "./dtcg.schema";
import { parseDesignTokens } from "./tokens";
import type { SetMeta, TreeNodeMeta } from "./state.svelte";
import type { TreeNode } from "./store";

type ParseResult = {
  nodes: TreeNode<TreeNodeMeta>[];
  errors: Array<{ path: string; message: string }>;
};

// Helper function to deep merge sources respecting path-based order
// Later sources override earlier ones at the same path
const mergeSources = (
  sources: Record<string, unknown>[],
): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};

  const deepMerge = (
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): void => {
    for (const [key, value] of Object.entries(source)) {
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date) &&
        !("$value" in value) && // Token - don't merge, replace
        target[key] !== null &&
        typeof target[key] === "object" &&
        !Array.isArray(target[key]) &&
        target[key] instanceof Object
      ) {
        // Both are plain objects and not tokens - recurse
        deepMerge(
          target[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        // Override: later source wins
        target[key] = value;
      }
    }
  };

  for (const source of sources) {
    deepMerge(merged, source);
  }

  return merged;
};

// Detect if JSON is resolver format by checking for resolver-specific fields
export const isResolverFormat = (obj: unknown): boolean => {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const o = obj as Record<string, unknown>;
  // Resolver must have version "2025.10" and resolutionOrder array
  return o.version === "2025.10" && Array.isArray(o.resolutionOrder);
};

// Parse resolver document containing sets and modifiers in resolutionOrder
// Creates separate root token-sets for each Set item
// Only processes Set items; Modifier items are silently skipped
export const parseTokenResolver = (input: unknown): ParseResult => {
  // Validate resolver document structure
  const validation = resolverDocumentSchema.safeParse(input);

  if (!validation.success) {
    const errorMessage = prettifyError(validation.error);
    return {
      nodes: [],
      errors: [{ path: "resolver", message: errorMessage }],
    };
  }

  const resolverDoc: ResolverDocument = validation.data;
  const allNodes: Array<any> = [];
  const collectedErrors: Array<{ path: string; message: string }> = [];
  const lastChildIndexPerParent = new Map<string | undefined, string>();
  const zeroIndex = generateKeyBetween(null, null);

  // Process each Set in resolutionOrder
  for (let i = 0; i < resolverDoc.resolutionOrder.length; i++) {
    const item = resolverDoc.resolutionOrder[i];

    if (item.type === "modifier") {
      // Silently skip modifier items
      continue;
    }

    // item.type === "set"
    const set = item as ResolverSet;

    // Merge sources within this Set only
    const mergedSetSources = mergeSources(set.sources);

    // Parse the merged sources using existing parseDesignTokens
    const parseResult = parseDesignTokens(mergedSetSources);

    // Create a new token-set node for this Set
    const setNodeId = crypto.randomUUID();
    const prevSetIndex = lastChildIndexPerParent.get(undefined);
    const setIndex = generateKeyBetween(prevSetIndex ?? zeroIndex, null);
    lastChildIndexPerParent.set(undefined, setIndex);

    const setNode: TreeNode<SetMeta> = {
      nodeId: setNodeId,
      parentId: undefined,
      index: setIndex,
      meta: {
        nodeType: "token-set",
        name: set.name,
        description: set.description,
        extensions: set.$extensions,
      },
    };

    // Add the token-set node
    allNodes.push(setNode);

    // Re-parent root-level tokens/groups from this Set to the token-set node
    // Only set parentId for nodes at root level (parentId is undefined)
    // This preserves the hierarchy of nested groups and tokens within the Set
    for (const node of parseResult.nodes) {
      if (node.parentId === undefined) {
        node.parentId = setNodeId;
      }
      allNodes.push(node);
    }

    // Collect errors from this Set
    collectedErrors.push(...parseResult.errors);
  }

  return {
    nodes: allNodes,
    errors: collectedErrors,
  };
};
