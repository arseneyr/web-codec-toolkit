import { defineConfig } from "vite";

export default defineConfig({
	resolve: {
		alias: [
			{ find: /^\/(libav.*)$/, replacement: "/../node_modules/libav.js/$1" },
		],
		preserveSymlinks: true,
	},
	assetsInclude: ["**.wasm"],
});
