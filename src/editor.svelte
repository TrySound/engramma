<script lang="ts">
  import type { SvelteSet } from "svelte/reactivity";
  import { Plus, X } from "@lucide/svelte";
  import {
    treeState,
    resolveTokenValue,
    type TreeNodeMeta,
  } from "./state.svelte";
  import { parseColor, serializeColor } from "./color";
  import type {
    DimensionValue,
    FontFamilyValue,
    ShadowItem,
    StrokeStyleValue,
  } from "./schema";
  import CubicBezierEditor from "./cubic-bezier-editor.svelte";
  import GradientEditor from "./gradient-editor.svelte";

  let {
    selectedItems,
    editingMode = $bindable(),
  }: { selectedItems: SvelteSet<string>; editingMode: boolean } = $props();

  const fontWeightMap: Record<string, number> = {
    thin: 100,
    hairline: 100,
    "extra-light": 200,
    "ultra-light": 200,
    light: 300,
    normal: 400,
    regular: 400,
    book: 400,
    medium: 500,
    "semi-bold": 600,
    "demi-bold": 600,
    bold: 700,
    "extra-bold": 800,
    "ultra-bold": 800,
    black: 900,
    heavy: 900,
    "extra-black": 950,
    "ultra-black": 950,
  };

  const normalizeFontWeight = (value: number | string): number => {
    if (typeof value === "number") {
      return value;
    }
    const normalized = value.toLowerCase().trim();
    return fontWeightMap[normalized] ?? Number.parseInt(value, 10);
  };

  const normalizeFontFamily = (value: string | string[]): string | string[] => {
    if (Array.isArray(value)) {
      return value;
    }
    // If it's a string with commas, split it into an array
    const trimmed = value.trim();
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
    }
    // Otherwise keep it as a string
    return trimmed;
  };

  const node = $derived.by(() => {
    const nodeId = Array.from(selectedItems).at(0);
    if (nodeId) {
      return treeState.getNode(nodeId);
    }
  });
  const meta = $derived(node?.meta);
  const tokenValue = $derived.by(() => {
    if (node?.meta.nodeType === "token") {
      return resolveTokenValue(node, treeState.nodes());
    }
  });

  const updateMeta = (newMeta: Partial<TreeNodeMeta>) => {
    if (node?.meta) {
      treeState.transact((tx) => {
        tx.set({
          ...node,
          meta: { ...node.meta, ...(newMeta as typeof node.meta) },
        });
      });
    }
  };

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
    if (node?.meta.nodeType !== "token") {
      return [];
    }
    const nodes = treeState.nodes();
    const currentTokenType = tokenValue?.type;
    if (!currentTokenType) {
      return [];
    }
    const compatibleTokens = Array.from(nodes.values())
      .filter((item) => {
        if (item.nodeId !== node.nodeId && item.meta.nodeType === "token") {
          const otherTokenType = resolveTokenValue(item, nodes).type;
          return otherTokenType === currentTokenType;
        }
        return false;
      })
      .map((n) => ({
        nodeId: n.nodeId,
        path: getTokenPath(n.nodeId),
        name: n.meta.name,
      }))
      .sort((a, b) => a.path.join(".").localeCompare(b.path.join(".")));
    return compatibleTokens;
  });

  const makeAlias = (targetNodeId: string) => {
    const targetNode = treeState.getNode(targetNodeId);
    if (targetNode?.meta.nodeType === "token") {
      const targetPath = getTokenPath(targetNodeId);
      const extendsRef = `{${targetPath.join(".")}}`;
      updateMeta({ extends: extendsRef, value: undefined });
    }
  };

  const isAlias = $derived(
    meta?.nodeType === "token" && meta.extends !== undefined,
  );

  let aliasSearchInput = $state("");
  let selectedAliasIndex = $state(0);

  const aliasPath = $derived.by(() => {
    if (meta?.nodeType === "token" && meta.extends) {
      // Extract path from {group.token} format
      const extendsRef = meta.extends;
      return extendsRef.replace(/[{}]/g, "").split(".").join(" > ");
    }
    return "";
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
          aliasPopoverElement?.hidePopover();
        }
        break;
      case "Escape":
        aliasSearchInput = "";
        selectedAliasIndex = 0;
        aliasPopoverElement?.hidePopover();
        break;
    }
  };

  const handleNameChange = (newName: string) => {
    updateMeta({ name: newName });
  };

  const handleDescriptionChange = (newDescription: string) => {
    updateMeta({ description: newDescription });
  };

  const handleDeprecatedChange = (deprecated: boolean | string) => {
    if (deprecated === "") {
      updateMeta({ deprecated: true });
    } else if (deprecated === false) {
      updateMeta({ deprecated: undefined });
    } else {
      updateMeta({ deprecated });
    }
  };

  // svelte-ignore non_reactive_update
  let aliasPopoverElement: undefined | HTMLDivElement;
