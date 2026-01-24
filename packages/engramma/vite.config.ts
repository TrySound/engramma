import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        css: "injected",
      },
    }),
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  build: {
    // auto prefixing height: stretch breaks the app
    cssMinify: false,
    lib: {
      entry: "src/engramma-app.ts",
      formats: ["es"],
    },
  },
});
