import { generateKeyBetween } from "fractional-indexing";
import { mount } from "svelte";
import "prismjs/themes/prism-tomorrow.min.css";
import "./app.css";
import App from "./app.svelte";
import { parseDesignTokens } from "./tokens";
import {
  isResolverFormat,
  parseTokenResolver,
  serializeTokenResolver,
} from "./resolver";
import { setDataInUrl, getDataFromUrl } from "./url-data";
import { treeState, type SetMeta } from "./state.svelte";
import type { TreeNode } from "./store";
import type { Preset } from "./new-project.svelte";
import type { TreeNodeMeta } from "./state.svelte";

const presets: Preset[] = [
  {
    name: "Open Props",
    description:
      "Popular CSS custom properties library with colors, sizes, shadows, and more",
    load: async () => {
      const resolver = await import("open-props/resolver");
      return {
        name: "Open Props",
        content: JSON.stringify(resolver.default),
      };
    },
  },
  {
    name: "Test Tokens",
    description:
      "Example design tokens in DTCG format with colors, spacing, typography",
    load: async () => {
      const { default: tokens } =
        await import("./design-tokens-example.tokens.json");
      return { name: "Example Tokens", content: JSON.stringify(tokens) };
    },
  },
  {
    name: "Test Resolver",
    description: "Example resolver format with sets and modifiers",
    load: async () => {
      const { default: resolver } =
        await import("./design-tokens-example.resolver.json");
      return { name: "Example Resolver", content: JSON.stringify(resolver) };
    },
  },
];

// Get design tokens from URL or use example
const urlData = await getDataFromUrl();
const tokensData = urlData;

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

// Set up debounced URL sync after initial load
const URL_SYNC_DEBOUNCE_MS = 300;
let urlUpdateTimeout: ReturnType<typeof setTimeout> | undefined;

treeState.subscribe(() => {
  if (urlUpdateTimeout) {
    clearTimeout(urlUpdateTimeout);
  }
  urlUpdateTimeout = setTimeout(() => {
    const allNodes = treeState.nodes() as Map<string, TreeNode<TreeNodeMeta>>;
    const serialized = serializeTokenResolver(allNodes);
    setDataInUrl(serialized).catch((error: unknown) => {
      console.error("Failed to sync design tokens to URL:", error);
    });
  }, URL_SYNC_DEBOUNCE_MS);
});

mount(App, { target: document.body, props: { presets } });
