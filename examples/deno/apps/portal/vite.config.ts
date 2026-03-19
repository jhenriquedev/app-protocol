import { fromFileUrl } from "@std/path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fromFileUrl(new URL(".", import.meta.url)),
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: fromFileUrl(new URL("../../dist/portal", import.meta.url)),
    emptyOutDir: true,
  },
});
