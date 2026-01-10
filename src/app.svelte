<script module lang="ts">
  import "@oddbird/popover-polyfill";
  import "invokers-polyfill";
  import "dialog-closedby-polyfill";
  import "hdr-color-input";
  import "interestfor";
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { generateKeyBetween } from "fractional-indexing";
  import {
    autoPlacement,
    autoUpdate,
    computePosition,
    offset,
    shift,
  } from "@floating-ui/dom";
  import {
    focusGroupKeyUX,
    hotkeyKeyUX,
    hotkeyMacCompat,
    startKeyUX,
  } from "keyux";
  import {
    Settings,
    Trash2,
    Folder,
    Square,
    Ruler,
    Clock,
    Type,
    Hash,
    Bold,
    Tangent,
    CaseUpper,
    ArrowRightLeft,
    LineSquiggle,
    Paintbrush,
    Tags,
  } from "@lucide/svelte";
  import TreeView, { type TreeItem } from "./tree-view.svelte";
  import Editor from "./editor.svelte";
  import AddToken from "./add-token.svelte";
  import AppMenu from "./app-menu.svelte";
  import Styleguide from "./styleguide.svelte";
  import type { TreeNode } from "./store";
  import {
    findTokenType,
    resolveTokenValue,
    treeState,
    type TreeNodeMeta,
  } from "./state.svelte";
  import { serializeColor } from "./color";
  import type { Value } from "./schema";

  const zeroIndex = generateKeyBetween(null, null);

  onMount(() => {
    return startKeyUX(window, [
      hotkeyKeyUX([hotkeyMacCompat()]),
      focusGroupKeyUX(),
    ]);
  });

  const rootNodes = $derived.by(() => {
    const rootNodes = treeState.getChildren(undefined);
    // Get children of Base token-set if it exists
    const baseSet = rootNodes.find(
      (node) => node.meta.nodeType === "token-set",
    );
    return baseSet ? treeState.getChildren(baseSet.nodeId) : rootNodes;
  });

  let selectedItems = new SvelteSet<string>();

  const buildTreeItem = (node: TreeNode<TreeNodeMeta>): TreeItem => {
    const children = treeState.getChildren(node.nodeId);
    return {
      id: node.nodeId,
      parentId: node.parentId,
      name: node.meta.name,
      children: children.map(buildTreeItem),
    };
  };

  const treeData = $derived(rootNodes.map(buildTreeItem));
  const defaultExpandedItems = $derived([]);

  const handleDelete = () => {
    if (selectedItems.size === 0) {
      return;
    }
    // find the next focus target before deletion
    const currentNodeId = Array.from(selectedItems).at(0);
    let nextFocusId: string | undefined;
    if (currentNodeId) {
      const nextSelectedNode =
        treeState.getNextSibling(currentNodeId) ??
        treeState.getPrevSibling(currentNodeId) ??
        treeState.getParent(currentNodeId);
      if (nextSelectedNode) {
        nextFocusId = nextSelectedNode.nodeId;
      }
    }
    // delete selected nodes
    treeState.transact((tx) => {
      for (const nodeId of selectedItems) {
        tx.delete(nodeId);
      }
    });
    // move selection to the next focus target
    selectedItems.clear();
    if (nextFocusId) {
      selectedItems.add(nextFocusId);
    }
  };

  const handleAddGroup = () => {
    const firstSelectedId = Array.from(selectedItems)[0];
    const firstSelectedNode = treeState.getNode(firstSelectedId);
    // determine parent and index for new group
    let parentId: string | undefined;
    let insertAfterIndex: string;
    if (
      firstSelectedNode === undefined ||
      firstSelectedNode.meta.nodeType === "token-group"
    ) {
      parentId = firstSelectedId;
      // add at the end of the group
      const children = treeState.getChildren(firstSelectedId);
      const lastChildIndex = children.at(-1)?.index ?? zeroIndex;
      insertAfterIndex = generateKeyBetween(lastChildIndex, null);
    } else {
      // add after the token
      parentId = firstSelectedNode.parentId;
      insertAfterIndex = generateKeyBetween(firstSelectedNode.index, null);
    }
    const newGroup: TreeNode<TreeNodeMeta> = {
      nodeId: crypto.randomUUID(),
      parentId,
      index: insertAfterIndex,
      meta: {
        nodeType: "token-group",
        name: "New Group",
      },
    };
    treeState.transact((tx) => {
      tx.set(newGroup);
    });
    selectedItems.clear();
    selectedItems.add(newGroup.nodeId);
  };

  const handleTokenAdded = (tokenNodeId: string) => {
    // select and open editor for the new token
    selectedItems.clear();
    selectedItems.add(tokenNodeId);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    if (
      event.target.closest("input, textarea, [contenteditable], color-input")
    ) {
      return;
    }
    const closestTree = event.target.closest("[role=tree]");
    if (event.key === "Enter" && closestTree) {
      document.getElementById("app-node-editor")?.showPopover();
    }
    if (event.key === "Backspace" && closestTree) {
      handleDelete();
    }
  };

  const handleMove = (
    itemIds: string[],
    newParentId: undefined | string,
    position: number,
  ) => {
    // get the children of the new parent to calculate the new index
    const newParentChildren = treeState.getChildren(newParentId);
    const prevIndex = newParentChildren[position - 1]?.index ?? zeroIndex;
    const nextIndex = newParentChildren[position]?.index ?? null;
    treeState.transact((tx) => {
      // move each item to the new parent
      for (const itemId of itemIds) {
        const node = treeState.getNode(itemId);
        if (node) {
          tx.set({
            ...node,
            parentId: newParentId,
            index: generateKeyBetween(prevIndex, nextIndex),
          });
        }
      }
    });
  };

  /**
   * polyfill for anchor positioning in popovers
   * detects toggle source (which is also poorly supported) with click handler
   * and uses floating-ui to position elements
   */
  let cleanupPositioningAutoUpdate: undefined | (() => void);
  const handleDocumentClick = (event: MouseEvent) => {
    // ignore if anchor-positioning is already supported
    if ("anchorName" in document.documentElement.style) {
      return;
    }
    const button = (event.target as HTMLElement).closest(
      "button[commandfor]",
    ) as null | HTMLButtonElement;
    if (button?.commandForElement) {
      const target = button.commandForElement;
      // ignore dialogs
      if (target instanceof HTMLDialogElement) {
        return;
      }
      // closed state is not always triggers beforetoggle
      cleanupPositioningAutoUpdate?.();
      const updatePosition = () => {
        computePosition(button, target, {
          middleware: [
            offset(8),
            shift({ padding: 12 }),
            autoPlacement({ allowedPlacements: ["top", "bottom"] }),
          ],
        }).then(({ x, y }) => {
          target.style.setProperty("margin", "0px");
          target.style.setProperty("left", `${x}px`);
          target.style.setProperty("top", `${y}px`);
        });
      };
      cleanupPositioningAutoUpdate = autoUpdate(button, target, updatePosition);
    }
  };

  const handleDocumentMouseOver = (event: MouseEvent) => {
    // ignore if anchor-positioning is already supported
    if ("anchorName" in document.documentElement.style) {
      return;
    }
    const button = (event.target as HTMLElement).closest(
      "button[interestfor]",
    ) as null | HTMLButtonElement;
    const interestFor = button?.getAttribute("interestfor");
    const target = interestFor
      ? document.getElementById(interestFor)
      : undefined;
    if (button && target) {
      // closed state is not always triggers beforetoggle
      cleanupPositioningAutoUpdate?.();
      const updatePosition = () => {
        computePosition(button, target, {
          middleware: [
            offset(8),
            shift({ padding: 12 }),
            autoPlacement({ allowedPlacements: ["top", "bottom"] }),
          ],
        }).then(({ x, y }) => {
          target.style.setProperty("margin", "0px");
          target.style.setProperty("left", `${x}px`);
          target.style.setProperty("top", `${y}px`);
        });
      };
      cleanupPositioningAutoUpdate = autoUpdate(button, target, updatePosition);
    }
  };
