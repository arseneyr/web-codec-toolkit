import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  server: {
    watch: {
      ignored: ["!**/node_modules/libav.js/**"],
    },
  },
  resolve: {
    alias: [
      {
        find: /^\/(libav.*)$/,
        replacement: "/node_modules/libav.js/$1",
      },
    ],
    preserveSymlinks: true,
  },
  assetsInclude: ["**.wasm"],
  optimizeDeps: {
    exclude: ["libav.js"],
  },
});
