import { mount, unmount } from "svelte";
import { generateKeyBetween } from "fractional-indexing";
import App from "../../../src/app.svelte";
import {
  generateCssVariables,
  parseCssVariables,
} from "../../../src/css-variables";
import type { TreeNode } from "../../../src/store";
import {
  treeState,
  type SetMeta,
  type TreeNodeMeta,
} from "../../../src/state.svelte";
import { parseDesignTokens } from "../../../src/tokens";
import styles from "../../../src/app.css?raw";
import prismStyles from "prismjs/themes/prism-tomorrow.min.css?raw";

const extractUserCssVariables = () => {
  let css = ``;

  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules; // throws for cross-origin sheets
    } catch {
      continue;
    }

    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        // find selectors like ":root, html"
        const parts = rule.selectorText.split(",").map((s) => s.trim());
        if (!parts.some((part) => part === ":root" || part === "html")) {
          continue;
        }
        for (const property of rule.style) {
          if (property.startsWith("--")) {
            const value = rule.style.getPropertyValue(property);
            css += `${property}: ${value};\n`;
          }
        }
      }
    }
  }
  return css;
};

const importNodes = (nodes: TreeNode<TreeNodeMeta>[]) => {
  treeState.transact((tx) => {
    tx.clear();
    const tokenSetNode: TreeNode<SetMeta> = {
      nodeId: crypto.randomUUID(),
      parentId: undefined,
      index: generateKeyBetween(null, null),
      meta: { nodeType: "token-set", name: "Base" },
    };
    tx.set(tokenSetNode);
    for (const node of nodes) {
      if (node.parentId === undefined) {
        node.parentId = tokenSetNode.nodeId;
      }
      tx.set(node);
    }
  });
};

const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(`
  ${prismStyles}
  ${styles}
  :host {
    display: block;
    width: 100%;
    height: 100%;
  }
`);

export class EngrammaApp extends HTMLElement {
  #app: undefined | Record<string, any>;
  #unsubscribe: undefined | (() => void);

  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [styleSheet];
    const result = parseDesignTokens(
      parseCssVariables(extractUserCssVariables()),
    );
    importNodes(result.nodes);
    const tokensStyleSheet = new CSSStyleSheet();
    this.#unsubscribe = treeState.store.subscribe(() => {
      tokensStyleSheet.replaceSync(generateCssVariables(treeState.nodes()));
    });
    document.adoptedStyleSheets.push(tokensStyleSheet);
    this.#app = mount(App, { target: shadow });
  }

  disconnectedCallback() {
    if (this.#app) {
      unmount(this.#app);
    }
    this.#unsubscribe?.();
  }
}

customElements.define("engramma-app", EngrammaApp);
