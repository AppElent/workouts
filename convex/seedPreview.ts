import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/**
 * The preview deployment's one seed entry point. It loads catalogs only;
 * per-user demo data needs a real identity and is seeded on request.
 */
export const seedPreview = internalMutation({
	args: {},
	handler: async (ctx) => {
		await ctx.runMutation(internal.seed.seedWods, {});
		return { ok: true };
	},
});
