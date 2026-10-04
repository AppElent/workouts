import { getShippedFood } from '@workouts/core/nutrition';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
const unit = v.union(v.literal('g'), v.literal('ml'));
const serving = v.object({ id: v.id('supplementaryServings'), foodId: v.string(), name: v.string(), amount: v.number(), unit });
const input = { foodId: v.string(), name: v.string(), amount: v.number(), unit };
async function owner(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated');
  return identity.subject;
}
function present(row: Doc<'supplementaryServings'>) {
  return { id: row._id, foodId: row.foodId, name: row.name, amount: row.amount, unit: row.unit };
}
function validateDefinition(rawName: string, amount: number) {
  const name = rawName.trim();
  if (!name || name.length > 40) throw new Error('Name must contain between 1 and 40 characters.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) throw new Error('Amount must be greater than zero and at most 10000.');
  return { name, normalizedName: name.toLowerCase() };
}
export const list = query({
  args: { foodId: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(serving), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const userId = await owner(ctx);
    const result = await ctx.db.query('supplementaryServings').withIndex('by_userId_and_foodId', q => q.eq('userId', userId).eq('foodId', args.foodId)).paginate(args.paginationOpts);
    return { isDone: result.isDone, continueCursor: result.continueCursor, page: result.page.map(present) };
  },
});
export const create = mutation({
  args: input, returns: serving,
  handler: async (ctx, args) => {
    const userId = await owner(ctx);
    const food = getShippedFood(args.foodId);
    if (!food || food.baseUnit !== args.unit) throw new Error('Food or unit unavailable.');
    const { name, normalizedName } = validateDefinition(args.name, args.amount);
    const existing = await ctx.db.query('supplementaryServings').withIndex('by_userId_and_foodId_and_normalizedName', q => q.eq('userId', userId).eq('foodId', args.foodId).eq('normalizedName', normalizedName)).first();
    if (existing) throw new Error('A Serving with this name already exists.');
    const id = await ctx.db.insert('supplementaryServings', { ...args, name, normalizedName, userId });
    return { id, foodId: args.foodId, name, amount: args.amount, unit: args.unit };
  },
});
export const update = mutation({
  args: { id: v.id('supplementaryServings'), name: v.string(), amount: v.number() }, returns: serving,
  handler: async (ctx, args) => {
    const userId = await owner(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error('Serving not found.');
    const { name, normalizedName } = validateDefinition(args.name, args.amount);
    const existing = await ctx.db.query('supplementaryServings').withIndex('by_userId_and_foodId_and_normalizedName', q => q.eq('userId', userId).eq('foodId', row.foodId).eq('normalizedName', normalizedName)).first();
    if (existing && existing._id !== row._id) throw new Error('A Serving with this name already exists.');
    await ctx.db.patch(args.id, { name, normalizedName, amount: args.amount });
    return present({ ...row, name, amount: args.amount });
  },
});
export const remove = mutation({
  args: { id: v.id('supplementaryServings') }, returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await owner(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) throw new Error('Serving not found.');
    await ctx.db.delete(id);
    return null;
  },
});
