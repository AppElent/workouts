import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { verifiedAppleUserIds } from "./lib/clerkUsers";

const http = httpRouter();

/**
 * Clerk's user events for the shared AppElent login. `user.deleted`, sent
 * when the login is deleted from any app or the Clerk dashboard, purges its
 * Foundry data. `user.created` and `user.updated` mirror its verified Apple
 * links (`appleSignInLinks`), which web Apple revocation binds codes to. The
 * request must carry a valid Svix signature for `CLERK_WEBHOOK_SECRET`;
 * anything else is refused before any work. Every other event type is
 * acknowledged and ignored.
 */
const clerkWebhook = httpAction(async (ctx, request) => {
	const secret = process.env.CLERK_WEBHOOK_SECRET;
	if (!secret) {
		console.error("clerk webhook: CLERK_WEBHOOK_SECRET is not set");
		// Clerk retries, so deliveries succeed once the secret is set.
		return new Response(null, { status: 503 });
	}
	const headers = {
		"svix-id": request.headers.get("svix-id") ?? "",
		"svix-timestamp": request.headers.get("svix-timestamp") ?? "",
		"svix-signature": request.headers.get("svix-signature") ?? "",
	};
	if (
		!headers["svix-id"] ||
		!headers["svix-timestamp"] ||
		!headers["svix-signature"]
	)
		return new Response(null, { status: 400 });
	const body = await request.text();
	try {
		new Webhook(secret).verify(body, headers);
	} catch {
		return new Response(null, { status: 401 });
	}
	const event = parseEvent(body);
	if (event?.type === "user.deleted" && event.userId)
		await ctx.runMutation(internal.account.purgeDeletedUser, {
			userId: event.userId,
		});
	if (
		(event?.type === "user.created" || event?.type === "user.updated") &&
		event.userId &&
		event.updatedAt !== null
	)
		await ctx.runMutation(internal.account.syncAppleLink, {
			userId: event.userId,
			appleUserIds: verifiedAppleUserIds(event.data),
			clerkUpdatedAt: event.updatedAt,
		});
	return new Response(null, { status: 200 });
});

/**
 * The event type and, for user events, the Clerk user (`data`), its id and
 * its `updated_at`.
 */
function parseEvent(body: string) {
	try {
		const event: unknown = JSON.parse(body);
		if (typeof event !== "object" || event === null) return null;
		const { type, data: raw } = event as { type?: unknown; data?: unknown };
		const data = (typeof raw === "object" && raw !== null ? raw : {}) as {
			id?: unknown;
			updated_at?: unknown;
			external_accounts?: unknown;
		};
		const { id, updated_at } = data;
		return {
			type: typeof type === "string" ? type : null,
			userId: typeof id === "string" && id.length > 0 ? id : null,
			updatedAt:
				typeof updated_at === "number" && Number.isFinite(updated_at)
					? updated_at
					: null,
			data,
		};
	} catch {
		return null;
	}
}

http.route({ path: "/clerk/webhook", method: "POST", handler: clerkWebhook });

export default http;
