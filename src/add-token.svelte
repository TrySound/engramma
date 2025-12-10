<script lang="ts">
  import { generateKeyBetween } from "fractional-indexing";
  import { findTokenType, treeState, type TreeNodeMeta } from "./state.svelte";
  import type { TreeNode } from "./store";
  import { Plus } from "@lucide/svelte";
  import type { GradientValue, Value } from "./schema";
  import { titleCase } from "title-case";
  import { noCase } from "change-case";

  interface Props {
    selectedItems: Set<string>;
    onTokenAdded?: (nodeId: string) => void;
  }

  let { selectedItems, onTokenAdded }: Props = $props();

  const zeroIndex = generateKeyBetween(null, null);

  const tokenTypes: Value["type"][] = [
    "color",
    "dimension",
    "duration",
    "number",
    "fontFamily",
    "fontWeight",
    "cubicBezier",
    "transition",
    "strokeStyle",
    "shadow",
    "border",
    "typography",
    "gradient",
  ];

  const inheritedType = $derived.by(() => {
    if (selectedItems.size > 0) {
      const node = treeState.getNode(Array.from(selectedItems)[0]);
      if (node) {
        return findTokenType(node, treeState.nodes());
      }
    }
  });

  const getDefaultValue = (type: Value["type"]): Value => {
    switch (type) {
      case "color":
        return {
          type,
          value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1 },
        };
      case "dimension":
        return { type, value: { value: 0, unit: "px" } };
      case "duration":
        return { type, value: { value: 0, unit: "ms" } };
      case "number":
        return { type, value: 0 };
      case "fontFamily":
        return { type, value: "sans-serif" };
      case "fontWeight":
        return { type, value: 400 };
      case "cubicBezier":
        return { type, value: [0.25, 0.1, 0.25, 1] };
      case "transition":
        return {
          type,
          value: {
            duration: { value: 300, unit: "ms" },
            delay: { value: 0, unit: "ms" },
            timingFunction: [0.25, 0.1, 0.25, 1],
          },
        };
      case "strokeStyle":
        return { type, value: "solid" };
      case "shadow":
        return {
          type,
          value: [
            {
              color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.5 },
              offsetX: { value: 0, unit: "px" },
              offsetY: { value: 4, unit: "px" },
              blur: { value: 6, unit: "px" },
            },
          ],
        };
      case "border":
        return {
          type,
          value: {
            color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1 },
            width: { value: 1, unit: "px" },
            style: "solid",
          },
        };
      case "typography":
        return {
          type,
          value: {
            fontFamily: "sans-serif",
            fontSize: { value: 16, unit: "px" },
            fontWeight: 400,
            letterSpacing: { value: 0, unit: "px" },
            lineHeight: 1.5,
          },
        };
      case "gradient": {
        const start: GradientValue[number] = {
          color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1 },
          position: 0,
        };
        const end: GradientValue[number] = {
          color: { colorSpace: "srgb", components: [255, 255, 255], alpha: 1 },
          position: 1,
        };
        return {
          type,
          value: [start, end],
        };
      }
    }
  };

  const handleAddToken = (type: Value["type"]) => {
    let parentId: string | undefined;
    let insertAfterIndex: string | undefined;
    if (selectedItems.size === 0) {
      // no selection: add to root at the end
      parentId = undefined;
      const rootChildren = treeState.getChildren(undefined);
      const lastRootIndex = rootChildren.at(-1)?.index ?? zeroIndex;
      insertAfterIndex = generateKeyBetween(lastRootIndex, null);
    } else {
      const selectedNode = treeState.getNode(Array.from(selectedItems)[0]);
      if (selectedNode?.meta.nodeType === "token-group") {
        parentId = selectedNode.nodeId;
        // Add at the end of the group
        const children = treeState.getChildren(selectedNode.nodeId);
        const lastChildIndex = children.at(-1)?.index ?? zeroIndex;
        insertAfterIndex = generateKeyBetween(lastChildIndex, null);
      }
      if (selectedNode?.meta.nodeType === "token") {
        // add between selected item and the next sibling
        const nextSibling = treeState.getNextSibling(selectedNode.nodeId);
        parentId = selectedNode.parentId;
        insertAfterIndex = generateKeyBetween(
          selectedNode.index,
          nextSibling?.index ?? null,
        );
      }
    }
    if (!insertAfterIndex) {
      return;
    }
    // Create new token node with the selected type
    const newToken: TreeNode<TreeNodeMeta> = {
      nodeId: crypto.randomUUID(),
      parentId,
      index: insertAfterIndex,
      meta: {
        nodeType: "token",
        name: "New Token",
        ...getDefaultValue(type),
      },
    };
    treeState.transact((tx) => {
      tx.set(newToken);
    });
    onTokenAdded?.(newToken.nodeId);
  };
</script>

{#if inheritedType}
  <button
    class="a-button"
    aria-label="Add token"
    onclick={() => handleAddToken(inheritedType)}
  >
    <Plus size={16} />
  </button>
{:else}
  <button
    class="a-button"
    aria-label="Add token"
    commandfor="app-add-token-menu"
    command="toggle-popover"
  >
    <Plus size={16} />
  </button>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  id="app-add-token-menu"
  class="a-popover a-menu token-type-menu"
  popover="auto"
  role="menu"
  onclick={(event) => event.currentTarget.hidePopover()}
>
  {#each tokenTypes as type, index (type)}
    <!-- svelte-ignore a11y_autofocus -->
    <button
      class="a-item"
      role="menuitem"
      autofocus={index === 0}
      onclick={() => handleAddToken(type)}
    >
      {titleCase(noCase(type))}
    </button>
  {/each}
</div>

<style>
  .token-type-menu {
    position-area: span-left bottom;
  }
</style>
