import { formatError } from "zod";
import { createSubscriber } from "svelte/reactivity";
import { TreeStore, type Transaction, type TreeNode } from "./store";
import { type RawValue, type Value, ValueSchema } from "./schema";
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
  type?: Value["type"];
  value: RawValue["value"];
  description?: string;
  deprecated?: boolean | string;
  extensions?: Record<string, unknown>;
};

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

/**
 * Helper function to resolve a single token reference
 */
const resolveTokenReference = (
  reference: string,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
  resolvingStack: Set<string>,
): TreeNode<TreeNodeMeta> => {
  // check for circular references
  if (resolvingStack.has(reference)) {
    throw new Error(
      `Circular reference detected: ${Array.from(resolvingStack).join(
        " -> ",
      )} -> ${reference}`,
    );
  }
  // extract token path from "group.token" or "group.nested.token"
  const segments = reference.replace(/[{}]/g, "").split(".").filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`Invalid reference format: "${reference}"`);
  }
  const nodesList = Array.from(nodes.values());
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
  const tokenNode = currentNodeId ? nodes.get(currentNodeId) : undefined;
  if (!tokenNode || tokenNode.meta.nodeType !== "token") {
    throw new Error(
      `Final token node not found while resolving "${reference}"`,
    );
  }
  return tokenNode;
};

const resolveRawValue = <
  Input extends RawValue,
  Output extends Extract<Value, { type: Input["type"] }>,
>(
  tokenValue: Input,
  nodes: Map<string, TreeNode<TreeNodeMeta>>,
  resolvingStack: Set<string>,
): Output => {
  if (isTokenReference(tokenValue.value)) {
    const reference = tokenValue.value;
    const tokenNode = resolveTokenReference(reference, nodes, resolvingStack);
    const newStack = new Set(resolvingStack);
    newStack.add(reference);
    return resolveTokenValue(tokenNode, nodes, newStack) as Output;
  }
  switch (tokenValue.type) {
    case "transition":
      return {
        type: "transition",
        value: {
          duration: resolveRawValue(
            { type: "duration", value: tokenValue.value.duration },
            nodes,
            resolvingStack,
          ).value,
          delay: resolveRawValue(
            { type: "duration", value: tokenValue.value.delay },
            nodes,
            resolvingStack,
          ).value,
          timingFunction: resolveRawValue(
            { type: "cubicBezier", value: tokenValue.value.timingFunction },
            nodes,
            resolvingStack,
          ).value,
        },
      } satisfies Value as Output;
    case "border":
      return {
        type: "border",
        value: {
          color: resolveRawValue(
            { type: "color", value: tokenValue.value.color },
            nodes,
            resolvingStack,
          ).value,
          width: resolveRawValue(
            { type: "dimension", value: tokenValue.value.width },
            nodes,
            resolvingStack,
          ).value,
          style: resolveRawValue(
            { type: "strokeStyle", value: tokenValue.value.style },
            nodes,
            resolvingStack,
          ).value,
        },
      } satisfies Value as Output;
    case "shadow":
      return {
        type: "shadow",
        value: tokenValue.value.map((shadow) => ({
          color: resolveRawValue(
            { type: "color", value: shadow.color },
            nodes,
            resolvingStack,
          ).value,
          offsetX: resolveRawValue(
            { type: "dimension", value: shadow.offsetX },
            nodes,
            resolvingStack,
          ).value,
          offsetY: resolveRawValue(
            { type: "dimension", value: shadow.offsetY },
            nodes,
            resolvingStack,
          ).value,
          blur: resolveRawValue(
            { type: "dimension", value: shadow.blur },
            nodes,
            resolvingStack,
          ).value,
          spread: resolveRawValue(
            { type: "dimension", value: shadow.spread },
            nodes,
            resolvingStack,
          ).value,
          inset: shadow.inset,
        })),
      } satisfies Value as Output;
    case "typography":
      return {
        type: "typography",
        value: {
          fontFamily: resolveRawValue(
            { type: "fontFamily", value: tokenValue.value.fontFamily },
            nodes,
            resolvingStack,
          ).value,
          fontSize: resolveRawValue(
            { type: "dimension", value: tokenValue.value.fontSize },
            nodes,
            resolvingStack,
          ).value,
          fontWeight: resolveRawValue(
            { type: "fontWeight", value: tokenValue.value.fontWeight },
            nodes,
            resolvingStack,
          ).value,
          letterSpacing: resolveRawValue(
            { type: "dimension", value: tokenValue.value.letterSpacing },
            nodes,
            resolvingStack,
          ).value,
          lineHeight: resolveRawValue(
            { type: "number", value: tokenValue.value.lineHeight },
            nodes,
            resolvingStack,
          ).value,
        },
      } satisfies Value as Output;
    case "gradient":
      return {
        type: "gradient",
        value: tokenValue.value.map((gradient) => ({
          color: resolveRawValue(
            { type: "color", value: gradient.color },
            nodes,
            resolvingStack,
          ).value,
          position: gradient.position,
        })),
      } satisfies Value as Output;
    default:
      tokenValue.type satisfies
        | "number"
        | "color"
        | "dimension"
        | "duration"
        | "cubicBezier"
        | "fontFamily"
        | "fontWeight"
        | "strokeStyle";
      return { type: tokenValue.type, value: tokenValue.value } as Output;
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
  if (node.meta.nodeType !== "token") {
    throw new Error("resolveTokenValue requires a token node");
  }
  const token = node.meta;
  // Check if value is a token reference string
  // If not a reference, resolve composite components if needed
  if (isTokenReference(token.value)) {
    // Handle token reference
    const reference = token.value;
    const tokenNode = resolveTokenReference(reference, nodes, resolvingStack);
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
  const resolvedValue = resolveRawValue(
    { type: resolvedType, value: node.meta.value } as RawValue,
    nodes,
    resolvingStack,
  );
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
