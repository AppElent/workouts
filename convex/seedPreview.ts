import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'

export const PREVIEW_DEMO_USER_ID = 'preview_demo_user'

export const seedPreview = internalMutation({
	args: {},
	handler: async (ctx) => {
		await ctx.runMutation(internal.seed.seedExercises, {})
		await ctx.runMutation(internal.seed.seedTestData, { userId: PREVIEW_DEMO_USER_ID })
		return { ok: true, demoUserId: PREVIEW_DEMO_USER_ID }
	},
})
