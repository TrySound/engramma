<script lang="ts">
  import { treeState } from "./state.svelte";
  import { parseDesignTokens } from "./tokens";
  import { parseCssVariables } from "./css-variables";

  let dialogElement: undefined | HTMLDialogElement;
  let fileInputElement: undefined | HTMLInputElement;
  let dropzoneElement: undefined | HTMLElement;
  let inputMode: "upload" | "text" = "upload";
  let importType: "unknown" | "json" | "css" = "unknown";
  let importedContent = "";
  let importedResult: undefined | ReturnType<typeof parseDesignTokens>;
  let isDragOver = false;
  let isInputTouched = false;

  const validateImportedTokens = (content: string) => {
    importType = "unknown";
    importedResult = undefined;

    // Try JSON
    try {
      const result = parseDesignTokens(JSON.parse(content));
      if (result.nodes.length > 0 || result.errors.length > 0) {
        importType = "json";
        importedResult = result;
      }
    } catch {}

    // Try CSS
    try {
      const result = parseDesignTokens(parseCssVariables(content));
      if (result.nodes.length > 0 || result.errors.length > 0) {
        importType = "css";
        importedResult = result;
      }
    } catch {}
  };

  const handleImport = async () => {
    isInputTouched = true;

    if (importedResult && importedResult.errors.length > 0) {
      return;
    }

    // Update state
    const nodes = importedResult?.nodes ?? [];
    treeState.transact((tx) => {
      tx.clear();
      for (const node of nodes) {
        tx.set(node);
      }
    });

    // Close and reset
    dialogElement?.close();
  };

  const resetForm = () => {
    importedContent = "";
    importedResult = undefined;
    importType = "unknown";
    isDragOver = false;
    inputMode = "upload";
  };

  const handleTextareaInput = () => {
    isInputTouched = false;
    validateImportedTokens(importedContent);
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      importedContent = content;
      isInputTouched = true;
      validateImportedTokens(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    isDragOver = true;
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Only set to false if we're leaving the dropzone element entirely
    if (event.target === dropzoneElement) {
      isDragOver = false;
    }
  };

  const handleFileInputChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
      // Reset input so same file can be selected again
      input.value = "";
    }
  };
</script>

<dialog
  bind:this={dialogElement}
  id="new-project-dialog"
  closedby="any"
  ontoggle={resetForm}
>
  <h2>New Project</h2>

  <p>
    <button
      class="a-link"
      role="tab"
      aria-selected={inputMode === "upload"}
      aria-controls="new-project-upload-panel"
      onclick={() => (inputMode = "upload")}
    >
      Upload file
    </button>
    or
    <button
      class="a-link"
      role="tab"
      aria-selected={inputMode === "text"}
      aria-controls="new-project-text-panel"
      onclick={() => (inputMode = "text")}
    >
      paste as text
    </button>
    with JSON (DTCG) or CSS custom properties
  </p>

  <p>
    Format: <span>
      {#if importType === "json"}
        JSON (DTCG)
      {/if}
      {#if importType === "css"}
        CSS Variables
      {/if}
      {#if importType === "unknown"}
        Unknown
      {/if}
    </span>
  </p>

  {#if isInputTouched && importedResult && importedResult.errors.length > 0}
    <p class="error-message">
      {#each importedResult.errors as error, index}
        {#if index > 0}
          <br />
        {/if}
        {error.message} at ${error.path}
      {/each}
    </p>
  {/if}

  <div class="control-container">
    {#if inputMode === "upload"}
      <label
        bind:this={dropzoneElement}
        for="new-project-file"
        id="new-project-upload-panel"
        class="dropzone"
        role="region"
        aria-label="File dropzone"
        data-drag-over={isDragOver}
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragenter={handleDragEnter}
        ondragleave={handleDragLeave}
      >
        <div>
          <p class="dropzone-text">Upload your tokens file here</p>
          <p class="dropzone-subtext">Supports .json and .css files</p>
        </div>
      </label>
      <input
        bind:this={fileInputElement}
        id="new-project-file"
        class="file-input"
        aria-label="Select tokens file"
        type="file"
        accept=".json,.css"
        onchange={handleFileInputChange}
      />
    {/if}
    {#if inputMode === "text"}
      <textarea
        id="new-project-text-panel"
        class="a-field"
        placeholder="Paste your JSON tokens or CSS variables here..."
        bind:value={importedContent}
        oninput={handleTextareaInput}
        onblur={() => (isInputTouched = true)}
      ></textarea>
    {/if}
  </div>

  <div class="dialog-actions">
    <button class="a-button" onclick={handleImport}>Create</button>
    <button class="a-button" commandfor="new-project-dialog" command="close">
      Cancel
    </button>
  </div>
</dialog>

<style>
  dialog:modal {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 28px;
    width: 100%;
    max-width: 720px;
    box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);

    &::backdrop {
      background: rgba(0, 0, 0, 0.5);
    }
  }

  h2 {
    margin: 0 0 16px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .control-container {
    display: grid;
    height: 300px;
  }

  textarea {
    width: 100%;
    height: 100%;
    resize: none;
    max-height: none;
  }

  .dropzone {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid transparent;
    border-radius: 4px;
    background: var(--bg-secondary);
    transition: all 0.2s ease;
    text-align: center;

    &:hover {
      background-color: var(--bg-hover);
    }

    &[data-drag-over="true"] {
      outline: none;
      border-color: var(--accent);
      background: var(--bg-primary);
      box-shadow: 0 0 0 2px rgb(0 0 0 / 0.1);
    }
  }

  .dropzone-text {
    font-size: 16px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .dropzone-subtext {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .file-input {
    display: none;
  }

  .error-message {
    color: var(--error-color, #ff0000);
    font-size: 13px;
    padding: 8px;
    background: rgba(255, 0, 0, 0.1);
    border-radius: 4px;
    margin: 8px 0;
  }

  .dialog-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    justify-content: flex-end;
  }
</style>
