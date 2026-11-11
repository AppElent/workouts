import { v } from "convex/values";
import { ENV_CONFIG } from "../env.manifest";
import { mutation, query } from "./_generated/server";
import { getOptionalUserId, requireSubject } from "./lib/auth";
import { rejectConnectedApps } from "./lib/connectedApps";
import { appError } from "./lib/errors";
import {
	personalDataBlocker,
	personalDataBlockerValidator,
} from "./lib/personalData";
import { resetTestData, testDataMode } from "./lib/testDataBaseline";

function enabled() {
	const production = ENV_CONFIG.convex.deployments.production;
	const cloudUrl = process.env.CONVEX_CLOUD_URL;
	const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
	if (!cloudUrl || !issuer || !production) return false;
	// A malformed URL is a broken deployment and throws rather than hiding it.
	return (
		new URL(cloudUrl).hostname.split(".")[0] !== production &&
		new URL(issuer).hostname.endsWith(".clerk.accounts.dev")
	);
}

export const availability = query({
	args: {},
	returns: v.object({
		available: v.boolean(),
		blocker: personalDataBlockerValidator,
	}),
	handler: async (ctx) => {
		const userId = await getOptionalUserId(ctx);
		const available = !!userId && enabled();
		return {
			available,
			blocker:
				available && userId ? await personalDataBlocker(ctx, userId) : null,
		};
	},
});

export const reset = mutation({
	args: {
		mode: testDataMode,
		expectedSubject: v.string(),
		today: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await rejectConnectedApps(ctx);
		const userId = await requireSubject(ctx, args.expectedSubject);
		if (!enabled()) throw appError("unavailable");
		const reason = await personalDataBlocker(ctx, userId);
		if (reason) throw appError(reason);
		await resetTestData(ctx, userId, args.mode, args.today);
		return null;
	},
});
