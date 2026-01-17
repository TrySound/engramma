import * as z from "zod/mini";
import { generateKeyBetween } from "fractional-indexing";
import {
  resolverDocumentSchema,
  type ResolverDocument,
  type ResolverSet,
} from "./dtcg.schema";
import {
  serializeDesignTokens,
  extractIntermediaryNodes,
  resolveIntermediaryNodes,
  type IntermediaryNode,
} from "./tokens";
import { compareTreeNodes } from "./store";
import type {
  GroupMeta,
  SetMeta,
  TokenMeta,
  TreeNodeMeta,
} from "./state.svelte";
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
// Supports cross-set token aliases through two-phase resolution:
// Phase 1: Extract intermediary nodes from all sets (collect what tokens/groups exist)
// Phase 2: Resolve with all accumulated nodes available (enables cross-set references)
export const parseTokenResolver = (input: unknown): ParseResult => {
  // Validate resolver document structure
  const validation = resolverDocumentSchema.safeParse(input);

  if (!validation.success) {
    const errorMessage = z.prettifyError(validation.error);
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

  // PHASE 1: Extract intermediary nodes from all sets
  // This collects all tokens/groups with their paths, without resolving references yet
  const allIntermediaryNodes = new Map<string, any>();
  const intermediaryNodesBySet = new Map<
    string,
    Map<string, IntermediaryNode>
  >();

  for (const item of resolverDoc.resolutionOrder) {
    // Silently skip modifier items
    if (item.type === "modifier") {
      continue;
    }
    const mergedSetSources = mergeSources(item.sources);
    const { nodes, errors } = extractIntermediaryNodes(mergedSetSources);
    intermediaryNodesBySet.set(item.name, nodes);
    for (const [path, node] of nodes) {
      allIntermediaryNodes.set(path, node);
    }
    collectedErrors.push(...errors);
  }

  // PHASE 2: Resolve intermediary nodes with cross-set availability
  // Now that we have all tokens/groups from all sets, resolve references with full visibility
  for (const item of resolverDoc.resolutionOrder) {
    if (item.type === "modifier") {
      // Silently skip modifier items
      continue;
    }
    // Get this set's intermediary nodes
    const intermediaryNodes = intermediaryNodesBySet.get(item.name);
    if (!intermediaryNodes) {
      continue;
    }
    // Resolve this set's intermediary nodes, using all accumulated nodes for reference lookup
    const { nodes, errors } = resolveIntermediaryNodes(
      intermediaryNodes,
      allIntermediaryNodes,
    );

    // Create a new token-set node for this Set
    const setNodeId = crypto.randomUUID();
    const prevSetIndex = lastChildIndexPerParent.get(undefined);
    const newSetIndex = generateKeyBetween(prevSetIndex ?? zeroIndex, null);
    lastChildIndexPerParent.set(undefined, newSetIndex);

    const setNode: TreeNode<SetMeta> = {
      nodeId: setNodeId,
      parentId: undefined,
      index: newSetIndex,
      meta: {
        nodeType: "token-set",
        name: item.name,
        description: item.description,
        extensions: item.$extensions,
      },
    };

    // Add the token-set node
    allNodes.push(setNode);

    // Re-parent root-level tokens/groups from this Set to the token-set node
    // Only set parentId for nodes at root level (parentId is undefined)
    // This preserves the hierarchy of nested groups and tokens within the Set
    for (const node of nodes) {
      if (node.parentId === undefined) {
        node.parentId = setNodeId;
      }
      allNodes.push(node);
    }

    // Collect errors from this Set
    collectedErrors.push(...errors);
  }

  return {
    nodes: allNodes,
    errors: collectedErrors,
  };
};

/**
 * Serializes tree nodes back into a ResolverDocument following the Design Tokens Resolver Module 2025.10 specification.
 *
 * This function converts a tree structure (as produced by parseTokenResolver) back into a valid resolver document.
 * Each token-set node at the root level becomes a Set in the resolutionOrder array.
 *
 * @param nodes - Map of all tree nodes (nodeId → TreeNode)
 * @param metadata - Optional document-level metadata (name and description)
 * @returns A valid ResolverDocument with sets organized in resolutionOrder
 *
 * @example
 * ```typescript
 * const resolver = parseTokenResolver(jsonData);
 * const document = serializeTokenResolver(
 *   new Map(resolver.nodes.map(n => [n.nodeId, n])),
 *   { name: "My Design System", description: "..." }
 * );
 * ```
 */
export const serializeTokenResolver = (
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
  metadata?: { name?: string; description?: string },
): ResolverDocument => {
  const setNodes: Array<TreeNode<SetMeta>> = [];
  for (const node of nodes.values()) {
    if (node.parentId === undefined && node.meta.nodeType === "token-set") {
      setNodes.push(node as TreeNode<SetMeta>);
    }
  }

  // Sort by index to maintain document order
  setNodes.sort(compareTreeNodes);
  const resolutionOrder: ResolverSet[] = [];
  for (const setNode of setNodes) {
    // Create a filtered map containing only this set's descendants (excluding the set node itself)
    // serializeDesignTokens expects token and group nodes, not token-set nodes
    const setSubtree = new Map<string, TreeNode<TreeNodeMeta>>();
    const collectDescendants = (nodeId: string | undefined) => {
      let node = nodeId ? nodes.get(nodeId) : undefined;
      if (!node) {
        return;
      }
      // Skip the token-set node itself, only collect token and group children
      if (node.meta.nodeType !== "token-set") {
        // Re-parent direct children of token-set to root (undefined)
        if (node.parentId === setNode.nodeId) {
          // avoid mutating original nodes
          node = { ...node, parentId: undefined };
        }
        setSubtree.set(node.nodeId, node);
      }
      // Recursively collect all children
      for (const child of nodes.values()) {
        if (child.parentId === nodeId) {
          collectDescendants(child.nodeId);
        }
      }
    };

    collectDescendants(setNode.nodeId);
    const source = serializeDesignTokens(
      setSubtree as Map<string, TreeNode<TokenMeta | GroupMeta>>,
      nodes as Map<string, TreeNode<TokenMeta | GroupMeta>>, // Pass all nodes for cross-set reference lookup
    );
    resolutionOrder.push({
      type: "set",
      name: setNode.meta.name,
      description: setNode.meta.description,
      $extensions: setNode.meta.extensions,
      sources: [source],
    });
  }

  return {
    version: "2025.10",
    name: metadata?.name,
    description: metadata?.description,
    resolutionOrder,
  };
};
