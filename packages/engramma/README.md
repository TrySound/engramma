# Engramma Web Component

An embeddable web component for previewing and editing CSS variables as design tokens.
Perfect for developers building design systems who want an easy way to test and refine their variables.

## Installation

### From unpkg (simplest)

```html
<script
  type="module"
  src="https://unpkg.com/engramma@latest/dist/engramma.js"
></script>
```

### From npm

```bash
npm install engramma
```

Then import in your module:

```ts
import "engramma";
```

## Quick Integration

Add the web component to any HTML page using a dialog to avoid affecting your page layout:

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      :root {
        --color-primary: #3b82f6;
        --color-secondary: #10b981;
        --spacing-unit: 8px;
        --font-size-base: 16px;
      }
      body {
        color: var(--color-secondary);
        font-size: var(--font-size-base);
        display: grid;
        gap: var(--spacing-unit);
      }
      h1 {
        color: var(--color-primary);
      }
      #engramma-dialog:modal {
        top: 8px;
        right: 8px;
        bottom: auto;
        left: auto;
        width: 30dvw;
        height: calc(100dvh - 16px);
        padding: 0;
        border: 0;
        box-shadow: 0 0 10px rgb(0 0 0 / 30%);
      }
    </style>
  </head>
  <body>
    <h1>My App</h1>
    <p>Edit the CSS variables with Engramma</p>

    <script
      type="module"
      src="https://unpkg.com/engramma@latest/dist/engramma.js"
    ></script>

    <button commandfor="engramma-dialog" command="show-modal">
      Edit design tokens
    </button>

    <dialog id="engramma-dialog" closedby="any">
      <engramma-app></engramma-app>
    </dialog>
  </body>
</html>
```

## How CSS Variables Are Handled

When the component loads, it:

1. Looks for all CSS custom properties (`--variable-name`) in HTML element (or :root selector)
2. Detects types:
   - Colors (hex, rgb, hsl, named)
   - Dimensions (px, rem, em, etc.)
   - Font sizes, weights, families
   - Durations, bezier curves, and more
3. **Structures them** as design tokens following DTCG (Design Tokens Community Group) format
4. Whenever you change any token it is automatically converted to css custom properties and written back to :root

## Use Cases

- **Design System Preview**: Load your CSS variables and see them as organized design tokens
- **Variable Experimentation**: Tweak values in real-time while designing
- **Token Extraction**: Convert existing CSS variables into a structured design token system
- **Component Library Testing**: Test color schemes, spacing, and typography across components

For the standalone editor experience, visit [engramma.dev](https://app.engramma.dev).
