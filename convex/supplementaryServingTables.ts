import { defineTable } from 'convex/server';
import { v } from 'convex/values';
export const supplementaryServingTables = {
  supplementaryServings: defineTable({
    userId: v.string(), foodId: v.string(), name: v.string(), normalizedName: v.string(),
    amount: v.number(), unit: v.union(v.literal('g'), v.literal('ml')),
  }).index('by_userId_and_foodId', ['userId', 'foodId'])
    .index('by_userId_and_foodId_and_normalizedName', ['userId', 'foodId', 'normalizedName']),
};
