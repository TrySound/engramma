<script lang="ts">
  import { Plus, X } from "@lucide/svelte";
  import { parseColor, serializeColor } from "./color";
  import type { GradientValue } from "./schema";

  interface Props {
    value: GradientValue;
    onChange: (value: GradientValue) => void;
    disabled?: boolean;
  }

  const { value, onChange, disabled = false }: Props = $props();

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

  const handleStopColorChange = (index: number, colorString: string) => {
    const updated = [...value];
    updated[index].color = parseColor(colorString);
    onChange(updated);
  };

  const handleStopPositionChange = (index: number, position: number) => {
    if (position < 0 || position > 1) return;
    const updated = [...value];
    updated[index].position = position;
    // Re-sort by position
    updated.sort((a, b) => a.position - b.position);
    onChange(updated);
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
      <div class="gradient-stop-row">
        <color-input
          value={serializeColor(stop.color)}
          {disabled}
          onopen={(event: InputEvent) => {
            const input = event.target as HTMLInputElement;
            handleStopColorChange(index, input.value);
          }}
          onclose={(event: InputEvent) => {
            const input = event.target as HTMLInputElement;
            handleStopColorChange(index, input.value);
          }}
        ></color-input>

        <div class="position-input-group">
          <input
            id="position-{index}"
            class="position-input"
            type="range"
            min="0"
            max="1"
            step="0.01"
            {disabled}
            value={stop.position}
            oninput={(e) => {
              const val = Number.parseFloat(e.currentTarget.value);
              if (!Number.isNaN(val)) {
                handleStopPositionChange(index, val);
              }
            }}
          />
          <input
            class="a-field position-number"
            type="number"
            min="0"
            max="1"
            step="0.01"
            {disabled}
            value={(stop.position * 100).toFixed(1)}
            oninput={(e) => {
              const val = Number.parseFloat(e.currentTarget.value);
              if (!Number.isNaN(val)) {
                handleStopPositionChange(index, val / 100);
              }
            }}
          />
          <span class="position-percent">%</span>
        </div>

        {#if value.length > 2}
          <button
            class="a-button remove-button"
            aria-label="Remove stop"
            {disabled}
            onclick={() => handleRemoveStop(index)}
          >
            <X size={20} />
          </button>
        {/if}
      </div>
    {/each}

    <button class="a-button" {disabled} onclick={handleAddStop}>
      <Plus size={20} /> Add Stop
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
    gap: 16px;
  }

  .gradient-stop-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 12px;
    align-items: center;
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
    min-width: 20px;
  }

  .remove-button {
    padding: 4px 8px;
  }
</style>