</script>

<svelte:document
  onclickcapture={handleDocumentClick}
  onmouseovercapture={handleDocumentMouseOver}
  onkeydown={handleKeyDown}
/>

<div class="app">
  <div class="horizontal-container">
    <!-- Left Panel: Design Tokens -->
    <aside class="panel left-panel">
      <div class="panel-header">
        <AppMenu />
        <h1 class="a-panel-title">Engramma</h1>
        <div class="toolbar-actions">
          {#if selectedItems.size > 0}
            <button
              class="a-button"
              aria-label={`Delete ${selectedItems.size} item(s)`}
              onclick={handleDelete}
            >
              <Trash2 size={16} />
            </button>
          {/if}
          <button
            class="a-button"
            aria-label="Add group"
            onclick={handleAddGroup}
          >
            <Folder size={16} />
          </button>
          <AddToken {selectedItems} onTokenAdded={handleTokenAdded} />
        </div>
      </div>

      {#snippet renderTypeIcon(type: Value["type"])}
        {#if type === "color"}
          <div
            class="token-preview"
            style="background: var(--text-secondary);"
          ></div>
        {:else if type === "dimension"}
          <Ruler size={16} />
        {:else if type === "duration"}
          <Clock size={16} />
        {:else if type === "number"}
          <Hash size={16} />
        {:else if type === "fontFamily"}
          <CaseUpper size={16} />
        {:else if type === "fontWeight"}
          <Bold size={16} />
        {:else if type === "cubicBezier"}
          <Tangent size={16} />
        {:else if type === "transition"}
          <ArrowRightLeft size={16} />
        {:else if type === "typography"}
          <Type size={16} />
        {:else if type === "strokeStyle"}
          <LineSquiggle size={16} />
        {:else if type === "shadow"}
          <Tags size={16} />
        {:else if type === "border"}
          <Square size={16} />
        {:else if type === "gradient"}
          <Paintbrush size={16} />
        {/if}
      {/snippet}

      {#snippet renderTreeItem(item: TreeItem)}
        {@const node = treeState.getNode(item.id)}
        <div class="token">
          {#if node?.meta.nodeType === "token"}
            {@const tokenValue = resolveTokenValue(node, treeState.nodes())}
            {#if tokenValue.type === "color"}
              <div
                class="token-preview"
                style="background: {serializeColor(tokenValue.value)};"
              ></div>
            {:else}
              <div class="token-icon">
                {@render renderTypeIcon(tokenValue.type)}
              </div>
            {/if}
          {/if}
          {#if node?.meta.nodeType === "token-group"}
            {@const type = findTokenType(node, treeState.nodes())}
            <div class="token-icon">
              {#if type}
                {@render renderTypeIcon(type)}
              {:else}
                <Folder size={16} />
              {/if}
            </div>
          {/if}
          <span class="token-name">{item.name}</span>
          <button
            class="a-small-button edit-button"
            aria-label="Edit"
            onclick={() => {
              selectedItems.clear();
              selectedItems.add(item.id);
              /* safari closes dialog whenever cursor is out of button */
              document.getElementById("app-node-editor")?.showPopover();
            }}
          >
            <Settings size={16} />
          </button>
        </div>
      {/snippet}

      <div class="tokens-container">
        <TreeView
          id="tokens-tree"
          label="Design Tokens"
          data={treeData}
          {selectedItems}
          {defaultExpandedItems}
          renderItem={renderTreeItem}
          canAcceptChildren={(nodeId) =>
            treeState.getNode(nodeId)?.meta.nodeType === "token-group"}
          onMove={handleMove}
        />
      </div>
    </aside>

    <Editor id="app-node-editor" {selectedItems} />

    <!-- Right Panel: CSS Variables / JSON -->
    <main class="panel right-panel">
      <div class="panel-header"><!-- placeholder for sets --></div>
      <div class="styleguide-panel">
        <Styleguide {selectedItems} />
      </div>
    </main>
  </div>
</div>

<style>
  .app {
    container-type: inline-size;
    width: 100%;
    height: 100%;
    display: grid;
  }

  .horizontal-container {
    display: grid;
    grid-template-columns: max(320px, 30%) 1fr;
    grid-template-rows: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;

    @container (width <= 720px) {
      grid-template-columns: 100cqw 100cqw;
    }
  }

  /* Panels */
  .panel {
    display: grid;
    grid-template-rows: var(--panel-header-height) 1fr;
    background: var(--bg-primary);
    scroll-snap-align: center;
  }

  .left-panel {
    border-right: 1px solid var(--border-color);
  }

  .panel-header {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 0 8px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    background: var(--bg-primary);
    gap: 8px;
    overflow: hidden;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    margin-left: auto;
  }

  .tokens-container {
    overflow: auto;
  }

  /* Tree structure */
  .token {
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .token-preview {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .token-icon {
    flex-shrink: 0;
    opacity: 0.6;
    display: flex;
    align-items: center;
  }

  .token-name {
    font-size: 14px;
    font-weight: 400;
    color: var(--text-primary);
  }

  .edit-button {
    pointer-events: auto;
    visibility: var(--tree-view-item-visibility);
  }

  .styleguide-panel {
    overflow: hidden;
  }
</style>
