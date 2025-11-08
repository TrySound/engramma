<script lang="ts">
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
        <div class="token-group">
          <div class="token-group-header">Colors</div>
          <div class="token-item">
            <div class="token-preview" style="background: #3b82f6;"></div>
            <span class="token-name">Primary</span>
            <span class="token-value">#3b82f6</span>
          </div>
          <div class="token-item">
            <div class="token-preview" style="background: #ef4444;"></div>
            <span class="token-name">Error</span>
            <span class="token-value">#ef4444</span>
          </div>
          <div class="token-item">
            <div class="token-preview" style="background: #10b981;"></div>
            <span class="token-name">Success</span>
            <span class="token-value">#10b981</span>
          </div>
        </div>

        <div class="token-group">
          <div class="token-group-header">Typography</div>
          <div class="token-item">
            <span class="token-name">Font Size</span>
            <span class="token-value">16px</span>
          </div>
          <div class="token-item">
            <span class="token-name">Line Height</span>
            <span class="token-value">1.5</span>
          </div>
          <div class="token-item">
            <span class="token-name">Font Weight</span>
            <span class="token-value">500</span>
          </div>
        </div>

        <div class="token-group">
          <div class="token-group-header">Spacing</div>
          <div class="token-item">
            <span class="token-name">Small</span>
            <span class="token-value">8px</span>
          </div>
          <div class="token-item">
            <span class="token-name">Medium</span>
            <span class="token-value">16px</span>
          </div>
          <div class="token-item">
            <span class="token-name">Large</span>
            <span class="token-value">24px</span>
          </div>
        </div>
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
