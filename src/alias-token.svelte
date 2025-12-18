<script lang="ts">
  import { Link2, X } from "@lucide/svelte";
  import {
    treeState,
    resolveTokenValue,
    isAliasCircular,
  } from "./state.svelte";
  import { isNodeRef, type NodeRef, type RawValue, type Value } from "./schema";

  let {
    nodeId,
    type,
    value,
    onChange,
  }: {
    /** makes sure alias is not circular, optional for composite components */
    nodeId?: string;
    /** shows tokens only for specified type */
    type: Value["type"];
    value: NodeRef | RawValue["value"];
    onChange: (newNodeRef: undefined | NodeRef) => void;
  } = $props();
  const key = $props.id();

  const nodeRef = $derived(isNodeRef(value) ? value : undefined);

  let aliasSearchInput = $state("");
  let highlightedIndex = $state(0);
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
            // composites can safely avoid circular check
            (!nodeId || !isAliasCircular(nodeId, item.nodeId, nodes))
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

  const handleAliasKeyDown = (event: KeyboardEvent) => {
    if (!filteredAliasTokens.length) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (highlightedIndex === filteredAliasTokens.length - 1) {
          highlightedIndex = 0;
        } else {
          highlightedIndex = highlightedIndex + 1;
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (highlightedIndex === 0) {
          highlightedIndex = filteredAliasTokens.length - 1;
        } else {
          highlightedIndex = highlightedIndex - 1;
        }
        break;
      case "Enter":
        if (highlightedIndex >= 0) {
          event.preventDefault();
          onChange({ ref: filteredAliasTokens[highlightedIndex].nodeId });
          aliasSearchInput = "";
          highlightedIndex = 0;
          popoverElement?.hidePopover();
        }
        break;
      case "Escape":
        aliasSearchInput = "";
        highlightedIndex = 0;
        popoverElement?.hidePopover();
        break;
    }
  };

  const handleSelectAlias = (nodeId: string) => {
    onChange({ ref: nodeId });
    aliasSearchInput = "";
    highlightedIndex = 0;
    popoverElement?.hidePopover();
  };

  const handleRemoveAlias = () => {
    onChange(undefined);
    aliasSearchInput = "";
    highlightedIndex = 0;
    popoverElement?.hidePopover();
  };

  const handleToggle = (event: ToggleEvent) => {
    if (event.newState === "open") {
      // reset input and highlight selected option
      aliasSearchInput = "";
      highlightedIndex = availableTokens.findIndex(
        (token) => token.nodeId === nodeRef?.ref,
      );
      if (highlightedIndex === -1) {
        highlightedIndex = 0;
      }
    }
  };

  const activeDescendantId = $derived.by(() => {
    const activeItem = filteredAliasTokens[highlightedIndex];
    if (activeItem) {
      return `${key}-item-${activeItem.nodeId}`;
    }
  });

  $effect(() => {
    popoverElement?.querySelector(`#${activeDescendantId}`)?.scrollIntoView({
      block: "nearest",
    });
  });
</script>

<button
  class="a-button"
  interestfor="{key}-tooltip"
  commandfor="{key}-popover"
  command="toggle-popover"
  aria-pressed={nodeRef !== undefined}
>
  <Link2 size={16} />
</button>

<div id="{key}-tooltip" class="a-tooltip" popover="hint">
  {#if nodeRef}
    {getTokenPath(nodeRef.ref).join(" > ")}
  {:else}
    Make an alias for another token
  {/if}
</div>

<div
  bind:this={popoverElement}
  id="{key}-popover"
  class="a-popover a-menu"
  popover="auto"
  ontoggle={handleToggle}
>
  <div class="input-container">
    <!-- svelte-ignore a11y_autofocus -->
    <input
      bind:this={aliasSearchInputElement}
      class="a-field"
      type="text"
      placeholder="Search token..."
      autofocus
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      aria-controls="{key}-list"
      aria-expanded="true"
      aria-activedescendant={activeDescendantId}
      value={aliasSearchInput}
      oninput={(event) => {
        aliasSearchInput = event.currentTarget.value;
        highlightedIndex = 0;
      }}
      onkeydown={handleAliasKeyDown}
    />
    {#if nodeRef}
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
  <div id="{key}-list" class="menu" role="menu">
    {#each filteredAliasTokens as token, index (token.nodeId)}
      <button
        id="{key}-item-{token.nodeId}"
        class="a-item"
        role="option"
        aria-selected={index === highlightedIndex}
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

  .a-item[aria-selected="true"] {
    background: var(--bg-hover);
  }

  .no-results {
    padding-bottom: 8px;
    text-align: center;
    color: var(--text-secondary);
  }
</style>
