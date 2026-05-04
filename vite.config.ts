import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@convex": path.resolve(import.meta.dirname, "convex"),
		},
	},
	plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact(), cloudflare({
        viteEnvironment: {
            name: "ssr"
        }
    })],
});

export default config;