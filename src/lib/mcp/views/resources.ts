import { VIEW_HTML, VIEW_PLACEHOLDER } from "virtual:foundry-mcp-views";
import {
	RESOURCE_MIME_TYPE,
	registerAppResource,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_SCOPES } from "../auth";
import type { ToolContext } from "../tools/define";
import { VIEW_NAMES, type ViewName, viewUri } from "./types";

const VIEWS: Record<ViewName, { title: string; description: string }> = {
	"week-overview": {
		title: "Week overview",
		description: "Training and nutrition for one Monday-to-Sunday week.",
	},
	"food-log": {
		title: "Review food log",
		description: "Proposed diary entries to adjust and log.",
	},
	"exercise-progress": {
		title: "Exercise progress",
		description: "Strength progress, weekly volume, and 1RMs for one Exercise.",
	},
};

export function viewHtml(view: ViewName) {
	return VIEW_HTML.replace(VIEW_PLACEHOLDER, view);
}

/**
 * The sandbox origin Claude serves this endpoint's views from: the first 32
 * hex characters of SHA-256(endpoint URL) under claudemcpcontent.com.
 */
export async function claudeViewDomain(endpointUrl: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(endpointUrl),
	);
	const hex = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return `${hex.slice(0, 32)}.claudemcpcontent.com`;
}

/** Views exist for any token that may read; they render read tools only. */
export function registerViewResources(server: McpServer, context: ToolContext) {
	if (!context.access.scopes.has(MCP_SCOPES.read)) return;
	for (const view of VIEW_NAMES) {
		const uri = viewUri(view);
		const { title, description } = VIEWS[view];
		registerAppResource(
			server,
			title,
			uri,
			{ description, mimeType: RESOURCE_MIME_TYPE },
			async () => ({
				contents: [
					{
						uri,
						mimeType: RESOURCE_MIME_TYPE,
						text: viewHtml(view),
						_meta: {
							ui: {
								domain: await claudeViewDomain(context.endpointUrl),
								prefersBorder: true,
							},
						},
					},
				],
			}),
		);
	}
}