</script>

{#snippet dimensionEditor(
  dimension: DimensionValue,
  onChange: (value: DimensionValue) => void,
  disabled: boolean = false,
)}
  <div class="dimension-input-group">
    <input
      class="a-field dimension-value"
      type="number"
      value={dimension.value}
      {disabled}
      step="0.1"
      placeholder="Value"
      oninput={(e) => {
        const value = Number.parseFloat(e.currentTarget.value);
        if (!Number.isNaN(value)) {
          onChange({ ...dimension, value });
        }
      }}
    />
    <select
      class="a-field dimension-unit-select"
      value={dimension.unit}
      {disabled}
      onchange={(e) => {
        onChange({
          ...dimension,
          unit: e.currentTarget.value as "px" | "rem",
        });
      }}
    >
      <option value="px">px</option>
      <option value="rem">rem</option>
    </select>
  </div>
{/snippet}

{#snippet fontFamilyEditor(
  fontFamily: FontFamilyValue,
  onChange: (value: FontFamilyValue) => void,
  disabled: boolean = false,
)}
  <textarea
    class="a-field"
    {disabled}
    placeholder="e.g., Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    value={typeof fontFamily === "string" ? fontFamily : fontFamily.join(", ")}
    oninput={(e) => {
      const input = e.currentTarget.value;
      const normalized = normalizeFontFamily(input);
      onChange(normalized);
    }}
  ></textarea>
{/snippet}

{#snippet fontWeightEditor(
  fontWeight: number | string,
  onChange: (value: number) => void,
  disabled: boolean = false,
)}
  <select
    class="a-field"
    value={String(normalizeFontWeight(fontWeight))}
    {disabled}
    onchange={(e) => {
      const value = Number.parseInt(e.currentTarget.value, 10);
      onChange(value);
    }}
  >
    <option value="100">100 — thin, hairline</option>
    <option value="200">200 — extra-light, ultra-light</option>
    <option value="300">300 — light</option>
    <option value="400">400 — normal, regular, book</option>
    <option value="500">500 — medium</option>
    <option value="600">600 — semi-bold, demi-bold</option>
    <option value="700">700 — bold</option>
    <option value="800">800 — extra-bold, ultra-bold</option>
    <option value="900">900 — black, heavy</option>
    <option value="950">950 — extra-black, ultra-black</option>
  </select>
{/snippet}

