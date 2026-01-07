import { generateKeyBetween } from "fractional-indexing";
import { mount } from "svelte";
import App from "./app.svelte";
import "./app.css";
import { parseDesignTokens } from "./tokens";
import { treeState, type SetMeta } from "./state.svelte";
import designTokens from "./design-tokens-example.tokens.json";
import { getDataFromUrl } from "./url-data";
import type { TreeNode } from "./store";
import { isResolverFormat, parseTokenResolver } from "./resolver";

// Get design tokens from URL or use example
const urlData = await getDataFromUrl();
const tokensData = urlData ?? designTokens;

// Parse design tokens and populate state
let parsedResult: undefined | ReturnType<typeof parseTokenResolver>;

const zeroIndex = generateKeyBetween(null, null);

if (isResolverFormat(tokensData)) {
  const result = parseTokenResolver(tokensData);
  parsedResult = result;
  if (result.nodes.length > 0 || result.errors.length > 0) {
    treeState.transact((tx) => {
      for (const node of result.nodes) {
        tx.set(node);
      }
    });
  }
} else {
  // Try as tokens format
  const result = parseDesignTokens(tokensData);
  parsedResult = result;
  if (result.nodes.length > 0 || result.errors.length > 0) {
    treeState.transact((tx) => {
      const baseSetNode: TreeNode<SetMeta> = {
        nodeId: crypto.randomUUID(),
        parentId: undefined,
        index: zeroIndex,
        meta: {
          nodeType: "token-set",
          name: "Base",
        },
      };
      tx.set(baseSetNode);
      for (const node of result.nodes) {
        if (node.parentId === undefined) {
          node.parentId = baseSetNode.nodeId;
        }
        tx.set(node);
      }
    });
  }
}

// Log any parsing errors
if (parsedResult.errors.length > 0) {
  console.error("Design token parsing errors:", parsedResult.errors);
}

console.info(`Loaded design tokens: ${parsedResult.nodes.length} nodes`);

// Enable URL sync after initial load
treeState.enableUrlSync();

mount(App, { target: document.body });
