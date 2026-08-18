import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // USWDS ships Sass and resolves its own partials from these roots.
        loadPaths: ["node_modules/@uswds/uswds/packages"],
        quietDeps: true,
        silenceDeprecations: ["import", "global-builtin", "mixed-decls", "slash-div"],
      },
    },
  },
  server: {
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  build: { outDir: "dist" },
});
