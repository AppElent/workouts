import { defineTool } from "./define";

export const accountTools = [
	defineTool({
		name: "get_current_user",
		title: "Get current user",
		description:
			"Return who this connection acts for (Foundry user ID, name, email), the access it was granted, and the server's current time. Call it to resolve 'today' before date-based tools.",
		access: "read",
		input: {},
		async run(_, { access, userInfo, now }) {
			const info = await userInfo().catch(() => undefined);
			const name =
				typeof info?.name === "string"
					? info.name
					: [info?.given_name, info?.family_name]
							.filter((part) => typeof part === "string" && part)
							.join(" ") || undefined;
			return {
				userId: access.userId,
				name,
				email: typeof info?.email === "string" ? info.email : undefined,
				scopes: [...access.scopes].sort(),
				serverTime: now().toISOString(),
			};
		},
	}),
];
