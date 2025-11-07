import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  build: {
    // auto prefixing height: stretch breaks the app
    cssMinify: false,
  },
});
