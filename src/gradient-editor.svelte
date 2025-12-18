<script lang="ts">
  import { Plus, X } from "@lucide/svelte";
  import { parseColor, serializeColor } from "./color";
  import type { GradientValue, RawGradientValue } from "./schema";
  import AliasToken from "./alias-token.svelte";

  interface Props {
    value: GradientValue;
    rawValue: RawGradientValue;
    onChange: (value: RawGradientValue) => void;
  }

  const { value, rawValue, onChange }: Props = $props();

  const handleAddStop = () => {
    // Add a new stop at the end with a slightly different color
    const newStop = {
      color: {
        colorSpace: "srgb" as const,
        components: [1, 1, 1],
        alpha: 1,
      },
      position: Math.min(1, value[value.length - 1]?.position ?? 0 + 0.5),
    };
    const updatedValue = [...value, newStop].sort(
      (a, b) => a.position - b.position,
    );
    onChange(updatedValue);
  };

  const handleRemoveStop = (index: number) => {
    if (value.length <= 2) return; // Prevent removing if only 2 stops
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateItem = (
    index: number,
    item: Partial<RawGradientValue[number]>,
  ) => {
    const newGradient = [...rawValue];
    newGradient[index] = { ...newGradient[index], ...item };
    // Re-sort by position
    newGradient.sort((a, b) => a.position - b.position);
    onChange(newGradient);
  };

  const handleStopPositionChange = (index: number, position: number) => {
    if (0 <= position && position <= 1) {
      updateItem(index, { position });
    }
  };

  const generateGradientPreview = (): string => {
    const stops = value
      .map(
        (stop) =>
          `${serializeColor(stop.color)} ${(stop.position * 100).toFixed(1)}%`,
      )
      .join(", ");
    return `linear-gradient(90deg, ${stops})`;
  };
</script>

<div class="gradient-editor">
  <div
    class="gradient-preview"
    style="background: {generateGradientPreview()}"
  ></div>

  <div class="gradient-stops-list">
    {#each value as stop, index (index)}
      {@const rawStop = rawValue[index]}
      <div class="gradient-stop-row">
        <div class="color-with-alias">
          <color-input
            value={serializeColor(stop.color)}
            onopen={(event: InputEvent) => {
              const input = event.target as HTMLInputElement;
              updateItem(index, { color: parseColor(input.value) });
            }}
            onclose={(event: InputEvent) => {
              const input = event.target as HTMLInputElement;
              updateItem(index, { color: parseColor(input.value) });
            }}
          ></color-input>
          <AliasToken
            type="color"
            value={rawStop.color}
            onChange={(color) => {
              updateItem(index, { color: color ?? stop.color });
            }}
          />
        </div>

        <div class="position-input-group">
          <input
            id="position-{index}"
            class="position-input"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={stop.position}
            oninput={(event) => {
              const value = Number.parseFloat(event.currentTarget.value);
              if (!Number.isNaN(value)) {
                handleStopPositionChange(index, value);
              }
            }}
          />
          <input
            class="a-field position-number"
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={(stop.position * 100).toFixed(1)}
            oninput={(event) => {
              const value = Number.parseFloat(event.currentTarget.value);
              if (!Number.isNaN(value)) {
                handleStopPositionChange(index, value / 100);
              }
            }}
          />
          <span class="position-percent">%</span>
        </div>

        {#if value.length > 2}
          <button
            class="a-button"
            aria-label="Remove stop"
            onclick={() => handleRemoveStop(index)}
          >
            <X size={16} />
          </button>
        {/if}
      </div>
    {/each}

    <button class="a-button" onclick={handleAddStop}>
      <Plus size={16} /> Add Stop
    </button>
  </div>
</div>

<style>
  .gradient-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gradient-preview {
    width: 100%;
    height: 60px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .gradient-stops-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .gradient-stop-row {
    display: grid;
    grid-template-columns: max-content 1fr auto;
    gap: 8px;
    align-items: center;
  }

  color-input {
    gap: 0;
  }

  color-input::part(input) {
    display: none;
  }

  .color-with-alias {
    display: grid;
    gap: 4px;
    grid-template-columns: max-content max-content;
  }

  .position-input-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .position-input {
    flex: 1;
    appearance: slider-horizontal;
    height: 6px;
    -webkit-appearance: slider-horizontal;
    padding: 0;
  }

  .position-number {
    width: 60px;
  }

  .position-percent {
    font-size: 14px;
    color: var(--text-secondary);
  }
</style>
