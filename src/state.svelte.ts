import { formatError } from "zod";
import { createSubscriber } from "svelte/reactivity";
import { TreeStore, type Transaction, type TreeNode } from "./store";
import {
  type RawValue,
  type RawValueWithReference,
  type Value,
  ValueSchema,
} from "./schema";
import { isTokenReference, serializeDesignTokens } from "./tokens";
import { setDataInUrl } from "./url-data";

export type GroupMeta = {
  nodeType: "token-group";
  name: string;
  type?: Value["type"];
  description?: string;
  deprecated?: boolean | string;
  extensions?: Record<string, unknown>;
};

export type TokenMeta = {
  nodeType: "token";
  name: string;
  description?: string;
  deprecated?: boolean | string;
  extensions?: Record<string, unknown>;
} & RawValueWithReference;

/**
 * Helper function to find the type of a token
 * Searches through reference chain or parent group hierarchy
 */
export const findTokenType = (
  node: TreeNode<TreeNodeMeta>,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): Value["type"] | undefined => {
  // If token has explicit type, use it
  if (node.meta.type) {
    return node.meta.type;
  }
  // If token is a child of a group, check parent group's type
  let currentParentId: string | undefined = node?.parentId;
  while (currentParentId !== undefined) {
    const parentNode = nodes.get(currentParentId);
    if (parentNode?.meta.nodeType === "token-group" && parentNode.meta.type) {
      return parentNode.meta.type;
    }
    currentParentId = parentNode?.parentId;
  }
  return undefined;
};

type ResolveContext = {
  nodes: Map<string, TreeNode<TreeNodeMeta>>;
  resolvingStack: Set<string>;
};

/**
 * Helper function to resolve a single token reference
 */
