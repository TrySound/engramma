<script lang="ts">
  import Prism from "prismjs";
  import "prismjs/components/prism-json";
  import "prismjs/components/prism-css";
  import "prismjs/components/prism-css";
  import "prismjs/components/prism-scss";
  import type { HTMLAttributes } from "svelte/elements";
  import CopyButton from "./copy-button.svelte";

  interface Props extends HTMLAttributes<HTMLPreElement> {
    code: string;
    language: "json" | "css" | "scss";
  }

  let { code, language }: Props = $props();

  const highlightedCode = $derived(
    Prism.highlight(code, Prism.languages[language], language),
  );
</script>

<div class="code-container">
  <div class="copy-button">
    <CopyButton label="Copy" data={code} />
  </div>
  <pre><code class="language-{language}">{@html highlightedCode}</code></pre>
</div>

<style>
  .code-container {
    position: relative;
    overflow: hidden;
    display: grid;
    height: 100%;
  }

  .copy-button {
    position: absolute;
    top: 12px;
    right: 16px;
  }

  pre {
    height: 100%;
    margin: 0;
    padding: 16px;
    overflow: auto;
    font-family: var(--typography-monospace-code);
    font-size: 12px;
    line-height: 1.5;
    /* makes dense text slightly more readable */
    letter-spacing: 0.05em;
  }
</style>
