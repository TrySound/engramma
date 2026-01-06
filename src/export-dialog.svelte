<script lang="ts">
  import stringify from "json-stringify-pretty-compact";
  import { X } from "@lucide/svelte";
  import { treeState, type GroupMeta, type TokenMeta } from "./state.svelte";
  import { generateCssVariables } from "./css-variables";
  import { generateScssVariables } from "./scss";
  import { serializeDesignTokens } from "./tokens";
  import Code from "./code.svelte";
  import type { TreeNode } from "./store";

  let exportMode = $state<"json" | "css" | "scss">("json");

  const nodes = $derived(treeState.nodes());
  const jsonOutput = $derived.by(() => {
    const filteredNodes = new Map(nodes);
    // remove set node from data and serialize as DTCG format module
    const setIds = new Set<undefined | string>();
    for (const node of filteredNodes.values()) {
      if (node.meta.nodeType === "token-set") {
        setIds.add(node.nodeId);
        filteredNodes.delete(node.nodeId);
      }
    }
    for (const node of filteredNodes.values()) {
      if (setIds.has(node.parentId)) {
        node.parentId = undefined;
      }
    }
    return stringify(
      serializeDesignTokens(
        filteredNodes as Map<string, TreeNode<TokenMeta | GroupMeta>>,
      ),
    );
  });
  const cssOutput = $derived(generateCssVariables(nodes));
  const scssOutput = $derived(generateScssVariables(nodes));
</script>

<dialog id="export-dialog" class="dialog" closedby="any">
  <div class="a-tab-scroller">
    <div class="a-tab-list" role="tablist" aria-label="Export format">
      <button
        role="tab"
        aria-selected={exportMode === "json"}
        aria-controls="export-dialog-json"
        class="a-tab"
        onclick={() => (exportMode = "json")}
      >
        Export JSON
      </button>
      <button
        role="tab"
        aria-selected={exportMode === "css"}
        aria-controls="export-dialog-css"
        class="a-tab"
        onclick={() => (exportMode = "css")}
      >
        Export CSS
      </button>
      <button
        role="tab"
        aria-selected={exportMode === "scss"}
        aria-controls="export-dialog-scss"
        class="a-tab"
        onclick={() => (exportMode = "scss")}
      >
        Export SCSS
      </button>
    </div>
    <button
      class="a-button dialog-close"
      aria-label="Close"
      commandfor="export-dialog"
      command="close"
    >
      <X size={16} />
    </button>
  </div>

  {#if exportMode === "json"}
    <div id="export-dialog-json" class="code-panel">
      <Code code={jsonOutput} language="json" />
    </div>
  {/if}
  {#if exportMode === "css"}
    <div id="export-dialog-css" class="code-panel">
      <Code code={cssOutput} language="css" />
    </div>
  {/if}
  {#if exportMode === "scss"}
    <div id="export-dialog-scss" class="code-panel">
      <Code code={scssOutput} language="scss" />
    </div>
  {/if}
</dialog>

<style>
  .dialog:modal {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 0;
    max-width: 980px;
    width: 100%;
    height: 80vh;
    display: grid;
    grid-template-rows: max-content 1fr;
    box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);

    &::backdrop {
      background: rgba(0, 0, 0, 0.5);
    }
  }

  .dialog-close {
    position: sticky;
    right: 8px;
    margin: 0 8px;
  }

  .code-panel {
    overflow: hidden;
  }
</style>
