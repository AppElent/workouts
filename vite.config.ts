import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	server: {
		host: true,
		port: process.env.PORT ? Number(process.env.PORT) : 3000,
	},
	resolve: {
		tsconfigPaths: true,
		alias: {
			"@convex": path.resolve(import.meta.dirname, "convex"),
		},
	},
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		cloudflare({
			viteEnvironment: {
				name: "ssr",
			},
		}),
	],
});

export default config;
