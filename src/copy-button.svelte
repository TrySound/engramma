<script lang="ts">
  import { Check, Copy } from "@lucide/svelte";

  const { label, data }: { label: string; data: string } = $props();
  const id = $props.id();

  let copyFeedback = $state(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data);
      copyFeedback = true;
      setTimeout(() => {
        copyFeedback = false;
      }, 2000);
    } catch (error) {
      console.error("Failed to copy code", error);
    }
  };
</script>

<button class="a-button" interestfor="{id}-copy-tooltip" onclick={handleCopy}>
  {#if copyFeedback}
    <Check size={16} />
  {:else}
    <Copy size={16} />
  {/if}
</button>
<div id="{id}-copy-tooltip" popover="hint" class="a-tooltip">
  {copyFeedback ? "Copied" : label}
</div>