{#snippet strokeStyleEditor(
  strokeStyle: StrokeStyleValue,
  onChange: (value: StrokeStyleValue) => void,
  disabled: boolean = false,
)}
  {#if typeof strokeStyle === "string"}
    <select
      class="a-field"
      value={strokeStyle}
      {disabled}
      onchange={(e) => {
        const value = e.currentTarget.value;
        if (value !== "custom") {
          onChange(value as StrokeStyleValue);
        } else {
          onChange({
            dashArray: [{ value: 2, unit: "px" }],
            lineCap: "round",
          });
        }
      }}
    >
      <option value="solid">Solid</option>
      <option value="dashed">Dashed</option>
      <option value="dotted">Dotted</option>
      <option value="double">Double</option>
      <option value="groove">Groove</option>
      <option value="ridge">Ridge</option>
      <option value="outset">Outset</option>
      <option value="inset">Inset</option>
      <option value="custom">Custom</option>
    </select>
  {:else if typeof strokeStyle === "object" && "dashArray" in strokeStyle}
    <select
      class="a-field"
      value="custom"
      {disabled}
      onchange={(e) => {
        const value = e.currentTarget.value;
        if (value !== "custom") {
          onChange(value as StrokeStyleValue);
        }
      }}
    >
      <option value="solid">Solid</option>
      <option value="dashed">Dashed</option>
      <option value="dotted">Dotted</option>
      <option value="double">Double</option>
      <option value="groove">Groove</option>
      <option value="ridge">Ridge</option>
      <option value="outset">Outset</option>
      <option value="inset">Inset</option>
      <option value="custom">Custom</option>
    </select>

    <div class="form-group">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="a-label">Line Cap</label>
      <select
        class="a-field"
        value={strokeStyle.lineCap}
        {disabled}
        onchange={(e) => {
          onChange({
            ...strokeStyle,
            lineCap: e.currentTarget.value as "round" | "butt" | "square",
          });
        }}
      >
        <option value="round">Round</option>
        <option value="butt">Butt</option>
        <option value="square">Square</option>
      </select>
    </div>

    <div class="form-group">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label class="a-label">Dash Array</label>
      <div class="dash-array-list">
        {#each strokeStyle.dashArray as dash, index (index)}
          <div class="dash-array-item">
            <div class="dash-array-item-header">
              <span class="dash-array-item-title">Dash {index + 1}</span>
              {#if strokeStyle.dashArray.length > 1}
                <button
                  class="a-button"
                  aria-label="Remove dash"
                  onclick={() => {
                    const updated = strokeStyle.dashArray.filter(
                      (_, i: number) => i !== index,
                    );
                    onChange({
                      ...strokeStyle,
                      dashArray: updated,
                    });
                  }}
                >
                  <X size={20} />
                </button>
              {/if}
            </div>
            <div class="dash-array-item-body">
              {@render dimensionEditor(dash, (newDash) => {
                const updated = [...strokeStyle.dashArray];
                updated[index] = newDash;
                onChange({
                  ...strokeStyle,
                  dashArray: updated,
                });
              })}
            </div>
          </div>
        {/each}

        <button
          class="a-button"
          onclick={() => {
            onChange({
              ...strokeStyle,
              dashArray: [...strokeStyle.dashArray, { value: 2, unit: "px" }],
            });
          }}
        >
          <Plus /> Add Dash
        </button>
      </div>
    </div>
  {/if}
{/snippet}

<div class="form-panel">
  <div class="form-header">
    <h2 class="form-title">
      {meta?.nodeType === "token-group" ? "Group" : "Token"}
    </h2>
    <button
      class="a-button"
      aria-label="Close"
      aria-keyshortcuts="Escape"
      onclick={() => (editingMode = false)}
    >
      <X size={20} />
    </button>
  </div>

  <div class="form-content">
    <div class="form-group">
      <label class="a-label" for="name-input">Name</label>
      <input
        id="name-input"
        class="a-field"
        type="text"
        value={meta?.name}
        oninput={(e) => handleNameChange(e.currentTarget.value)}
      />
    </div>

    <div class="form-group">
      <label class="a-label" for="description-input">Description</label>
      <textarea
        id="description-input"
        class="a-field"
        value={meta?.description ?? ""}
        oninput={(e) => handleDescriptionChange(e.currentTarget.value)}
      ></textarea>
    </div>

    <div class="form-group">
      <label class="a-label" for="deprecated-input">
        <input
          id="deprecated-input"
          type="checkbox"
          checked={meta?.deprecated !== undefined}
          onchange={(e) => handleDeprecatedChange(e.currentTarget.checked)}
        />
        Deprecated
      </label>
      {#if meta?.deprecated !== undefined}
        <input
          class="a-field"
          type="text"
          placeholder="Reason for deprecation"
          bind:value={
            () => (typeof meta.deprecated === "string" ? meta.deprecated : ""),
            (reason) => handleDeprecatedChange(reason)
          }
        />
      {/if}
    </div>

    {#if meta?.nodeType === "token" && meta.type}
      <div class="form-group">
        <div class="a-label">Type</div>
        <div class="form-value">{meta.type}</div>
      </div>
    {/if}

    {#if meta?.nodeType === "token" && availableTokens.length > 0}
      <div class="form-group">
        <label class="a-label" for="alias-input">Alias Token</label>
        <div class="combobox-container">
          <input
            id="alias-input"
            class="a-field alias-input"
            type="text"
            placeholder="Search token..."
            autocomplete="off"
            value={aliasPath || aliasSearchInput}
            oninput={(event) => {
              aliasSearchInput = event.currentTarget.value;
              selectedAliasIndex = 0;
              aliasPopoverElement?.showPopover();
            }}
            onkeydown={handleAliasKeyDown}
            onfocus={() => aliasPopoverElement?.showPopover()}
            onblur={() => {
              // Clear search after a brief delay to allow click handling
              setTimeout(() => {
                aliasSearchInput = "";
                selectedAliasIndex = 0;
                aliasPopoverElement?.hidePopover();
              }, 200);
            }}
          />
          {#if meta.extends}
            <button
              class="a-button"
              aria-label="Remove alias"
              onclick={() => {
                if (tokenValue) {
                  updateMeta({ ...tokenValue, extends: undefined });
                  aliasSearchInput = "";
                  selectedAliasIndex = 0;
                  aliasPopoverElement?.hidePopover();
                }
              }}
            >
              <X size={20} />
            </button>
          {/if}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_interactive_supports_focus -->
          <div
            bind:this={aliasPopoverElement}
            class="a-popover alias-popover"
            popover="manual"
            role="menu"
          >
            {#each filteredAliasTokens as token, index (token.nodeId)}
              <button
                class="a-item"
                class:selected={index === selectedAliasIndex}
                role="menuitem"
                onclick={(e) => {
                  e.stopPropagation();
                  makeAlias(token.nodeId);
                  aliasSearchInput = "";
                  selectedAliasIndex = 0;
                  aliasPopoverElement?.hidePopover();
                }}
              >
                {token.path.join(" > ")}
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    {#if tokenValue?.type === "color"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Color</label>
        <div class="color-picker-wrapper">
          <color-input
            value={serializeColor(tokenValue.value)}
            disabled={meta?.nodeType === "token" && meta?.extends !== undefined}
            onopen={(event: InputEvent) => {
              // track both open and close because of bug in css-color-component
              const input = event.target as HTMLInputElement;
              updateMeta({ value: parseColor(input.value) });
            }}
            onclose={(event: InputEvent) => {
              const input = event.target as HTMLInputElement;
              updateMeta({ value: parseColor(input.value) });
            }}
          ></color-input>
          <span class="color-value">
            {serializeColor(tokenValue.value)}
          </span>
        </div>
      </div>
    {/if}

    {#if tokenValue?.type === "dimension"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Dimension</label>
        <div class="dimension-input-group">
          <input
            id="dimension-value-input"
            class="a-field dimension-value"
            type="number"
            value={tokenValue.value.value}
            disabled={meta?.nodeType === "token" && meta?.extends !== undefined}
            oninput={(e) => {
              const value = Number.parseFloat(e.currentTarget.value);
              if (!Number.isNaN(value)) {
                updateMeta({ value: { ...tokenValue.value, value } });
              }
            }}
            step="0.1"
            placeholder="Value"
          />
          <select
            id="dimension-unit-input"
            class="a-field dimension-unit-select"
            value={tokenValue.value.unit}
            disabled={meta?.nodeType === "token" && meta?.extends !== undefined}
            onchange={(e) => {
              updateMeta({
                value: {
                  ...tokenValue.value,
                  unit: e.currentTarget.value as "px" | "rem",
                },
              });
            }}
          >
            <option value="px">px</option>
            <option value="rem">rem</option>
          </select>
        </div>
      </div>
    {/if}

    {#if tokenValue?.type === "duration"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Duration</label>
        <div class="duration-input-group">
          <input
            id="duration-value-input"
            class="a-field duration-value"
            type="number"
            value={tokenValue.value.value}
            disabled={isAlias}
            oninput={(e) => {
              const value = Number.parseFloat(e.currentTarget.value);
              if (!Number.isNaN(value)) {
                updateMeta({ value: { ...tokenValue.value, value } });
              }
            }}
            step="1"
            placeholder="Value"
          />
          <select
            id="duration-unit-input"
            class="a-field duration-unit-select"
            value={tokenValue.value.unit}
            disabled={isAlias}
            onchange={(e) => {
              updateMeta({
                value: {
                  ...tokenValue.value,
                  unit: e.currentTarget.value as "ms" | "s",
                },
              });
            }}
          >
            <option value="ms">ms</option>
            <option value="s">s</option>
          </select>
        </div>
      </div>
    {/if}

    {#if tokenValue?.type === "number"}
      <div class="form-group">
        <label class="a-label" for="number-input">Value</label>
        <input
          id="number-input"
          class="a-field"
          type="number"
          value={tokenValue.value}
          disabled={isAlias}
          oninput={(e) => {
            const value = Number.parseFloat(e.currentTarget.value);
            if (!Number.isNaN(value)) {
              updateMeta({ value });
            }
          }}
          step="0.1"
        />
      </div>
    {/if}

    {#if tokenValue?.type === "fontFamily"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Font Family</label>
        {@render fontFamilyEditor(
          tokenValue.value,
          (value) => {
            updateMeta({ value });
          },
          isAlias,
        )}
      </div>
    {/if}

    {#if tokenValue?.type === "fontWeight"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Font Weight</label>
        {@render fontWeightEditor(
          tokenValue.value,
          (value) => {
            updateMeta({ value });
          },
          isAlias,
        )}
      </div>
    {/if}

    {#if tokenValue?.type === "cubicBezier"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Easing Function</label>
        <CubicBezierEditor
          value={tokenValue.value}
          disabled={isAlias}
          onChange={(value) => {
            updateMeta({ value });
          }}
        />
      </div>
    {/if}

    {#if tokenValue?.type === "transition"}
      <div class="transition-durations">
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Duration</label>
          <div class="dimension-input-group">
            <input
              class="a-field duration-value"
              type="number"
              value={tokenValue.value.duration.value}
              disabled={isAlias}
              step="1"
              placeholder="Value"
              oninput={(e) => {
                const val = Number.parseFloat(e.currentTarget.value);
                if (!Number.isNaN(val)) {
                  updateMeta({
                    value: {
                      ...tokenValue.value,
                      duration: {
                        ...tokenValue.value.duration,
                        value: val,
                      },
                    },
                  });
                }
              }}
            />
            <select
              class="a-field duration-unit-select"
              value={tokenValue.value.duration.unit}
              disabled={isAlias}
              onchange={(e) => {
                updateMeta({
                  value: {
                    ...tokenValue.value,
                    duration: {
                      ...tokenValue.value.duration,
                      unit: e.currentTarget.value as "ms" | "s",
                    },
                  },
                });
              }}
            >
              <option value="ms">ms</option>
              <option value="s">s</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Delay</label>
          <div class="dimension-input-group">
            <input
              class="a-field duration-value"
              type="number"
              value={tokenValue.value.delay.value}
              disabled={isAlias}
              step="1"
              placeholder="Value"
              oninput={(e) => {
                const val = Number.parseFloat(e.currentTarget.value);
                if (!Number.isNaN(val)) {
                  updateMeta({
                    value: {
                      ...tokenValue.value,
                      delay: {
                        ...tokenValue.value.delay,
                        value: val,
                      },
                    },
                  });
                }
              }}
            />
            <select
              class="a-field duration-unit-select"
              value={tokenValue.value.delay.unit}
              disabled={isAlias}
              onchange={(e) => {
                updateMeta({
                  value: {
                    ...tokenValue.value,
                    delay: {
                      ...tokenValue.value.delay,
                      unit: e.currentTarget.value as "ms" | "s",
                    },
                  },
                });
              }}
            >
              <option value="ms">ms</option>
              <option value="s">s</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Timing Function</label>
        <CubicBezierEditor
          value={tokenValue.value.timingFunction}
          disabled={isAlias}
          onChange={(value) => {
            updateMeta({
              value: { ...tokenValue.value, timingFunction: value },
            });
          }}
        />
      </div>
    {/if}

    {#if tokenValue?.type === "typography"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Font Family</label>
        {@render fontFamilyEditor(
          tokenValue.value.fontFamily,
          (fontFamily) => {
            updateMeta({
              value: { ...tokenValue.value, fontFamily },
            });
          },
          isAlias,
        )}
      </div>

      <div class="typography-aux">
        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Font Size</label>
          {@render dimensionEditor(
            tokenValue.value.fontSize,
            (fontSize) => {
              updateMeta({
                value: { ...tokenValue.value, fontSize },
              });
            },
            isAlias,
          )}
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Font Weight</label>
          {@render fontWeightEditor(
            tokenValue.value.fontWeight,
            (fontWeight) => {
              updateMeta({
                value: { ...tokenValue.value, fontWeight },
              });
            },
            isAlias,
          )}
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Line Height</label>
          <input
            class="a-field"
            type="number"
            value={tokenValue.value.lineHeight}
            disabled={isAlias}
            oninput={(e) => {
              const value = Number.parseFloat(e.currentTarget.value);
              if (!Number.isNaN(value)) {
                updateMeta({
                  value: { ...tokenValue.value, lineHeight: value },
                });
              }
            }}
            step="0.1"
            placeholder="e.g., 1.5"
          />
        </div>

        <div class="form-group">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="a-label">Letter Spacing</label>
          {@render dimensionEditor(
            tokenValue.value.letterSpacing,
            (letterSpacing) => {
              updateMeta({
                value: { ...tokenValue.value, letterSpacing },
              });
            },
            isAlias,
          )}
        </div>
      </div>
    {/if}

    {#if tokenValue?.type === "strokeStyle"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Style</label>
        {@render strokeStyleEditor(
          tokenValue.value,
          (value) => {
            updateMeta({ value });
          },
          isAlias,
        )}
      </div>
    {/if}

    {#if tokenValue?.type === "shadow"}
      {@const shadows = Array.isArray(tokenValue.value)
        ? tokenValue.value
        : [tokenValue.value]}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Shadow</label>
        <div class="shadow-list">
          {#each shadows as item, index (index)}
            <div class="shadow-item">
              <div class="shadow-item-header">
                <span class="shadow-item-title">Shadow {index + 1}</span>
                {#if shadows.length > 1}
                  <button
                    class="a-button"
                    aria-label="Remove shadow"
                    disabled={isAlias}
                    onclick={() => {
                      const updated = shadows.filter((_, i) => i !== index);
                      updateMeta({
                        value: updated.length === 1 ? updated[0] : updated,
                      });
                    }}
                  >
                    <X size={16} />
                  </button>
                {/if}
              </div>

              <div class="shadow-item-body">
                <div class="shadow-fields-grid">
                  <div class="form-group">
                    <label class="a-label">
                      <input
                        type="checkbox"
                        checked={item.inset ?? false}
                        disabled={isAlias}
                        onchange={(e) => {
                          const updated = [...shadows];
                          updated[index].inset =
                            e.currentTarget.checked || undefined;
                          updateMeta({
                            value: updated.length === 1 ? updated[0] : updated,
                          });
                        }}
                      />
                      Inset
                    </label>
                  </div>

                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label class="a-label">Color</label>
                    <div class="color-picker-wrapper">
                      <color-input
                        value={serializeColor(item.color)}
                        disabled={isAlias}
                        onopen={(event: InputEvent) => {
                          const input = event.target as HTMLInputElement;
                          const updated = [...shadows];
                          updated[index].color = parseColor(input.value);
                          updateMeta({
                            value: updated.length === 1 ? updated[0] : updated,
                          });
                        }}
                        onclose={(event: InputEvent) => {
                          const input = event.target as HTMLInputElement;
                          const updated = [...shadows];
                          updated[index].color = parseColor(input.value);
                          updateMeta({
                            value: updated.length === 1 ? updated[0] : updated,
                          });
                        }}
                      ></color-input>
                      <span class="color-value">
                        {serializeColor(item.color)}
                      </span>
                    </div>
                  </div>

                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label class="a-label">Offset X</label>
                    {@render dimensionEditor(
                      item.offsetX,
                      (offsetX) => {
                        const updated = [...shadows];
                        updated[index].offsetX = offsetX;
                        updateMeta({
                          value: updated.length === 1 ? updated[0] : updated,
                        });
                      },
                      isAlias,
                    )}
                  </div>

                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label class="a-label">Offset Y</label>
                    {@render dimensionEditor(
                      item.offsetY,
                      (offsetY) => {
                        const updated = [...shadows];
                        updated[index].offsetY = offsetY;
                        updateMeta({
                          value: updated.length === 1 ? updated[0] : updated,
                        });
                      },
                      isAlias,
                    )}
                  </div>

                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label class="a-label">Blur</label>
                    {@render dimensionEditor(
                      item.blur,
                      (blur) => {
                        const updated = [...shadows];
                        updated[index].blur = blur;
                        updateMeta({
                          value: updated.length === 1 ? updated[0] : updated,
                        });
                      },
                      isAlias,
                    )}
                  </div>

                  <div class="form-group">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label class="a-label">Spread</label>
                    {@render dimensionEditor(
                      item.spread ?? { value: 0, unit: "px" },
                      (spread) => {
                        const updated = [...shadows];
                        updated[index].spread = spread;
                        updateMeta({
                          value: updated.length === 1 ? updated[0] : updated,
                        });
                      },
                      isAlias,
                    )}
                  </div>
                </div>
              </div>
            </div>
          {/each}

          <button
            class="a-button"
            disabled={isAlias}
            onclick={() => {
              const newShadow: ShadowItem = {
                color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1 },
                offsetX: { value: 0, unit: "px" },
                offsetY: { value: 4, unit: "px" },
                blur: { value: 6, unit: "px" },
                spread: { value: 0, unit: "px" },
              };
              updateMeta({ value: [...shadows, newShadow] });
            }}
          >
            <Plus /> Add Shadow
          </button>
        </div>
      </div>
    {/if}

    {#if tokenValue?.type === "border"}
      {@const border = tokenValue.value}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Color</label>
        <div class="color-picker-wrapper">
          <color-input
            value={serializeColor(border.color)}
            disabled={isAlias}
            onopen={(event: InputEvent) => {
              const input = event.target as HTMLInputElement;
              updateMeta({
                value: { ...border, color: parseColor(input.value) },
              });
            }}
            onclose={(event: InputEvent) => {
              const input = event.target as HTMLInputElement;
              updateMeta({
                value: { ...border, color: parseColor(input.value) },
              });
            }}
          ></color-input>
          <span class="color-value">
            {serializeColor(border.color)}
          </span>
        </div>
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Width</label>
        {@render dimensionEditor(
          border.width,
          (width) => {
            updateMeta({
              value: { ...border, width },
            });
          },
          isAlias,
        )}
      </div>

      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Style</label>
        {@render strokeStyleEditor(
          border.style,
          (style) => {
            updateMeta({
              value: { ...border, style },
            });
          },
          isAlias,
        )}
      </div>
    {/if}

    {#if tokenValue?.type === "gradient"}
      <div class="form-group">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="a-label">Gradient</label>
        <GradientEditor
          value={tokenValue.value}
          disabled={isAlias}
          onChange={(value) => {
            updateMeta({ value });
          }}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .form-panel {
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    overflow: auto;
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .form-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .form-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-value {
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 4px;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .color-picker-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-value {
    font-family: var(--typography-monospace-code);
    font-size: 12px;
    color: var(--text-secondary);
    min-width: 50px;
    text-align: center;
  }

  .dimension-input-group {
    display: flex;
    gap: 8px;
  }

  .dimension-value {
    flex: 1;
  }

  .dimension-unit-select {
    field-sizing: content;
    min-width: 60px;
  }

  .duration-input-group {
    display: flex;
    gap: 8px;
  }

  .duration-value {
    flex: 1;
  }

  .duration-unit-select {
    field-sizing: content;
    min-width: 50px;
  }

  .shadow-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shadow-item {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .shadow-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .shadow-item-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .shadow-item-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shadow-fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .dash-array-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .dash-array-item {
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }

  .dash-array-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .dash-array-item-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .dash-array-item-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .typography-aux {
    display: grid;
    gap: 16px;
    grid-template-columns: 1fr 1fr;
  }

  .transition-durations {
    display: grid;
    gap: 16px;
    grid-template-columns: 1fr 1fr;
  }

  .combobox-container {
    position: relative;
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr max-content;
  }

  .a-item.selected {
    background: var(--bg-hover);
  }

  .alias-input {
    width: 100%;
    anchor-name: --editor-alias-input;
  }

  .alias-popover {
    position-anchor: --editor-alias-input;
    width: anchor-size(width);
  }
</style>