const getToken = (
  ctx: ResolveContext,
  reference: string,
): TreeNode<TreeNodeMeta> => {
  // check for circular references
  if (ctx.resolvingStack.has(reference)) {
    throw new Error(
      `Circular reference detected: ${Array.from(ctx.resolvingStack).join(
        " -> ",
      )} -> ${reference}`,
    );
  }
  // extract token path from "group.token" or "group.nested.token"
  const segments = reference.replace(/[{}]/g, "").split(".").filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Invalid reference format: "${reference}"`);
  }
  const nodesList = Array.from(ctx.nodes.values());
  let currentNodeId: string | undefined;
  // navigate through remaining segments
  for (const segment of segments) {
    // find child with matching name
    const nextNode = nodesList.find(
      (n) => n.parentId === currentNodeId && n.meta.name === segment,
    );
    currentNodeId = nextNode?.nodeId;
  }
  // final token node
  const tokenNode = currentNodeId ? ctx.nodes.get(currentNodeId) : undefined;
  if (!tokenNode || tokenNode.meta.nodeType !== "token") {
    throw new Error(
      `Final token node not found while resolving "${reference}"`,
    );
  }
  return tokenNode;
};

const resolveRef = <
  Input extends RawValue,
  Output extends Extract<Value, { type: Input["type"] }>["value"],
>(
  ctx: ResolveContext,
  type: Input["type"],
  value: string | Output,
): Output => {
  if (!isTokenReference(value)) {
    return value;
  }
  const tokenNode = getToken(ctx, value);
  const newStack = new Set(ctx.resolvingStack);
  newStack.add(value);
  const tokenValue = resolveTokenValue(tokenNode, ctx.nodes, newStack);
  if (tokenValue.type !== type) {
    throw Error(
      `${value} is expected to have ${type} type, received ${tokenValue.type}`,
    );
  }
  return tokenValue.value as Output;
};

const resolveRawValue = (ctx: ResolveContext, tokenValue: RawValue): Value => {
  switch (tokenValue.type) {
    case "transition": {
      const { value } = tokenValue;
      return {
        type: "transition",
        value: {
          duration: resolveRef(ctx, "duration", value.duration),
          delay: resolveRef(ctx, "duration", value.delay),
          timingFunction: resolveRef(ctx, "cubicBezier", value.timingFunction),
        },
      };
    }
    case "border": {
      const { value } = tokenValue;
      return {
        type: "border",
        value: {
          color: resolveRef(ctx, "color", value.color),
          width: resolveRef(ctx, "dimension", value.width),
          style: resolveRef(ctx, "strokeStyle", value.style),
        },
      };
    }
    case "shadow":
      return {
        type: "shadow",
        value: tokenValue.value.map((shadow) => ({
          color: resolveRef(ctx, "color", shadow.color),
          offsetX: resolveRef(ctx, "dimension", shadow.offsetX),
          offsetY: resolveRef(ctx, "dimension", shadow.offsetY),
          blur: resolveRef(ctx, "dimension", shadow.blur),
          spread: resolveRef(ctx, "dimension", shadow.spread),
          inset: shadow.inset,
        })),
      };
    case "typography": {
      const { value } = tokenValue;
      return {
        type: "typography",
        value: {
          fontFamily: resolveRef(ctx, "fontFamily", value.fontFamily),
          fontSize: resolveRef(ctx, "dimension", value.fontSize),
          fontWeight: resolveRef(ctx, "fontWeight", value.fontWeight),
          letterSpacing: resolveRef(ctx, "dimension", value.letterSpacing),
          lineHeight: resolveRef(ctx, "number", value.lineHeight),
        },
      };
    }
    case "gradient":
      return {
        type: "gradient",
        value: tokenValue.value.map((gradient) => ({
          color: resolveRef(ctx, "color", gradient.color),
          position: gradient.position,
        })),
      };
    default:
      // primitive tokens
      tokenValue.type satisfies
        | "number"
        | "color"
        | "dimension"
        | "duration"
        | "cubicBezier"
        | "fontFamily"
        | "fontWeight"
        | "strokeStyle";
      return tokenValue;
  }
};

/**
 * "extends" resolution algorithm for aliases
 *
 * Parse reference: Extract token path from {group.token}
 * Split path: Convert to segments ["group", "token"]
 * Navigate to token: Find the target token object
 * Validate token: Ensure target has $value property
 * Return token value: Extract and return the $value content
 * Check for cycles: Maintain stack of resolving references
 */
export const resolveTokenValue = (
  node: TreeNode<TreeNodeMeta>,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
  resolvingStack: Set<string> = new Set(),
): Value => {
  const ctx = { nodes, resolvingStack };
  if (node.meta.nodeType !== "token") {
    throw new Error("resolveTokenValue requires a token node");
  }
  const token = node.meta;
  // Check if value is a token reference string
  // If not a reference, resolve composite components if needed
  if (isTokenReference(token.value)) {
    // Handle token reference
    const reference = token.value;
    const tokenNode = getToken(ctx, reference);
    // resolve token further if it's also a reference
    const newStack = new Set(resolvingStack);
    newStack.add(reference);
    return resolveTokenValue(tokenNode, nodes, newStack);
  }
  const resolvedType = token.type ?? findTokenType(node, nodes);
  if (!resolvedType) {
    throw new Error(`Token "${token.name}" has no determinable type`);
  }
  // Resolve any component-level references in composite values
  const resolvedValue = resolveRawValue(ctx, {
    type: resolvedType,
    value: node.meta.value,
  } as RawValue);
  // Validate resolved value
  const parsed = ValueSchema.safeParse(resolvedValue);
  if (!parsed.success) {
    throw Error(formatError(parsed.error)._errors.join("\n"));
  }
  return parsed.data;
};

/**
 * Check if setting an alias would create a circular dependency
 * Returns true if the alias would be safe (no circular dependency)
 * Returns false if the alias would create a circular dependency
 */
export const isAliasCircular = (
  currentTokenId: string,
  targetTokenId: string,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
): boolean => {
  const targetNode = nodes.get(targetTokenId);
  if (!targetNode || targetNode.meta.nodeType !== "token") {
    return false;
  }

  const targetTokenMeta = targetNode.meta;

  // If target doesn't have a reference value, it's safe
  if (!isTokenReference(targetTokenMeta.value)) {
    return false;
  }

  // Build the path of tokens that the target references through
  const visited = new Set<string>();
  let currentRef: string | undefined = targetTokenMeta.value as string;

  while (currentRef) {
    // Prevent infinite loops in our detection logic
    if (visited.has(currentRef)) {
      return false;
    }
    visited.add(currentRef);

    // Extract token path from "group.token" format
    const segments = currentRef.replace(/[{}]/g, "").split(".").filter(Boolean);
    const nodesList = Array.from(nodes.values());
    let currentNodeId: string | undefined;

    // Navigate through segments to find the token
    for (const segment of segments) {
      const nextNode = nodesList.find(
        (n) => n.parentId === currentNodeId && n.meta.name === segment,
      );
      currentNodeId = nextNode?.nodeId;
    }

    // Check if we found the current token we're trying to set as alias
    if (currentNodeId === currentTokenId) {
      return true; // Circular dependency detected
    }

    // Get the next reference if it exists
    const nextNode = currentNodeId ? nodes.get(currentNodeId) : undefined;
    if (
      nextNode?.meta.nodeType === "token" &&
      typeof nextNode.meta.value === "string" &&
      isTokenReference(nextNode.meta.value)
    ) {
      currentRef = nextNode.meta.value;
    } else {
      // Reached end of reference chain
      currentRef = undefined;
    }
  }

  return false; // No circular dependency
};

export type TreeNodeMeta = GroupMeta | TokenMeta;

export class TreeState<Meta> {
  #store = new TreeStore<Meta>();
  #subscribe = createSubscriber((update) => this.#store.subscribe(update));
  #syncToUrl: boolean = false;

  transact(callback: (tx: Transaction<Meta>) => void): void {
    this.#store.transact(callback);
    // Sync to URL after transaction completes
    if (this.#syncToUrl) {
      this.#updateUrl();
    }
  }

  enableUrlSync(): void {
    this.#syncToUrl = true;
  }

  #updateUrl(): void {
    const allNodes = this.#store.nodes() as Map<string, TreeNode<TreeNodeMeta>>;
    const serialized = serializeDesignTokens(allNodes);
    setDataInUrl(serialized).catch((error) => {
      console.error("Failed to sync design tokens to URL:", error);
    });
  }

  values(): TreeNode<Meta>[] {
    this.#subscribe();
    return this.#store.values();
  }

  nodes(): Map<string, TreeNode<Meta>> {
    this.#subscribe();
    return this.#store.nodes();
  }

  getNode(nodeId: string): undefined | TreeNode<Meta> {
    this.#subscribe();
    return this.#store.nodes().get(nodeId);
  }

  getChildren(nodeId: string | undefined): TreeNode<Meta>[] {
    this.#subscribe();
    return this.#store.getChildren(nodeId);
  }

  getParent(nodeId: string): TreeNode<Meta> | undefined {
    this.#subscribe();
    return this.#store.getParent(nodeId);
  }

  getPrevSibling(nodeId: string): TreeNode<Meta> | undefined {
    this.#subscribe();
    return this.#store.getPrevSibling(nodeId);
  }

  getNextSibling(nodeId: string): TreeNode<Meta> | undefined {
    this.#subscribe();
    return this.#store.getNextSibling(nodeId);
  }
}

export const treeState = new TreeState<TreeNodeMeta>();
