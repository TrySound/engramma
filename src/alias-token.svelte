<script lang="ts">
  import { Link2, X } from "@lucide/svelte";
  import {
    treeState,
    resolveTokenValue,
    isAliasCircular,
  } from "./state.svelte";
  import type { Value } from "./schema";

  let {
    nodeId,
    type,
    reference,
    onAlias,
  }: {
    /** makes sure alias is not circular  */
    nodeId: string;
    /** shows tokens only for specified type */
    type: Value["type"];
    reference: undefined | string;
    onAlias: (newReference: undefined | string) => void;
  } = $props();
  const key = $props.id();

  let aliasSearchInput = $state("");
  let selectedAliasIndex = $state(0);
  let popoverElement: undefined | HTMLDivElement;
  let aliasSearchInputElement: undefined | HTMLInputElement;

  const getTokenPath = (nodeId: string): string[] => {
    const path: string[] = [];
    let currentId: string | undefined = nodeId;
    const nodes = treeState.nodes();
    while (currentId !== undefined) {
      const currentNode = nodes.get(currentId);
      if (!currentNode) break;
      path.unshift(currentNode.meta.name);
      currentId = currentNode.parentId;
    }
    return path;
  };

  const availableTokens = $derived.by(() => {
    const nodes = treeState.nodes();
    const compatibleTokens = Array.from(nodes.values())
      .filter((item) => {
        if (item.nodeId !== nodeId && item.meta.nodeType === "token") {
          const otherTokenType = resolveTokenValue(item, nodes).type;
          // Filter by type compatibility and check for circular dependencies
          return (
            otherTokenType === type &&
            !isAliasCircular(nodeId, item.nodeId, nodes)
          );
        }
        return false;
      })
      .map((node) => ({
        nodeId: node.nodeId,
        path: getTokenPath(node.nodeId),
        name: node.meta.name,
      }))
      .sort((a, b) => a.path.join(".").localeCompare(b.path.join(".")));
    return compatibleTokens;
  });

  const filteredAliasTokens = $derived.by(() => {
    if (!aliasSearchInput.trim()) {
      return availableTokens;
    }
    const query = aliasSearchInput.toLowerCase();
    return availableTokens.filter((token) =>
      token.path.some((part) => part.toLowerCase().includes(query)),
    );
  });

  const makeAlias = (targetNodeId: string) => {
    const targetNode = treeState.getNode(targetNodeId);
    if (targetNode?.meta.nodeType === "token") {
      const newReference = `{${getTokenPath(targetNodeId).join(".")}}`;
      onAlias(newReference);
    }
  };

  const handleAliasKeyDown = (event: KeyboardEvent) => {
    if (!filteredAliasTokens.length) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (selectedAliasIndex === filteredAliasTokens.length - 1) {
          selectedAliasIndex = 0;
        } else {
          selectedAliasIndex = selectedAliasIndex + 1;
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (selectedAliasIndex === 0) {
          selectedAliasIndex = filteredAliasTokens.length - 1;
        } else {
          selectedAliasIndex = selectedAliasIndex - 1;
        }
        break;
      case "Enter":
        if (selectedAliasIndex >= 0) {
          event.preventDefault();
          makeAlias(filteredAliasTokens[selectedAliasIndex].nodeId);
          aliasSearchInput = "";
          selectedAliasIndex = 0;
          popoverElement?.hidePopover();
        }
        break;
      case "Escape":
        aliasSearchInput = "";
        selectedAliasIndex = 0;
        popoverElement?.hidePopover();
        break;
    }
  };

  const handleSelectAlias = (nodeId: string) => {
    makeAlias(nodeId);
    aliasSearchInput = "";
    selectedAliasIndex = 0;
    popoverElement?.hidePopover();
  };

  const handleRemoveAlias = () => {
    onAlias(undefined);
    aliasSearchInput = "";
    selectedAliasIndex = 0;
    popoverElement?.hidePopover();
  };

  $effect(() => {
    if (popoverElement?.matches(":popover-open")) {
      aliasSearchInputElement?.focus();
    }
  });
</script>

<button
  class="a-button"
  interestfor="alias-token-tooltip-{key}"
  commandfor="alias-token-popopver-{key}"
  command="toggle-popover"
  aria-pressed={reference !== undefined}
>
  <Link2 size={16} />
</button>

<div id="alias-token-tooltip-{key}" class="a-tooltip" popover="hint">
  {#if reference}
    {reference.replace(/[{}]/g, "").split(".").join(" > ")}
  {:else}
    Make an alias for another token
  {/if}
</div>

<div
  bind:this={popoverElement}
  id="alias-token-popopver-{key}"
  class="a-popover a-menu"
  popover="auto"
>
  <div class="input-container">
    <!-- svelte-ignore a11y_autofocus -->
    <input
      bind:this={aliasSearchInputElement}
      class="a-field"
      type="text"
      placeholder="Search token..."
      autofocus
      autocomplete="off"
      value={aliasSearchInput}
      oninput={(event) => {
        aliasSearchInput = event.currentTarget.value;
        selectedAliasIndex = 0;
      }}
      onkeydown={handleAliasKeyDown}
    />
    {#if reference}
      <button
        class="a-button"
        aria-label="Remove alias"
        type="button"
        onclick={handleRemoveAlias}
      >
        <X size={16} />
      </button>
    {/if}
  </div>
  <div class="menu" role="menu">
    {#each filteredAliasTokens as token, index (token.nodeId)}
      <button
        class="a-item"
        class:selected={index === selectedAliasIndex}
        role="menuitem"
        type="button"
        onclick={() => handleSelectAlias(token.nodeId)}
      >
        {token.path.join(" > ")}
      </button>
    {:else}
      <div class="a-label no-results">No matching tokens</div>
    {/each}
  </div>
</div>

<style>
  .a-popover {
    width: 320px;
  }

  .input-container {
    position: relative;
    display: grid;
    align-items: center;
    padding: 8px;
    gap: 4px;
    &:has(button:last-child) {
      grid-template-columns: 1fr max-content;
    }
  }

  .menu {
    overflow-y: auto;
    max-height: 200px;
  }

  .a-item.selected {
    background: var(--bg-hover);
  }

  .no-results {
    padding-bottom: 8px;
    text-align: center;
    color: var(--text-secondary);
  }
</style>
