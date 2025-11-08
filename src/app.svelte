<script lang="ts">
  interface TreeNode {
    id: string;
    name: string;
    children?: TreeNode[];
    value?: string;
    color?: string;
    expanded?: boolean;
  }

  const tokens: TreeNode[] = [
    {
      id: "colors",
      name: "Colors",
      expanded: true,
      children: [
        {
          id: "colors-primary",
          name: "Primary",
          value: "#3b82f6",
          color: "#3b82f6",
        },
        {
          id: "colors-error",
          name: "Error",
          value: "#ef4444",
          color: "#ef4444",
        },
        {
          id: "colors-success",
          name: "Success",
          value: "#10b981",
          color: "#10b981",
        },
      ],
    },
    {
      id: "typography",
      name: "Typography",
      expanded: true,
      children: [
        {
          id: "typography-size",
          name: "Font Size",
          value: "16px",
        },
        {
          id: "typography-height",
          name: "Line Height",
          value: "1.5",
        },
        {
          id: "typography-weight",
          name: "Font Weight",
          value: "500",
        },
      ],
    },
    {
      id: "spacing",
      name: "Spacing",
      expanded: true,
      children: [
        {
          id: "spacing-sm",
          name: "Small",
          value: "8px",
        },
        {
          id: "spacing-md",
          name: "Medium",
          value: "16px",
        },
        {
          id: "spacing-lg",
          name: "Large",
          value: "24px",
        },
      ],
    },
  ];

  let expandedNodes = new Set(tokens.map((t) => t.id));
  let selectedNodeId: string | null = null;

  function toggleNode(nodeId: string) {
    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
    } else {
      expandedNodes.add(nodeId);
    }
    expandedNodes = expandedNodes;
  }

  function selectNode(nodeId: string) {
    selectedNodeId = nodeId;
  }
</script>

<div class="container">
  <!-- Toolbar -->
  <header class="toolbar">
    <div class="toolbar-section">
      <button class="toolbar-btn" title="New project">
        <span class="icon">✚</span>
      </button>
      <button class="toolbar-btn" title="Open">
        <span class="icon">📁</span>
      </button>
      <button class="toolbar-btn" title="Save">
        <span class="icon">💾</span>
      </button>
    </div>

    <div class="toolbar-section">
      <button class="toolbar-btn" title="Export">
        <span class="icon">⬇</span>
      </button>
      <button class="toolbar-btn" title="Settings">
        <span class="icon">⚙</span>
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <div class="content">
    <!-- Left Panel: Design Tokens -->
    <aside class="panel left-panel">
      <div class="panel-header">
        <h2 class="panel-title">Design Tokens</h2>
        <button class="add-btn" title="Add token">+</button>
      </div>

      <div class="tokens-list">
        {#each tokens as node (node.id)}
          <div class="tree-node">
            <button
              class="tree-toggle"
              on:click={() => toggleNode(node.id)}
              title={expandedNodes.has(node.id) ? "Collapse" : "Expand"}
            >
              <span
                class="tree-chevron"
                class:rotated={expandedNodes.has(node.id)}
              >
                ▶
              </span>
            </button>
            <span class="tree-folder-icon">📁</span>
            <span class="tree-label">{node.name}</span>
          </div>

          {#if expandedNodes.has(node.id) && node.children}
            {#each node.children as child (child.id)}
              <div
                class="tree-item"
                class:selected={selectedNodeId === child.id}
                on:click={() => selectNode(child.id)}
              >
                <div class="tree-item-indent"></div>
                {#if child.color}
                  <div
                    class="token-preview"
                    style="background: {child.color};"
                  ></div>
                {/if}
                <span class="tree-item-name">{child.name}</span>
                <span class="tree-item-value">{child.value}</span>
              </div>
            {/each}
          {/if}
        {/each}
      </div>
    </aside>

    <!-- Right Panel: CSS Variables -->
    <main class="panel right-panel">
      <div class="panel-header">
        <h2 class="panel-title">CSS Variables</h2>
      </div>

      <textarea class="css-textarea"></textarea>
    </main>
  </div>
</div>
